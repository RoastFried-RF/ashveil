import { describe, expect, it } from 'vitest'
import { addWound } from '../src/core/body'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { player, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { addToBag, allItems, makeItem } from '../src/core/items'
import { foodTick } from '../src/core/food-safety'
import { waterTick } from '../src/core/water'
import { worldIndex } from '../src/core/overworld'
import type { Creature, OverworldState } from '../src/core/types'
import { db } from './helpers'
import {worldObservation} from '../src/core/world-observations'
function setup(): World {
  const w = { db, s: newGame(db, { seed: 'journey-integration', background: 'Bg.Deserter', overworld: true }) }, p = player(w)
  p.traits = []; p.traumas = []; p.abilities = []; p.thoughts = []; p.effects = []; p.age = undefined
  Object.assign(p.needs, { kcal: 3000, waterDeficit: 0, protein: 100, vitamin: 100, fatigue: 10, stress: 0, bodyTemp: 37, wetness: 0 })
  w.s.time = (73 * TURNS_PER_DAY + 12 * TURNS_PER_HOUR) * 100; p.nextAct = w.s.time; p.needs.nutritionDay = 73
  w.s.weather = 'clear'; w.s.weatherUntil = 1e12
  return w
}
function depart(w: World) { const p = player(w); p.pos = { ...w.s.map.exits[0] }; expect(playerAct(w, { type: 'leave' })).toBeNull(); expect(w.s.overworld!.currentRegion).toBeUndefined() }
function roadTarget(m: OverworldState) { return { x: m.position.x, y: m.position.y - 1 } }
function finish(w: World) { let n = 0; while (w.s.simulationPending && n++ < 10000) runUntilInput(w, 200); expect(n).toBeLessThan(10000) }
function start(w: World, target = roadTarget(w.s.overworld!)) { expect(playerAct(w, { type: 'travel', target }, 200)).toBeNull(); return target }
// 맑은 날의 0% 초기화와 새 환경 시계만 정규화한다. 몸·AI·물품 손상은 전부 비교한다.
function withoutExposureClock(creatures:Creature[]){return structuredClone(creatures).map(c=>{for(const it of allItems(c)){delete it.gearAgedAt;if(it.wetness&&Object.values(it.wetness).every(n=>n===0))it.wetness={}}if(c.needs.skinWetness&&Object.values(c.needs.skinWetness).every(n=>n===0))delete c.needs.skinWetness;return c})}

describe('지역·여행의 실제 입력과 정지·각인', () => {
  for(const blind of [false,true])it(`실제1200턴 도착은 ${blind?'볼 수 없으면 옛 기록만 남긴다':'도착 시각의 지형을 기록한다'}`,()=>{
    const w=setup();depart(w);const m=w.s.overworld!,old=structuredClone(m.worldObservations),target=roadTarget(m),at=w.s.time
    if(blind)player(w).body.missing=['LeftEye','RightEye']
    start(w,target);finish(w);expect(w.s.time-at).toBe(120000);expect(m.position).toEqual(target)
    if(blind)expect(m.worldObservations).toEqual(old)
    else{const o=worldObservation(w,worldIndex(m,target))!;expect(o.source).toBe('arrival');expect(o.at).toBeGreaterThanOrEqual(at/100+1199);expect(o.at).toBeLessThanOrEqual(turnOf(w));expect(o.cell.biome).toBe(m.cells[worldIndex(m,target)]!.biome)}
  })
  it('출입구에서만 떠나며 실제 출정한 주민도 몸·장비를 복제하지 않고 지역의 나머지 일과를 동결한다', () => {
    const w = setup(), p = player(w), before = w.s.time
    expect(playerAct(w, { type: 'leave' })).toContain('떠날 수 없다')
    const residents = structuredClone(w.s.creatures.filter((c) => c.id !== p.id)); depart(w)
    expect(w.s.time - before).toBe(100); expect(w.s.creatures).toHaveLength(1); expect(w.s.map.w).toBe(16)
    start(w); finish(w)
    const stored=w.s.overworld!.scenes['Region.GreyCloister'].creatures
    const travellers=(w.s.overworld!.roadRaids??[]).filter(r=>r.source==='Region.GreyCloister').flatMap(r=>r.actors??[])
    expect(travellers.length).toBeGreaterThan(0)
    const actual=withoutExposureClock([...stored,...travellers]).map(c=>{delete c.roadRaid;return c}).sort((a,b)=>a.id-b.id)
    expect(actual).toEqual(withoutExposureClock(residents).sort((a,b)=>a.id-b.id))
    expect(new Set([...stored,...travellers].map(c=>c.id)).size).toBe(residents.length)
    for(const c of stored)for(const it of allItems(c))if(it.gearAgedAt!==undefined)expect(it.gearAgedAt).toBeGreaterThanOrEqual(turnOf(w)-200)
    expect(w.s.over).toBeUndefined()
  })
  it('도로 한 칸이 정확히1200턴이며 걷기 대사·갈증·탐험 기록을 정산한다', () => {
    const w = setup(); depart(w); const before = w.s.time, p = player(w), b = p.needs.kcal, d = p.needs.waterDeficit, m = w.s.overworld!, seen = m.seen.length
    const target = start(w); finish(w)
    expect(w.s.time - before).toBe(TURNS_PER_HOUR * 100); expect(m.position).toEqual(target); expect(m.travel).toBeUndefined(); expect(p.activity).toBeUndefined()
    expect(p.needs.kcal).toBeLessThan(b - 100); expect(p.needs.waterDeficit).toBeGreaterThan(d + 100); expect(m.seen.length).toBeGreaterThan(seen)
  })
  it('계산 분할 중 각인은 중간 위치·남은 시간과 모든 상태를 그대로 재생한다', () => {
    const w = setup(); depart(w); start(w); expect(w.s.simulationPending).toBe(true)
    const copy = { db, s: deserialize(serialize(w.s)) }
    expect(copy.s.overworld!.travel!.segmentRemaining).toBe(w.s.overworld!.travel!.segmentRemaining)
    finish(w); finish(copy); expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('직접 중단→다른 행동→계속 걸어도 이미 걸은 진척을 초기화하지 않는다', () => {
    const w = setup(); depart(w); const target = start(w)
    const remaining = w.s.overworld!.travel!.segmentRemaining
    expect(playerAct(w, { type: 'stopActivity' })).toBeNull(); expect(w.s.simulationPending).toBeUndefined(); expect(player(w).activity).toBeUndefined(); expect(w.s.overworld!.travel!.segmentRemaining).toBe(remaining)
    expect(playerAct(w, { type: 'travel', target: { x: target.x + 1, y: target.y } })).toContain('칸을 마친 뒤')
    playerAct(w, { type: 'wait' }); expect(w.s.overworld!.travel!.segmentRemaining).toBe(remaining)
    expect(playerAct(w, { type: 'travel', target }, 200)).toBeNull(); finish(w); expect(w.s.overworld!.position).toEqual(target)
  })
  it('각 지역과 길목의 바닥 물건·지역 저장은 이동해도 같은 UID로 남는다', () => {
    const w = setup(), p = player(w), marker = makeItem(w, 'Item.Wood')
    w.s.map.tiles[2 * w.s.map.w + 2].items.push(marker)
    depart(w); const m = w.s.overworld!, origin = { ...m.position }, roadItem = makeItem(w, 'Item.IronScrap'); w.s.map.tiles[0].items.push(roadItem)
    start(w); finish(w); expect(w.s.map.tiles[0].items.some((i) => i.uid === roadItem.uid)).toBe(false)
    start(w, origin); finish(w); expect(w.s.map.tiles[0].items.some((i) => i.uid === roadItem.uid)).toBe(true)
    expect(playerAct(w, { type: 'enterRegion' })).toBeNull(); expect(m.currentRegion).toBe('Region.GreyCloister'); expect(w.s.map.tiles[2 * w.s.map.w + 2].items[0].uid).toBe(marker.uid)
    expect(w.s.creatures.filter((c) => c.id === p.id)).toHaveLength(1)
  })
  it('남의 지명에 순간 입장할 수 없고 실제 도착한 지역만 입장한다', () => {
    const w = setup(); depart(w); const m = w.s.overworld!, target = roadTarget(m)
    start(w, target); finish(w); expect(playerAct(w, { type: 'enterRegion' })).toContain('지역이 없다')
    // 한 칸 옆에 존재하는 지역의 실제 진입과 재진입을 검증한다.
    const site = m.sites.find((s) => s.id === 'Region.ChimneySeven')!; site.cell = { ...target }
    expect(playerAct(w, { type: 'enterRegion' })).toBeNull(); expect(m.currentRegion).toBe(site.id); expect(w.s.map.name).toBe(db.get<import('../src/core/types').RegionLayoutDef>('RegionLayout.ChimneyService').label); expect(w.s.map.w).toBe(64)
    expect(w.s.map.tiles.every((t) => !!db.tryGet(t.t))).toBe(true)
    const uid = makeItem(w, 'Item.Wood'); w.s.map.tiles[0].items.push(uid); depart(w); expect(playerAct(w, { type: 'enterRegion' })).toBeNull(); expect(w.s.map.tiles[0].items[0].uid).toBe(uid.uid)
    expect(m.visited.filter((s) => s === site.id)).toHaveLength(1)
  })
  it('멀리 남겨 둔 음식과 침전 중인 병은 지역을 떠나도 시간에 따라 정산한다', () => {
    const w = setup(), map = w.s.map, food = makeItem(w, 'Item.RawMeat'), bottle = makeItem(w, 'Item.WaterBottle')
    food.foodAgedAt = turnOf(w); bottle.water = { pathogen: 70, ash: 20, source: 'pond' }; bottle.waterSettlesAt = turnOf(w) + TURNS_PER_HOUR
    map.tiles[0].items.push(food, bottle); depart(w); w.s.time = ((Math.floor(turnOf(w) / TURNS_PER_DAY) + 1) * TURNS_PER_DAY + 13 * TURNS_PER_HOUR) * 100
    foodTick(w); waterTick(w); expect(food.freshness).toBeLessThan(100); expect(bottle.water!.ash).toBe(12); expect(bottle.waterSettlesAt).toBeUndefined()
  })
  it('2ml/턴을 넘는 출혈은 여행을 막고 지혈대가 실제로 멎게 하면 갈 수 있다', () => {
    const w=setup();depart(w);const p=player(w),target=roadTarget(w.s.overworld!),before=w.s.time
    addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:6,source:'검증'}).wound.bleed=3
    expect(playerAct(w,{type:'travel',target})).toContain('출혈');expect(w.s.time).toBe(before)
    p.body.tourniquets.LeftUpperArm=turnOf(w)
    expect(playerAct(w,{type:'travel',target},1)).toBeNull();expect(p.activity?.kind).toBe('travel')
  })
  it('플레이어 배낭은 지역 장면에 복제하지 않는다', () => {
    const w = setup(), p = player(w), it = makeItem(w, 'Item.Wood'); expect(addToBag(w, p, it)).toBe(0); depart(w); start(w); finish(w)
    const m = w.s.overworld!; expect(Object.values(m.scenes).every((s) => !s.creatures.some((c) => c.id === p.id))).toBe(true); expect(p.bag.some((i) => i.uid === it.uid)).toBe(true)
    expect(m.cells[worldIndex(m, m.position)].road).toBe(true)
  })
})
