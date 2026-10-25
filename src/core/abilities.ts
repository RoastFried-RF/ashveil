import {crawlerCoilError} from './crawlers'
import {attemptFirearm,firearmShock} from './firearms'
import { knownCreatureName } from './bestiary-state'
import { alcoholWithdrawalStage } from './drug-state'
// 액티브·토글 능력 사용 (15 §5~§7). 공격형은 07 §2 파이프라인을 그대로 쓰고 지정한 항만 바꾼다.

import { projectileFletching, projectileReady, spendProjectile } from './ranged'
import { lodgeProjectile } from './medical'
import { stumbleChance, type ActResult } from './actions'
import { capacity, energyMax, isDestroyed } from './body'
import { bowProblem } from './gear-state'
import { bowStringBreaks } from './gear-care'
import { canReach, fx, knockDown, previewHit, pushBack, resolveAttack, sporeCloud, rangedRange } from './combat'
import { creatureAt, creatureById, inBounds, log, rng, terrainAt, turnOf, type World } from './ctx'
import { hasLos } from './fov'
import { cheb, DIRS, dirIndex } from './geom'
import { canStack, itemDef, maxStack, meleeWield, wield } from './items'
import { emitNoise } from './perception'
import { addEffect, hasEffect, traitAdd, effectiveStat } from './traits'
import type { AbilityDef, Creature } from './types'

export const WEAPON_LABEL: Record<string, string> = { blade: '도검', axe: '도끼', blunt: '둔기', spear: '창', archery: '활' }
const MODE_LABEL: Record<string, string> = { slash: '베기', stab: '찌르기', blunt: '타격' }

/** 기력 비용: 탈영 경비병 창 액티브 −2, 겁쟁이 공격형 +2 (15 §9) */
export function abilityCost(w: World, c: Creature, d: AbilityDef): number {
  let e = d.energy ?? 0
  if (d.weapon) e += traitAdd(w, c, `energy_${d.weapon}`)
  if (d.attack) e += traitAdd(w, c, 'attackAbilityEnergy')
  return Math.max(0, e)
}

/** 재사용 대기: 냉혈은 급소 찌르기·머리 강타 −1 (15 §9.2) */
function cooldownOf(w: World, c: Creature, d: AbilityDef): number {
  let cd = d.cooldown ?? 0
  if (d.id === 'Ab.Blade.Vital' || d.id === 'Ab.Blunt.HeadBash') cd += traitAdd(w, c, 'executeCooldown')
  return Math.max(0, cd)
}

export function abilityReady(w: World, c: Creature, id: string): string | null {
  const d = w.db.ability(id)
  if (!c.abilities.includes(id) && !(w.db.creature(c.def).abilities ?? []).includes(id)) return '배우지 않은 능력'
  if(d.requiresCapacity&&capacity(w,c,d.requiresCapacity)<.1)return '능력에 필요한 실제 신체 부위를 쓸 수 없다'
  if (d.kind === 'passive') return '패시브 능력이다'
  const turn = turnOf(w)
  if ((c.cooldowns[id] ?? 0) > turn) return `재사용 대기 ${c.cooldowns[id] - turn}턴`
  if (d.kind === 'toggle') return c.freeActTurn === turn ? '자유 행동은 턴당 한 번' : null
  const cost = abilityCost(w, c, d)
  if (c.needs.energy <= 0 && cost >= 0 && d.attack) return '기력이 바닥났다'
  if (cost > c.needs.energy) return '기력이 부족하다'
  if (d.weapon) {
    const main = c.equip.main
    if (main && (main.durability ?? 100) <= 0) return '무기가 부서졌다. 수리해야 한다'
    if (d.weapon === 'archery' && main) { const err = bowProblem(main, itemDef(w, main)); if (err) return err }
    const wl = wield(w, c)
    if (!wl || wl.atk.family !== d.weapon) {
      if (c.equip.main && w.db.item(c.equip.main.def).attacks?.[0]?.family === d.weapon) return '무기 든 팔을 쓸 수 없다'
      return `${WEAPON_LABEL[d.weapon] ?? d.weapon}를 들어야 한다`
    }
    if (d.attackMode && wl.item && !itemDef(w, wl.item).attacks?.some((a) => a.id === d.attackMode)) return `${MODE_LABEL[d.attackMode]} 공격이 있는 무기여야 한다`
  }
  if (d.id === 'Ab.Archery.Aimed' && (alcoholWithdrawalStage(w, c) || hasEffect(c, 'withdrawal', turn))) return '손이 떨려 겨눌 수 없다'
  return null
}

function payCost(w: World, c: Creature, d: AbilityDef) {
  c.needs.energy -= abilityCost(w, c, d)
  // t 에 쓰면 t+1 … t+N 동안 못 쓰고 t+N+1 에 다시 쓴다 (15 §5)
  c.cooldowns[d.id] = turnOf(w) + cooldownOf(w, c, d) + 1
  c.exerted = (d.energy ?? 0) > 0
}

function hostileTo(a: Creature, b: Creature): boolean {
  if (a.faction === b.faction) return false
  if (a.ai.mode === 'calm' || b.ai.mode === 'calm') return false
  return a.faction === 'player' || b.faction === 'player' || !(a.faction === 'vermin' || b.faction === 'vermin')
}

export function useAbility(w: World, c: Creature, id: string, targetId?: number): ActResult {
  const err = abilityReady(w, c, id)
  if (err) return { ok: false, tu: 0, msg: err }
  const d = w.db.ability(id)
  const turn = turnOf(w)
  const isPl = c.faction === 'player'

  if (d.kind === 'toggle') {
    // 토글 = 자유 행동(0턴, 턴당 1회, 01 §3.4)
    c.freeActTurn = turn
    c.sneaking = !c.sneaking
    if (isPl) log(w, 'info', c.sneaking ? '몸을 낮추고 숨을 죽인다. (잠행: 이동 2턴, 소음 ×0.3)' : '몸을 일으킨다.')
    fx(w, { k: 'status', id: c.id, text: c.sneaking ? '잠행' : '잠행 해제', color: '#9fb3c8', turn })
    return { ok: true, tu: 0 }
  }
  if (d.stance) {
    payCost(w, c, d)
    // 겁쟁이: 자세 지속 +1턴
    const turns = d.stance.turns + traitAdd(w, c, 'stanceTurns')
    addEffect(c, d.stance.effect, turn + turns + 1, d.stance.magnitude)
    if (isPl) log(w, 'info', `${d.label}.`)
    fx(w, { k: 'status', id: c.id, text: d.label, color: '#e0c070', turn })
    return { ok: true, tu: 100 }
  }
  if (d.self) {
    payCost(w, c, d)
    // 숨 고르기: 최대 기력의 50% (저체온 1단계부터 35%, 추위 체질은 감소 없음)
    let pct = d.self.energyPct ?? 0
    if (c.needs.bodyTemp < 35 && traitAdd(w, c, 'coldBreath') <= 0) pct = Math.min(pct, 0.35)
    if (pct) c.needs.energy = Math.min(energyMax(w, c), c.needs.energy + Math.floor(energyMax(w, c) * pct))
    if (d.self.painRelief) addEffect(c, 'breath', turn + (d.self.turns ?? 3) + 1, d.self.painRelief)
    c.needs.kcal -= traitAdd(w, c, 'breathKcal')
    if (isPl) log(w, 'info', `${d.label}. 숨이 고르게 돌아온다.`)
    fx(w, { k: 'status', id: c.id, text: d.label, color: '#8fc0a0', turn })
    return { ok: true, tu: 100 }
  }
  if (d.burst) {
    // 포자 분출: 머리 하나가 부서질 때마다 주기 +2턴 (bestiary §20)
    payCost(w, c, d)
    const broken = w.db.body(c.body.def).parts.filter((p) => p.region === 'head' && !p.internal && isDestroyed(w, c, p.id)).length
    c.cooldowns[d.id] += broken * 2
    sporeCloud(w, c.pos, d.burst.radius, d.burst.turns, d.burst.conc)
    emitNoise(w, c.pos, 8, c.id)
    if (w.s.visible.includes(c.pos.y * w.s.map.w + c.pos.x)) log(w, 'danger', `${knownCreatureName(w,c)}이(가) 몸을 부풀리더니 짙은 포자를 뿜어낸다!`)
    return { ok: true, tu: 100 }
  }
  if (d.sweep) return sweep(w, c, d)
  if (d.grab) return grab(w, c, d, targetId)
  if (d.lunge) return lunge(w, c, d, targetId)
  if (!d.attack) return { ok: false, tu: 0, msg: '쓸 수 없다' }
  const mods = d.attack
  // 휘둘러 베기: 인접 8칸의 모든 개체 (아군·중립 포함), 북쪽부터 시계 방향
  if (mods.aoe === 'adjacent') {
    const targets = DIRS.map((dd) => creatureAt(w, { x: c.pos.x + dd.x, y: c.pos.y + dd.y })).filter((o): o is Creature => !!o && o.alive && o.id !== c.id)
    if (!targets.some((o) => hostileTo(c, o))) return { ok: false, tu: 0, msg: '주변에 적이 없다' }
    payCost(w, c, d)
    if (isPl) log(w, 'combat', `${d.label}!`)
    for (const t of targets) resolveAttack(w, c, t, { mods, abilityLabel: d.label, paid: true })
    return { ok: true, tu: 100 }
  }
  const t = creatureById(w, targetId)
  if (!t || !t.alive) return { ok: false, tu: 0, msg: '대상을 골라야 한다' }
  const wl = wield(w, c, d.attackMode)
  const ranged = !!(wl?.item && itemDef(w, wl.item).ranged)
  if (ranged) {
    const rd = itemDef(w, wl!.item!).ranged!
    if (cheb(c.pos, t.pos) > rangedRange(w, c, t) || !hasLos(w, c.pos, t.pos)) return { ok: false, tu: 0, msg: '쏠 수 없는 위치다' }
    if (!projectileReady(w, c, wl!.item!)) return { ok: false, tu: 0, msg: rd.reloadTurns ? '먼저 석궁을 장전해야 한다' : '화살이 없다' }
  } else if (!canReach(w, c, t)) return { ok: false, tu: 0, msg: '닿지 않는다' }
  // 2턴 채널 (조준 사격): 첫 턴에 기력을 내고 겨눈다. 채널 중 피격되면 취소, 기력 절반 환급
  if (d.channel && d.channel > 1) {
    payCost(w, c, d)
    c.activity = { kind: 'aim', remaining: d.channel - 1, target: { ...t.pos }, uid: t.id, label: d.label, abilityId: d.id, woundCount: c.body.wounds.length }
    c.facing = dirIndex(t.pos.x - c.pos.x, t.pos.y - c.pos.y)
    fx(w, { k: 'status', id: c.id, text: '조준', color: '#e0d080', turn })
    if (isPl) log(w, 'combat', `${d.label}: 활을 겨눈다… (${d.channel}턴)`)
    else if (w.s.visible.includes(c.pos.y * w.s.map.w + c.pos.x)) log(w, 'warn', `${knownCreatureName(w,c)}이(가) 당신을 겨누고 있다.`)
    return { ok: true, tu: 100 }
  }
  payCost(w, c, d)
  if (isPl) log(w, 'combat', `${d.label}!`)
  return { ok: true, tu: 100, ...abilityStrike(w, c, t, d, ranged) }
}

/** 능력 공격 한 번 (채널 끝의 조준 사격 포함) */
export function abilityStrike(w: World, c: Creature, t: Creature, d: AbilityDef, ranged: boolean): Partial<ActResult> {
  const mods = d.attack!
  const r = rng(w, 'combat')
  const isPl = c.faction === 'player' || t.faction === 'player'
  let projectileDamaged=false
  if (ranged) {
    const main = c.equip.main!
    const err = bowProblem(main, itemDef(w, main))
    if (err) return { ok: false, msg: err }
    if (!projectileReady(w, c, main)) return { ok: false, msg: '발사할 탄약이 없다' }
    if(itemDef(w,main).ranged?.firearm){if(attemptFirearm(w,c,main,true)!=='fired')return {ok:true}}
    else {
      if (bowStringBreaks(w, c, true)) return { ok: true }
      projectileDamaged=projectileFletching(w,c,main)
      spendProjectile(w, c, main)
    }
  }
  const res = resolveAttack(w, c, t, { mods, abilityLabel: d.label, ranged, projectileDamaged, mode: d.attackMode, paid: true })
  if (ranged) {if(itemDef(w,c.equip.main!).ranged?.firearm)firearmShock(w,c,c.equip.main!);else recoverArrow(w, c, t, res.hit, res.woundId,projectileDamaged)}
  // 꿰뚫기: 바라보는 방향 일직선 2칸의 모든 개체 (가까운 칸부터)
  if (mods.aoe === 'line2') {
    const dir = DIRS[dirIndex(t.pos.x - c.pos.x, t.pos.y - c.pos.y)]
    const behind = { x: c.pos.x + dir.x * 2, y: c.pos.y + dir.y * 2 }
    const t2 = inBounds(w, behind) && cheb(t.pos, c.pos) === 1 ? creatureAt(w, behind) : undefined
    if (t2 && t2.id !== c.id && t2.alive) resolveAttack(w, c, t2, { mods, abilityLabel: d.label, paid: true })
  }
  if (res.hit && t.alive) {
    if (mods.knockback) pushBack(w, c, t, mods.knockback)
    if (mods.knockdownChance) {
      const q = w.db.body(t.body.def).kind === 'quadruped' ? 0.5 : 1
      if (r.chance(mods.knockdownChance * q)) knockDown(w, t, isPl, t.faction === 'player' ? '당신' : knownCreatureName(w,t))
    }
  }
  return {}
}

/** 휩쓸기: 인접 8칸 중 적대 개체가 가장 많은 연속 N칸(팔 2개 이하면 2칸) (bestiary §20) */
function sweep(w: World, c: Creature, d: AbilityDef): ActResult {
  const arms = w.db.body(c.body.def).parts.filter((p) => (p.region === 'larm' || p.region === 'rarm') && !p.internal)
  const left = arms.filter((p) => !isDestroyed(w, c, p.id)).length
  if (arms.length && left === 0) return { ok: false, tu: 0, msg: '휘두를 팔이 없다' }
  const n = arms.length && left <= 2 ? 2 : d.sweep ?? 3
  let best: Creature[] = []
  for (let i = 0; i < 8; i++) {
    const arc: Creature[] = []
    for (let k = 0; k < n; k++) {
      const dd = DIRS[(i + k) % 8]
      const o = creatureAt(w, { x: c.pos.x + dd.x, y: c.pos.y + dd.y })
      if (o && o.alive && hostileTo(c, o)) arc.push(o)
    }
    if (arc.length > best.length) best = arc
  }
  if (!best.length) return { ok: false, tu: 0, msg: '주변에 적이 없다' }
  payCost(w, c, d)
  if (best.some((o) => o.faction === 'player')) log(w, 'danger', `${knownCreatureName(w,c)}이(가) 촉수로 크게 휩쓸었다!`)
  for (const t of best) resolveAttack(w, c, t, { abilityLabel: d.label, paid: true })
  return { ok: true, tu: 100 }
}

/** 붙잡기: 명중하면 대상은 이동할 수 없다. 탈출 = 근력·민첩 대결 (bestiary §19·§20) */
function grab(w: World, c: Creature, d: AbilityDef, targetId?: number): ActResult {
  const coilError=crawlerCoilError(w,c);if(coilError)return {ok:false,tu:0,msg:coilError}
  const t = creatureById(w, targetId)
  if (!t || !t.alive || cheb(t.pos, c.pos) > 1) return { ok: false, tu: 0, msg: '붙잡을 대상이 없다' }
  if (hasEffect(t, 'grabbed', turnOf(w))) return { ok: false, tu: 0, msg: '이미 붙잡혀 있다' }
  payCost(w, c, d)
  const pv = previewHit(w,c,t,false,undefined,d.attackMode?meleeWield(w,c,d.attackMode):undefined)
  const roll = rng(w, 'combat').int(0, 99)
  const isPl = t.faction === 'player' || c.faction === 'player'
  if (!pv || roll >= pv.chance) {
    if (isPl) log(w, 'combat', `${knownCreatureName(w,c)}이(가) 붙잡으려 했지만 빗나갔다.`)
    return { ok: true, tu: 100 }
  }
  addEffect(t, 'grabbed', turnOf(w) + 60, c.id)
  fx(w, { k: 'status', id: t.id, text: '붙잡힘', color: '#e09060', turn: turnOf(w) })
  if(isPl&&w.db.creature(c.def).crawler)log(w,'danger',`${knownCreatureName(w,c)}이(가) ${t.faction==='player'?'당신':knownCreatureName(w,t)}을(를) 몸으로 휘감았다! (이동하면 탈출 시도)`)
  else if (isPl) log(w, 'danger', w.db.body(c.body.def).kind==='humanoid'?`${knownCreatureName(w,c)}이(가) ${t.faction === 'player' ? '당신의' : knownCreatureName(w,t) + '의'} 팔을 움켜쥐었다! (이동하면 탈출 시도)`:`${knownCreatureName(w,c)}이(가) ${t.faction === 'player' ? '당신을' : knownCreatureName(w,t)+'을(를)'} 앞발로 붙들었다! (이동하면 탈출 시도)`)
  return { ok: true, tu: 100 }
}

/** 탈출 판정: 50 + (내 근력·민첩 중 높은 쪽 − 붙잡은 쪽 근력) × 5, 5~95 */
export function escapeChance(w: World, c: Creature, grabber: Creature): number {
  return Math.max(5, Math.min(95, 50 + (Math.max(effectiveStat(w, c, 'str'), c.stats.agi) - effectiveStat(w, grabber, 'str')) * 5))
}

/** 달려들기: 직선 N칸을 달려와 같은 턴에 근접 공격, 이동 칸마다 비틀거림 판정 (bestiary §17) */
function lunge(w: World, c: Creature, d: AbilityDef, targetId?: number): ActResult {
  const t = creatureById(w, targetId)
  if (!t || !t.alive) return { ok: false, tu: 0, msg: '대상을 골라야 한다' }
  const dx = t.pos.x - c.pos.x, dy = t.pos.y - c.pos.y
  const dist = cheb(c.pos, t.pos)
  if (dist < 2 || dist > (d.lunge ?? 2) + 1 || !(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return { ok: false, tu: 0, msg: '직선으로 닿지 않는다' }
  const step = { x: Math.sign(dx), y: Math.sign(dy) }
  const path = []
  for (let k = 1; k < dist; k++) {
    const p = { x: c.pos.x + step.x * k, y: c.pos.y + step.y * k }
    if (!inBounds(w, p) || !terrainAt(w, p).passable || creatureAt(w, p)) return { ok: false, tu: 0, msg: '길이 막혔다' }
    path.push(p)
  }
  payCost(w, c, d)
  const r = rng(w, 'ai')
  for (const p of path) {
    const sp = stumbleChance(w, c, p)
    if (sp > 0 && r.chance(sp / 100)) {
      fx(w, { k: 'status', id: c.id, text: '휘청', color: '#e0b070', turn: turnOf(w) })
      return { ok: true, tu: 100 }
    }
    const from = { ...c.pos }
    c.pos = p
    c.movedTurn = turnOf(w)
    fx(w, { k: 'move', id: c.id, from, to: p, turn: turnOf(w) })
  }
  if (t.faction === 'player' || c.faction === 'player') log(w, 'combat', `${knownCreatureName(w,c)}이(가) 순식간에 파고든다!`)
  if (canReach(w, c, t)) resolveAttack(w, c, t, { abilityLabel: d.label, paid: true })
  return { ok: true, tu: 100 }
}

/** 화살 회수: 명중 60% · 빗나감 85%, 화살 회수 능력 +30%p (상한 95) (07 §7.1 · 15 §6.5) */
export function recoverArrow(w: World, c: Creature, t: Creature, hit: boolean, woundId?: number,projectileDamaged=false) {
  const rd = itemDef(w, c.equip.main!).ranged
  if (!rd||rd.firearm) return
  const p = Math.min(95, (hit ? 60 : 85) + traitAdd(w, c, 'arrowRecover'))
  const intact = rng(w, 'combat').int(0, 99) < p
  const wd = t.body.wounds.find((wd) => wd.id === woundId)
  if (hit && wd && t.alive) { lodgeProjectile(w, t, wd, rd.ammo, intact,projectileDamaged); return }
  if (intact) {
    const tile = w.s.map.tiles[t.pos.y * w.s.map.w + t.pos.x]
    const recovered:import('./types').ItemInst = { uid: w.s.nextId, def: rd.ammo, count: 1 }
    if(projectileDamaged)recovered.fletchingDamaged=true
    if(itemDef(w,recovered).fletching)recovered.gearAgedAt=turnOf(w)
    const limit = maxStack(itemDef(w, recovered))
    const ex = tile.items.find((i) => i.count < limit && canStack(i, recovered))
    if (ex) ex.count++
    else { w.s.nextId++; tile.items.push(recovered) }
  }
}

/** 창벽 자세: 인접 칸에 들어오는 적대 개체에게 먼저 반응 공격 (15 §6.4 · 01 §3.2 phase 1) */
export function spearWallReact(w: World, mover: Creature) {
  const turn = turnOf(w)
  for (const o of w.s.creatures) {
    if (!o.alive || o.id === mover.id || !hostileTo(o, mover) || cheb(o.pos, mover.pos) > 1) continue
    const e = o.effects.find((x) => x.kind === 'spearWall' && x.untilTurn > turn)
    if (!e || o.unconscious || !canReach(w, o, mover)) continue
    const seen = (e.magnitude ?? 0)
    if (seen === mover.id) continue
    e.magnitude = mover.id
    if (o.faction === 'player' || mover.faction === 'player') log(w, 'combat', `${o.faction === 'player' ? '당신' : knownCreatureName(w,o)}의 창벽! 다가오는 ${mover.faction === 'player' ? '당신' : knownCreatureName(w,mover)}을(를) 먼저 찌른다.`)
    resolveAttack(w, o, mover, { abilityLabel: '창벽 찌르기', counter: true })
    if (!mover.alive) return
  }
}
