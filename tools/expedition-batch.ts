// Full/World/GPU 검사와 겹치지 않게 불변 체크포인트에서 실행한다.
// node --import tsx tools/expedition-batch.ts <새 출력 디렉터리> [판 수=1000] [최대 일수=3] [시드 시작=0]
import { spawn, type ChildProcess } from 'node:child_process'
import { cpus } from 'node:os'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, lstatSync, readdirSync } from 'node:fs'
import { resolve, join, isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256, summarizeExpeditions, validateExpeditionRange, type ExpeditionRow } from './expedition-run'

const [output, count = '1000', limit = '3', start = '0'] = process.argv.slice(2)
const root = resolve(fileURLToPath(new URL('../', import.meta.url))), runs = Number(count), days = Number(limit), from = Number(start)
if (!output || process.argv.length > 6) throw Error('새 출력 디렉터리와 선택적인 판 수/최대 일수/시드 시작만 지정한다')
validateExpeditionRange(from, runs, days)
const out = resolve(output), workers = Math.min(4, cpus().length, runs), manifestPath = root + '-manifest.json'
if (existsSync(out)) throw Error('기존 원정 기록을 덮어쓰지 않는다: ' + out)
const inside = relative(root, out)
if (!inside || !inside.startsWith('..') && !isAbsolute(inside) && !inside.startsWith('test-results/')) throw Error('검증본의 원본 경로에 보고서를 쓰지 않는다')
if (!existsSync(manifestPath)) throw Error('game:freeze로 고정한 체크포인트에서 실행해야 한다')
const manifestRaw = readFileSync(manifestPath), manifest = JSON.parse(manifestRaw.toString()) as Record<string, string>
function checkSource() {
  if (sha256(readFileSync(manifestPath)) !== sha256(manifestRaw)) throw Error('원정 도중 불변 명세가 바뀌었다')
  const checkAddedFiles = (directory: string) => {
    for (const name of readdirSync(join(root, directory))) {
      const path = join(directory, name), stat = lstatSync(join(root, path))
      if (stat.isSymbolicLink()) throw Error('불변 원본 안의 심볼릭 링크: ' + path)
      if (stat.isDirectory()) checkAddedFiles(path)
      else if (!manifest[path]) throw Error('불변 명세에 없는 실행/콘텐츠 원본: ' + path)
    }
  }
  for (const directory of ['src', 'tools', 'mods']) checkAddedFiles(directory)
  for (const [name, hash] of Object.entries(manifest)) {
    const path = resolve(root, name), rel = relative(root, path)
    if (isAbsolute(name) || !rel || rel.startsWith('..') || isAbsolute(rel) || lstatSync(path).isSymbolicLink() || sha256(readFileSync(path)) !== hash) throw Error('불변 원본 불일치: ' + name)
  }
  for (const name of ['tools/expedition-batch.ts', 'tools/expedition-worker.ts', 'tools/expedition-run.ts']) if (!manifest[name]) throw Error('측정 도구가 불변 명세에 없다: ' + name)
}
checkSource(); mkdirSync(out, { recursive: true })
const began = performance.now(), config = {
  source: root, runs, days, from, workers, overworld: false, sourceManifestSha256: sha256(manifestRaw),
  seedPattern: `sim-${from} through sim-${from + runs - 1}`,
  limits: '자연 newGame과 기존 botDecide/playerAct만 사용한다. 초기 fixture·몸/시각/난수 주입 없음. 매 실제 결정 뒤 최대 도달 층을 관찰한다. World30·독립 전체 기대 세계·UI·사람 플레이 검증을 대체하지 않는다.',
}
writeFileSync(join(out, 'config.json'), JSON.stringify(config, null, 2), { flag: 'wx' })
let offset = from
const groups = Array.from({ length: workers }, (_, i) => {
  const count = Math.floor(runs / workers) + (i < runs % workers ? 1 : 0), first = offset
  offset += count; return { from: first, count }
})
const children = new Set<ChildProcess>(), stop = () => { for (const child of children) child.kill('SIGTERM') }
process.once('SIGINT', stop); process.once('SIGTERM', stop)
const tasks = groups.map(group => new Promise<void>((done, fail) => {
  const log = join(out, `worker-${group.from}.log`)
  writeFileSync(log, '', { flag: 'wx' })
  const child = spawn(process.execPath, ['--import', 'tsx', join(root, 'tools/expedition-worker.ts'), out, String(group.from), String(group.count), String(days)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  children.add(child)
  child.stdout!.on('data', chunk => { appendFileSync(log, chunk); process.stdout.write(chunk) })
  child.stderr!.on('data', chunk => appendFileSync(log, chunk))
  child.once('error', error => { children.delete(child); stop(); fail(error) })
  child.once('close', code => {
    children.delete(child)
    if (code !== 0) { stop(); fail(Error(`원정 작업자 ${group.from} 실패 (${code}). 원문과 완료된 행은 ${log}에 보존했다`)) }
    else done()
  })
}))
const results = await Promise.allSettled(tasks)
process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop)
const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
if (failures.length) {
  writeFileSync(join(out, 'incomplete.json'), JSON.stringify({ ...config, failures: failures.map(r => String(r.reason)) }, null, 2), { flag: 'wx' })
  throw Error('일부 원정이 실패했다. 성공 집계는 만들지 않는다', { cause: failures[0].reason })
}
checkSource()
const rows = groups.flatMap(group => readFileSync(join(out, `worker-${group.from}.ndjson`), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as ExpeditionRow))
const result = { ...config, seconds: (performance.now() - began) / 1000, ...summarizeExpeditions(rows, from, runs, days) }
writeFileSync(join(out, 'summary.json'), JSON.stringify(result, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ ...result, rows: undefined }))
