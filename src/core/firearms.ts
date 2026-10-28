import { capacity, handCapacity, regionState } from './body'
import { weatherWetPerTurn } from './climate-state'
import { clamp, log, rng, tileAt, turnOf, type World } from './ctx'
import { hostile } from './diplomacy'
import { cheb } from './geom'
import { findItem, itemDef, removeOne, supplyItems } from './items'
import { moraleEvent } from './morale'
import { ambientNoise, hearingBonus, noiseCost } from './perception'
import { prostheticGrip } from './prosthetic-state'
import type { Activity, Creature, ItemInst } from './types'

export function firearmRates(w: World, gun: ItemInst) {
  const cfg = itemDef(w, gun).ranged?.firearm
  if (!cfg) return null
  const fouling = clamp(gun.firearmFouling ?? 0, 0, 100)
  const cartridge = gun.loadedCartridges?.[0], ammo = cartridge && w.db.tryGet<import('./types').ItemDef>(cartridge.def)?.cartridge
  const wet = (cartridge?.powderWetness ?? gun.loadedRound?.powder.powderWetness ?? 0) >= cfg.wetThreshold
  return { misfire: clamp((ammo?.misfire ?? cfg.misfire) * (wet ? cfg.wetMultiplier : 1) + Math.floor(fouling / 10), 0, 100), jam: clamp(Math.max(0, fouling - cfg.jamThreshold) * cfg.jamPerPoint, 0, 100), fouling, wet }
}
function usableHands(w: World, c: Creature, gun?: ItemInst) {
  const sides: ('Left'|'Right')[] = gun && !itemDef(w, gun).twoHanded ? ['Right'] : ['Left','Right']
  return sides.every(side => prostheticGrip(w, c, side) && handCapacity(w, c, side) >= .5 && regionState(w, c, side === 'Left' ? 'larm' : 'rarm') < 4)
}
export function firearmAmmo(w: World, gun: ItemInst, ammo: ItemInst): boolean {
  const rd=itemDef(w,gun).ranged
  return !!rd?.magazine && [rd.ammo,...rd.magazine.alternatives].includes(ammo.def) && !!w.db.tryGet<import('./types').ItemDef>(ammo.def)?.cartridge && !ammo.missingItem
}
export function firearmSupply(w: World, c: Creature, gun: ItemInst): boolean {
  const rd=itemDef(w,gun).ranged
  return !!rd?.firearm && (rd.magazine ? magazineSupplies(w,c,gun).length>0 : [rd.ammo,rd.firearm.powder].every(def=>supplyItems(c).some(i=>i.def===def&&Number.isSafeInteger(i.count)&&i.count>0&&!i.missingItem)))
}
function magazineSupplies(w: World, c: Creature, gun: ItemInst): ItemInst[] {
  const rd=itemDef(w,gun).ranged!, preference=c.ammoPreference
  const restrict=preference && [rd.ammo,...rd.magazine!.alternatives].includes(preference.def)
  return supplyItems(c).filter(i=>firearmAmmo(w,gun,i)&&Number.isSafeInteger(i.count)&&i.count>0&&(!restrict||i.def===preference.def))
}
export function firearmReady(w: World, c: Creature, gun: ItemInst): boolean {
  const rd = itemDef(w, gun).ranged, round = gun.loadedRound
  if(!rd?.firearm||gun.firearmJammed||!usableHands(w,c,gun))return false
  if(rd.magazine){const next=gun.loadedCartridges?.[0];return !!next&&(gun.loadedCartridges?.length??0)<=rd.magazine.capacity&&next.count===1&&firearmAmmo(w,gun,next)}
  return !!round && round.ball.def === rd.ammo && round.powder.def === rd.firearm.powder && round.ball.count === 1 && round.powder.count === 1 && !round.ball.missingItem && !round.powder.missingItem
}
export function firearmReloadError(w: World, c: Creature, gun: ItemInst): string | null {
  const rd=itemDef(w, gun).ranged
  if (!rd?.firearm) return '장전할 화기가 없다'
  if ((gun.durability ?? 100) <= 0) return '화기가 부서졌다'
  if (gun.firearmJammed) return '먼저 걸림을 해소해야 한다'
  if(rd.magazine){if(gun.loadedRound||(gun.loadedCartridges?.length??0)>=rd.magazine.capacity)return '탄창이 가득 차 있다'}
  else if (gun.loadedRound || gun.loadedAmmo) return '이미 장전되어 있다'
  if (!usableHands(w, c)) return '두 손 상태 때문에 장전할 수 없다'
  return null
}
export function startFirearmReload(w: World, c: Creature, gun: ItemInst, factor: number): string | null {
  const error = firearmReloadError(w, c, gun)
  if (error) return error
  if (!Number.isFinite(factor) || factor <= 0 || factor > 4) return '몸 상태 때문에 장전할 수 없다'
  const rd = itemDef(w, gun).ranged!, cfg = rd.firearm!
  if(rd.magazine){
    const refs:NonNullable<Activity['supplies']>=[],free=rd.magazine.capacity-(gun.loadedCartridges?.length??0)
    for(const i of magazineSupplies(w,c,gun))for(let n=0;n<i.count&&refs.length<free;n++)refs.push({uid:i.uid,def:i.def,count:1})
    if(!refs.length)return '선택한 실제 호환 실탄이 없다'
    const unit=Math.max(1,Math.ceil(rd.reloadTurns!*factor-1e-9)),total=unit*(rd.magazine.mode==='round'?refs.length:1)
    c.activity={kind:'magazineReload',uid:gun.uid,supplies:refs,reloadUnitTurns:unit,remaining:total,total,label:`${itemDef(w,gun).label} 장전`}
    return null
  }
  const ball = supplyItems(c).find(i => i.def === rd.ammo && Number.isSafeInteger(i.count) && i.count > 0 && !i.missingItem)
  const powder = supplyItems(c).find(i => i.def === cfg.powder && Number.isSafeInteger(i.count) && i.count > 0 && !i.missingItem)
  if (!ball || !powder) return '실제 납탄과 흑색화약 한 회분이 필요하다'
  const total = Math.max(1, Math.ceil(rd.reloadTurns! * factor - 1e-9))
  c.activity = { kind: 'reload', uid: gun.uid, supplies: [ball, powder].map(i => ({ uid: i.uid, def: i.def, count: 1 })), remaining: total, total, label: `${itemDef(w, gun).label} 장전` }
  return null
}
/** 권총은 각 한 발, 클립은 계획한 전부를 완료 시 원래 더미에서 옮긴다. */
export function magazineReloadStep(w: World,c: Creature): boolean {
  const act=c.activity!,gun=findItem(c,act.uid??-1),rd=gun&&itemDef(w,gun).ranged,refs=act.supplies
  const stop=()=>{c.activity=undefined;if(c.faction==='player')log(w,'warn','장전 중단: 같은 화기·두 손·원래 실탄이 필요하다.');return true}
  if(!gun||!rd?.magazine||firearmReloadError(w,c,gun)||!refs?.length||!Number.isSafeInteger(act.reloadUnitTurns)||act.reloadUnitTurns!<1)return stop()
  const unit=act.reloadUnitTurns!
  if(rd.magazine.mode==='round'&&(act.elapsed??0)%unit!==0||rd.magazine.mode==='clip'&&act.remaining>0)return false
  const batch=rd.magazine.mode==='round'?refs.slice(0,1):refs,available=supplyItems(c),needed=new Map<number,number>()
  for(const ref of batch){if(ref.count!==1)return stop();needed.set(ref.uid,(needed.get(ref.uid)??0)+1)}
  if((gun.loadedCartridges?.length??0)+batch.length>rd.magazine.capacity||batch.some(ref=>{const i=available.find(i=>i.uid===ref.uid&&i.def===ref.def);return !i||!firearmAmmo(w,gun,i)||!Number.isSafeInteger(i.count)||i.count<needed.get(ref.uid)!}))return stop()
  gun.loadedCartridges??=[]
  for(const ref of batch)gun.loadedCartridges.push(removeOne(w,c,ref.uid)!)
  gun.loadedAmmo=gun.loadedCartridges[0]!.def;refs.splice(0,batch.length)
  if(c.faction==='player')log(w,'good',`${itemDef(w,gun).label}: ${gun.loadedCartridges.length}/${rd.magazine.capacity}발 장전.`)
  if(!refs.length||act.remaining<=0){c.activity=undefined;return true}
  return false
}
export function finishFirearmReload(w: World, c: Creature, act: Activity) {
  const gun = findItem(c, act.uid ?? -1), rd = gun && itemDef(w, gun).ranged
  const refs = act.supplies, available = supplyItems(c)
  const materials = refs?.map(ref => available.find(i => i.uid === ref.uid && i.def === ref.def && Number.isSafeInteger(i.count) && i.count >= ref.count && !i.missingItem))
  if (!gun || !rd?.firearm || firearmReloadError(w, c, gun) || refs?.length !== 2 || !materials?.every(Boolean) || refs[0].def !== rd.ammo || refs[1].def !== rd.firearm.powder || refs.some(ref => ref.count !== 1) || refs[0].uid === refs[1].uid) {
    if (c.faction === 'player') log(w, 'warn', '장전 중단: 같은 무기·납탄·화약·두 손이 필요하다.')
    return
  }
  // 두 실물 모두 검증한 뒤 같은 동기 동작에서만 옮긴다. 중간 실패로 한쪽을 소비하지 않는다.
  const ball = removeOne(w, c, refs[0].uid)!, powder = removeOne(w, c, refs[1].uid)!
  gun.loadedRound = { ball, powder }; gun.loadedAmmo = ball.def
  if (c.faction === 'player') log(w, 'good', `${itemDef(w, gun).label}에 납탄과 화약 한 회분을 장전했다.`)
}
/** 실제 입력에서만 한 번 판정한다. 실패도 행동·기력은 쓰며 조회는 이 함수를 호출하지 않는다. */
export function attemptFirearm(w: World, c: Creature, gun: ItemInst, paid=false): 'fired' | 'misfire' | 'jammed' {
  const cfg = itemDef(w, gun).ranged!.firearm!, rates = firearmRates(w, gun)!, cartridge=gun.loadedCartridges?.[0], ammo=cartridge&&w.db.item(cartridge.def).cartridge
  const failed = (kind: 'misfire' | 'jammed') => { c.exerted = true; if(!paid)c.needs.energy = Math.max(0, c.needs.energy - (itemDef(w, gun).attacks?.[0]?.energy ?? 0)); log(w, 'warn', `${itemDef(w, gun).label}: ${kind === 'jammed' ? '총이 걸렸다. 장전된 탄은 남아 있다.' : '불발! 장전한 한 발을 잃었다.'}`); return kind }
  if (rates.jam > 0 && rng(w, 'combat').chance(rates.jam / 100)) { gun.firearmJammed = true; return failed('jammed') }
  const misfire = rng(w, 'combat').chance(rates.misfire / 100)
  if(cartridge&&ammo){
    gun.loadedCartridges!.shift();cartridge.def=ammo.spent;delete cartridge.powderWetness;delete cartridge.gx;delete cartridge.gy;delete cartridge.rot;tileAt(w,c.pos).items.push(cartridge)
    if(gun.loadedCartridges!.length)gun.loadedAmmo=gun.loadedCartridges![0]!.def;else{delete gun.loadedCartridges;delete gun.loadedAmmo}
  }else{delete gun.loadedRound;delete gun.loadedAmmo}
  delete gun.loadedAmmoFletching
  gun.firearmFouling = Math.min(100, rates.fouling + (ammo?.fouling??cfg.foulingPerShot))
  return misfire ? failed('misfire') : 'fired'
}
export function firearmShock(w: World, shooter: Creature, gun: ItemInst) {
  const cfg = itemDef(w, gun).ranged?.firearm, strength = itemDef(w, gun).attacks?.[0]?.noise ?? 30
  if (!cfg?.moraleShock) return
  const costs = noiseCost(w, shooter.pos, strength + 4), ambient = ambientNoise(w)
  for (const c of w.s.creatures) {
    if (!c.alive || c.unconscious || c.id === shooter.id || !hostile(w, c, shooter) || capacity(w, c, 'hearing') <= 0 || cheb(c.pos, shooter.pos) > strength + 4) continue
    const cost = costs.get(c.pos.y * w.s.map.w + c.pos.x) ?? cheb(c.pos, shooter.pos) + 8
    if (strength - cost - ambient + hearingBonus(w, c) >= 0) moraleEvent(c, -cfg.moraleShock, 't30', turnOf(w))
  }
}
export function startFirearmCare(w: World, c: Creature, uid: number, operation: 'clean' | 'unjam', factor: number): string | null {
  const gun = findItem(c, uid), cfg = gun && itemDef(w, gun).ranged?.firearm
  if (!gun || !cfg || (operation !== 'clean' && operation !== 'unjam')) return '정비할 화기가 없다'
  if (!usableHands(w, c) || !Number.isFinite(factor) || factor <= 0 || factor > 4) return '두 손 상태 때문에 정비할 수 없다'
  if (operation === 'unjam' ? !gun.firearmJammed : !(gun.firearmFouling! > 0)) return operation === 'unjam' ? '총이 걸리지 않았다' : '총열이 깨끗하다'
  const oil = operation === 'clean' ? supplyItems(c).find(i => i.def === cfg.oil && Number.isSafeInteger(i.count) && i.count > 0 && !i.missingItem) : undefined
  if (operation === 'clean' && !oil) return '총기 기름 한 개가 필요하다'
  const total = Math.max(1, Math.ceil((operation === 'clean' ? cfg.cleanTurns : cfg.unjamTurns) * factor - 1e-9))
  c.activity = { kind: 'firearmCare', uid, firearmCare: operation, toolUid: oil?.uid, remaining: total, total, label: operation === 'clean' ? '총열 청소' : '총 걸림 해소' }
  return null
}
export function firearmCareStep(w: World, c: Creature): boolean {
  const act = c.activity!, gun = findItem(c, act.uid ?? -1), cfg = gun && itemDef(w, gun).ranged?.firearm
  const oil = act.firearmCare === 'clean' ? supplyItems(c).find(i => i.uid === act.toolUid && i.def === cfg?.oil && Number.isSafeInteger(i.count) && i.count > 0 && !i.missingItem) : undefined
  if (!gun || !cfg || !usableHands(w, c) || (act.firearmCare !== 'clean' && act.firearmCare !== 'unjam') || act.firearmCare === 'clean' && !oil) { c.activity = undefined; log(w, 'warn', '화기 정비 중단: 같은 화기·두 손·원래 기름이 필요하다.'); return true }
  if (act.remaining > 0) return false
  if (act.firearmCare === 'clean') { removeOne(w, c, oil!.uid); gun.firearmFouling = 0 }
  else delete gun.firearmJammed
  c.activity = undefined; log(w, 'good', `${act.label} 완료.`); return true
}
/** 실제 정산 시각 이후의 노출만 적용하며 장전한 원래 화약에도 같은 시계를 쓴다. */
export function ageFirearmPowder(w: World, item: ItemInst, exposed: boolean, water: boolean, heat: number, elapsed: number, sealed = false) {
  const cfg=w.db.item(item.def),powders=cfg.powder||cfg.cartridge?[item]:cfg.ranged?.firearm?[...(item.loadedRound?[item.loadedRound.powder]:[]),...(item.loadedCartridges??[])]:[]
  for(const powder of powders){
    if(powder.missingItem)continue
    const now = turnOf(w), observed = clamp(now - (powder.gearAgedAt ?? now), 0, Math.max(0, elapsed))
    powder.gearAgedAt = now
    if (!observed || sealed) continue
    const wet = powder.powderWetness ?? 0, rain = exposed ? weatherWetPerTurn(w) * observed : 0, dry = (heat >= 15 ? 10 : 2) / 200 * observed
    const next = water ? 100 : clamp(wet + (rain > 0 ? rain : -dry), 0, 100)
    if (next !== wet) powder.powderWetness = next
  }
}
