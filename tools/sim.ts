// 헤드리스 시뮬레이션: pnpm sim [판 수=20] [최대 일수=3]
// 봇으로 여러 시드를 돌려 사망 원인 분포·생존 일수를 집계한다.

import { botDecide } from '../src/core/bot'
import { player, turnOf, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { loadDb } from './loadContent'

const runs = Number(process.argv[2] ?? 20)
const maxDays = Number(process.argv[3] ?? 3)
const { db, report } = loadDb()
if (report.errors.length) { console.error(report.errors); process.exit(1) }

const causes: Record<string, number> = {}
const days: number[] = []
let escapes = 0
const t0 = Date.now()
for (let i = 0; i < runs; i++) {
  const seed = `sim-${i}`
  const s = newGame(db, { seed })
  const w: World = { db, s }
  runUntilInput(w)
  let guard = 0
  while (!s.over && turnOf(w) < TURNS_PER_DAY * maxDays + 8 * 1200 && guard++ < 150000) {
    const err = playerAct(w, botDecide(w))
    if (err) playerAct(w, { type: 'wait' })
  }
  const pl = player(w)
  const key = s.over ? (s.over.kind === 'escape' ? '탈출' : s.over.report.cause) : '생존(시간 종료)'
  if (s.over?.kind === 'escape') escapes++
  causes[key] = (causes[key] ?? 0) + 1
  const d = turnOf(w) / TURNS_PER_DAY - 8 / 24
  days.push(d)
  console.log(`${seed}: ${key} · ${d.toFixed(2)}일 · ${pl.background} · 사건 ${s.storyteller.history.map((h) => h.event.replace('Event.', '')).join(',') || '-'}`)
}
const avg = days.reduce((a, b) => a + b, 0) / days.length
console.log('\n── 집계 ──')
for (const [k, v] of Object.entries(causes).sort((a, b) => b[1] - a[1])) console.log(`${k}: ${v} (${((v / runs) * 100).toFixed(0)}%)`)
console.log(`평균 생존 ${avg.toFixed(2)}일 · 탈출 ${escapes}/${runs} · ${((Date.now() - t0) / 1000).toFixed(1)}s`)
const top = Object.entries(causes).filter(([k]) => k !== '탈출' && k !== '생존(시간 종료)').sort((a, b) => b[1] - a[1])[0]
if (top && top[1] / runs > 0.5) console.log(`⚠ 경고: '${top[0]}' 이(가) 사망 원인의 50% 초과 — 밸런스 점검 필요`)
