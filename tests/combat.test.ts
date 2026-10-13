import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { addWound } from '../src/core/body'
import { killCreature, previewHit } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { makeItem } from '../src/core/items'
import type { Creature } from '../src/core/types'
import { makeWorld } from './helpers'

/** 타입 좁히기를 피해 현재 활동을 읽는다 */
const actOf = (c: Creature) => c.activity

/** 한낮·맑음, 주변 개체 정리 */
function noon(w: World) {
  w.s.time = (TURNS_PER_DAY + 12 * TURNS_PER_HOUR) * 100
  w.s.weather = 'clear'
  w.s.weatherUntil = Infinity
  const pl = player(w)
  w.s.creatures = [pl]
  pl.traits = []
  pl.abilities = []
  pl.equip = {}
  pl.bag = []
  return pl
}

function openTile(w: World, pl: Creature, dx: number, dy: number) {
  const p = { x: pl.pos.x + dx, y: pl.pos.y + dy }
  tileAt(w, p).t = 'Terrain.Earth'
  tileAt(w, p).items = []
  return p
}

describe('전투 판정 (07)', () => {
  it('예시 A: 약탈자 손도끼가 우측면을 친다 → 명중 71% (07 §3)', () => {
    const w = makeWorld('cmb1')
    const pl = noon(w)
    pl.stats.agi = 11
    pl.facing = 0 // 북쪽을 본다
    pl.equip.chest = makeItem(w, 'Item.ScrapMail') // 둔중 2
    const at = openTile(w, pl, 1, 0) // 동쪽 = 오른쪽
    const r = createCreature(w, 'Creature.Reaver', at)
    w.s.creatures.push(r)
    r.stats.agi = 13
    r.stats.per = 10
    r.equip = { main: makeItem(w, 'Item.Hatchet') }
    r.needs.energy = 22
    r.ai.morale = 60
    const pv = previewHit(w, r, pl)!
    // 공격치 = 4 + floor(3 × 1.5) + 0 = 8, 회피치 = 2 − 2 = 0 → 50 + 16 + 측면 10 − 기력 5 = 71
    expect(pv.chance).toBe(71)
  })
  it('잠든 대상: 명중 +40, 회피치 무시 (07 §2.8)', () => {
    const w = makeWorld('cmb2')
    const pl = noon(w)
    pl.equip.main = makeItem(w, 'Item.HuntingKnife')
    const at = openTile(w, pl, 1, 0)
    const s = createCreature(w, 'Creature.Withered', at)
    w.s.creatures.push(s)
    s.asleep = true
    const pv = previewHit(w, pl, s)!
    expect(pv.lines.some((l) => l.includes('잠든 상대 +40'))).toBe(true)
  })
})

describe('처치 채널 (02 §12 · 01 §4.2)', () => {
  it('붕대는 팔다리 5턴, 몸통 6턴, 응급 처치면 ×0.6 올림 = 3턴', () => {
    const w = makeWorld('trt1')
    const pl = noon(w)
    const bandage = makeItem(w, 'Item.Bandage', 3)
    pl.bag.push({ ...bandage, gx: 0, gy: 0 })
    const leg = addWound(w, pl, { def: 'Wound.Cut', part: 'LeftThigh', severity: 6, source: 't' }).wound
    const chest = addWound(w, pl, { def: 'Wound.Cut', part: 'Chest', severity: 6, source: 't' }).wound
    expect(perform(w, pl, { type: 'treat', uid: bandage.uid, woundId: leg.id }).ok).toBe(true)
    expect(actOf(pl)?.total).toBe(5)
    pl.activity = undefined
    perform(w, pl, { type: 'treat', uid: bandage.uid, woundId: chest.id })
    expect(actOf(pl)?.total).toBe(6)
    pl.activity = undefined
    pl.abilities = ['Ab.Survival.FirstAid']
    perform(w, pl, { type: 'treat', uid: bandage.uid, woundId: leg.id })
    expect(actOf(pl)?.total).toBe(3)
  })
})

describe('루팅 창 (13 §8)', () => {
  it('상자 6×4·1턴, 석관 8×3·3턴', () => {
    const w = makeWorld('loot1')
    const pl = noon(w)
    const p = { x: pl.pos.x + 1, y: pl.pos.y }
    tileAt(w, p).t = 'Terrain.Chest'
    tileAt(w, p).searched = false
    tileAt(w, p).cont = undefined
    perform(w, pl, { type: 'search' })
    expect(actOf(pl)?.total).toBe(1)
    pl.activity = undefined
    tileAt(w, p).t = 'Terrain.Sarcophagus'
    perform(w, pl, { type: 'search' })
    expect(actOf(pl)?.total).toBe(3)
  })
  it('시체는 들고 있던 것을 지닌다: 첫 수색 2턴, 입은 장비 벗기기 = 탈 턴', async () => {
    const { lootGrid, lootItems } = await import('../src/core/actions')
    const w = makeWorld('loot2')
    const pl = noon(w)
    const at = openTile(w, pl, 1, 0)
    const r = createCreature(w, 'Creature.Reaver', at)
    w.s.creatures.push(r)
    r.equip = { chest: makeItem(w, 'Item.ScrapMail') }
    r.bag = [makeItem(w, 'Item.Jerky', 2)]
    killCreature(w, r, 't')
    expect(tileAt(w, at).items.length).toBe(0)
    perform(w, pl, { type: 'search' })
    expect(actOf(pl)?.total).toBe(2)
    pl.activity!.remaining = 1
    const { activityStep } = await import('../src/core/actions')
    activityStep(w, pl)
    expect(w.s.loot?.kind).toBe('corpse')
    expect(lootGrid(w)).toMatchObject({ w: 8, h: 4 })
    const mail = lootItems(w)!.find((i) => i.def === 'Item.ScrapMail')!
    perform(w, pl, { type: 'lootTake', uid: mail.uid })
    expect(actOf(pl)?.kind).toBe('strip')
    expect(actOf(pl)?.total).toBe(3) // 사슬옷 착탈 6/3
  })
})

describe('소리와 각성 (07 §9.1 · 14 §7.2)', () => {
  it('경로 비용: 칸당 1, 닫힌 문 +4 — 14 검산 1의 수치', async () => {
    const { noiseCost } = await import('../src/core/perception')
    const w = makeWorld('noise1')
    const m = w.s.map
    // 3줄짜리 복도를 판다: 가운데 줄만 바닥, (x0+5)에 닫힌 문
    const y0 = 10, x0 = 10
    for (let y = y0 - 1; y <= y0 + 1; y++) for (let x = x0 - 1; x <= x0 + 12; x++) m.tiles[y * m.w + x].t = y === y0 ? 'Terrain.KtFloor' : 'Terrain.KtWall'
    m.tiles[y0 * m.w + x0 + 3].t = 'Terrain.DoorClosed'
    const cost = noiseCost(w, { x: x0, y: y0 }, 20)
    expect(cost.get(y0 * m.w + x0 + 2)).toBe(2) // 2칸 옆
    expect(cost.get(y0 * m.w + x0 + 4)).toBe(8) // 4칸 + 닫힌 문 4
    // 가죽 장화 3 − 2 = 1 < 3 · 사슬옷 5 − 2 = 3 ≥ 3 · 막기 8 − 4 − 4 = 0 < 3 (얕은 잠 임계 3, 청각 보정 0인 경우)
    expect(3 - 2).toBeLessThan(3)
    expect(5 - 2).toBeGreaterThanOrEqual(3)
    expect(8 - cost.get(y0 * m.w + x0 + 4)!).toBeLessThan(3)
  })
})
