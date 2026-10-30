param([Parameter(Mandatory=$true)][string]$Executable)
$ErrorActionPreference = 'Stop'
$file = [System.Diagnostics.FileVersionInfo]::GetVersionInfo((Resolve-Path -LiteralPath $Executable).Path)
Write-Output ($file.ProductName + ' ' + ($file.ProductVersion -replace '[^0-9.].*$', ''))
