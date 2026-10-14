// 공격 판정 파이프라인 (07 §2). 모든 판정은 combat 스트림의 정수 roll 0..99 하나씩.
// 1 명중 → 2 방어 반응(막기/받아넘기기) → 3 부위 결정(‰) → 4 방어구 층 → 5 HP 피해·상처 → 6 2차 효과

import {
  addStun, addWound, ARM_BLOCK, ARM_DMG, bloodLoss, bodyDef, isMissing, painStage, painTotal, part, regionPenalties,
  regionState, totalBleed,
} from './body'
import { clamp, creatureAt, creatureById, inBounds, log, player, rng, terrainAt, tileAt, turnOf, type World } from './ctx'
import { canSee, hasLos, lightLevel } from './fov'
import { cheb, DIRS, dirDelta, dirIndex, line, type Pos } from './geom'
import { apparelItems, gridAdd, itemDef, makeItem, meleeWield, qualityInfo, wield, type Wield } from './items'
import { addThought } from './needs'
import { moraleEvent, moraleOf } from './morale'
import { emitNoise } from './perception'
import { awardDefeat } from './progression'
import { addEffect, effectMag, hasEffect, traitAdd, traitMul, traitOverride } from './traits'
import type { AbilityAttackMods, ArmorCategory, AttackDef, BodyPartDef, Creature, DamageType, FxEvent, ItemInst, Region } from './types'

/** 크기 보정: 작음 +4 · 보통 0 · 큼 −4 · 거대 −8 (07 §2.1) */
const SIZE_EVASION: Record<string, number> = { tiny: 4, small: 4, medium: 0, large: -4, huge: -8 }
const SIZE_RANK: Record<string, number> = { tiny: 0, small: 1, medium: 2, large: 3, huge: 4 }

function size(w: World, c: Creature): string {
  return w.db.creature(c.def).sizeClass
}

export function isDown(w: World, c: Creature): boolean {
  return hasEffect(c, 'knockedDown', turnOf(w))
}

/** 회피치 = (민첩 − 10) × 2 + 장비·능력 − 둔중 + 크기, 양수면 × 다리 계수(내림) (07 §2.1) */
export function evasion(w: World, c: Creature): number {
  let e = (c.stats.agi - 10) * 2 + (w.db.creature(c.def).evasion ?? 0) + traitAdd(w, c, 'evasion') + (SIZE_EVASION[size(w, c)] ?? 0)
  for (const it of Object.values(c.equip)) {
    if (!it) continue
    e -= itemDef(w, it).bulk ?? 0
    if (it.half) e -= 2 // 반쯤 입은 장비 (01 §7)
  }
  if (e > 0) e = Math.floor(e * regionPenalties(w, c).evasionCoef)
  const terr = terrainAt(w, c.pos)
  if (terr.id.includes('Mud') || terr.water === 'shallow') e -= 2
  return e
}

/** 공격치 = 무기 정확도 + floor((민첩 − 10) × 1.5) + (지각 − 머리 불이익 − 10) + 능력·장비 (05 §2.1) */
export function attackScore(w: World, a: Creature, atk: AttackDef): number {
  const pen = regionPenalties(w, a)
  return atk.accuracy + Math.floor((a.stats.agi - 10) * 1.5) + (a.stats.per - pen.per - 10) + traitAdd(w, a, 'hitBonus')
}

/** 대상 기준 공격자 방향: front · side · back, 그리고 좌우 */
export function facingRelation(defender: Creature, attackerPos: Pos): 'front' | 'side' | 'back' {
  const toAtt = dirIndex(attackerPos.x - defender.pos.x, attackerPos.y - defender.pos.y)
  const d = dirDelta(defender.facing, toAtt)
  return d <= 1 ? 'front' : d === 2 ? 'side' : 'back'
}

/** 방향 관계. 융합체처럼 등 뒤가 없는 개체는 늘 정면 (bestiary §20) */
export function relationOf(w: World, defender: Creature, attackerPos: Pos): 'front' | 'side' | 'back' {
  return w.db.creature(defender.def).noBack ? 'front' : facingRelation(defender, attackerPos)
}

function sideOf(defender: Creature, attackerPos: Pos): 'l' | 'r' | undefined {
  const toAtt = dirIndex(attackerPos.x - defender.pos.x, attackerPos.y - defender.pos.y)
  const off = (toAtt - defender.facing + 8) % 8
  return off === 2 ? 'r' : off === 6 ? 'l' : undefined
}

/** 기습 대상: 잠듦·의식 없음(기절) (07 §2.8, D28) */
export function helpless(c: Creature): boolean {
  return !!c.asleep || c.unconscious || c.activity?.kind === 'sleep'
}

/** 대상이 공격자를 인지하지 못함 (기습 +20, 반응 불가) */
function unaware(w: World, a: Creature, d: Creature): boolean {
  if (helpless(d)) return false
  if (d.faction !== 'player' && (d.ai.mode === 'hunt' || d.ai.mode === 'flee') && d.ai.target === a.id) return false
  if (d.ai.alertTurn !== undefined && turnOf(w) - d.ai.alertTurn < 10 && d.faction !== 'player') return false
  return !canSee(w, d, a.pos)
}

function narrowCorridor(w: World, p: Pos): boolean {
  let open = 0
  for (const i of [0, 2, 4, 6]) {
    const q = { x: p.x + DIRS[i].x, y: p.y + DIRS[i].y }
    if (inBounds(w, q) && terrainAt(w, q).passable) open++
  }
  return open <= 2
}

export interface HitPreview { chance: number; lines: string[]; attack: AttackDef; wield?: Wield }

/** 1단계 명중: clamp(5, 95, 50 + (공격치 − 회피치) × 2 + Σ수정치) (07 §2.1) */
export function previewHit(w: World, a: Creature, d: Creature, ranged = false, mods?: AbilityAttackMods, wd?: Wield): HitPreview | null {
  const wl = wd ?? (ranged ? wield(w, a) : meleeWield(w, a))
  if (!wl) return null
  const atk = wl.atk
  const turn = turnOf(w)
  const lines: string[] = []
  const as = attackScore(w, a, atk)
  const ev = helpless(d) ? 0 : evasion(w, d)
  let chance = 50 + (as - ev) * 2
  lines.push(`50 + (공격치 ${as} − 회피치 ${ev}) × 2 = ${chance}`)
  const add = (label: string, v: number) => { if (v !== 0) { chance += v; lines.push(`${label} ${v > 0 ? '+' : ''}${v}`) } }
  // 방향 · 기습
  if (helpless(d)) add(d.unconscious ? '의식 없는 상대' : '잠든 상대', 40)
  else {
    const rel = relationOf(w, d, a.pos)
    add(rel === 'back' ? '후면' : rel === 'side' ? '측면' : '정면', rel === 'back' ? 20 : rel === 'side' ? 10 : 0)
    if (unaware(w, a, d)) add('기습', 20)
  }
  // 조명 (대상 칸): 밝음 0 · 어스름 −5 · 어둠 −15 · 칠흑 −30
  const lv = lightLevel(w, d.pos)
  let lp = [0, -5, -15, -30][lv]
  const ds = w.db.creature(a.def).darkSight
  if (ds && lv >= 2) lp = -ds[lv - 2]
  // 야행성: 어둠 단계 감점 5 완화, 조준 사격·다리 쏘기는 조명 감점 절반 (04 §8 #8)
  if (traitAdd(w, a, 'nightOwl') > 0 && lp < 0) lp = mods?.aimed ? Math.ceil(lp / 2) : Math.min(0, lp + 5)
  add(['밝음', '어스름', '어둠', '칠흑'][lv], lp)
  if (isDown(w, d) && !helpless(d)) add('넘어진 상대', ranged ? -15 : 20)
  // 고저차 (07 §5): 단차 1 높으면 근접 +10 · 원거리 +5, 낮으면 반대
  const elev = terrainAt(w, a.pos).elevation ?? 0, delev = terrainAt(w, d.pos).elevation ?? 0
  if (elev !== delev) add(elev > delev ? '높은 자리' : '낮은 자리', (elev > delev ? 1 : -1) * (ranged ? 5 : 10))
  // 엄폐 (07 §2.1, 원거리만): 대상 바로 앞(쏘는 쪽) 칸의 장애물
  if (ranged && cheb(a.pos, d.pos) > 1) {
    const q = { x: d.pos.x + Math.sign(a.pos.x - d.pos.x), y: d.pos.y + Math.sign(a.pos.y - d.pos.y) }
    const cv = terrainAt(w, q).cover ?? 0
    if (cv) add(cv >= 30 ? '전 엄폐' : '반 엄폐', -cv)
  }
  // 공격자 머리·쥔 팔
  const pen = regionPenalties(w, a, wl.arm, wl.twoHanded)
  add('머리 상태', -pen.headHit)
  add('쥔 팔 상태', -Math.min(10, pen.armHit))
  // 공격자 몸
  add('통증', -5 * painStage(painTotal(w, a)))
  const loss = bloodLoss(a)
  add('실혈', loss >= 0.3 ? -20 : loss >= 0.15 ? -10 : 0)
  add('기력', a.needs.energy <= 0 ? -15 : a.needs.energy < 25 ? -5 : 0)
  if (isDown(w, a)) add('넘어짐', -20)
  if ((a.drowsyUntil ?? 0) > turn) add('잠기운', -20)
  const morale = a.ai.morale
  if (a.faction !== 'player' && !w.db.creature(a.def).noMorale && morale >= 25 && morale < 40) add('흔들림', -5)
  // 대칭 (07 §8): 플레이어도 같은 사기 공식. 25 미만이면 '공포' 명중 −10 (조작권은 빼앗지 않는다)
  if (a.faction === 'player' && moraleOf(w, a) < 25) add('공포', -10)
  if (a.ai.cornered) add('궁지', 5)
  // 협공: 같은 대상에 인접한 다른 아군 1명당 +5 (최대 +15)
  if (!ranged) {
    let mates = 0
    for (const o of w.s.creatures) if (o.alive && o.id !== a.id && o.faction === a.faction && !helpless(o) && cheb(o.pos, d.pos) <= 1) mates++
    add('협공', Math.min(15, mates * 5))
  }
  const dist = cheb(a.pos, d.pos)
  if (ranged) {
    const rd = wl.item ? itemDef(w, wl.item).ranged : undefined
    const over = Math.max(0, dist - (rd?.effective ?? rd?.range ?? 6))
    let rp = over * 3
    if (traitAdd(w, a, 'rangePenaltyHalf') > 0) rp = Math.floor(rp / 2)
    add('사거리 초과', -rp)
    if (dist <= 1) add('인접 사격', -10)
    if (d.movedTurn !== undefined && turn - d.movedTurn <= 1) add('이동 중인 대상', -5)
    // 연기·포자 구름: 사선상 칸당 −10 (07 §2.1)
    let clouds = 0
    for (const q of line(a.pos, d.pos)) if ((w.s.map.tiles[q.y * w.s.map.w + q.x].spores?.until ?? 0) > turn) clouds++
    add('포자 구름', -10 * clouds)
  } else {
    if ((atk.reach ?? 1) >= 2 && dist <= 1) add('긴 자루 인접', -10)
    if (dist === 2) add('거리 유지', traitAdd(w, a, 'reachHit'))
    if (atk.family === 'axe' && narrowCorridor(w, a.pos)) add('좁은 곳 도끼', -15)
  }
  if (mods?.hitBonus) add('능력', mods.hitBonus)
  // 알코올 의존 금단(손떨림): 공격형 액티브 명중 −10 (15 §9.2)
  if (mods && hasEffect(a, 'withdrawal', turn)) add('손떨림', -10)
  chance = clamp(chance, 5, 95)
  lines.push(`최종 ${chance}% (5~95)`)
  return { chance, lines, attack: atk, wield: wl }
}

// ── 2단계 방어 반응 ──────────────────────────────

interface Reaction { kind: 'shield' | 'block' | 'parry'; chance: number; cost: number; item: ItemInst }

/** 같은 턴 두 번째 반응부터 기력 ×1.5, 세 번째 ×2 (07 §2.2) */
function reactionMult(w: World, d: Creature): number {
  const turn = turnOf(w)
  const n = d.reactions?.turn === turn ? d.reactions.n : 0
  return n === 0 ? 1 : n === 1 ? 1.5 : 2
}

function reactionOptions(w: World, a: Creature, d: Creature, D: number, ranged: boolean): Reaction[] {
  const turn = turnOf(w)
  if (helpless(d) || d.ai.mode === 'surrender' || d.ai.cornered || d.needs.energy <= 0) return []
  if (hasEffect(d, 'stunned', turn) || unaware(w, a, d) || !canSee(w, d, a.pos)) return []
  const rel = relationOf(w, d, a.pos)
  const side = sideOf(d, a.pos)
  const down = isDown(w, d)
  const mult = reactionMult(w, d)
  const la = regionState(w, d, 'larm'), ra = regionState(w, d, 'rarm')
  const out: Reaction[] = []
  // 방패 막기: 정면, 방패쪽(왼쪽) 측면 −20
  const sh = d.equip.off
  const shDef = sh ? itemDef(w, sh).shield : undefined
  if (sh && shDef && la < 4 && (sh.durability ?? 100) > 0 && (rel === 'front' || (rel === 'side' && side === 'l'))) {
    let ch = shDef.block + (d.stats.str - 10) * 2 + traitAdd(w, d, 'blockBonus') - ARM_BLOCK[la] - (rel === 'side' ? 20 : 0) - (down ? 20 : 0)
    ch = clamp(ch, 0, 85)
    out.push({ kind: 'shield', chance: ch, cost: Math.ceil((4 + Math.floor(D / 2)) * mult), item: sh })
  }
  const wl = wield(w, d)
  const wdef = wl?.item ? itemDef(w, wl.item) : undefined
  if (!down && !ranged && rel === 'front' && wl?.item && wdef?.weapon && !wdef.ranged && (wl.item.durability ?? 100) > 0) {
    const armSt = wl.twoHanded ? Math.max(la, ra) : wl.arm === 'larm' ? la : ra
    if (armSt < 4) {
      // 무기 막기
      const bc = clamp(wdef.weapon.block + (d.stats.str - 10) - ARM_BLOCK[armSt], 0, 50)
      out.push({ kind: 'block', chance: bc, cost: Math.ceil((6 + D) * mult), item: wl.item })
      // 받아넘기기: 받아넘기기 자세 +40, 상한 90
      const stance = effectMag(d, 'parryStance', turn)
      const pc = clamp(15 + (d.stats.agi - a.stats.agi) * 2 + wdef.weapon.parry, 0, 50) + stance
      out.push({ kind: 'parry', chance: clamp(pc, 0, stance ? 90 : 50), cost: Math.ceil(6 * mult), item: wl.item })
    }
  }
  return out.filter((o) => o.cost <= d.needs.energy)
}

/** 반응 정책 (07 §2.2): 플레이어 설정 · AI는 가장 높은 쪽. 최선이 10% 미만이면 생략 */
function chooseReaction(d: Creature, opts: Reaction[]): Reaction | undefined {
  if (!opts.length) return undefined
  const policy = d.faction === 'player' ? d.reactPolicy ?? 'block' : 'best'
  if (policy === 'none') return undefined
  const best = [...opts].sort((x, y) => y.chance - x.chance)[0]
  if (best.chance < 10) return undefined
  if (policy === 'parry') return opts.find((o) => o.kind === 'parry' && o.chance >= 10) ?? best
  if (policy === 'block') return opts.filter((o) => o.kind !== 'parry' && o.chance >= 10).sort((x, y) => y.chance - x.chance)[0] ?? best
  return best
}

// ── 3단계 부위 결정 (07 §2.3) ──────────────────────

const REGION_ORDER: Region[] = ['head', 'torso', 'rarm', 'larm', 'rleg', 'lleg']

export interface PartPick { part: BodyPartDef; lines: string[] }

export function pickPart(w: World, a: Creature, d: Creature, opts: { mods?: AbilityAttackMods; shieldFailed?: boolean; sneak?: boolean } = {}): PartPick {
  const r = rng(w, 'combat')
  const bdef = bodyDef(w, d)
  const side = w.db.creature(d.def).noBack ? undefined : sideOf(d, a.pos)
  const smaller = SIZE_RANK[size(w, d)] - SIZE_RANK[size(w, a)] >= 2
  const down = isDown(w, d)
  const pw = opts.mods?.partWeights
  const cands = bdef.parts
    .filter((p) => !p.internal && (p.coverage ?? 0) > 0 && !isMissing(w, d, p.id))
    .sort((x, y) => REGION_ORDER.indexOf(x.region) - REGION_ORDER.indexOf(y.region))
  const weights = cands.map((p) => {
    let m = 1
    if (side && p.side) m *= p.side === side ? 1.5 : 0.5
    const isLeg = p.region === 'lleg' || p.region === 'rleg'
    const isArm = p.region === 'larm' || p.region === 'rarm'
    if (smaller) m *= isLeg ? 3 : isArm ? 0.5 : p.region === 'head' ? 0 : 1
    if (down) m *= p.region === 'head' || p.region === 'torso' ? 1.5 : isLeg ? 0.5 : 1
    if (opts.sneak && p.id === 'Neck') m *= 2
    if (opts.shieldFailed && p.region === 'larm') m *= 2
    if (pw) {
      m *= pw[p.region] ?? 1
      if (p.id === 'Neck' && pw.neck) m *= pw.neck
    }
    return Math.round((p.coverage ?? 0) * m)
  })
  const total = weights.reduce((s, v) => s + v, 0)
  const roll = r.int(0, Math.max(0, total - 1))
  let acc = 0
  let pick = cands[0]
  for (let i = 0; i < cands.length; i++) {
    acc += weights[i]
    if (roll < acc) { pick = cands[i]; break }
  }
  const lines = [`부위: ${pick.label} ${weights[cands.indexOf(pick)]} / ${total} (roll ${roll})`]
  // 손·발 피격의 일부는 손가락·발가락으로 (02 §2.2)
  if (pick.childShare) {
    const kids = bdef.parts.filter((p) => p.parent === pick.id && p.digit && !isMissing(w, d, p.id))
    if (kids.length && r.int(0, 99) < pick.childShare) {
      const k = r.weighted(kids, (p) => p.weight ?? 1)!
      lines.push(`→ ${k.label}`)
      pick = k
    }
  }
  return { part: pick, lines }
}

// ── 4·5·6단계 ───────────────────────────────────

function armorCategory(t: DamageType): ArmorCategory {
  return t === 'blunt' ? 'blunt' : t === 'burn' ? 'heat' : 'sharp'
}

const WOUND_FOR: Record<DamageType, string> = {
  cut: 'Wound.Cut', stab: 'Wound.Stab', blunt: 'Wound.Bruise', bite: 'Wound.Bite', burn: 'Wound.Burn',
}

export interface AttackResult { hit: boolean; damage: number; killed: boolean; reacted?: string }
export interface AttackOpts {
  ranged?: boolean
  mods?: AbilityAttackMods
  abilityLabel?: string
  /** 반격(0턴·기력 0) */
  counter?: boolean
  /** 공격 방식 지정 (능력의 베기/찌르기) */
  mode?: string
  /** 기력을 이미 냈다 (능력) */
  paid?: boolean
}

export function fx(w: World, ev: FxEvent) {
  w.s.fx.push(ev)
  if (w.s.fx.length > 80) w.s.fx.splice(0, w.s.fx.length - 80)
}

/** 깨우기. 맞아서 깨면 잠기운 10턴(깊은 잠 20턴) (01 §8.3) */
export function wake(w: World, c: Creature, why: string) {
  if (!c.asleep) return
  const turn = turnOf(w)
  c.asleep = false
  c.drowsyUntil = turn + (c.deepSleep ? 20 : 10)
  c.deepSleep = false
  c.ai.alertTurn = turn
  fx(w, { k: 'status', id: c.id, text: '!', color: '#ffd060', turn })
  if (c.faction !== 'player' && w.s.visible.includes(c.pos.y * w.s.map.w + c.pos.x)) log(w, 'warn', `${c.name}이(가) 깨어났다. (${why})`)
}

/** 한 층의 결과 분포 [튕김, 절반, 관통] % (정수 roll 0..99, 07 §2.4) */
export function layerOdds(useful: number, crumple: boolean): [number, number, number] {
  let d = 0, h = 0
  for (let roll = 0; roll < 100; roll++) {
    if ((crumple ? 4 : 2) * roll < useful) d++
    else if (roll < useful) h++
  }
  return [d, h, 100 - d - h]
}

function wear(it: ItemInst | undefined, pct: number) {
  if (!it || pct <= 0) return
  it.durability = Math.max(0, (it.durability ?? 100) - pct)
}

function dull(it: ItemInst | undefined, loss: number) {
  if (!it || it.edge === undefined) return
  it.edge = Math.max(0, it.edge - loss)
}

export function resolveAttack(w: World, a: Creature, d: Creature, opts: AttackOpts = {}): AttackResult {
  const r = rng(w, 'combat')
  const turn = turnOf(w)
  const mods = opts.mods
  const wl = opts.ranged ? wield(w, a, opts.mode) : meleeWield(w, a, opts.mode)
  const pv = previewHit(w, a, d, opts.ranged, mods, wl)
  const res: AttackResult = { hit: false, damage: 0, killed: false }
  if (!pv || !wl) return res
  const atk = pv.attack
  const detail: string[] = [...pv.lines]
  const isPlayer = a.faction === 'player' || d.faction === 'player'
  const aName = a.faction === 'player' ? '당신' : a.name
  const dName = d.faction === 'player' ? '당신' : d.name
  const label = opts.abilityLabel ?? atk.label
  const sneak = helpless(d)
  const firstSneak = sneak

  a.exerted = true
  // 기본 공격은 무기 기력 전부, 능력은 능력 비용으로 대체 (07 §2.7 · §6)
  if (!opts.paid && !opts.counter) a.needs.energy = Math.max(0, a.needs.energy - atk.energy)
  a.facing = dirIndex(d.pos.x - a.pos.x, d.pos.y - a.pos.y)
  fx(w, { k: 'attack', id: a.id, target: d.id, turn })
  emitNoise(w, a.pos, atk.noise ?? 6, a.id)
  d.ai.alertTurn = turn
  noteFight(w, a, d)

  // 1 명중
  const roll = r.int(0, 99)
  detail.push(`roll ${roll} < ${pv.chance}?`)
  if (roll >= pv.chance) {
    fx(w, { k: 'miss', id: d.id, turn })
    wake(w, d, '빗나간 공격')
    if (isPlayer) log(w, 'combat', `${aName}의 ${label} — ${dName}에게 빗나갔다.`, detail)
    return res
  }

  // 피해 원값 D0 = floor(기본 × 날 상태 × 근력 보정 × 팔 상태 × (80 + r)/100), r = 0..40 (07 §2.5)
  const pen0 = regionPenalties(w, a, wl.arm, wl.twoHanded)
  let edgeF = 1
  if (wl.item?.edge !== undefined && (atk.damageType === 'cut' || atk.damageType === 'stab')) edgeF = (60 + wl.item.edge * 0.4) / 100
  const strF = opts.ranged || atk.family === 'archery' ? 1 : (100 + (a.stats.str - 10) * 5) / 100
  const rr = r.int(0, 40)
  const qm = wl.item ? qualityInfo(wl.item).dmg : 1
  let D = Math.floor(atk.damage * qm * edgeF * strF * ARM_DMG[pen0.armState] * (80 + rr) / 100)
  detail.push(`피해 ${atk.damage}${qm !== 1 ? ` × 품질 ${qm}` : ''} × 날 ${edgeF.toFixed(2)} × 근력 ${strF.toFixed(2)} × 팔 ${ARM_DMG[pen0.armState]} × ${80 + rr}% = ${D}`)
  if (mods?.damageMult) { D = Math.floor(D * mods.damageMult); detail.push(`능력 ×${mods.damageMult} → ${D}`) }
  const fero = traitMul(w, a, 'dmgVsBleeding')
  if (fero !== 1 && totalBleed(w, d) > 0) { D = Math.floor(D * fero); detail.push(`흉포 ×${fero} → ${D}`) }
  if (firstSneak) {
    const m = atk.shortBlade ? 2 : 1.5
    D = Math.floor(D * m)
    detail.push(`기습 첫 타 ×${m} → ${D}`)
  }
  let dtype: DamageType = atk.damageType
  let pen = atk.pen + (mods?.penBonus ?? 0)

  // 2 방어 반응
  let shieldFailed = false
  let forcedPart: string | undefined
  if (!sneak && !opts.counter) {
    const react = chooseReaction(d, reactionOptions(w, a, d, D, !!opts.ranged))
    if (react) {
      d.needs.energy -= react.cost
      d.exerted = true
      d.reactions = { turn, n: (d.reactions?.turn === turn ? d.reactions.n : 0) + 1 }
      const rroll = r.int(0, 99)
      const ok = rroll < react.chance
      const name = react.kind === 'shield' ? '방패 막기' : react.kind === 'block' ? '무기 막기' : '받아넘기기'
      detail.push(`${name} ${react.chance}% · 기력 ${react.cost} · roll ${rroll} → ${ok ? '성공' : '실패'}`)
      if (ok && react.kind === 'shield') {
        emitNoise(w, d.pos, 8, d.id)
        fx(w, { k: 'block', id: d.id, turn })
        const absorb = itemDef(w, react.item).shield!.absorb
        wear(react.item, Math.floor(D / 4) * (atk.shieldDamage ?? 1))
        if (D <= absorb) {
          res.reacted = 'shield'
          if (isPlayer) log(w, 'combat', `${dName}이(가) 방패로 ${aName}의 ${label}을(를) 막았다.`, detail)
          return res
        }
        // 흡수 초과분은 방패 든 팔에 타격으로
        D -= absorb
        dtype = 'blunt'
        forcedPart = bodyDef(w, d).parts.find((p) => p.region === 'larm' && /Forearm|Leg/.test(p.id))?.id
        detail.push(`방패 흡수 ${absorb}, 넘친 ${D}이(가) 방패 든 팔로`)
      } else if (ok) {
        emitNoise(w, d.pos, 8, d.id)
        fx(w, { k: react.kind === 'parry' ? 'parry' : 'block', id: d.id, turn })
        if (react.kind === 'block') wear(react.item, Math.floor(D / 4))
        res.reacted = react.kind
        if (isPlayer) log(w, 'combat', `${dName}이(가) ${aName}의 ${label}을(를) ${react.kind === 'parry' ? '받아넘겼다' : '무기로 막았다'}.`, detail)
        if (react.kind === 'parry') {
          a.nextAct += 50 // 빈틈 +50TU
          if (hasEffect(d, 'parryStance', turn) && canReach(w, d, a)) {
            if (isPlayer) log(w, 'combat', `${dName}의 반격!`)
            resolveAttack(w, d, a, { counter: true, abilityLabel: '반격' })
          }
        }
        return res
      } else if (react.kind === 'shield') shieldFailed = true
    }
  }

  // 3 부위
  const pk = forcedPart ? { part: part(w, d, forcedPart), lines: [`부위: ${part(w, d, forcedPart).label}(방패 팔)`] } : pickPart(w, a, d, { mods, shieldFailed, sneak })
  const pd = pk.part
  detail.push(...pk.lines)

  // 4 방어구 층: 망토 → 몸 → 자연 방어 (07 §2.4)
  const tag = pd.groups[0]
  const layers: { label: string; armor: Partial<Record<ArmorCategory, number>>; it?: ItemInst; max: number }[] = apparelItems(w, d)
    .filter(({ def }) => def.apparel!.groups.includes(tag))
    .sort((x, y) => y.def.apparel!.layer - x.def.apparel!.layer)
    .map(({ it, def }) => ({ label: def.label, armor: def.apparel!.armor, it, max: Math.floor(def.apparel!.durability * qualityInfo(it).dur) }))
  const nat = w.db.creature(d.def).naturalArmor
  if (nat) layers.push({ label: '자연 방어', armor: nat, max: 0 })
  const crumple = traitAdd(w, a, 'deflectHalf') > 0
  const hitItems: ItemInst[] = []
  for (const L of layers) {
    const base = L.armor[armorCategory(dtype)] ?? 0
    const dur = L.it ? L.it.durability ?? 100 : 100
    let effA = Math.floor(base * (L.it ? qualityInfo(L.it).dmg : 1) * (50 + dur / 2) / 100)
    if (L.it?.half) effA = Math.floor(effA / 2)
    const useful = effA - pen
    if (L.it) hitItems.push(L.it)
    if (useful <= 0) { detail.push(`${L.label}: 실효 ${effA} − 관통 ${pen} ≤ 0, 통과`); continue }
    const ar = r.int(0, 99)
    const blockedLoss = (blocked: number) => L.it && L.max > 0 ? Math.floor(blocked * 100 / L.max) : 0
    if ((crumple ? 4 : 2) * ar < useful) {
      detail.push(`${L.label}: 유효 ${useful}, roll ${ar} → 튕김`)
      wear(L.it, blockedLoss(D))
      wear(wl.item, 2)
      dull(wl.item, 3)
      fx(w, { k: 'deflect', id: d.id, turn })
      emitNoise(w, d.pos, 8, d.id)
      wake(w, d, '공격받음')
      if (isPlayer) log(w, 'combat', `${aName}의 ${label}이(가) ${dName}의 ${L.label}에 튕겨났다.`, detail)
      return res
    }
    if (ar < useful) {
      const before = D
      D = Math.floor(D / 2)
      if (dtype === 'cut' || dtype === 'stab' || dtype === 'bite') dtype = 'blunt'
      pen = Math.floor(pen / 2)
      detail.push(`${L.label}: 유효 ${useful}, roll ${ar} → 절반 ${D} · 타격 변환`)
      wear(L.it, blockedLoss(before - D))
      dull(wl.item, 2)
    } else detail.push(`${L.label}: 유효 ${useful}, roll ${ar} → 관통`)
  }
  if (mods?.armorDamage) for (const it of hitItems) wear(it, mods.armorDamage + traitAdd(w, a, 'splitBonus'))
  wear(wl.item, 1)
  dull(wl.item, 1)
  if (D <= 0) {
    detail.push('피해 0')
    if (isPlayer) log(w, 'combat', `${aName}의 ${label}이(가) ${dName}의 ${pd.label}에 닿았지만 상처를 내지 못했다.`, detail)
    wake(w, d, '공격받음')
    return res
  }

  // 5 상처
  const hpBefore = d.hp
  const out = applyWound(w, a, d, pd, D, dtype, atk, mods, detail, label)
  d.hp -= D
  res.hit = true
  res.damage = D
  fx(w, { k: 'dmg', id: d.id, v: D, crit: sneak || out.arterial, turn })
  let text = `${aName}의 ${label} → ${dName}의 ${out.target.label}에 ${out.woundLabel} (${D})`
  if (sneak) text = '기습! ' + text
  if (out.arterial) { text += ' — 동맥이 끊겼다! 피가 뿜어져 나온다'; fx(w, { k: 'status', id: d.id, text: '동맥!', color: '#ff4040', turn }) }
  if (out.fracture) { text += ` — 뼈가 부러졌다(${out.fracture})`; fx(w, { k: 'status', id: d.id, text: '골절!', color: '#f0d0a0', turn }) }
  if (out.tendon) text += ' — 힘줄이 끊겼다'
  if (out.destroyed) text += out.severed ? ` — ${out.destroyed}이(가) 떨어져 나갔다` : ` — ${out.destroyed}이(가) 못 쓰게 됐다`
  if (out.severed) fx(w, { k: 'status', id: d.id, text: '절단!', color: '#ff6060', turn })
  if (out.organ && d.faction !== 'player') text += ` — 깊숙이 박혔다`
  detail.push(`HP ${Math.round(hpBefore)} → ${Math.round(d.hp)}`)
  if (isPlayer) log(w, d.faction === 'player' ? 'danger' : 'combat', text, detail)
  if (d.faction === 'player') d.history.push({ turn, kind: 'wound', text: `${a.name}에게 ${out.target.label} ${out.woundLabel}${out.arterial ? '(동맥)' : ''}${out.fracture ? '(골절)' : ''}` })
  if (out.severed && d.faction === 'player') addThought(w, d, 'Thought.Maimed')

  // 6 2차 효과
  secondary(w, a, d, out.target, D, dtype, atk, mods, out.tendon, isPlayer, dName)
  if (sneak) {
    // 기습 비명: 같은 방 잠든 개체의 각성 판정 (07 §2.8)
    emitNoise(w, d.pos, 12, d.id)
  }
  wake(w, d, '공격받음')
  return res
}

interface WoundOut {
  target: BodyPartDef
  woundLabel: string
  arterial: boolean
  fracture?: string
  tendon: boolean
  destroyed?: string
  severed: boolean
  organ?: string
}

/** 동맥 판정 문턱: 심각도가 부위 HP의 이 % 이상일 때만 (CANON D33) */
export const ARTERY_MIN_PCT = 30

function applyWound(w: World, a: Creature, d: Creature, pd: BodyPartDef, D: number, dtype: DamageType, atk: AttackDef,
  mods: AbilityAttackMods | undefined, detail: string[], label: string): WoundOut {
  const r = rng(w, 'combat')
  const bdef = bodyDef(w, d)
  const source = `${a.name}의 ${label}`
  const bleedMult = (atk.bleedMult ?? 1) * (mods?.bleedMult ?? 1)
  const hp = d.body.maxHp[pd.id]
  detail.push(`심각도 ${D}/${hp} = ${Math.round(D * 100 / hp)}% (${D < hp * 0.25 ? '경상' : D < hp * 0.5 ? '중상' : D < hp ? '심각' : '파괴'})`)
  // 동맥: 베기·찌르기·물기, D ≥ 부위 HP 30%일 때만 D × 2% (+ 깊게 베기 15%p) — CANON D33
  let artery = 0
  if (pd.artery && (dtype === 'cut' || dtype === 'stab' || dtype === 'bite') && D * 100 >= hp * ARTERY_MIN_PCT) {
    const ch = clamp(D * 2 + (mods?.arterialBonus ?? 0), 0, 100)
    const ar = r.int(0, 99)
    detail.push(`동맥 판정 ${ch}% roll ${ar}`)
    if (ar < ch) artery = pd.artery
  }
  // 힘줄: 손·전완·발 베기 D ≥ 부위 HP 40%
  let tendon = false
  if (pd.tendon && dtype === 'cut' && D * 100 >= hp * 40 && r.int(0, 99) < 50) tendon = true
  // 골절: 타격(방어구가 바꾼 피해 포함), (D − 뼈 강도) × 8% × 배율, 상한 90
  let fracture: { grade: 'hairline' | 'simple' | 'compound'; progress: number } | undefined
  if (pd.bone !== undefined && dtype === 'blunt' && D > pd.bone) {
    const special = (mods?.fractureMult ?? 1) * traitMul(w, a, 'fractureDealt')
    const m = special * (special > 1 ? traitMul(w, d, 'fractureTaken') : 1)
    const ch = clamp(Math.floor((D - pd.bone) * 8 * m), 0, 90)
    const fr = r.int(0, 99)
    detail.push(`골절 판정 (${D} − ${pd.bone}) × 8 × ${m} = ${ch}% roll ${fr}`)
    if (fr < ch) {
      const margin = D - pd.bone
      fracture = { grade: margin <= 3 ? 'hairline' : margin <= 9 ? 'simple' : 'compound', progress: 0 }
    }
  }
  const woundId = WOUND_FOR[dtype]
  const { wound, destroyed, severed } = addWound(w, d, {
    def: woundId, part: pd.id, severity: D, source, sourceId: a.id, artery, fracture, tendon, bleedMult,
    contam: (atk.contam ?? 0) + (fracture?.grade === 'compound' ? 30 : 0),
    canSever: dtype === 'cut' || dtype === 'bite',
  })
  if (fracture?.grade === 'compound') wound.bleed += D
  detail.push(`출혈 ${wound.bleed}${wound.artery ? ` + 동맥 ${wound.artery}` : ''} ml/턴`)
  // 장기 관통: 찌르기 clamp(0, 80, (D − 4) × 6)% (흉부·복부), 두개골은 남은 HP를 넘으면 뇌
  let organ: string | undefined
  const inner = bdef.parts.filter((p) => p.parent === pd.id && p.internal && !p.digit && !isMissing(w, d, p.id))
  if (inner.length && dtype === 'stab' && pd.organMiss !== undefined) {
    const ch = clamp((D - 4) * 6, 0, 80)
    const or = r.int(0, 99)
    detail.push(`장기 관통 ${ch}% roll ${or}`)
    if (or < ch) {
      const pool: (BodyPartDef | null)[] = [...inner, null]
      const pick = r.weighted(pool, (p) => (p ? p.weight ?? 1 : pd.organMiss ?? 0))
      if (pick) organ = pick.id
    }
  } else if (dtype === 'blunt' && pd.id === 'Abdomen' && D * 100 >= hp * 40 && r.int(0, 99) < 25) {
    const pick = r.weighted(inner.filter((p) => p.id === 'Spleen' || p.id === 'Liver'), (p) => p.weight ?? 1)
    if (pick) organ = pick.id
  } else if (pd.id === 'Skull' && destroyed) {
    organ = inner.find((p) => p.capacities?.consciousness)?.id
  }
  if (organ) {
    const op = part(w, d, organ)
    addWound(w, d, { def: 'Wound.InternalBleed', part: organ, severity: D, source, sourceId: a.id, internal: true })
    detail.push(`→ ${op.label} 관통 (내출혈 ${Math.round(D * (op.organ ?? 1) * 10) / 10} ml/턴)`)
  }
  return {
    target: pd, woundLabel: w.db.wound(woundId).label, arterial: !!artery, fracture: fracture && { hairline: '금', simple: '단순', compound: '복합' }[fracture.grade],
    tendon, destroyed: destroyed && part(w, d, destroyed).label, severed: !!severed, organ,
  }
}

function secondary(w: World, a: Creature, d: Creature, pd: BodyPartDef, D: number, dtype: DamageType, atk: AttackDef,
  mods: AbilityAttackMods | undefined, tendon: boolean, isPlayer: boolean, dName: string) {
  const r = rng(w, 'combat')
  const turn = turnOf(w)
  // 기절 (D27): 머리 타격 clamp(0, 90, (D' − 4) × 6 − (의지 − 10) × 3 + 능력)%, 둔기는 D + 4. 지속 ceil(D/2)턴
  if (pd.region === 'head' && !helpless(d)) {
    const Dx = D + (dtype === 'blunt' ? atk.stunD ?? 0 : 0)
    const ch = clamp((Dx - 4) * 6 - (d.stats.wil - 10) * 3 + (mods?.stunBonus ?? 0), 0, 90)
    if (r.int(0, 99) < ch) {
      addStun(d, turn, Math.ceil(D / 2))
      d.unconscious = true
      fx(w, { k: 'status', id: d.id, text: '기절', color: '#f0e070', turn })
      if (isPlayer) log(w, 'combat', `${dName}이(가) 머리를 맞고 정신을 잃었다 (기절 ${Math.ceil(D / 2)}턴).`)
    }
  }
  // 무기 떨굼: 손·전완 D × 3%, 힘줄 절단 100%
  if ((pd.groups.includes('hand') || pd.groups.includes('forearm') || pd.groups.includes('finger')) && (tendon || r.int(0, 99) < D * 3)) {
    const slot = pd.side === 'l' ? 'off' : 'main'
    const it = d.equip[slot]
    if (it && (itemDef(w, it).attacks || itemDef(w, it).shield)) {
      delete d.equip[slot]
      const spot = freeAdjacent(w, d.pos)
      tileAt(w, spot).items.push(it)
      fx(w, { k: 'status', id: d.id, text: '무기 놓침', color: '#d0d0d0', turn })
      if (isPlayer) log(w, d.faction === 'player' ? 'danger' : 'combat', `${dName}이(가) ${itemDef(w, it).label}을(를) 떨어뜨렸다.`)
    }
  }
  // 넘어짐: 다리 D ≥ 부위HP 30% → D × 4% / 타격 D ≥ 15 → (D − 10) × 5% / 사족 ×1/2
  if (!isDown(w, d)) {
    let ch = 0
    const isLeg = pd.region === 'lleg' || pd.region === 'rleg'
    if (isLeg && D * 100 >= d.body.maxHp[pd.id] * 30) ch = D * 4
    if (dtype === 'blunt' && D >= 15) ch = Math.max(ch, (D - 10) * 5)
    if (bodyDef(w, d).kind === 'quadruped') ch /= 2
    if (bodyDef(w, d).kind === 'amalgam') ch = 0
    if (ch > 0 && r.int(0, 99) < ch) knockDown(w, d, isPlayer, dName)
  }
  // 포자 뿜기: HP가 줄어들 때마다 인접 칸에 포자 구름 (bestiary §18)
  const sp = w.db.creature(d.def).sporeOnHit
  if (sp) {
    sporeCloud(w, d.pos, sp.radius, sp.turns, sp.conc)
    if (isPlayer) log(w, 'warn', `${d.name}에게서 회색 포자 구름이 터졌다.`)
  }
  // 비명 (통증 급증)
  if (D >= 10 && !traitOverride(w, d, 'noPain')) emitNoise(w, d.pos, 12, d.id)
  void a
}

export function knockDown(w: World, d: Creature, isPlayer: boolean, dName: string) {
  const turn = turnOf(w)
  // 넘어지면 일어나기 1턴 (다리 골절 시 3턴)
  const legFx = d.body.wounds.some((x) => x.fracture && (part(w, d, x.part).region === 'lleg' || part(w, d, x.part).region === 'rleg'))
  addEffect(d, 'knockedDown', turn + (legFx ? 3 : 1) + 1)
  fx(w, { k: 'status', id: d.id, text: '넘어짐', color: '#e0a050', turn })
  if (isPlayer) log(w, 'combat', `${dName}이(가) 넘어졌다.`)
}

function freeAdjacent(w: World, p: Pos): Pos {
  for (const dd of DIRS) {
    const q = { x: p.x + dd.x, y: p.y + dd.y }
    if (inBounds(w, q) && terrainAt(w, q).passable) return q
  }
  return p
}

function noteFight(w: World, a: Creature, d: Creature) {
  const other = a.faction === 'player' ? d : d.faction === 'player' ? a : undefined
  if (!other) return
  const b = (w.s.knowledge.bestiary[other.def] ??= { seen: 0, fought: 0, killed: 0 })
  b.fought++
}

/** 포자 구름 (07 §11 · bestiary §18·§20): 반경 안 칸에 농도·지속 */
export function sporeCloud(w: World, at: Pos, radius: number, turns: number, conc: number) {
  const m = w.s.map
  const until = turnOf(w) + turns
  for (let y = at.y - radius; y <= at.y + radius; y++) for (let x = at.x - radius; x <= at.x + radius; x++) {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue
    const t = m.tiles[y * m.w + x]
    if (!w.db.terrain(t.t).passable) continue
    if (!t.spores || t.spores.until < until) t.spores = { until, conc: Math.max(conc, t.spores?.conc ?? 0) }
  }
  fx(w, { k: 'status', id: creatureAt(w, at)?.id ?? -1, text: '포자!', color: '#a0c060', turn: turnOf(w) })
}

// ── 밀치기 (07 §7.2) ─────────────────────────────

function mass(w: World, c: Creature): number {
  return c.stats.str + Math.floor((w.db.creature(c.def).weightKg ?? 70) / 10)
}

export function shoveChance(w: World, a: Creature, d: Creature): number {
  let ch = 50 + (mass(w, a) - mass(w, d)) * 3
  if (a.equip.off && itemDef(w, a.equip.off).shield) ch += itemDef(w, a.equip.off).shield!.shove ?? 10
  else if (!wield(w, a)?.item) ch += 10
  const terr = terrainAt(w, d.pos)
  if (terr.id.includes('Mud') || terr.water === 'shallow') ch += 15
  if (hasEffect(d, 'parryStance', turnOf(w)) || hasEffect(d, 'spearWall', turnOf(w))) ch -= 20
  return clamp(ch, 5, 95)
}

/** 대상을 n칸 민다. 벽이면 타격 5(흉부) + 넘어짐 25% */
export function pushBack(w: World, a: Creature, t: Creature, n: number) {
  const r = rng(w, 'combat')
  const isPl = a.faction === 'player' || t.faction === 'player'
  const name = t.faction === 'player' ? '당신' : t.name
  if (size(w, t) === 'huge') return
  const dir = DIRS[dirIndex(t.pos.x - a.pos.x, t.pos.y - a.pos.y)]
  for (let i = 0; i < n; i++) {
    const to: Pos = { x: t.pos.x + dir.x, y: t.pos.y + dir.y }
    if (!inBounds(w, to) || !terrainAt(w, to).passable || creatureAt(w, to)) {
      const chest = bodyDef(w, t).parts.find((p) => p.id === 'Chest' || p.region === 'torso' && !p.internal)!
      addWound(w, t, { def: 'Wound.Bruise', part: chest.id, severity: 5, source: '벽에 부딪힘', sourceId: a.id })
      t.hp -= 5
      fx(w, { k: 'status', id: t.id, text: '쾅!', color: '#e08050', turn: turnOf(w) })
      if (isPl) log(w, 'combat', `${name}이(가) 벽에 부딪혔다.`)
      if (r.int(0, 99) < 25) knockDown(w, t, isPl, name)
      return
    }
    const from = { ...t.pos }
    t.pos = to
    fx(w, { k: 'move', id: t.id, from, to, turn: turnOf(w) })
  }
}

/** 사망 처리: 시체, 소지품 투하(루팅 더미), 주변 사기, 경험치 */
export function killCreature(w: World, c: Creature, cause: string) {
  if (!c.alive) return
  const turn = turnOf(w)
  c.alive = false
  c.unconscious = false
  c.asleep = false
  c.deathCause = cause
  c.deathTurn = turn
  c.killedBy = c.lastAttacker
  const t = w.s.map.tiles[c.pos.y * w.s.map.w + c.pos.x]
  if (c.faction !== 'player') {
    // 시체는 실제로 들고 있던 것을 그대로 지닌다: 배낭 격자 + 장착 장비 (13 §8.1). 격자에 안 들어가면 바닥으로
    const [gw, gh] = w.db.creature(c.def).bagSize ?? [4, 3]
    const items = c.bag
    c.bag = []
    const g = { items: c.bag, w: gw, h: gh }
    for (const it of items) {
      const left = gridAdd(w, g, { ...it, gx: undefined, gy: undefined, rot: undefined })
      if (left > 0) t.items.push({ ...it, count: left, gx: undefined, gy: undefined })
    }
  }
  t.blood = Math.min(400, t.blood + 60)
  if (c.faction === 'beasts' || c.faction === 'vermin') t.items.push(makeItem(w, 'Item.RawMeat', c.def === 'Creature.BurrowRat' ? 1 : 3))
  fx(w, { k: 'death', id: c.id, turn })
  const pl = player(w)
  if (c.id !== pl.id) {
    if (pl.alive) {
      const b = (w.s.knowledge.bestiary[c.def] ??= { seen: 0, fought: 0, killed: 0 })
      // 사망 원인 기여: 플레이어가 준 상처가 하나라도 남아 있으면 전액 (15 §3)
      const byPlayer = c.body.wounds.some((wd) => wd.sourceId === pl.id) || c.lastAttacker?.startsWith(pl.name)
      if (byPlayer) {
        b.killed++
        if (c.faction === 'reavers' || c.faction === 'shades') addThought(w, pl, 'Thought.KilledHuman', traitOverride(w, pl, 'killMood'))
        else if (c.faction === 'withered') addThought(w, pl, 'Thought.KilledFevered', traitOverride(w, pl, 'killMood'))
        else addThought(w, pl, 'Thought.KilledBeast')
        awardDefeat(w, pl, c, 1, '처치')
      } else addThought(w, pl, 'Thought.SawDeath')
    }
    log(w, 'combat', `${c.name}이(가) 쓰러졌다. (${cause})`)
  }
  // 사기 사건 (07 §8): 시야 내 아군 사망 −15(30턴 반감), 우두머리 사망 −30, 처치한 쪽 +5
  const leader = !!w.db.creature(c.def).leader
  for (const o of w.s.creatures) {
    if (!o.alive || o.faction !== c.faction || o.id === c.id) continue
    if (leader && cheb(o.pos, c.pos) <= 20) moraleEvent(o, -30, 'fixed', turn)
    else if (canSee(w, o, c.pos)) moraleEvent(o, -15, 'half30', turn)
  }
  const killer = creatureById(w, c.body.wounds[c.body.wounds.length - 1]?.sourceId)
  if (killer && killer.alive && killer.faction !== 'player') moraleEvent(killer, 5, 't30', turn)
}

/** 인접(또는 리치 2) 공격 가능 여부 */
export function canReach(w: World, a: Creature, d: Creature): boolean {
  const atk = meleeWield(w, a)?.atk
  if (!atk) return false
  const reach = atk.reach ?? 1
  const dist = cheb(a.pos, d.pos)
  if (dist <= 1) {
    const dx = d.pos.x - a.pos.x, dy = d.pos.y - a.pos.y
    if (dx !== 0 && dy !== 0) {
      const t1 = w.db.terrain(w.s.map.tiles[a.pos.y * w.s.map.w + a.pos.x + dx].t)
      const t2 = w.db.terrain(w.s.map.tiles[(a.pos.y + dy) * w.s.map.w + a.pos.x].t)
      if (!t1.passable && !t2.passable) return false
    }
    return true
  }
  if (dist === 2 && reach >= 2) {
    const mid = { x: a.pos.x + Math.sign(d.pos.x - a.pos.x), y: a.pos.y + Math.sign(d.pos.y - a.pos.y) }
    return w.db.terrain(w.s.map.tiles[mid.y * w.s.map.w + mid.x].t).passable && !creatureAt(w, mid) && hasLos(w, a.pos, d.pos)
  }
  return false
}
