import { describe, expect, it } from 'vitest'
import { perform, stumbleChance } from '../src/core/actions'
import { isMissing } from '../src/core/body'
import { exposeDisease } from '../src/core/conditions'
import { craftingQuality, repairPreview } from '../src/core/crafting'
import { player, tileAt } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { allItems, itemDef, makeItem, addToBag } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { masteryStage } from '../src/core/skills'
import { gainTrauma } from '../src/core/trauma'
import type { BackgroundDef, RecipeDef } from '../src/core/types'
import { db, makeWorld } from './helpers'

describe('12종 배경의 실제 시작 상태', () => {
  it('모든 배경은 합50·나이 범위·문해·무료 능력·시작 장비를 생성하고 저장 복원한다', () => {
    expect(db.all<BackgroundDef>('Background')).toHaveLength(12)
    for (const bg of db.all<BackgroundDef>('Background')) for (let i = 0; i < 3; i++) {
      const w = makeWorld(`background-${i}`, bg.id), p = player(w)
      expect(Object.values(p.stats).reduce((a, b) => a + b, 0)).toBe(50)
      expect(p.age!.years).toBeGreaterThanOrEqual(bg.ageRange![0]); expect(p.age!.years).toBeLessThanOrEqual(bg.ageRange![1]); expect(p.literacy).toBe(bg.literacy)
      expect(p.abilities).toEqual(bg.startAbilities ?? []); expect(p.abilityPoints).toBe(2 + (bg.bonusAbilityPoints ?? 0))
      for (const id of new Set(bg.startItems)) expect(allItems(p).filter((it) => it.def === id).reduce((n, it) => n + it.count, 0)).toBe(bg.startItems.filter((item) => item === id).length)
      expect(p.bag.every((it) => it.gx !== undefined && it.gy !== undefined)).toBe(true)
      expect(stateHash(deserialize(serialize(w.s)))).toBe(stateHash(w.s))
    }
  })
  it('탈주 노예의 족쇄 흉터는 기능 손실 없이 저장되며 첫인상 보정을 가진다', () => {
    const w = makeWorld('slave', 'Bg.EscapedSlave'), p = player(w)
    expect(p.body.scars?.map((s) => s.source)).toEqual(['족쇄', '족쇄']); expect(p.body.scars?.every((s) => s.cap === 1)).toBe(true)
    expect(isMissing(w, p, 'LeftShin')).toBe(false); expect(db.background(p.background!).mods?.firstImpression).toBe(-5)
  })
  it('회색열 고아는 노출 난수를 소비하지 않고 회색열에 영구 면역이며 생존1이다', () => {
    const w = makeWorld('orphan', 'Bg.FeverOrphan'), p = player(w), before = [...w.s.rng.body]
    expect(exposeDisease(w, p, 'Disease.GreyFever', 1)).toBe(false); expect(w.s.rng.body).toEqual(before); expect(masteryStage(w, p, 'survival')).toBe(1)
  })
  it('사냥꾼은 화살20과 사냥칼, 상인은 좋음 재킷을 가지고 시작한다', () => {
    const hunter = player(makeWorld('kit', 'Bg.Hunter')), merchant = player(makeWorld('kit', 'Bg.GuildMerchant'))
    expect(hunter.bag.find((it) => it.def === 'Item.Arrow')?.count).toBe(20); expect(allItems(hunter).some((it) => it.def === 'Item.HuntingKnife')).toBe(true)
    expect(merchant.equip.chest?.def).toBe('Item.PaddedJacket'); expect(merchant.equip.chest?.quality).toBe(2)
  })
  it('대장간 도제는 대장 레시피를 알고 대장Q/금속 수리만10점을 얻는다', () => {
    const w = makeWorld('smith', 'Bg.SmithApprentice'), p = player(w); p.age = undefined; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.traits = []; p.equip = {}; p.bag = []
    const smith = db.all<RecipeDef>('Recipe').find((r) => r.category === 'smithing')!, other = db.all<RecipeDef>('Recipe').find((r) => r.category === 'woodwork')!
    expect(p.recipes).toContain(smith.id)
    const withBonus = craftingQuality(w, p, smith, 15), nonSmith = craftingQuality(w, p, other, 15)
    const knife = makeItem(w, 'Item.HuntingKnife'); knife.durability = 30; addToBag(w, p, knife); const repair = repairPreview(w, p, knife.uid)!
    p.background = undefined
    expect(withBonus - craftingQuality(w, p, smith, 15)).toBe(10); expect(nonSmith).toBe(craftingQuality(w, p, other, 15)); expect(repair.score - repairPreview(w, p, knife.uid)!.score).toBe(10)
  })
  it('뱃사공의 물/진흙 비틀거림−10과 물 공포 면제는 실제 행동 판정에 반영된다', () => {
    const w = makeWorld('boat', 'Bg.Boatman'), p = player(w); p.age = undefined; p.traits = []; p.body.wounds = []; p.needs.fatigue = 20; p.needs.bodyTemp = 37
    const pos = { x: p.pos.x + 1, y: p.pos.y }; tileAt(w, pos).t = 'Terrain.Mud'; const protectedChance = stumbleChance(w, p, pos)
    expect(gainTrauma(w, p, 'Trauma.Water')).toBeUndefined(); p.background = undefined
    expect(stumbleChance(w, p, pos) - protectedChance).toBe(10)
  })
  it('이야기꾼의 세 소문은 서로 다르고 일지·지도와 같은 저장 구조를 쓴다', () => {
    const w = makeWorld('stories', 'Bg.Storyteller'), clues = w.s.knowledge.rumors!
    expect(clues).toHaveLength(3); expect(new Set(clues.map((r) => r.id)).size).toBe(3); expect(clues.every((r) => r.hop === 2)).toBe(true)
    expect(clues.some((r) => r.kind === 'room' && r.rect)).toBe(true)
  })
  it('기록관의 낡은 지도를 실제로 읽으면 아직 안 간 납골당1층 방이 소문에 기록된다', () => {
    const w = makeWorld('map', 'Bg.GuardArchivist'), p = player(w), map = p.bag.find((it) => it.def === 'Item.OldMap')!
    expect(itemDef(w, map).readable).toBe(true); expect(map.note?.mapId).toBe('crypt1'); expect(w.s.knowledge.rumors).toBeUndefined()
    w.s.time = 14400 * 100; w.s.weather = 'clear'; invalidateLights(w); expect(perform(w, p, { type: 'read', uid: map.uid }).ok).toBe(true)
    expect(w.s.knowledge.rumors?.find((r) => r.id === map.note!.id)?.rect).toEqual(map.note!.rect)
  })
})
