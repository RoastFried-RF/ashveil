// 실행 성능 측정. 규칙 코어 밖에서만 실제 시계를 읽는다.
import { cpus } from 'node:os'
import { botDecide } from '../src/core/bot'
import { player } from '../src/core/ctx'
import { changeMap, newGame, playerAct } from '../src/core/game'
import { serialize } from '../src/core/save'
import { loadDb } from './loadContent'

const { db, report } = loadDb()
if (report.errors.length) throw new Error(report.errors.join('\n'))
const measure = <T>(f: () => T): [T, number] => { const t = performance.now(); const result = f(); return [result, performance.now() - t] }
const summary = (a: number[]) => {
  const sorted = [...a].sort((x, y) => x - y), at = (q: number) => Number(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))].toFixed(3))
  return { count: a.length, medianMs: at(0.5), p95Ms: at(0.95), maxMs: at(1) }
}
const starts: number[] = [], maps: number[] = [], actions: number[] = [], saves: number[] = [], sizes: number[] = []
let failures = 0, dead = 0
for (let i = 0; i < 12; i++) {
  const [s, ms] = measure(() => newGame(db, { seed: `bench-${i}` })); starts.push(ms)
  const w = { db, s }
  const [, generation] = measure(() => changeMap(w, 'crypt1')); maps.push(generation)
  for (let k = 0; k < 250 && !s.over; k++) {
    const [error, elapsed] = measure(() => playerAct(w, botDecide(w)))
    actions.push(elapsed)
    if (error) { failures++; playerAct(w, { type: 'wait' }) }
  }
  if (!player(w).alive) dead++
  const [data, saving] = measure(() => serialize(s)); saves.push(saving); sizes.push(Buffer.byteLength(data))
}
console.log(JSON.stringify({ runtime: process.version, logicalCpus: cpus().length, scenarios: 12, starts: summary(starts), dungeonGeneration: summary(maps), botDecisionAndAction: summary(actions), serialization: summary(saves), maxSaveBytes: Math.max(...sizes), rejectedActions: failures, deaths: dead }, null, 2))
