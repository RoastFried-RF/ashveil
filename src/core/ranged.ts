// 석궁 장전: 탄약/무기 UID를 묶고 완료 때만 한 발을 옮긴다.
import { firearmReady, finishFirearmReload, startFirearmReload } from './firearms'
import { capacity } from './body'
import { log, type World } from './ctx'
import { bowProblem } from './gear-state'
import { findItem, itemDef, removeOne, supplyItems } from './items'
import type { Activity, Creature, ItemInst } from './types'

export function selectedProjectile(c:Creature,def:string):ItemInst|undefined{
 const preference=c.ammoPreference?.def===def?c.ammoPreference:undefined
 return supplyItems(c).find(i=>i.def===def&&i.count>0&&!i.missingItem&&(!preference||!!i.fletchingDamaged===preference.fletchingDamaged&&(preference.toxin===undefined||!!i.toxin===preference.toxin)))
}
export function projectileFletching(w:World,c:Creature,weapon:ItemInst):boolean{
 const rd=itemDef(w,weapon).ranged
 return !!rd&&!rd.firearm&&(rd.reloadTurns?!!weapon.loadedAmmoFletching:!!selectedProjectile(c,rd.ammo)?.fletchingDamaged)
}
export function projectileToxin(w:World,c:Creature,weapon:ItemInst){const rd=itemDef(w,weapon).ranged;return rd&&!rd.firearm?(rd.reloadTurns?weapon.loadedAmmoToxin:selectedProjectile(c,rd.ammo)?.toxin):undefined}
export function projectileReady(w: World, c: Creature, weapon: ItemInst): boolean {
  const rd = itemDef(w, weapon).ranged
  return rd?.firearm ? firearmReady(w,c,weapon) : !!rd && (rd.reloadTurns ? weapon.loadedAmmo === rd.ammo : !!selectedProjectile(c,rd.ammo))
}
export function spendProjectile(w: World, c: Creature, weapon: ItemInst): boolean {
  const rd = itemDef(w, weapon).ranged
  if (!rd || rd.firearm || !projectileReady(w, c, weapon)) return false
  if (rd.reloadTurns) {weapon.loadedAmmo = undefined;delete weapon.loadedAmmoFletching;delete weapon.loadedAmmoToxin}
  else removeOne(w, c, selectedProjectile(c,rd.ammo)!.uid)
  return true
}
export function startReload(w: World, c: Creature, uid: number, factor: number): string | null {
  const it = findItem(c, uid), d = it && itemDef(w, it), rd = d?.ranged
  if (!it || !d || !rd?.reloadTurns) return '장전할 석궁이 없다'
  if(rd.firearm)return startFirearmReload(w,c,it,factor)
  const err = bowProblem(it, d)
  if (err) return err
  if (it.loadedAmmo) return '이미 장전되어 있다'
  if (capacity(w, c, 'manipulation') < .5 || !Number.isFinite(factor) || factor > 4) return '손 상태 때문에 장전할 수 없다'
  const ammo = selectedProjectile(c,rd.ammo)
  if (!ammo) return '장전할 탄약이 없다'
  const total = Math.max(1, Math.ceil(rd.reloadTurns * factor - 1e-9))
  c.activity = { kind: 'reload', remaining: total, total, uid: it.uid, toolUid: ammo.uid, label: `${d.label} 장전` }
  if(ammo.toxin)c.activity.ammoToxin={...ammo.toxin,turns:[...ammo.toxin.turns]}
  if (c.faction === 'player') log(w, 'info', `${d.label} 장전 (${total}턴).`)
  return null
}
export function finishReload(w: World, c: Creature, act: Activity) {
  const it = findItem(c, act.uid ?? -1), d = it && itemDef(w, it), ammo = supplyItems(c).find((i) => i.uid === act.toolUid)
  if(d?.ranged?.firearm){finishFirearmReload(w,c,act);return}
  if (!it || !d?.ranged?.reloadTurns || bowProblem(it, d) || it.loadedAmmo || !ammo || ammo.def !== d.ranged.ammo || ammo.count < 1 || (c.ammoPreference?.def===ammo.def&&c.ammoPreference.fletchingDamaged!==!!ammo.fletchingDamaged) || JSON.stringify(act.ammoToxin)!==JSON.stringify(ammo.toxin) || capacity(w, c, 'manipulation') < .5) {
    if (c.faction === 'player') log(w, 'warn', '장전 중단: 무기·탄약·깃·손 상태가 바뀌었다.')
    return
  }
  const damaged=!!ammo.fletchingDamaged,toxin=ammo.toxin
  removeOne(w, c, ammo.uid); it.loadedAmmo = d.ranged.ammo
  if(damaged)it.loadedAmmoFletching=true;else delete it.loadedAmmoFletching
  if(toxin)it.loadedAmmoToxin={...toxin,turns:[...toxin.turns]};else delete it.loadedAmmoToxin
  if (c.faction === 'player') log(w, 'good', `${d.label}에 한 발을 장전했다.`)
}
