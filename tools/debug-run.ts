// 디버그: 한 시드를 봇으로 돌려 마지막 로그를 본다. npx tsx tools/debug-run.ts [seed]
import { botDecide } from '../src/core/bot'
import { player, turnOf, fmtClock, type World } from '../src/core/ctx'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { loadDb } from './loadContent'

const { db } = loadDb()
const s = newGame(db, { seed: process.argv[2] ?? 'sim-1' })
const w: World = { db, s }
runUntilInput(w)
let g = 0
while (!s.over && g++ < 20000) {
  const a = botDecide(w)
  const err = playerAct(w, a)
  if (err) playerAct(w, { type: 'wait' })
}
const pl = player(w)
console.log(s.map.id, 'lv', pl.level, 'hp', pl.hp, fmtClock(turnOf(w)), s.over?.report.cause, pl.killedBy)
for (const l of s.log.slice(-40)) console.log(fmtClock(l.turn), l.kind, l.text, process.env.DETAIL ? JSON.stringify(l.detail ?? []) : "")
