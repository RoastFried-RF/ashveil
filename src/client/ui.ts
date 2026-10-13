// 화면 상태(창·대상 지정·툴팁)와 플레이어 편의 행동 (아이템 쓰기·빠른 슬롯)

import { reactive, ref } from 'vue'
import {
  abilityReady, allItems, canReach, cheb, effectiveBleed, hasLos, hostile, itemDef, mainWeapon, part, player,
  type Action, type Creature, type HotbarRef, type ItemInst, type World,
} from '../core'
import { act, world } from './store'

export type WinKey = 'char' | 'inv' | 'abil' | 'body' | 'journal'
export const wins = reactive<Record<WinKey, boolean>>({ char: false, inv: false, abil: false, body: false, journal: false })
export const hint = ref<string | null>(null)
export const tooltip = ref<{ x: number; y: number; title: string; lines: string[]; color?: string } | null>(null)

export interface Targeting { kind: 'ability' | 'shoot'; id?: string; label: string; targets: number[]; idx: number }
export const targeting = ref<Targeting | null>(null)

let zTop = 30
export function nextZ(): number {
  return ++zTop
}

export function toggleWin(k: WinKey) {
  wins[k] = !wins[k]
}

export function doAct(a: Action): string | null {
  const err = act(a)
  hint.value = err
  return err
}

/** 보이는 적 (가까운 순) */
export function visibleEnemies(w: World): Creature[] {
  const pl = player(w)
  const vis = new Set(w.s.visible)
  return w.s.creatures
    .filter((c) => c.alive && hostile(pl, c) && vis.has(c.pos.y * w.s.map.w + c.pos.x))
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
    if (useRanged) return !!ranged && cheb(pl.pos, c.pos) <= ranged.range && hasLos(w, pl.pos, c.pos)
    return canReach(w, pl, c)
  })
}

export function startShoot() {
  const w = world.value
  if (!w) return
  const pl = player(w)
  const mw = mainWeapon(w, pl)
  if (!mw || !itemDef(w, mw).ranged) { hint.value = '원거리 무기를 들고 있지 않다'; return }
  const ts = validTargets(w)
  if (!ts.length) { hint.value = '쏠 수 있는 적이 없다'; return }
  targeting.value = { kind: 'shoot', label: '사격', targets: ts.map((c) => c.id), idx: 0 }
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
  else doAct({ type: 'ability', id: t.id!, target })
}

/** 아이템 기본 사용: 의료품은 가장 급한 상처에, 음식·약은 먹고, 장비는 장착 */
export function useItem(w: World, it: ItemInst): string | null {
  const d = itemDef(w, it)
  const pl = player(w)
  if (d.medical) {
    const wounds = pl.body.wounds.filter((wd) => !wd.internal)
    let target
    if (d.medical.kind === 'splint') target = wounds.find((wd) => wd.fracture && !wd.splinted)
    else if (d.medical.kind === 'disinfect') target = wounds.find((wd) => !wd.disinfected && (wd.infection || !wd.infectionChecked))
    else if (d.medical.kind === 'tourniquet') target = wounds.filter((wd) => wd.arterial && part(w, pl, wd.part).limb).sort((a, b) => effectiveBleed(w, pl, b) - effectiveBleed(w, pl, a))[0]
    else target = wounds.filter((wd) => !wd.bandage && effectiveBleed(w, pl, wd) > 0).sort((a, b) => effectiveBleed(w, pl, b) - effectiveBleed(w, pl, a))[0]
      ?? wounds.find((wd) => !wd.bandage)
    if (!target) return (hint.value = '처치할 상처가 없다')
    return doAct({ type: 'treat', uid: it.uid, woundId: target.id })
  }
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
  const it = allItems(player(w)).find((x) => x.def === ref.def)
  if (!it) { hint.value = `${w.db.item(ref.def).label}: 남은 것이 없다`; return }
  useItem(w, it)
}

export function assignHotbar(ref: HotbarRef) {
  const w = world.value
  if (!w) return
  const hb = player(w).hotbar
  const same = hb.findIndex((h) => h && h.kind === ref.kind && (h.kind === 'ability' ? h.id === (ref as { id: string }).id : h.def === (ref as { def: string }).def))
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
