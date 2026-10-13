// 생물 생성: 플레이어(배경·특성·시작 능력)와 NPC(로드아웃·잠듦·거점)

import { createBody, energyMax, hpMax } from './body'
import { creatureAt, terrainAt, rng, inBounds, type World } from './ctx'
import type { Pos } from './geom'
import { addToInventory, equip, itemDef, makeItem } from './items'
import { newNeeds } from './needs'
import { setMasteryStage, type MasteryKind } from './skills'
import type { BackgroundDef, Creature, TraitDef } from './types'

const NAMES = ['에다', '로반', '케스', '미르', '타일', '브랜', '유나', '하렌', '오슬', '세린', '도겸', '아라', '베일', '노아', '카이', '린']

export function createCreature(w: World, defId: string, pos: Pos, name?: string): Creature {
  const def = w.db.creature(defId)
  const r = rng(w, 'world')
  const body = createBody(w.db.body(def.body), def)
  const chars = def.char ? (Array.isArray(def.char) ? def.char : [def.char]) : []
  const sprites = def.sprite ? (Array.isArray(def.sprite) ? def.sprite : [def.sprite]) : [defId]
  const c: Creature = {
    id: w.s.nextId++,
    def: defId,
    name: name ?? def.label,
    sprite: chars.length ? r.pick(chars) : r.pick(sprites),
    pos: { ...pos },
    facing: r.int(0, 7),
    faction: def.faction,
    nextAct: w.s.time + r.int(0, 99),
    alive: true,
    unconscious: false,
    body,
    stats: { ...def.stats },
    skills: { ...def.skills },
    passions: {},
    traits: [],
    needs: newNeeds(),
    effects: [],
    thoughts: [],
    bag: [],
    equip: {},
    hotbar: new Array(10).fill(null),
    hp: 1,
    level: 1,
    xp: 0,
    statPoints: 0,
    abilityPoints: 0,
    abilities: [],
    cooldowns: {},
    ai: {
      mode: def.ai === 'guard' || def.ai === 'boss' ? 'guard' : 'wander',
      hunger: def.hunger ? r.range(def.hunger[0], def.hunger[1]) : 0.3,
      morale: def.morale,
    },
    exerted: false,
    history: [],
  }
  for (const k of Object.keys(c.stats) as (keyof typeof c.stats)[]) c.stats[k] = Math.max(3, c.stats[k] + r.int(-1, 1))
  for (const slot of def.loadout?.slots ?? []) {
    if (slot.chance !== undefined && !r.chance(slot.chance)) continue
    const it = makeItem(w, r.pick(slot.items), slot.count ? r.int(slot.count[0], slot.count[1]) : 1)
    addToInventory(w, c, it)
    const idef = itemDef(w, it)
    if (idef.slot && !c.equip[idef.slot === 'ring' ? 'ring1' : idef.slot]) equip(w, c, it.uid)
  }
  c.hp = hpMax(w, c)
  c.needs.stamina = energyMax(w, c)
  return c
}

export function pickTraits(w: World, bg: BackgroundDef, n: number): string[] {
  const r = rng(w, 'world')
  const all = w.db.all<TraitDef>('Trait')
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const pool = all.filter((t) => !out.includes(t.id) && !out.some((o) => w.db.trait(o).conflicts?.includes(t.id)) && !(t.conflicts ?? []).some((cf) => out.includes(cf)))
    const t = r.weighted(pool, (x) => (bg.traitWeights?.[x.id] ?? 1) * (x.weight ?? 1))
    if (t) out.push(t.id)
  }
  return out
}

export function createPlayer(w: World, pos: Pos, bgId?: string): Creature {
  const r = rng(w, 'world')
  const bgs = w.db.all<BackgroundDef>('Background')
  const bg = bgId ? w.db.background(bgId) : r.pick(bgs)
  const c = createCreature(w, 'Creature.Drifter', pos, r.pick(NAMES))
  c.background = bg.id
  c.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10, ...bg.stats }
  // 숙련 폐지(D23): 의료·생존 숙달만, 배경이 시작 단계를 준다 (15 §9.1)
  c.skills = {}
  c.passions = {}
  for (const [k, st] of Object.entries(bg.mastery ?? {})) setMasteryStage(c, k as MasteryKind, st ?? 0)
  c.literate = bg.literate
  c.traits = pickTraits(w, bg, 2 + (r.chance(0.3) ? 1 : 0))
  c.facing = 0
  c.nextAct = w.s.time
  c.bag = []
  c.equip = {}
  c.abilityPoints = 2 + (bg.bonusAbilityPoints ?? 0) // 15 §4: 시작 능력 포인트 2 + 배경 무료 능력
  c.statPoints = 0
  c.abilities = [...(bg.startAbilities ?? [])]
  for (const id of bg.startItems) addToInventory(w, c, makeItem(w, id))
  for (const it of [...c.bag]) {
    const d = itemDef(w, it)
    if (d.slot && !c.equip[d.slot === 'ring' ? 'ring1' : d.slot] && !(d.slot === 'main' && c.equip.main)) equip(w, c, it.uid)
  }
  // 빠른 슬롯: 시작 능력 → 붕대/천 → 음식
  let hb = 0
  for (const a of c.abilities) if (w.db.ability(a).kind !== 'passive') c.hotbar[hb++] = { kind: 'ability', id: a }
  for (const d of ['Item.Bandage', 'Item.Cloth', 'Item.HealthDraught', 'Item.Hardtack', 'Item.Jerky', 'Item.WaterBottle']) {
    if (hb >= 10) break
    if (c.bag.some((i) => i.def === d)) c.hotbar[hb++] = { kind: 'item', def: d }
  }
  if (c.traits.includes('Trait.Alcoholic')) c.effects.push({ kind: 'drankRecently', untilTurn: 14400 })
  c.hp = hpMax(w, c)
  c.needs.stamina = energyMax(w, c)
  return c
}

export function findSpawnNear(w: World, base: Pos, n: number): Pos[] {
  const out: Pos[] = []
  const r = rng(w, 'story')
  for (let tries = 0; tries < 200 && out.length < n; tries++) {
    const p = { x: base.x + r.int(-3, 3), y: base.y + r.int(-3, 3) }
    if (!inBounds(w, p) || !terrainAt(w, p).passable || creatureAt(w, p) || out.some((o) => o.x === p.x && o.y === p.y)) continue
    out.push(p)
  }
  return out
}
