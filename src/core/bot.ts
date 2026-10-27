import {firearmSupply} from './firearms'
import {throwQuote} from './throwing'
import {canSearchContainer} from './container-locks'
import {readyFood} from './open-food-state'
import { corpseMoneyQuote } from './corpse-money'
import { nearbyIce, nearbySnow } from './climate'
import { handState, washHandsError } from './hand-hygiene'
import { nearbyWater, waterTreatmentError } from './water'
import { botShelterAction } from './bot-shelter'
// 헤드리스 밸런스용 플레이어 봇. 사람처럼 잘하진 않지만 시스템이 돌아가는지 본다.
// 지상 → 수도원 계단 → 지하 묘소를 탐색하며 상자를 뒤지고, 레벨업 포인트를 쓰고, 능력을 쓴다.
// 전술 (bestiary L1~L3 · 07): 승산 계산 → 불리하면 위층으로 물러나 회복 후 재진입, 잠든 단독 적은 잠행 기습,
// 잠든 무리가 있는 방은 피한다, 다가오는 적은 정면·높은 자리(계단)에서 맞는다, 빛을 싫어하는 적은 등불 안에서 버틴다,
// 더 좋은 무기로 바꾼다, 원거리 무기는 거리에서 먼저. 설명·측정은 docs/prototype.md §4.

import { projectileReady } from './ranged'
import { abilityReady } from './abilities'
import { adjacentCorpse, canTreat, containerFresh, hostile, lootItems, type Action } from './actions'
import { bloodLoss, effectiveBleed, energyMax, hpMax, part, totalBleed } from './body'
import { gearCareError } from './gear-care'
import { bowProblem } from './gear-state'
import { canReach, previewHit } from './combat'
import { creatureAt, inBounds, player, terrainAt, tileAt, turnOf, TURNS_PER_HOUR, type World } from './ctx'
import { canSee, hasLos, lightLevel } from './fov'
import { cheb, DIRS, dirIndex, eq, type Pos } from './geom'
import { allItems, countOf, currentAttack, findSpot, itemDef, mainWeapon, wield } from './items'
import { moraleOf } from './morale'
import { diagonalBlocked, findPath } from './path'
import { abilitiesByTree, canLearn } from './progression'
import { traitMul } from './traits'
import type { Creature, ItemInst, Stats } from './types'

const STAT_ORDER: (keyof Stats)[] = ['agi', 'str', 'vit', 'agi', 'per', 'vit', 'wil']

/** 봇 기억: 피할 방(`맵:방`)·후퇴 횟수. 상태에 넣어 세이브와 함께 간다 */
function mem(w: World) {
  return (w.s.bot ??= { avoid: [], retreats: 0 })
}
const roomKey = (w: World, p: Pos) => { const r = tileAt(w, p).room; return r === undefined ? null : `${w.s.map.id}:${r}` }
const avoided = (w: World, p: Pos) => { const k = roomKey(w, p); return k !== null && mem(w).avoid.includes(k) }
function avoidRoomOf(w: World, c: Creature) {
  const k = c.room !== undefined ? `${w.s.map.id}:${c.room}` : roomKey(w, c.home ?? c.pos)
  if (k && !mem(w).avoid.includes(k)) mem(w).avoid.push(k)
}

/** 승산 (07 명중·피해 기댓값): 내가 차례로 다 쓰러뜨리는 동안 받는 피해 ÷ 버틸 수 있는 몸. 1 미만이면 유리 */
export function fightRisk(w: World, pl: Creature, foes: Creature[]): number {
  const myAtk = currentAttack(w, pl)
  const rows = foes.map((e) => {
    const mine = (previewHit(w, pl, e)?.chance ?? 5) / 100
    const theirs = (previewHit(w, e, pl)?.chance ?? 50) / 100
    // 기력이 바닥나면 공격이 무디다 (07): 내 피해 절반으로 본다
    const blunt = pl.needs.energy < (myAtk?.energy ?? 5) ? 0.5 : 1
    const ttk = e.hp / Math.max(0.05, mine * (myAtk?.damage ?? 3) * 0.85 * blunt)
    // 사기 (07 §8): 10 미만은 곧 달아나고, 25 미만은 5턴마다 (25 − 사기) × 4% 도주 — 그만큼 덜 위험하다
    const M = w.db.creature(e.def).noMorale ? 100 : moraleOf(w, e)
    const stay = M < 10 ? 0.2 : M < 25 ? Math.max(0.3, 1 - (25 - M) * 0.04 * 2) : 1
    const atk = wield(w, e)?.atk
    const dps = theirs * (atk?.damage ?? 3) * stay
    // 맞을 때마다 새 상처가 생겨 남은 싸움 내내 피를 흘린다: 상처당 출혈 ≈ 피해(베기·찌르기, 작은 상처 ×0.5 × 유형 2) — 타격은 거의 없음
    const perHit = atk && (atk.damageType === 'cut' || atk.damageType === 'stab' || atk.damageType === 'bite') ? atk.damage : (atk?.damage ?? 3) * 0.2
    return { ttk, dps, bleedRate: theirs * stay * perHit }
  }).sort((a, b) => a.ttk - b.ttk)
  let t = 0, taken = 0, newBleed = 0
  for (const r of rows) { t += r.ttk; taken += r.dps * t; newBleed += r.bleedRate * t * t / 2 }
  // 묽은 피 등 출혈 배율 특성 (body.ts 출혈률과 같은 배율)
  newBleed *= traitMul(w, pl, 'bleedMult')
  // 실혈이 HP보다 먼저 온다: 맞은 피해의 대부분이 상처 출혈로 이어진다 → 버틸 몸은 HP의 절반 정도
  const budget = pl.hp * 0.5 * (1 - bloodLoss(pl) * 2)
  // 지금 흐르는 피: 싸우는 t턴 동안 실혈 30%(쇼크)까지 남은 피를 다 쓰면 그만큼 위험하다
  const bleed = totalBleed(w, pl)
  const bloodLeft = pl.body.bloodMax * 0.3 - (pl.body.bloodMax - pl.body.blood)
  const bleedRisk = (bleed * t + newBleed) / Math.max(1, bloodLeft)
  return Math.max(taken / Math.max(1, budget), bleedRisk)
}

/**
 * 빛 안에서 버티기 (bestiary §17 L2 · CANON D35): 등불이 켜져 있고 보이는 적이 모두 빛을 싫어하는 종이면
 * (몸이 버틸 만할 때만) 물러나지 않는다. 빛 안에 들어온 적만 받아치고, 빛 밖으로 쫓아가지 않는다(어둠은 그들의 땅).
 */
function holdInLight(w: World, pl: Creature, foes: Creature[]): boolean {
  if (w.s.map.kind !== 'dungeon' || !foes.length) return false
  const lamp = allItems(pl).find((i) => !!itemDef(w, i).light)
  if (!lamp?.lit || (lamp.fuel ?? 0) < 60) return false
  if (!foes.every((e) => w.db.creature(e.def).lightAverse)) return false
  // 출혈이 쌓이면 버티지 않는다: HP 70%·실혈 12%·지금 출혈 8 ml/턴 중 하나라도 넘으면 물러나 처치
  // 목이 마르면(지하엔 물이 없다) 버티지 않고 올라간다
  return pl.hp >= hpMax(w, pl) * 0.7 && bloodLoss(pl) < 0.12 && totalBleed(w, pl) < 8 && pl.needs.waterDeficit < 1000
}

/** 근접 무기 기댓값: (50 + 정확도 × 2) × 피해 */
const meleeScore = (w: World, it: ItemInst | undefined) => {
  if (!it || (it.durability ?? 100) <= 0) return 0
  const d = itemDef(w, it), a = d.attacks?.[0]
  return a && !d.ranged ? (50 + a.accuracy * 2) * a.damage : 0
}

export function botDecide(w: World): Action {
  const pl = player(w)
  const shotAvailable=(it:import('./types').ItemInst)=>{const rd=itemDef(w,it).ranged!;return projectileReady(w,pl,it)||(rd.firearm?firearmSupply(w,pl,it):countOf(pl,rd.ammo)>0)}
  const inv = allItems(pl)
  const find = (pred: (d: ReturnType<typeof itemDef>) => boolean) => inv.find((i) => pred(itemDef(w, i)))

  // 성장 포인트
  if (pl.statPoints > 0) return { type: 'spendStat', stat: STAT_ORDER[(pl.level + pl.statPoints) % STAT_ORDER.length] }
  if (pl.abilityPoints > 0) {
    if (!pl.abilities.includes('Ab.Survival.Sneak') && !canLearn(w, pl, 'Ab.Survival.Sneak')) return { type: 'learn', id: 'Ab.Survival.Sneak' }
    const skill = currentAttack(w, pl)?.family
    const trees = abilitiesByTree(w)
    for (const tree of Object.keys(trees).sort((a, b) => Number(b === skill) - Number(a === skill))) {
      const ab = trees[tree].find((d) => !canLearn(w, pl, d.id))
      if (ab) return { type: 'learn', id: ab.id }
    }
  }
  // 언제 마지막으로 맞았나 (어둠 속 기습은 적이 안 보여도 위험 신호)
  const m0 = mem(w)
  if (m0.lastHp !== undefined && pl.hp < m0.lastHp) m0.hurtAt = turnOf(w)
  m0.lastHp = pl.hp

  // 열린 루팅 창: 같은 자리는 한 번만 다 담고 닫는다 (배낭이 차서 못 담아도 반복하지 않는다)
  const list = lootItems(w)
  if (list) {
    const coins=corpseMoneyQuote(w,pl)
    if(!coins.error&&coins.amount)return{type:'lootMoney',target:coins.id!,expectedAmount:coins.amount}
    const at = w.s.loot ? `${w.s.map.id}:${w.s.loot.pos.x},${w.s.loot.pos.y}` : ''
    if (list.length && mem(w).lootAt !== at) {
      mem(w).lootAt = at
      return { type: 'lootAll' }
    }
    return { type: 'lootClose' }
  }
  // 배낭이 가득 차면 값어치 없는 짐부터 버린다
  if (!findSpot(w, pl, w.db.item('Item.Bandage'))) {
    const junk = pl.bag.filter((i) => !itemDef(w, i).medical && !itemDef(w, i).food && !itemDef(w, i).drink && !itemDef(w, i).light)
      .sort((a, b) => (itemDef(w, a).value ?? 0) * a.count - (itemDef(w, b).value ?? 0) * b.count)[0]
    if (junk && (itemDef(w, junk).value ?? 0) * junk.count < 30) return { type: 'drop', uid: junk.uid }
  }

  // 어두운 곳에서는 등불을 켠다
  const lamp = inv.find((i) => !!itemDef(w, i).light)
  if (lamp && !lamp.lit && (lamp.fuel ?? 0) > 0 && w.s.map.kind === 'dungeon') return { type: 'toggleLight', uid: lamp.uid }
  // 등불 기름이 1시간 아래면 채운다 (빛이 곧 방패다)
  const oil = find((d) => !!d.refuel)
  if (lamp && oil && (lamp.fuel ?? 0) < TURNS_PER_HOUR && !enemiesAdjacent(w)) return { type: 'consume', uid: oil.uid }

  // 출혈 처치
  const bleeding = pl.body.wounds
    .filter((wd) => !wd.internal && effectiveBleed(w, pl, wd) > 1.2)
    .sort((a, b) => effectiveBleed(w, pl, b) - effectiveBleed(w, pl, a))
  const enemies = w.s.creatures.filter((o) => o.alive && !o.asleep && hostile(w, pl, o) && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos))
  const adjacentEnemy = enemies.find((e) => cheb(e.pos, pl.pos) <= 1)
  // 보이지 않는 적에게 계속 베이고 있으면(달려들기 후 빠지기) 위층으로 물러나 처치·회복
  // 처치보다 먼저: 냄새 맡고 모여드는 곳에서 붕대를 감지 않는다 (지혈대가 필요한 큰 출혈만 예외)
  const hurtRecently = turnOf(w) - (m0.hurtAt ?? -1e9) <= 40
  const holding = holdInLight(w, pl, enemies)
  if (hurtRecently && !adjacentEnemy && !holding && w.s.map.kind === 'dungeon' && (bloodLoss(pl) > 0.08 || pl.hp < hpMax(w, pl) * 0.7) && !bleeding.some((x) => x.arterial || effectiveBleed(w, pl, x) > 15) && turnOf(w) - (m0.lastStairs ?? -1e9) > 30) {
    const up = w.s.map.links.find((l) => terrainAt(w, l.pos).id === 'Terrain.StairsUp')
    if (up) {
      if (eq(pl.pos, up.pos)) { m0.retreats++; m0.lastRetreat = m0.lastStairs = turnOf(w); return { type: 'stairs' } }
      const st = stepTo(w, up.pos)
      if (st !== null) return { type: 'move', dir: st }
    }
  }

  if (bleeding.length && !adjacentEnemy) {
    const wd = bleeding[0]
    const limb = part(w, pl, wd.part).limb
    const tq = find((d) => d.medical?.kind === 'tourniquet')
    // 팔다리의 큰 출혈은 지혈대 (아래 부위 출혈 0)
    // 손이 말을 듣지 않으면(다턴 배율 ×4 초과) 처치를 시도하지 않고 손으로 누른다
    if ((wd.arterial || effectiveBleed(w, pl, wd) > 15) && limb && tq && pl.body.tourniquets[limb] === undefined && canTreat(w, pl, 'tourniquet', wd)) return { type: 'treat', uid: tq.uid, woundId: wd.id }
    const band = find((d) => d.medical?.kind === 'bandage')
    const unbandaged = bleeding.find((x) => !x.bandage && !(x.arterial && part(w, pl, x.part).limb))
    if (band && unbandaged && canTreat(w, pl, 'bandage', unbandaged)) return { type: 'treat', uid: band.uid, woundId: unbandaged.id }
    if (effectiveBleed(w, pl, wd) > 2) return { type: 'press', woundId: wd.id }
  }
  // 적이 붙어 있어도 큰 출혈은 손으로 누른다 (1턴, 한 손으로 싸울 수 있다)
  if (bleeding.length && adjacentEnemy && effectiveBleed(w, pl, bleeding[0]) > 25 && pl.body.pressing === undefined && rngPick(w)) return { type: 'press', woundId: bleeding[0].id }
  // 지혈대 1.5시간 넘으면 풀기
  for (const [limb, at] of Object.entries(pl.body.tourniquets)) if (turnOf(w) - at > 1800) return { type: 'removeTourniquet', limb }
  const frac = pl.body.wounds.find((wd) => wd.fracture && !wd.splint)
  const splint = find((d) => d.medical?.kind === 'splint')
  if (frac && splint && !adjacentEnemy && canTreat(w, pl, 'splint', frac)) return { type: 'treat', uid: splint.uid, woundId: frac.id }
  if (pl.hp < hpMax(w, pl) * 0.35) {
    const draught = inv.find((i) => i.def === 'Item.HealthDraught')
    if (draught) return { type: 'consume', uid: draught.uid }
  }

  for(const item of [pl.equip.main,pl.equip.off])if(item&&itemDef(w,item).throwable){const target=enemies.find(e=>cheb(pl.pos,e.pos)>1&&!throwQuote(w,pl,item.uid,e.id).error);if(target)return {type:'throwAttack',uid:item.uid,target:target.id}}
  // 파손·끊어진 활을 계속 쏘려 하지 않는다. 여유가 있으면 시위를 걸고, 교전 중에는 예비 무기로.
  const heldMain = mainWeapon(w, pl)
  const firearm=heldMain&&itemDef(w,heldMain).ranged?.firearm
  if(heldMain&&firearm){
    if(heldMain.firearmJammed)return {type:'firearmCare',uid:heldMain.uid,operation:'unjam'}
    if(!enemies.length&&(heldMain.firearmFouling??0)>=40&&countOf(pl,firearm.oil)>0)return {type:'firearmCare',uid:heldMain.uid,operation:'clean'}
  }
  if (heldMain && ((heldMain.durability ?? 100) <= 0 || bowProblem(heldMain, itemDef(w, heldMain)))) {
    if (!enemies.length && itemDef(w, heldMain).ranged && !gearCareError(w, pl, heldMain.uid, 'string')) return { type: 'gearCare', uid: heldMain.uid, care: 'string' }
    const spare = inv.filter((i) => i.uid !== heldMain.uid && meleeScore(w, i) > 0).sort((a, b) => meleeScore(w, b) - meleeScore(w, a))[0]
    if (spare) return { type: 'equip', uid: spare.uid }
  }
  // 무기를 떨어뜨렸으면(07 2차 효과) 줍고 다시 든다 — 교전 판단보다 먼저
  if (!mainWeapon(w, pl)) {
    const spare = inv.filter((i) => meleeScore(w, i) > 0).sort((a, b) => meleeScore(w, b) - meleeScore(w, a))[0]
    if (spare) return { type: 'equip', uid: spare.uid }
    const dropped = tileAt(w, pl.pos).items.find((i) => meleeScore(w, i) > 0)
    if (dropped) return { type: 'pickup', uid: dropped.uid }
    // 떨군 무기는 옆 빈칸에 떨어지고, 그새 밀려났을 수 있다: 3칸 안에서 찾는다
    const spot = nearest(w, (p) => cheb(p, pl.pos) <= 3 && tileAt(w, p).items.some((it) => meleeScore(w, it) > 0))
    if (spot) { const st = stepTo(w, spot); if (st !== null) return { type: 'move', dir: st } }
  }

  // 싸우는 틈에도 목은 축인다 (병에 물이 있으면, 붙은 적이 없을 때)
  if (pl.needs.waterDeficit >= 500 && !adjacentEnemy) {
    const drink = inv.find((i) => itemDef(w, i).drink && !itemDef(w, i).drink!.alcohol && (i.uses ?? 0) > 0 && !i.waterFrozen)
    if (drink) return { type: 'consume', uid: drink.uid }
  }

  const frozenBottle = inv.find((i) => i.waterFrozen && (i.uses ?? 0) > 0)
  if (frozenBottle && !enemies.length && !waterTreatmentError(w, pl, frozenBottle, 'boil')) return { type: 'waterTreatment', uid: frozenBottle.uid, method: 'boil' }

  // 전투. 8칸 밖에만 보이는 무리가 이길 수 없는 상대면 다가가지 않고 하던 일을 한다
  // (물러난 자리와 8칸 경계를 오가는 왕복 방지)
  const farOnly = enemies.length > 0 && enemies.every((x) => cheb(x.pos, pl.pos) > 8)
  if (enemies.length && !(farOnly && fightRisk(w, pl, enemies) > 1)) {
    enemies.sort((a, b) => cheb(a.pos, pl.pos) - cheb(b.pos, pl.pos))
    const e = enemies[0]
    const near = enemies.filter((x) => cheb(x.pos, pl.pos) <= 8)
    const risk = fightRisk(w, pl, near)
    if (pl.sneaking) return { type: 'ability', id: 'Ab.Survival.Sneak' } // 들켰으면 일어선다
    // 불리하면 물러난다: 지하에서는 올라가는 계단으로(그늘 사람은 지상까지 따라오지 않는다, bestiary §17 L3)
    // 계단을 막 탔으면(따라온 적) 30턴은 다시 계단으로 도망치지 않는다 — 계단 왕복 방지
    const stairsOk = turnOf(w) - (mem(w).lastStairs ?? -1e9) > 30
    // 붙은 적이 있어도 물러난다: 실측(12판)으로 붙은 채 버티기 0.21일 < 물러나기 1.48일
    const up = w.s.map.links.find((l) => terrainAt(w, l.pos).id === 'Terrain.StairsUp')
    if (risk > 1 && w.s.map.kind === 'dungeon' && stairsOk && !holding) {
      if (up) {
        const m = mem(w)
        for (const x of near) avoidRoomOf(w, x)
        if (eq(pl.pos, up.pos)) { m.retreats++; m.lastRetreat = m.lastStairs = turnOf(w); return { type: 'stairs' } }
        const st = stepTo(w, up.pos)
        if (st !== null) return { type: 'move', dir: st }
      }
    }
    // 지상에서 불리하면: 가까운 내려가는 계단으로(약탈자는 무리째 따라오지 못한다), 아니면 멀어진다
    if (risk > 1 && w.s.map.kind === 'surface') {
      for (const x of near) avoidRoomOf(w, x)
      const down = w.s.map.links.find((l) => terrainAt(w, l.pos).id === 'Terrain.StairsDown')
      if (down && cheb(down.pos, pl.pos) <= 15 && stairsOk) {
        if (eq(pl.pos, down.pos)) { mem(w).lastStairs = turnOf(w); return { type: 'stairs' } }
        const st = stepTo(w, down.pos)
        if (st !== null) return { type: 'move', dir: st }
      }
      if (!adjacentEnemy) { const away = stepAway(w, enemies.map((x) => x.pos)); if (away !== null) return { type: 'move', dir: away } }
    }
    if ((bloodLoss(pl) > 0.2 || pl.hp < hpMax(w, pl) * 0.4) && cheb(e.pos, pl.pos) > 1) {
      const away = stepAway(w, enemies.map((x) => x.pos))
      if (away !== null) return { type: 'move', dir: away }
    }
    // 여럿이면 좁은 곳(문틀·복도)으로 물러나 포위를 막는다 (bestiary §17 L1)
    if (enemies.filter((x) => cheb(x.pos, pl.pos) <= 4).length >= 2 && !adjacentEnemy) {
      const choke = chokeStep(w, enemies.map((x) => x.pos))
      if (choke !== null) return { type: 'move', dir: choke }
    }
    const mw = mainWeapon(w, pl)
    const ranged = !!(mw && itemDef(w, mw).ranged && !bowProblem(mw, itemDef(w, mw)))
    // 원거리 무기는 거리에서 먼저 (사거리 안, 붙기 전)
    const bow = inv.find((i) => itemDef(w, i).ranged && !bowProblem(i, itemDef(w, i)) && shotAvailable(i))
    if (bow && !ranged && cheb(e.pos, pl.pos) >= 4 && cheb(e.pos, pl.pos) <= (itemDef(w, bow).ranged!.effective ?? 6)) return { type: 'equip', uid: bow.uid }
    if (cheb(e.pos, pl.pos) <= 1 && ranged) {
      const melee = inv.filter((i) => meleeScore(w, i) > 0).sort((a, b) => meleeScore(w, b) - meleeScore(w, a))[0]
      if (melee) return { type: 'equip', uid: melee.uid }
    }
    if (canReach(w, pl, e) && !(ranged && cheb(e.pos, pl.pos) > 1)) {
      for (const id of pl.abilities) {
        const d = w.db.ability(id)
        if (d.kind === 'active' && d.attack && !abilityReady(w, pl, id)) return { type: 'ability', id, target: e.id }
      }
      return { type: 'attack', target: e.id }
    }
    if (ranged && shotAvailable(mw!)) return { type: 'shoot', target: e.id }
    // 높은 자리 (07 §5): 다가오는 적은 단차 위(잔해·관·제단, 지하는 올라가는 계단)에서 받는다
    const hg = highGround(w, enemies, up?.pos)
    if (hg) return hg
    // 빛 안에서 버티는 중: 빛 밖의 적은 쫓지 않는다. 좁은 곳이면 그 자리에서, 아니면 좁은 곳으로
    if (holding && lightLevel(w, e.pos) !== 0) {
      const toward0 = dirIndex(e.pos.x - pl.pos.x, e.pos.y - pl.pos.y)
      if (pl.facing !== toward0) return { type: 'face', dir: toward0 }
      if (openness(w, pl.pos) > 3) { const choke = chokeStep(w, enemies.map((x) => x.pos)); if (choke !== null) return { type: 'move', dir: choke } }
      return { type: 'wait' }
    }
    // 다가오는 적은 정면으로 맞는다 (측면 +10 · 후면 +20을 주지 않는다)
    const toward = dirIndex(e.pos.x - pl.pos.x, e.pos.y - pl.pos.y)
    if (cheb(e.pos, pl.pos) === 2 && e.ai.mode === 'hunt' && pl.facing !== toward) return { type: 'face', dir: toward }
    // 좁은 곳에 있으면 기다렸다 받아친다
    if (enemies.filter((x) => cheb(x.pos, pl.pos) <= 4).length >= 2 && openness(w, pl.pos) <= 3) return { type: 'wait' }
    const st = stepTo(w, e.pos)
    if (st !== null) return { type: 'move', dir: st }
    return { type: 'wait' }
  }
  if (pl.sneaking && !sleeperTarget(w)) return { type: 'ability', id: 'Ab.Survival.Sneak' }

  // 더 좋은 근접 무기로 바꾼다
  const cur = mainWeapon(w, pl)
  const best = inv.filter((i) => meleeScore(w, i) > 0).sort((a, b) => meleeScore(w, b) - meleeScore(w, a))[0]
  if (best && best.uid !== cur?.uid && meleeScore(w, best) > meleeScore(w, cur) * 1.15) return { type: 'equip', uid: best.uid }

  // 잠든 단독 적: 잠행으로 다가가 기습 (명중 +40 · 첫 타 ×1.5, 07 §2.8). 잠든 무리는 그 방을 피한다
  const sleeper = sleeperTarget(w)
  if (sleeper) {
    if (!pl.sneaking && pl.abilities.includes('Ab.Survival.Sneak') && !abilityReady(w, pl, 'Ab.Survival.Sneak')) return { type: 'ability', id: 'Ab.Survival.Sneak' }
    if (canReach(w, pl, sleeper)) {
      if (pl.sneaking) return { type: 'ability', id: 'Ab.Survival.Sneak' }
      return { type: 'attack', target: sleeper.id }
    }
    const st = stepTo(w, sleeper.pos)
    if (st !== null) return { type: 'move', dir: st }
  }

  // 생존
  if (pl.needs.kcal <= -500) {
    const edible=inv.filter(i=>readyFood(w,pl,i)),food=edible.find(i=>!itemDef(w,i).food!.raw)??edible.find(i=>(itemDef(w,i).food!.poison??25)<=10)??edible[0]
    if (food) {
      if (!enemies.length && handState(w, pl) === 'dirty' && !washHandsError(w, pl)) return { type: 'washHands' }
      return { type: 'consume', uid: food.uid }
    }
    // 먹을 게 없으면 숲 버섯 무리로 (D36: 이틀이면 다시 자란다). 지하에서는 올라간다
    if (w.s.map.kind === 'surface') {
      const patch = nearest(w, (p) => terrainAt(w, p).id === 'Terrain.Fungus' && containerFresh(w, p) && !!tileAt(w, p).seen && !avoided(w, p))
      if (patch) {
        if (cheb(patch, pl.pos) <= 1) return { type: 'search',pos:patch }
        const st = stepTo(w, patch)
        if (st !== null) return { type: 'move', dir: st }
      }
    } else {
      const up = w.s.map.links.find((l) => terrainAt(w, l.pos).id === 'Terrain.StairsUp')
      if (up && !enemiesAdjacent(w)) {
        if (eq(pl.pos, up.pos)) return { type: 'stairs' }
        const st = stepTo(w, up.pos)
        if (st !== null) return { type: 'move', dir: st }
      }
    }
  }
  if (pl.needs.waterDeficit >= 500) {
    const drink = inv.find((i) => itemDef(w, i).drink && !itemDef(w, i).drink!.alcohol && (i.uses ?? 0) > 0 && !i.waterFrozen)
    if (drink) return { type: 'consume', uid: drink.uid }
    if (w.s.overworld && nearbyIce(w, pl)) return { type: 'breakIce' }
    if (w.s.overworld ? !!nearbyWater(w, pl) : DIRS.some((d) => { const p = { x: pl.pos.x + d.x, y: pl.pos.y + d.y }; return inBounds(w, p) && !!terrainAt(w, p).water })) return { type: 'drinkHere' }
    const water = nearest(w, (p) => terrainAt(w, p).water === 'shallow')
    if (water) { const st = stepTo(w, water); if (st !== null) return { type: 'move', dir: st } }
    if (w.s.overworld && pl.needs.bodyTemp > 34 && nearbySnow(w, pl)) return { type: 'eatSnow' }
    // 지하에는 물이 없다: 위층 계단으로 올라간다
    const up = w.s.map.links.find((l) => terrainAt(w, l.pos).id === 'Terrain.StairsUp')
    if (up && pl.needs.waterDeficit >= 1000) {
      if (eq(pl.pos, up.pos)) return { type: 'stairs' }
      const st = stepTo(w, up.pos)
      if (st !== null) return { type: 'move', dir: st }
    }
  }
  // 물가에 있으면 빈 병을 채운다 (지하로 가져갈 물)
  if (DIRS.some((d) => { const p = { x: pl.pos.x + d.x, y: pl.pos.y + d.y }; return inBounds(w, p) && !!terrainAt(w, p).water })) {
    const bottle = inv.find((i) => itemDef(w, i).drink && !itemDef(w, i).drink!.alcohol && (i.uses ?? 0) < 3)
    if (bottle && pl.needs.waterDeficit < 500 && w.s.overworld && nearbyIce(w, pl)) return { type: 'breakIce' }
    if (bottle && pl.needs.waterDeficit < 500) return { type: 'fillBottle', uid: bottle.uid }
  }
  // 모닥불: 몸을 녹일 때만 켜고, 떠나기 전엔 끈다 (켜 둔 불빛·연기는 순찰이 보고 수색대를 부른다, 10 §3.3)
  const homeFire = w.s.map.kind === 'surface' ? w.s.map.lights.find((L) => L.kind === 'campfire' && cheb(L.pos, pl.pos) <= 1) : undefined
  const cold = pl.needs.bodyTemp < 36.8 || (pl.needs.wetness > 40 && ['ashrain', 'ashstorm'].includes(w.s.weather))
  if (homeFire && !homeFire.off && !cold && pl.needs.bodyTemp >= 36.8 && pl.needs.fatigue <= 75 && !(pl.needs.sleepDebt ?? 0) && !pl.activity) return { type: 'toggleFire' }
  if (homeFire && homeFire.sourceUid === undefined && homeFire.off && (cold || pl.needs.fatigue > 75 || (pl.needs.sleepDebt ?? 0) > 0)) return { type: 'toggleFire' }

  // 춥거나 젖었으면 불가·지붕 밑으로 (03: 젖은 옷은 단열을 잃는다). 지하는 비가 안 온다
  if ((pl.needs.bodyTemp < 36.8 || (pl.needs.wetness > 40 && ['ashrain', 'ashstorm'].includes(w.s.weather))) && w.s.map.kind === 'surface') {
    const recovery = botShelterAction(w, p => avoided(w, p) || (pl.level < 5 && w.s.map.rooms[tileAt(w, p).room ?? -1]?.type === 'camp'))
    if (recovery) return recovery
  }
  const awakeNear = w.s.creatures.some((o) => o.alive && !o.asleep && hostile(w, pl, o) && o.ai.mode !== 'surrender' && cheb(o.pos, pl.pos) <= 8)
  if (pl.needs.fatigue > 75 && pl.needs.bodyTemp >= 35 && !awakeNear) return { type: 'sleep' }
  // 다쳤으면 다음 방으로 가기 전에 쉰다 (던전 탐험의 정석)
  if ((pl.hp < hpMax(w, pl) * 0.75 || bloodLoss(pl) > 0.12) && !awakeNear) return { type: 'rest', turns: 120 }

  // 탐색: 바닥 → 용기 → 미발견 방 → 아래층
  if (tileAt(w, pl.pos).items.length) return { type: 'pickup' }
  const nearbyContainer=[{x:0,y:0},...DIRS].map(d=>({x:pl.pos.x+d.x,y:pl.pos.y+d.y})).find(pos=>inBounds(w,pos)&&hasLos(w,pl.pos,pos)&&canSee(w,pl,pos)&&!diagonalBlocked(w,pl.pos,pos.x-pl.pos.x,pos.y-pl.pos.y)&&terrainAt(w,pos).container&&containerFresh(w,pos)&&canSearchContainer(w,pl,pos))
  if(nearbyContainer)return{type:'search',pos:nearbyContainer}
  if(adjacentCorpse(w,pl,true))return{type:'search'}
  // 쓰러뜨린 적의 시체를 뒤진다 (소지품은 시체에 남는다)
  const body = w.s.creatures.find((o) => !o.alive && !o.searched && o.id !== pl.id && cheb(o.pos, pl.pos) <= 10 && (o.bag.length > 0 || Object.values(o.equip).some(Boolean)))
  if (body) {
    const st = stepTo(w, body.pos)
    if (st !== null) return { type: 'move', dir: st }
  }
  // 레벨이 낮으면 약탈자 야영지는 피한다
  const avoid = (p: Pos) => (pl.level < 5 && w.s.map.rooms[tileAt(w, p).room ?? -1]?.type === 'camp') || avoided(w, p)
  const cont = nearest(w, (p) => !!terrainAt(w, p).container && containerFresh(w, p) && canSearchContainer(w,pl,p) && !!tileAt(w, p).seen && !avoid(p))
  if (cont) {
    const st = stepTo(w, cont)
    if (st !== null) return { type: 'move', dir: st }
  }
  const room = w.s.map.rooms
    .filter((r, i) => !r.discovered && !(r.type === 'camp' && pl.level < 5) && !mem(w).avoid.includes(`${w.s.map.id}:${i}`))
    .map((r) => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }))
    .sort((a, b) => cheb(a, pl.pos) - cheb(b, pl.pos))[0]
  if (room) {
    const st = stepTo(w, room)
    if (st !== null) return { type: 'move', dir: st }
  }
  const down = w.s.map.links.find((l) => terrainAt(w, l.pos).id === 'Terrain.StairsDown')
  // 내려가기 전에 몸을 채운다 (HP 90% · 기력 80% · 출혈 없음)
  if (down && (pl.hp < hpMax(w, pl) * 0.9 || pl.needs.energy < energyMax(w, pl) * 0.8 || bleeding.length) && !awakeNear) return { type: 'rest', turns: 60 }
  // 지하로 내려가기 전에 빈 병을 채운다 (지하엔 물이 없다)
  if (down && w.s.map.kind === 'surface' && !awakeNear) {
    const empty = inv.find((i) => itemDef(w, i).drink && !itemDef(w, i).drink!.alcohol && (i.uses ?? 0) < 3)
    const water = empty && nearest(w, (p) => terrainAt(w, p).water === 'shallow')
    if (water) { const st = stepTo(w, water); if (st !== null) return { type: 'move', dir: st } }
  }
  // 물러난 뒤 1시간은 다시 내려가지 않는다 (추적하던 무리가 제자리로 돌아갈 시간)
  const sinceRetreat = turnOf(w) - (mem(w).lastRetreat ?? -1e9)
  if (down && sinceRetreat < TURNS_PER_HOUR && !awakeNear) return { type: 'rest', turns: 60 }
  if (down) {
    if (eq(pl.pos, down.pos)) return { type: 'stairs' }
    const st = stepTo(w, down.pos)
    if (st !== null) return { type: 'move', dir: st }
  }
  return { type: 'rest', turns: 60 }
}

const elevOf = (w: World, p: Pos) => terrainAt(w, p).elevation ?? 0

/**
 * 높은 자리 잡기 (07 §5: 단차 1 위면 근접 +10, 아래면 −10). 사냥 중인 적이 6칸 안에서 다가오면
 * 이미 높은 자리면 그쪽을 보고 기다리고(30턴까지), 올라가는 계단이 6걸음 안이고 적보다 가까우면 계단으로(높은 자리이자 퇴로),
 * 아니면 적에게 붙지 않는 옆 칸 중 더 높은 칸으로 오른다.
 */
function highGround(w: World, enemies: Creature[], up?: Pos): Action | null {
  const pl = player(w), m = mem(w)
  const coming = enemies.filter((e) => e.ai.mode === 'hunt' && cheb(e.pos, pl.pos) <= 6)
  if (!coming.length) { m.standAt = undefined; return null }
  const nearestFoe = coming[0]
  if (elevOf(w, pl.pos) > 0) {
    m.standAt ??= turnOf(w)
    if (turnOf(w) - m.standAt > 30) return null
    const toward = dirIndex(nearestFoe.pos.x - pl.pos.x, nearestFoe.pos.y - pl.pos.y)
    return pl.facing !== toward ? { type: 'face', dir: toward } : { type: 'wait' }
  }
  m.standAt = undefined
  if (up && w.s.map.kind === 'dungeon') {
    const path = findPath(w, pl.pos, up, { avoidCreatures: true, selfId: pl.id })
    if (path && path.length && path.length <= 6 && coming.every((e) => cheb(e.pos, up) > path.length)) {
      const n = path[0]
      return { type: 'move', dir: dirIndex(n.x - pl.pos.x, n.y - pl.pos.y) }
    }
  }
  for (let i = 0; i < 8; i++) {
    const p = { x: pl.pos.x + DIRS[i].x, y: pl.pos.y + DIRS[i].y }
    if (!inBounds(w, p) || !terrainAt(w, p).passable || creatureAt(w, p) || diagonalBlocked(w, pl.pos, DIRS[i].x, DIRS[i].y)) continue
    if (elevOf(w, p) > elevOf(w, pl.pos) && coming.every((e) => cheb(e.pos, p) >= 2)) return { type: 'move', dir: i }
  }
  return null
}

/** 잠든 단독 적: 주변 5칸에 다른 잠든 적이 없고 깨어 있는 적도 없을 때. 무리면 그 방을 피할 곳으로 */
function sleeperTarget(w: World): Creature | undefined {
  const pl = player(w)
  const vis = w.s.creatures.filter((o) => o.alive && hostile(w, pl, o) && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos))
  if (vis.some((o) => !o.asleep)) return undefined
  for (const s of vis.filter((o) => o.asleep).sort((a, b) => cheb(a.pos, pl.pos) - cheb(b.pos, pl.pos))) {
    const pack = w.s.creatures.filter((o) => o.alive && o.id !== s.id && hostile(w, pl, o) && cheb(o.pos, s.pos) <= 5)
    if (pack.length) { avoidRoomOf(w, s); continue }
    if (avoided(w, s.pos)) continue
    // 첫 타 뒤 1:1이 감당되는가
    if (fightRisk(w, pl, [s]) > 1.2) { avoidRoomOf(w, s); continue }
    return s
  }
  return undefined
}

function enemiesAdjacent(w: World): boolean {
  const pl = player(w)
  return w.s.creatures.some((o) => o.alive && !o.asleep && hostile(w, pl, o) && cheb(o.pos, pl.pos) <= 1)
}

/** 둘러싼 8칸 중 지나갈 수 있는 칸 수 (작을수록 좁다) */
function openness(w: World, p: Pos): number {
  let n = 0
  for (const d of DIRS) {
    const q = { x: p.x + d.x, y: p.y + d.y }
    if (inBounds(w, q) && terrainAt(w, q).passable) n++
  }
  return n
}

/** 지금보다 좁고 적에게서 가까워지지 않는 이웃 칸 */
function chokeStep(w: World, threats: Pos[]): number | null {
  const pl = player(w)
  const here = openness(w, pl.pos)
  const dNow = Math.min(...threats.map((t) => cheb(t, pl.pos)))
  let best: number | null = null, bo = here
  for (let i = 0; i < 8; i++) {
    const p = { x: pl.pos.x + DIRS[i].x, y: pl.pos.y + DIRS[i].y }
    if (!inBounds(w, p) || !terrainAt(w, p).passable || creatureAt(w, p) || diagonalBlocked(w, pl.pos, DIRS[i].x, DIRS[i].y)) continue
    const o = openness(w, p)
    if (o < bo && Math.min(...threats.map((t) => cheb(t, p))) >= dNow) { bo = o; best = i }
  }
  return best
}

function rngPick(w: World): boolean {
  return (turnOf(w) & 1) === 0
}

function nearest(w: World, pred: (p: Pos) => boolean): Pos | null {
  const pl = player(w)
  let best: Pos | null = null
  let bd = Infinity
  for (let y = 0; y < w.s.map.h; y++) for (let x = 0; x < w.s.map.w; x++) {
    const p = { x, y }
    if (!pred(p)) continue
    const d = cheb(p, pl.pos)
    if (d < bd) { bd = d; best = p }
  }
  return best
}

function stepTo(w: World, dest: Pos): number | null {
  const pl = player(w)
  const path = findPath(w, pl.pos, dest, { avoidCreatures: true, selfId: pl.id })
  if (!path || !path.length) return null
  const n = path[0]
  if (eq(n, dest) && terrainAt(w, dest).container && !terrainAt(w, dest).passable) return null
  return dirIndex(n.x - pl.pos.x, n.y - pl.pos.y)
}

function stepAway(w: World, threats: Pos[]): number | null {
  const pl = player(w)
  let best: number | null = null, bs = -1
  for (let i = 0; i < 8; i++) {
    const p = { x: pl.pos.x + DIRS[i].x, y: pl.pos.y + DIRS[i].y }
    if (!inBounds(w, p)) continue
    if (!terrainAt(w, p).passable || creatureAt(w, p) || diagonalBlocked(w, pl.pos, DIRS[i].x, DIRS[i].y)) continue
    const s = Math.min(...threats.map((t) => cheb(t, p)))
    if (s > bs) { bs = s; best = i }
  }
  return best
}
