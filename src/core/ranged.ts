// 석궁 장전: 탄약/무기 UID를 묶고 완료 때만 한 발을 옮긴다.
import { capacity } from './body'
import { log, type World } from './ctx'
import { bowProblem } from './gear-state'
import { findItem, itemDef, removeOne, supplyItems } from './items'
import type { Activity, Creature, ItemInst } from './types'

export function projectileReady(w: World, c: Creature, weapon: ItemInst): boolean {
  const rd = itemDef(w, weapon).ranged
  return !!rd && (rd.reloadTurns ? weapon.loadedAmmo === rd.ammo : supplyItems(c).some((i) => i.def === rd.ammo && i.count > 0))
}
export function spendProjectile(w: World, c: Creature, weapon: ItemInst): boolean {
  const rd = itemDef(w, weapon).ranged
  if (!rd || !projectileReady(w, c, weapon)) return false
  if (rd.reloadTurns) weapon.loadedAmmo = undefined
  else removeOne(w, c, supplyItems(c).find((i) => i.def === rd.ammo)!.uid)
  return true
}
export function startReload(w: World, c: Creature, uid: number, factor: number): string | null {
  const it = findItem(c, uid), d = it && itemDef(w, it), rd = d?.ranged
  if (!it || !d || !rd?.reloadTurns) return '장전할 석궁이 없다'
  const err = bowProblem(it, d)
  if (err) return err
  if (it.loadedAmmo) return '이미 장전되어 있다'
  if (capacity(w, c, 'manipulation') < .5 || !Number.isFinite(factor) || factor > 4) return '손 상태 때문에 장전할 수 없다'
  const ammo = supplyItems(c).find((i) => i.def === rd.ammo && i.count > 0)
  if (!ammo) return '장전할 탄약이 없다'
  const total = Math.max(1, Math.ceil(rd.reloadTurns * factor - 1e-9))
  c.activity = { kind: 'reload', remaining: total, total, uid: it.uid, toolUid: ammo.uid, label: `${d.label} 장전` }
  if (c.faction === 'player') log(w, 'info', `${d.label} 장전 (${total}턴).`)
  return null
}
export function finishReload(w: World, c: Creature, act: Activity) {
  const it = findItem(c, act.uid ?? -1), d = it && itemDef(w, it), ammo = supplyItems(c).find((i) => i.uid === act.toolUid)
  if (!it || !d?.ranged?.reloadTurns || bowProblem(it, d) || it.loadedAmmo || !ammo || ammo.def !== d.ranged.ammo || ammo.count < 1 || capacity(w, c, 'manipulation') < .5) {
    if (c.faction === 'player') log(w, 'warn', '장전 중단: 무기·탄약·손 상태가 바뀌었다.')
    return
  }
  removeOne(w, c, ammo.uid); it.loadedAmmo = d.ranged.ammo
  if (c.faction === 'player') log(w, 'good', `${d.label}에 한 발을 장전했다.`)
}
