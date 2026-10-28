// 시드마다 독립인 기존 sim을 여러 프로세스로 실행하고 원래의 정밀도로 합친다.
// pnpm exec tsx tools/sim-batch.ts [판 수=30] [최대 일수=3] [출력 디렉터리=test-results/sim]
import { spawn } from 'node:child_process'
import { cpus } from 'node:os'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const runs = Number(process.argv[2] ?? 30), days = Number(process.argv[3] ?? 3), dir = process.argv[4] ?? 'test-results/sim'
if (!Number.isInteger(runs) || runs < 1 || !Number.isFinite(days) || days <= 0) throw new Error('판 수와 일수는 양수여야 한다')
mkdirSync(dir, { recursive: true })
const overworld = process.argv.includes('--world')
const keepStates=process.argv.includes('--states')
const workers = Math.min(4, cpus().length, runs), t0 = performance.now()
interface Row { seed: string; cause: string; days: number; level: number; map: string; background?: string }
let start = 0
const groups = Array.from({ length: workers }, (_, i) => {
  const count = Math.floor(runs / workers) + (i < runs % workers ? 1 : 0), from = start
  start += count
  return { count, from, file: join(dir, `batch-${i}.json`) }
})
await Promise.all(groups.map((g) => new Promise<void>((resolve, reject) => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'tools/sim.ts', String(g.count), String(days), String(g.from), '--json', g.file, ...(overworld ? ['--world'] : []),...(keepStates?['--state-dir',join(dir,'states')]:[])], { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = '', errors = ''
  child.stdout.on('data', (b) => { output += String(b) })
  child.stderr.on('data', (b) => { errors += String(b) })
  child.on('error', reject)
  child.on('exit', (code) => {
    writeFileSync(join(dir, `batch-${g.from}.log`), output + errors)
    if (code !== 0) reject(new Error(`시드 ${g.from}부터 실행 실패 (${code}): ${errors}`))
    else { console.log(`시드 ${g.from}~${g.from + g.count - 1} 완료`); resolve() }
  })
})))
const rows = groups.flatMap((g) => (JSON.parse(readFileSync(g.file, 'utf8')) as { rows: Row[] }).rows).sort((a, b) => Number(a.seed.slice(4)) - Number(b.seed.slice(4)))
if (rows.length !== runs || rows.some((r, i) => r.seed !== `sim-${i}`)) throw new Error('시드 결과 누락·중복')
if (rows.some((r) => r.days > days + 1 / (28800 * 100))) throw new Error('측정 종료 시각 초과')
const causes: Record<string, number> = {}
for (const r of rows) causes[r.cause] = (causes[r.cause] ?? 0) + 1
const averageDays = rows.reduce((s, r) => s + r.days, 0) / runs
const result = { overworld, runs, maxDays: days, workers, seconds: (performance.now() - t0) / 1000, averageDays, causes, rows }
writeFileSync(join(dir, 'summary.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ ...result, rows: undefined }, null, 2))
