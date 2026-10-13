// 생물 생성: 플레이어(배경·특성)와 NPC(로드아웃)

import { createBody } from './body'
import { creatureAt, terrainAt, rng, inBounds, type World } from './ctx'
import type { Pos } from './geom'
import { addToInventory, equip, itemDef, makeItem } from './items'
import { newNeeds } from './needs'
import type { BackgroundDef, Creature, TraitDef } from './types'

const NAMES = ['에다', '로반', '케스', '미르', '타일', '브랜', '유나', '하렌', '오슬', '세린', '도겸', '아라', '베일', '노아', '카이', '린']

export function createCreature(w: World, defId: string, pos: Pos, name?: string): Creature {
  const def = w.db.creature(defId)
  const r = rng(w, 'world')
  const body = createBody(w.db.body(def.body), def)
  const sprites = Array.isArray(def.sprite) ? def.sprite : [def.sprite]
  const c: Creature = {
    id: w.s.nextId++,
    def: defId,
    name: name ?? def.label,
    sprite: r.pick(sprites),
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
    inventory: [],
    equipment: { apparel: [] },
    ai: {
      mode: 'wander',
      hunger: def.hunger ? r.range(def.hunger[0], def.hunger[1]) : 0.3,
      morale: def.morale,
    },
    exerted: false,
    history: [],
  }
  // 능력치 편차
  for (const k of Object.keys(c.stats) as (keyof typeof c.stats)[]) c.stats[k] = Math.max(3, c.stats[k] + r.int(-1, 1))
  // 로드아웃
  for (const slot of def.loadout?.slots ?? []) {
    if (slot.chance !== undefined && !r.chance(slot.chance)) continue
    const it = makeItem(w, r.pick(slot.items))
    addToInventory(w, c, it)
    const idef = itemDef(w, it)
    if (idef.apparel || idef.category === 'weapon' || idef.category === 'shield') equip(w, c, it.uid)
  }
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
  c.skills = { ...bg.skills }
  c.passions = { ...(bg.passions ?? {}) }
  c.literate = bg.literate
  c.traits = pickTraits(w, bg, 2 + (r.chance(0.3) ? 1 : 0))
  c.facing = 2
  c.nextAct = w.s.time
  c.inventory = []
  c.equipment = { apparel: [] }
  for (const id of bg.startItems) addToInventory(w, c, makeItem(w, id))
  let weaponSet = false
  for (const it of [...c.inventory]) {
    const d = itemDef(w, it)
    if (d.apparel) equip(w, c, it.uid)
    else if (d.category === 'weapon' && !weaponSet) { equip(w, c, it.uid); weaponSet = true }
  }
  if (c.traits.includes('Trait.Alcoholic')) c.effects.push({ kind: 'drankRecently', untilTurn: 14400 })
  return c
}

/** 가장자리 스폰 위치 (플레이어에게 보이지 않고 충분히 먼 곳) */
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
