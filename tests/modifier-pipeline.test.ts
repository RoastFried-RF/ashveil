import { describe, expect, it } from 'vitest'
import { capacity } from '../src/core/body'
import { player } from '../src/core/ctx'
import { DefDatabase } from '../src/core/defs'
import { makeItem } from '../src/core/items'
import { hungerBand, hungerStage } from '../src/core/nutrition-state'
import { deserialize, serialize } from '../src/core/save'
import { traitAdd, traitMul, traitOverride } from '../src/core/traits'
import type { AnyDef, GrowthDef, NutritionDef } from '../src/core/types'
import { db, makeWorld } from './helpers'

function patched(changes: Record<string, Record<string, unknown>>) {
  return new DefDatabase(Object.keys(db.definitionManifest()).map(id => ({ ...db.get(id), ...changes[id] }) as AnyDef), db.loadedMods)
}

describe('반복 질의의 원천 순서와 같은 TU 변경', () => {
  it('나이·특성·종·배경·무기 패시브·장비 순서를 유지하며 중복 나이 경계는 첫 항목을 쓴다', () => {
    const w = makeWorld('modifier-order'), p = player(w), growth = db.get<GrowthDef>('Growth.Human')
    w.db = patched({
      'Growth.Human': { ageBands: [
        { ...growth.ageBands[0], min: 20, mods: { probe: 2 } },
        { ...growth.ageBands[0], min: 0, mods: { probe: 97 } },
        { ...growth.ageBands[0], min: 20, mods: { probe: 99 } },
      ] },
      'Trait.Sensitive': { mods: { probe: 3 } },
      [p.def]: { mods: { probe: 5 } },
      'Bg.Excommunicate': { mods: { probe: 7 } },
      'Ab.Blade.Edge': { mods: { probe: 11 } },
      'Ab.Blade.DeepCut': { mods: { probe: 199 } },
      'Item.HuntingKnife': { mods: { probe: 13 } },
      'Item.LeatherCoat': { mods: { probe: 17 } },
    })
    p.age = { years: 25, nextBirthday: 999999, masteryMult: 1 }
    p.traits = ['Trait.Sensitive']; p.background = 'Bg.Excommunicate'
    p.abilities = ['Ab.Blade.DeepCut', 'Ab.Blade.Edge', 'Ab.Absent']
    p.equip = { main: makeItem(w, 'Item.HuntingKnife'), chest: makeItem(w, 'Item.LeatherCoat') }
    const raw = serialize(w.s), time = w.s.time
    expect(traitMul(w, p, 'probe')).toBe(510510)
    expect(traitAdd(w, p, 'probe')).toBe(58)
    expect(traitOverride(w, p, 'probe')).toBe(17)
    expect([traitMul(w, p, 'absent'), traitAdd(w, p, 'absent'), traitOverride(w, p, 'absent')]).toEqual([1, 0, undefined])
    expect(serialize(w.s)).toBe(raw)
    // 길이가 같아도 현재 능력을 읽으며 장비 순서도 덮어쓰기 순서에 반영한다.
    p.abilities[1] = 'Ab.Axe.Ferocity'
    expect(traitMul(w, p, 'probe')).toBe(46410)
    p.equip.main = makeItem(w, 'Item.Hatchet')
    expect(traitOverride(w, p, 'probe')).toBe(17)
    p.equip = { chest: p.equip.chest, main: makeItem(w, 'Item.HuntingKnife') }
    expect(traitOverride(w, p, 'probe')).toBe(13)
    p.traits = []; p.age.years = 10
    expect(traitAdd(w, p, 'probe')).toBe(139)
    expect(w.s.time).toBe(time)
  })

  it('불변 손가락 정의만 재사용하고 같은 TU의 동상·다른 DB의 부위 그룹·저장 복원을 반영한다', () => {
    const w = makeWorld('finger-def'), p = player(w)
    p.age = undefined; p.traits = []; p.background = undefined; p.equip = {}; p.abilities = []
    p.body.wounds = []; p.effects = []; p.needs.bodyTemp = 37
    p.frostbite = { Nose: { grade: 2, exposure: 60, frozen: true }, LeftIndex: { grade: 0, exposure: 0, frozen: false } }
    const base = capacity(w, p, 'manipulation'), time = w.s.time
    p.frostbite.LeftIndex.grade = 1
    expect(capacity(w, p, 'manipulation')).toBeCloseTo(base * .9)
    p.frostbite.LeftIndex.grade = 0
    expect(capacity(w, p, 'manipulation')).toBe(base)
    const body = w.db.body(p.body.def)
    w.db = patched({ [body.id]: { parts: body.parts.map(part => part.id === 'Nose' ? { ...part, groups: [...part.groups, 'finger'] } : part) } })
    expect(capacity(w, p, 'manipulation')).toBeCloseTo(base * .9)
    const restored = { db: w.db, s: deserialize(serialize(w.s)) }
    expect(capacity(restored, player(restored), 'manipulation')).toBe(capacity(w, p, 'manipulation'))
    expect(w.s.time).toBe(time)
  })

  it('영양 구간은 경계와 원래 모드 배열의 마지막 일치를 보존한다', () => {
    const w = makeWorld('nutrition-order'), p = player(w), n = db.get<NutritionDef>('Nutrition.Human')
    p.age = undefined; p.traits = []; p.background = undefined; p.equip = {}; p.abilities = []
    const hunger = [n.hunger[0], n.hunger[2], n.hunger[1]]
    w.db = patched({ [n.id]: { hunger } })
    for (const [kcal, index] of [[0, 0], [-499.99, 0], [-500, 2], [-2000, 2]] as const) {
      p.needs.kcal = kcal
      expect(hungerStage(w, p)).toBe(index)
      expect(hungerBand(w, p)).toEqual(hunger[index])
    }
  })
})
