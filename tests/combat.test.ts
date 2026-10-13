import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { addWound } from '../src/core/body'
import { killCreature, previewHit } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { makeItem } from '../src/core/items'
import type { Creature } from '../src/core/types'
import { makeWorld } from './helpers'

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
    expect(pl.activity?.total).toBe(5)
    pl.activity = undefined
    perform(w, pl, { type: 'treat', uid: bandage.uid, woundId: chest.id })
    expect(pl.activity?.total).toBe(6)
    pl.activity = undefined
    pl.abilities = ['Ab.Survival.FirstAid']
    perform(w, pl, { type: 'treat', uid: bandage.uid, woundId: leg.id })
    expect(pl.activity?.total).toBe(3)
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
    expect(pl.activity?.total).toBe(1)
    pl.activity = undefined
    tileAt(w, p).t = 'Terrain.Sarcophagus'
    perform(w, pl, { type: 'search' })
    expect(pl.activity?.total).toBe(3)
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
    expect(pl.activity?.total).toBe(2)
    pl.activity!.remaining = 1
    const { activityStep } = await import('../src/core/actions')
    activityStep(w, pl)
    expect(w.s.loot?.kind).toBe('corpse')
    expect(lootGrid(w)).toMatchObject({ w: 8, h: 4 })
    const mail = lootItems(w)!.find((i) => i.def === 'Item.ScrapMail')!
    perform(w, pl, { type: 'lootTake', uid: mail.uid })
    expect(pl.activity?.kind).toBe('strip')
    expect(pl.activity?.total).toBe(3) // 사슬옷 착탈 6/3
  })
})
