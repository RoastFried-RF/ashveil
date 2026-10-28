import { appendFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { newGame, runUntilInput } from '../src/core/game'
import type { World } from '../src/core/ctx'
import { attachQuickJSScripts } from '../src/scripting/attach'
import { loadDb } from './loadContent'
import { runExpedition, validateExpeditionRange } from './expedition-run'

const [output, first, count, limit] = process.argv.slice(2), from = Number(first), runs = Number(count), days = Number(limit)
validateExpeditionRange(from, runs, days)
const root = fileURLToPath(new URL('../', import.meta.url)), out = resolve(output), rowsFile = join(out, `worker-${from}.ndjson`)
writeFileSync(rowsFile, '', { flag: 'wx' })
const { db, report } = loadDb([], root)
if (report.errors.length) throw Error(report.errors.join('\n'))
await attachQuickJSScripts(db)
for (let index = from; index < from + runs; index++) {
  const seed = `sim-${index}`
  let w: World | undefined
  try {
    w = { db, s: newGame(db, { seed, overworld: false }) }
    runUntilInput(w)
    appendFileSync(rowsFile, JSON.stringify(runExpedition(w, index, days)) + '\n')
    console.log(JSON.stringify({ from, completed: index - from + 1, seed }))
  } catch (error) {
    writeFileSync(join(out, `failure-${seed}.json`), JSON.stringify({ seed, error: String(error), world: w?.s }), { flag: 'wx' })
    throw error
  }
}
