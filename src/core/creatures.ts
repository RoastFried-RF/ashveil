import {initializeCrawler} from './crawlers'
// 생물 생성: 플레이어(배경·특성·시작 능력)와 NPC(로드아웃·잠듦·거점)

import {diseaseStream} from './disease-state'
import { ambientTemp } from './environment'
import { backgroundClues } from './rumors'
import { createBody, energyMax, hpMax } from './body'
import { creatureAt, terrainAt, rng, inBounds, turnOf, type World } from './ctx'
import type { Pos } from './geom'
import { addToInventory, equip, itemDef, makeItem } from './items'
import { initializeAge } from './growth'
import { newNeeds } from './needs'
import { setMasteryStage, type MasteryKind } from './skills'
import type { BackgroundDef, Creature, TraitDef, Stats } from './types'

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
    traits: [...(def.traits ?? [])],
    needs: newNeeds(turnOf(w)),
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
  const carrier=def.biteDisease?.carrier
  if(carrier&&rng(w,diseaseStream('carrier.'+c.id)).chance(carrier.chance)){c.biteCarrier=def.biteDisease!.id;if(!name)c.name=carrier.label}
  if (def.literacy !== undefined) { c.literacy = def.literacy; c.literate = def.literacy > 0 }
  // 능력치 흔들림은 약탈자만 (도감 H): 범위 안에서 정수
  if(def.temperatureLimits)c.needs.bodyTemp=ambientTemp(w)
  if (def.fixedBodyTemp !== undefined) c.needs.bodyTemp = def.fixedBodyTemp
  for (const [k, range] of Object.entries(def.statRange ?? {}) as [keyof typeof c.stats, [number, number]][]) c.stats[k] = r.int(range[0], range[1])
  c.abilities = [...(def.abilities ?? [])]
  for (const slot of def.loadout?.slots ?? []) {
    if (slot.chance !== undefined && !r.chance(slot.chance)) continue
    const it = makeItem(w, r.pick(slot.items), slot.count ? r.int(slot.count[0], slot.count[1]) : 1)
    addToInventory(w, c, it)
    const idef = itemDef(w, it)
    if (idef.slot && !c.equip[idef.slot === 'ring' ? 'ring1' : idef.slot]) equip(w, c, it.uid)
  }
  // 든 무기 계열에 따른 능력 (약탈자 근접: 도끼 → 쪼개기, 둔기 → 밀쳐내기, 15 §15)
  const fam = c.equip.main ? itemDef(w, c.equip.main).attacks?.[0]?.family : undefined
  for (const id of (fam && def.weaponAbilities?.[fam]) || []) if (!c.abilities.includes(id)) c.abilities.push(id)
  if(def.ageRange&&def.faction!=='player'&&w.db.body(def.body).kind==='humanoid')initializeAge(w,c,rng(w,`body.age.${c.id}`).int(def.ageRange[0],def.ageRange[1]))
  c.hp = hpMax(w, c)
  if(body.machine){
    for(const drop of w.db.body(body.def).mechanical!.salvage)if(r.chance(drop.chance))(body.machine.components??=[]).push(makeItem(w,drop.item,drop.count))
    body.machine.alert=0
  }
  initializeCrawler(w,c)
  c.needs.energy = energyMax(w, c)
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

/** 05 §2: 합50·7~13 범위에서6번 양도한 뒤 합0의 배경 보정을 더한다. */
export function rollStats(w: World, mods: Partial<Stats> = {}): Stats {
  const r = rng(w, 'world'), stats: Stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }
  const keys = Object.keys(stats) as (keyof Stats)[]
  for (let i = 0; i < 6; i++) {
    const from = r.pick(keys.filter((k) => stats[k] > 7)), to = r.pick(keys.filter((k) => k !== from && stats[k] < 13))
    stats[from]--; stats[to]++
  }
  for (const k of keys) stats[k] = Math.max(1, Math.min(20, stats[k] + (mods[k] ?? 0)))
  return stats
}

export function createPlayer(w: World, pos: Pos, bgId?: string, reroll: 0 | 1 = 0): Creature {
  const r = rng(w, 'world')
  reroll = reroll === 1 ? 1 : 0
  const bgs = w.db.all<BackgroundDef>('Background')
  const bg = bgId ? w.db.background(bgId) : r.pick(bgs)
  const c = createCreature(w, 'Creature.Drifter', pos, r.pick(NAMES))
  c.background = bg.id
  if (bg.startMoney) c.money = bg.startMoney
  c.stats = bg.statMode === 'delta' ? rollStats(w, bg.stats) : { str: 10, agi: 10, per: 10, vit: 10, wil: 10, ...bg.stats }
  c.traits = pickTraits(w, bg, 2 + (r.chance(0.3) ? 1 : 0))
  initializeAge(w, c, r.int(...(bg.ageRange ?? [20, 39])))
  // 04 §8: 다시 굴리는 대상은 특성이다. 능력치와 나이는 유지한다.
  if (reroll) c.traits = pickTraits(w, bg, 2 + (r.chance(0.3) ? 1 : 0))
  c.creationRoll = reroll
  // 숙련 폐지(D23): 의료·생존 숙달만, 배경이 시작 단계를 준다 (15 §9.1)
  c.skills = {}
  c.passions = {}
  for (const [k, st] of Object.entries(bg.mastery ?? {})) setMasteryStage(w, c, k as MasteryKind, st ?? 0)
  c.literacy = bg.literacy ?? (bg.literate ? 2 : 0)
  c.literate = (c.literacy ?? 0) > 0
  c.facing = 0
  c.nextAct = w.s.time
  c.bag = []
  c.equip = {}
  c.abilityPoints = 2 + (bg.bonusAbilityPoints ?? 0) // 15 §4: 시작 능력 포인트 2 + 배경 무료 능력
  c.statPoints = 0
  c.abilities = [...(bg.startAbilities ?? [])]
  for (const id of bg.startItems) {
    const it = makeItem(w, id)
    if (bg.startQuality?.[id] !== undefined) it.quality = bg.startQuality[id]
    addToInventory(w, c, it)
  }
  if (bg.immuneDiseases?.length) c.immuneDiseases = [...bg.immuneDiseases]
  if (bg.startScars?.length) c.body.scars = bg.startScars.map((s) => ({ ...s, cap: 1, burn: false, at: turnOf(w) }))
  if (bg.recipeCategories?.length) c.recipes = w.db.all<import('./types').RecipeDef>('Recipe').filter((r) => bg.recipeCategories!.includes(r.category)).map((r) => r.id)
  if (bg.startingMap || bg.startingRumors) backgroundClues(w, c, bg)
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
  initializeCrawler(w,c)
  c.needs.energy = energyMax(w, c)
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
