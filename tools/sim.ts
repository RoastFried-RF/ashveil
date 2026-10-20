// 헤드리스 시뮬레이션: pnpm sim [판 수=20] [최대 일수=3] [시드 시작=0] [--json <파일>]
// 봇으로 여러 시드를 돌려 사망 원인 분포·생존 일수를 집계한다.

import { writeFileSync } from 'node:fs'
import { botDecide } from '../src/core/bot'
import { player, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { thermalState } from '../src/core/thermal'
import { loadDb } from './loadContent'

const overworld = process.argv.includes('--world')
const runs = Number(process.argv[2] ?? 20)
const maxDays = Number(process.argv[3] ?? 3)
const seedStart = Number(process.argv[4] ?? 0)
const jsonAt = process.argv.indexOf('--json'), jsonFile = jsonAt >= 0 ? process.argv[jsonAt + 1] : undefined
if (!Number.isInteger(runs) || runs < 1 || !Number.isFinite(maxDays) || maxDays <= 0 || !Number.isInteger(seedStart) || seedStart < 0 || (jsonAt >= 0 && !jsonFile)) throw new Error('사용법: sim <양의 판 수> <양의 최대 일수> [시드 시작] [--json 파일]')
const rows: { seed: string; cause: string; days: number; level: number; map: string; background?: string; final: object }[] = []
const { db, report } = loadDb()
if (report.errors.length) { console.error(report.errors); process.exit(1) }

const causes: Record<string, number> = {}
const days: number[] = []
let escapes = 0
const t0 = Date.now()
for (let i = 0; i < runs; i++) {
  const seed = `sim-${i + seedStart}`
  const s = newGame(db, { seed, overworld })
  const w: World = { db, s }
  runUntilInput(w)
  const startTU = w.s.time
  const endTU = startTU + Math.max(1, Math.floor(TURNS_PER_DAY * maxDays * 100))
  let guard = 0
  while (!s.over && s.time < endTU && guard++ < 150000) {
    const err = playerAct(w, botDecide(w), undefined, endTU)
    if (err) playerAct(w, { type: 'wait' }, undefined, endTU)
  }
  if (!s.over && s.time < endTU) throw new Error(`${seed}: 행동 상한 초과, 생존으로 집계하지 않음`)
  const pl = player(w)
  const key = s.over ? (s.over.kind === 'escape' ? '탈출' : s.over.report.cause) : '생존(시간 종료)'
  if (s.over?.kind === 'escape') escapes++
  causes[key] = (causes[key] ?? 0) + 1
  const d = (s.time - startTU) / (TURNS_PER_DAY * 100)
  days.push(d)
  rows.push({
    seed, cause: key, days: d, level: pl.level, map: s.map.id, background: pl.background,
    final: {
      overworld: s.overworld ? { position: s.overworld.position, currentRegion: s.overworld.currentRegion, visited: s.overworld.visited, scenes: Object.keys(s.overworld.scenes) } : undefined,
      stats: pl.stats, age: pl.age, traits: pl.traits,
      aftermath: { scars: pl.body.scars, chronicPain: pl.body.chronicPain, damagedTendons: pl.body.damagedTendons, nerveDamage: pl.body.nerveDamage },
      thoughts: pl.thoughts, traumas: pl.traumas, fearlessAgainst: pl.fearlessAgainst, psycheWatch: pl.psycheWatch,
      needs: pl.needs, thermal: thermalState(w, pl), pos: pl.pos, activity: pl.activity,
      equipment: Object.values(pl.equip).map((it) => ({
        def: it!.def, quality: it!.quality, durability: it!.durability, maxDurability: it!.maxDurability,
        partDurability: it!.partDurability, edge: it!.edge, edgeWear: it!.edgeWear, bowMoisture: it!.bowMoisture,
        bowBroken: it!.bowBroken, bowUnstrung: it!.bowUnstrung, elasticity: it!.elasticity, corrosion: it!.corrosion,
        rust: it!.rust, partCorrosion: it!.partCorrosion, partRust: it!.partRust, oiledUntil: it!.oiledUntil,
        waxedUntil: it!.waxedUntil, wetness: it!.wetness,
      })),
    },
  })
  console.log(`${seed}: ${key} · ${d.toFixed(2)}일 · Lv${pl.level} · ${s.map.id} · ${pl.background} · 사건 ${s.storyteller.history.map((h) => h.event.replace('Event.', '')).join(',') || '-'}`)
}
const avg = days.reduce((a, b) => a + b, 0) / days.length
console.log('\n── 집계 ──')
for (const [k, v] of Object.entries(causes).sort((a, b) => b[1] - a[1])) console.log(`${k}: ${v} (${((v / runs) * 100).toFixed(0)}%)`)
console.log(`평균 생존 ${avg.toFixed(2)}일 · 탈출 ${escapes}/${runs} · ${((Date.now() - t0) / 1000).toFixed(1)}s`)
const top = Object.entries(causes).filter(([k]) => k !== '탈출' && k !== '생존(시간 종료)').sort((a, b) => b[1] - a[1])[0]
if (top && top[1] / runs > 0.5) console.log(`⚠ 경고: '${top[0]}' 이(가) 사망 원인의 50% 초과 — 밸런스 점검 필요`)

if (jsonFile) writeFileSync(jsonFile, JSON.stringify({ overworld, rows, causes, averageDays: avg, escapes, seconds: (Date.now() - t0) / 1000 }, null, 2) + '\n')
