[CmdletBinding(PositionalBinding=$false)]
param(
    [Parameter(Position=0)][ValidateSet('setup','doctor','authoring','release','dev','pnpm')][string]$Action = 'doctor',
    [string]$NodePath,
    [string]$BrowserPath,
    [string]$GnuTarPath,
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$CommandArgs
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$local = Join-Path $root '.local-tools'
$configPath = Join-Path $local 'runtime.json'
$config = if (Test-Path -LiteralPath $configPath) { Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } else { $null }
if (!$NodePath -and $config) { $NodePath = $config.node }
if (!$NodePath) {
    $candidates = @((Get-Command node.exe -ErrorAction SilentlyContinue).Source,
        (Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'))
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate) -and ((& $candidate --version) -match '^v24\.')) { $NodePath = $candidate; break }
    }
}
if (!$NodePath -or !((Test-Path -LiteralPath $NodePath) -and ((& $NodePath --version) -match '^v24\.'))) {
    throw 'An installed Node 24 is required. Supply -NodePath C:\path\to\node.exe. Global Node settings are never changed.'
}
$NodePath = (Resolve-Path -LiteralPath $NodePath).Path
if (!$BrowserPath -and $config) { $BrowserPath = $config.chromium }
if (!$BrowserPath) {
    foreach ($candidate in @((Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft/Edge/Application/msedge.exe'))) {
        if (Test-Path -LiteralPath $candidate) { $BrowserPath = $candidate; break }
    }
}
if (!$BrowserPath -or !(Test-Path -LiteralPath $BrowserPath)) { throw 'Supply -BrowserPath pointing to an installed Chromium browser.' }
if (!$GnuTarPath -and $config) { $GnuTarPath = $config.gnuTar }
if (!$GnuTarPath) {
    $gitExe = (Get-Command git.exe -ErrorAction Stop).Source
    $gitParent = Split-Path -Parent $gitExe
    foreach ($candidate in @((Join-Path $gitParent '../usr/bin/tar.exe'),(Join-Path $gitParent '../../usr/bin/tar.exe'))) {
        if (Test-Path -LiteralPath $candidate) { $GnuTarPath = (Resolve-Path -LiteralPath $candidate).Path; break }
    }
}
if (!$GnuTarPath -or !(Test-Path -LiteralPath $GnuTarPath) -or !((& $GnuTarPath --version | Select-Object -First 1) -match '^tar \(GNU tar\)')) {
    throw 'Installed GNU tar is required for the existing deterministic mod package contract. Supply -GnuTarPath or use the tar bundled with Git for Windows.'
}
$pnpmCli = Join-Path $local 'node_modules/pnpm/bin/pnpm.cjs'
$python = Join-Path $local 'python/Scripts/python.exe'
$previousPath, $previousBrowser, $previousUtf8, $previousPython = $env:PATH, $env:CHROMIUM_PATH, $env:PYTHONUTF8, $env:ASHVEIL_PYTHON
$previousLocation = Get-Location
function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Executable $($Arguments -join ' ')" }
}
try {
    $env:PATH = (Split-Path -Parent $NodePath) + [IO.Path]::PathSeparator + (Split-Path -Parent $GnuTarPath) + [IO.Path]::PathSeparator + $env:PATH
    $env:CHROMIUM_PATH = $BrowserPath
    $env:PYTHONUTF8 = '1'
    $env:ASHVEIL_PYTHON = $python
    Set-Location -LiteralPath $root
    if ($Action -eq 'setup') {
        New-Item -ItemType Directory -Path $local -Force | Out-Null
        $npmCmd = (Get-Command npm.cmd -ErrorAction Stop).Source
        $npmCli = Join-Path (Split-Path -Parent $npmCmd) 'node_modules/npm/bin/npm-cli.js'
        if (!(Test-Path -LiteralPath $pnpmCli) -or ((& $NodePath $pnpmCli --version) -ne '9.15.9')) {
            Invoke-Checked $NodePath @($npmCli,'install','--prefix',$local,'--ignore-scripts','--no-audit','--no-fund','pnpm@9.15.9')
        }
        Invoke-Checked $NodePath @($pnpmCli,'install','--frozen-lockfile')
        if (!(Test-Path -LiteralPath $python)) { Invoke-Checked (Get-Command python.exe -ErrorAction Stop).Source @('-m','venv',(Join-Path $local 'python')) }
        Invoke-Checked $python @('-m','pip','install','--disable-pip-version-check','-r','tools/requirements-schema.txt')
        @{node=$NodePath;chromium=$BrowserPath;gnuTar=$GnuTarPath} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8
    }
    if (!(Test-Path -LiteralPath $pnpmCli) -or !(Test-Path -LiteralPath $python)) { throw 'Run tools/windows/ashveil.ps1 setup first.' }
    switch ($Action) {
        { $_ -in 'setup','doctor' } {
            Invoke-Checked $python @('tools/cloud-harness/environment.py','--root',$root,'--pnpm',$pnpmCli,'--chromium',$BrowserPath)
        }
        { $_ -in 'authoring','release' } {
            $prefix = Join-Path $root ('test-results/windows/' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
            $schemaArgs = if ($Action -eq 'release') { @('--schema') } else { @() }
            Invoke-Checked $python (@('tools/cloud-harness/plan.py','--root',$root,'--pnpm',$pnpmCli,'--chromium',$BrowserPath,'--profile',$Action,'--out',($prefix+'-plan.json')) + $schemaArgs + $CommandArgs)
            Invoke-Checked $python @('tools/cloud-harness/run.py',($prefix+'-plan.json'),'--out',$prefix,'--check')
            Invoke-Checked $python @('tools/cloud-harness/run.py',($prefix+'-plan.json'),'--out',$prefix)
        }
        'dev' { Invoke-Checked $NodePath (@($pnpmCli,'dev','--host','127.0.0.1') + $CommandArgs) }
        'pnpm' { Invoke-Checked $NodePath (@($pnpmCli) + $CommandArgs) }
    }
} finally {
    Set-Location -LiteralPath $previousLocation
    $env:PATH, $env:CHROMIUM_PATH, $env:PYTHONUTF8, $env:ASHVEIL_PYTHON = $previousPath, $previousBrowser, $previousUtf8, $previousPython
}
