// 주민 생활 진단. 관찰자만10분마다 몸을 재설정하며 NPC의 몸/물품/행동은 수정하지 않는다.
// pnpm exec tsx tools/resident-life.ts [일수=10] [시드=resident-life] [출력=test-results/resident-life.json]
import { writeFileSync } from 'node:fs'
import { allItems } from '../src/core/items'
import { player, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { loadDb } from './loadContent'
import { thermalState } from '../src/core/thermal'
const days = Number(process.argv[2] ?? 10), seed = process.argv[3] ?? 'resident-life', file = process.argv[4] ?? 'test-results/resident-life.json'
if (!Number.isFinite(days) || days <= 0 || days > 365) throw Error('일수는0보다 크고365 이하여야 한다')
const { db, report } = loadDb()
if (report.errors.length) throw Error(report.errors.join('\n'))
const w: World = { db, s: newGame(db, { seed, background: 'Bg.Hunter', overworld: true }) }, p = player(w), m = w.s.overworld!
p.pos = { ...w.s.map.exits[0] }
let error = playerAct(w, { type: 'leave' })
if (error) throw Error(error)
const site = m.sites.find((s) => s.kind === 'settlement' && s.faction === 'coalition')!
// 진단의 시작 위치만 배치한다. 실제 지역 생성·주민/보급·기후 초기화는 게임의 입장 행동이다.
m.position = { ...site.cell }
error = playerAct(w, { type: 'enterRegion' })
if (error) throw Error(error)
p.pos = { x: 33, y: 19 }; p.age = undefined; p.traits = []; p.traumas = []; p.background = undefined
w.s.sources = []; w.s.storyteller.budget = -1e9
const start = w.s.time, until = start + days * TURNS_PER_DAY * 100, snapshots: object[] = [], t0 = performance.now()
let hour = -1, iterations = 0
const snapshot = () => ({ time: turnOf(w), day: (w.s.time - start) / (TURNS_PER_DAY * 100), weather: w.s.weather, reserve: m.simulation!.settlements[site.id]!.reserve, people: w.s.creatures.filter((c) => c.id !== p.id).map((c) => ({ id: c.id, name: c.name, alive: c.alive, cause: c.deathCause, pos: c.pos, hp: c.hp, blood: c.body.blood, temp: c.needs.bodyTemp, kcal: c.needs.kcal, water: c.needs.waterDeficit, fatigue: c.needs.fatigue, wetness: c.needs.wetness, thermal: thermalState(w,c), bed: w.s.map.residentBeds?.find((b)=>b.owner===c.id), debt: c.needs.sleepDebt, asleep: c.asleep, activity: c.activity?.kind, diseases: c.diseases, food: allItems(c).filter((it) => db.item(it.def).food).map((it) => ({ def: it.def, count: it.count })), bottles: allItems(c).filter((it) => db.item(it.def).drink && !db.item(it.def).drink!.alcohol).map((it) => ({ uid: it.uid, uses: it.uses, quality: it.water })), consumption: c.residentConsumption })) })
while (w.s.time < until && !w.s.over && iterations++ < days * TURNS_PER_DAY) {
  // 외부 관찰자의 생존이 주민 진단을 중단하지 않도록 한다. NPC는 한 번도 재설정하지 않는다.
  Object.assign(p.needs, { kcal: 1000, waterDeficit: 0, protein: 100, vitamin: 100, fatigue: 10, sleepDebt: 0, bodyTemp: 37, wetness: 0, stress: 0, ash: 0 }); p.effects = []; p.thoughts = []; p.breakdown = undefined
  const before = w.s.time
  error = playerAct(w, { type: 'rest', turns: 200 }, 2000, until)
  while (w.s.simulationPending && w.s.time < until) runUntilInput(w, 2000, until)
  if (error) throw Error(error)
  if (w.s.time <= before) { error = playerAct(w, { type: 'wait' }); if (error) throw Error(error) }
  const now = Math.floor((w.s.time - start) / (TURNS_PER_HOUR * 100))
  if (now !== hour || w.s.creatures.some((c) => c.id !== p.id && !c.alive)) {
    hour = now; const row = structuredClone(snapshot()); snapshots.push(row)
    console.log(JSON.stringify(row))
  }
  if (w.s.creatures.some((c) => c.id !== p.id && !c.alive)) break
}
const result = { seed, site: site.id, saveVersion: w.s.version, observerNeedsReset: true, npcStateModified: false, raidsDisabled: true, requestedDays: days, elapsedDays: (w.s.time-start)/(TURNS_PER_DAY*100), seconds: (performance.now()-t0)/1000, observerOver: w.s.over, snapshots, final: snapshot() }
writeFileSync(file, JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({ ...result, snapshots: undefined, final: undefined }))
