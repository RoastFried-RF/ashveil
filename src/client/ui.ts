// 화면 상태(창·대상 지정·툴팁)와 플레이어 편의 행동 (아이템 쓰기·빠른 슬롯)

import { reactive, ref } from 'vue'
import {
  maneuverQuote, type ManeuverKind, throwItems, throwQuote, quickItem, abilityReady, bowProblem, type DrugDef, surgeryDef, surgeryError, masteryStage, canReach, cheb, effectiveBleed, hasLos, hostile, itemDef, mainWeapon, part, player, rangedRange,
  type Action, type Creature, type HotbarRef, type ItemInst, type World,
} from '../core'
import { act, world } from './store'

export type WinKey = 'char' | 'inv' | 'abil' | 'body' | 'journal' | 'map' | 'craft' | 'society'
export const wins = reactive<Record<WinKey, boolean>>({ char: false, inv: false, abil: false, body: false, journal: false, map: false, craft: false, society: false })
/** 연 순서 (Esc는 가장 위 창부터, 동시에 3개까지, 12 §2.3) */
export const winOrder: WinKey[] = []
export const socialTarget = ref<number | null>(null)
export const prostheticInstallUid = ref<number | null>(null)
export const hint = ref<string | null>(null)
/** 기록 창 크게 보기 (Shift+L, 12 §8) */
export const logBig = ref(false)
export const tooltip = ref<{ x: number; y: number; title: string; lines: string[]; color?: string } | null>(null)

export interface Targeting { kind: 'ability' | 'shoot' | 'throw' | 'trip' | 'disarm'; id?: string; uid?: number; label: string; targets: number[]; idx: number }
export const targeting = ref<Targeting | null>(null)

let zTop = 30
export function nextZ(): number {
  return ++zTop
}

export function toggleWin(k: WinKey) {
  setWin(k, !wins[k])
}

export function setWin(k: WinKey, open: boolean) {
  const i = winOrder.indexOf(k)
  if (i >= 0) winOrder.splice(i, 1)
  wins[k] = open
  if (!open) return
  winOrder.push(k)
  // 창은 3개까지: 넘치면 가장 먼저 연 창을 닫는다
  while (winOrder.length > 3) wins[winOrder.shift()!] = false
}

/** 가장 위(마지막에 연) 창을 닫는다 */
export function closeTopWin(): boolean {
  for (let i = winOrder.length - 1; i >= 0; i--) {
    const k = winOrder[i]
    winOrder.splice(i, 1)
    if (wins[k]) { wins[k] = false; return true }
  }
  const open = (Object.keys(wins) as WinKey[]).filter((k) => wins[k])
  if (open.length) { wins[open[open.length - 1]] = false; return true }
  return false
}

/** 전투 기록 상세도 3단계 (12 §5) */
export const logLevel = ref<'brief' | 'standard' | 'detail'>('standard')

export function doAct(a: Action): string | null {
  hideTip()
  const err = act(a)
  hint.value = err
  return err
}

/** 보이는 적 (가까운 순) */
export function visibleEnemies(w: World): Creature[] {
  const pl = player(w)
  const vis = new Set(w.s.visible)
  return w.s.creatures
    .filter((c) => c.alive && hostile(w, pl, c) && vis.has(c.pos.y * w.s.map.w + c.pos.x))
    .sort((a, b) => cheb(a.pos, pl.pos) - cheb(b.pos, pl.pos))
}

/** 능력/사격 대상 후보 */
export function validTargets(w: World, abilityId?: string): Creature[] {
  const pl = player(w)
  const mw = mainWeapon(w, pl)
  const ranged = mw ? itemDef(w, mw).ranged : undefined
  const ab = abilityId ? w.db.ability(abilityId) : undefined
  const useRanged = ab ? ab.weapon === 'archery' : !!ranged
  return visibleEnemies(w).filter((c) => {
    if (useRanged) return !!ranged && cheb(pl.pos, c.pos) <= rangedRange(w, pl, c) && hasLos(w, pl.pos, c.pos)
    return canReach(w, pl, c)
  })
}

export function startShoot() {
  const w = world.value
  if (!w) return
  const pl = player(w)
  const mw = mainWeapon(w, pl)
  if (!mw || !itemDef(w, mw).ranged) { hint.value = '원거리 무기를 들고 있지 않다'; return }
  const problem = bowProblem(mw, itemDef(w, mw))
  if (problem) { hint.value = problem; return }
  const ts = validTargets(w)
  if (!ts.length) { hint.value = '쏠 수 있는 적이 없다'; return }
  targeting.value = { kind: 'shoot', label: '사격', targets: ts.map((c) => c.id), idx: 0 }
}

/** 소지품 메뉴/더블클릭/기존 아이템 빠른 슬롯이 같은 실물 UID로 조준한다. */
export function startThrow(uid: number): string | null {
  const w = world.value
  if (!w) return null
  const pl = player(w)
  const ts = visibleEnemies(w).filter(c => !throwQuote(w, pl, uid, c.id).error)
  const item=throwItems(pl).find(i=>i.uid===uid),label=item?itemDef(w,item).throwable?.attack.label??'투척 공격':'투척 공격'
  if (!ts.length) return (hint.value = '던질 수 있는 적이 없다')
  targeting.value = { kind: 'throw', uid, label, targets: ts.map(c => c.id), idx: 0 }
  setWin('inv', false)
  hint.value = `${label} — 대상을 고르세요 (클릭 · Tab 순환 · Enter 확정 · Esc 취소)`
  return null
}

/** 같은 읽기 전용 코어 검사를 사용하고 실제 확정 입력에서만 비용을 낸다. */
export function startManeuver(kind:ManeuverKind){
  const w=world.value;if(!w)return
  const pl=player(w),label=kind==='trip'?'넘어뜨리기':'무장해제'
  const ts=visibleEnemies(w).filter(c=>!maneuverQuote(w,pl,kind,c.id).error)
  if(!ts.length){hint.value=`${label}: 바로 곁에 행동할 상대가 없다`;return}
  targeting.value={kind,label,targets:ts.map(c=>c.id),idx:0}
  setWin('inv',false)
  hint.value=`${label} — 대상을 고르세요 (클릭 · Tab · Enter 확정 · Esc 취소)`
}

export function useAbility(id: string) {
  const w = world.value
  if (!w) return
  const pl = player(w)
  const err = abilityReady(w, pl, id)
  if (err) { hint.value = err; return }
  const d = w.db.ability(id)
  if (d.target === 'enemy' || d.attack) {
    const ts = validTargets(w, id)
    if (!ts.length) { hint.value = `${d.label}: 닿는 적이 없다`; return }
    targeting.value = { kind: 'ability', id, label: d.label, targets: ts.map((c) => c.id), idx: 0 }
    hint.value = `${d.label} — 대상을 고르세요 (클릭 · Tab 순환 · Enter 확정 · Esc 취소)`
    return
  }
  doAct({ type: 'ability', id })
}

export function confirmTarget(id?: number) {
  const t = targeting.value
  if (!t) return
  const target = id ?? t.targets[t.idx]
  targeting.value = null
  hint.value = null
  if (t.kind === 'shoot') doAct({ type: 'shoot', target })
  else if (t.kind === 'throw') doAct({ type: 'throwAttack', uid: t.uid!, target })
  else if (t.kind === 'trip' || t.kind === 'disarm') doAct({type:t.kind,target})
  else doAct({ type: 'ability', id: t.id!, target })
}

/** 아이템 기본 사용: 의료품은 가장 급한 상처에, 음식·약은 먹고, 장비는 장착 */
export function useItem(w: World, it: ItemInst): string | null {
  const d = itemDef(w, it)
  const pl = player(w)
  if(d.throwable)return startThrow(it.uid)
  if(d.powder){hint.value='화약은 장총의 장전 메뉴에서 실제 납탄과 함께 쓴다';return null}
  if(d.category==='ammo')return doAct({type:'selectAmmo',uid:it.uid})
  if (d.drug?.def && w.db.get<DrugDef>(d.drug.def).external) { setWin('body', true); return (hint.value = '신체 창에서 약을 바를 상처를 고르세요.') }
  if (d.prosthetic) { prostheticInstallUid.value = it.uid; setWin('body', true); return (hint.value = '결손 부위를 골라 의수족을 설치할 수 있다.') }
  if (d.medical) {
    const wounds = pl.body.wounds.filter((wd) => !wd.internal)
    if (d.medical.kind === 'suture') {
      const advanced = masteryStage(w, pl, 'medicine') >= 3
      const target = wounds.filter((wd) => w.db.wound(wd.def).suturable && (!wd.suture || (advanced && wd.tendon))).sort((a, b) => effectiveBleed(w, pl, b) - effectiveBleed(w, pl, a))[0]
      const procedure = target?.artery ? 'ligate' : target?.tendon && advanced ? 'tendon' : 'suture'
      const damaged = !target && advanced ? pl.body.damagedTendons?.[0] : undefined
      const kind = damaged ? 'tendon' : procedure
      const err = surgeryError(w, pl, surgeryDef(w, kind), target, damaged)
      if (err) { setWin('body', true); return (hint.value = err) }
      return doAct({ type: 'treat', uid: it.uid, woundId: target?.id, limb: damaged, procedure: kind })
    }
    let target
    if (d.medical.kind === 'splint') target = wounds.find((wd) => wd.fracture && (!wd.splint || wd.splint.half))
    else if (d.medical.kind === 'disinfect') target = wounds.filter((wd) => wd.contam > 5 && !wd.cauterized).sort((a, b) => b.contam - a.contam)[0]
    else if (d.medical.kind === 'tourniquet') target = wounds.filter((wd) => wd.arterial && part(w, pl, wd.part).limb).sort((a, b) => effectiveBleed(w, pl, b) - effectiveBleed(w, pl, a))[0]
    else target = wounds.filter((wd) => (!wd.bandage || wd.bandage.dirty) && effectiveBleed(w, pl, wd) > 0).sort((a, b) => effectiveBleed(w, pl, b) - effectiveBleed(w, pl, a))[0]
      ?? wounds.find((wd) => !wd.bandage)
    if (!target) return (hint.value = '처치할 상처가 없다')
    return doAct({ type: 'treat', uid: it.uid, woundId: target.id })
  }
  if (d.readable) return doAct({ type: 'read', uid: it.uid })
  if (d.food || d.drink || d.drug || d.unidentified || d.refuel) return doAct({ type: 'consume', uid: it.uid })
  if (d.light && !d.slot) return doAct({ type: 'toggleLight', uid: it.uid })
  if (d.slot) return doAct({ type: 'equip', uid: it.uid })
  return doAct({ type: 'examine', uid: it.uid })
}

export function useHotbar(i: number) {
  const w = world.value
  if (!w) return
  const ref = player(w).hotbar[i]
  if (!ref) return
  if (ref.kind === 'ability') return useAbility(ref.id)
  // 배낭/착용한 허리 주머니의 실제 소모품 (13 §7)
  const it = quickItem(player(w),ref.def,ref.fletchingDamaged,!!w.db.item(ref.def).throwable)
  if (!it) { hint.value = `${w.db.item(ref.def).label}: 남은 것이 없다`; return }
  useItem(w, it)
}

export function itemHotbarRef(w:World,it:ItemInst):HotbarRef{return{kind:'item',def:it.def,...(itemDef(w,it).fletching?{fletchingDamaged:!!it.fletchingDamaged}:{})}}

export function assignHotbar(ref: HotbarRef) {
  const w = world.value
  if (!w) return
  const hb = player(w).hotbar
  // 능력은 한 칸만, 같은 소모품은 여러 칸 허용 (13 §7)
  const same = ref.kind === 'ability' ? hb.findIndex((h) => h?.kind === 'ability' && h.id === ref.id) : -1
  if (same >= 0) { hint.value = `이미 ${same + 1}번 칸에 있다`; return }
  const i = hb.findIndex((h) => !h)
  if (i < 0) { hint.value = '빠른 슬롯이 가득 찼다 (칸을 우클릭해 비우기)'; return }
  doAct({ type: 'hotbar', index: i, ref })
}

export function showTip(e: MouseEvent, title: string, lines: string[], color?: string) {
  tooltip.value = { x: e.clientX, y: e.clientY, title, lines, color }
}
export function hideTip() {
  tooltip.value = null
}
