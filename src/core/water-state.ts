import {dietStatus} from './diet-state'
// 03 §5. 오염 수치와 읽기 전용 표시/흡수 규칙.
import { turnOf, type World } from './ctx'
import { drinkVolume } from './wash-water'
import {waterCapacity} from './water-vessels'
import { masteryStage } from './skills'
import { hasEffect } from './traits'
import type { Creature, ItemInst, WaterQuality, WaterSafetyDef, WaterTreatment } from './types'

export const waterSafetyDef = (w: World) => w.db.get<WaterSafetyDef>('WaterSafety.Human')
export const waterBatches=(w:World,it:ItemInst)=>Math.max(1,Math.ceil(drinkVolume(w,it)/(waterSafetyDef(w).batchMl??1000)))
export const waterToolCharges=(it:ItemInst)=>it.uses===undefined?it.count:it.uses
export function waterResourcePlan(c:Creature,id:string|undefined,amount:number,charges=false){
 if(!id)return undefined
 const out:{uid:number;count:number}[]=[];let left=amount
 for(const it of c.bag){if(it.def!==id||it.count<=0)continue;const count=Math.min(left,charges?waterToolCharges(it):it.count);if(count<=0)continue;out.push({uid:it.uid,count});left-=count;if(left===0)return out}
 return undefined
}
export function waterResourceValid(c:Creature,id:string|undefined,plan:{uid:number;count:number}[]|undefined,amount:number,charges=false){
 if(!id)return !plan?.length
 if(!plan||plan.reduce((n,p)=>n+p.count,0)!==amount||new Set(plan.map(p=>p.uid)).size!==plan.length)return false
 return plan.every(p=>{const it=c.bag.find(i=>i.uid===p.uid);return Number.isSafeInteger(p.count)&&p.count>0&&it?.def===id&&(charges?waterToolCharges(it):it.count)>=p.count})
}
export function waterTreatmentSignature(w:World,it:ItemInst|undefined,method:WaterTreatment){
 const d=waterSafetyDef(w).treatments[method],batches=it?waterBatches(w,it):1
 return JSON.stringify(batches===1?d:[d,batches,waterCapacity(w,it!)])
}
export function waterQuality(w: World, it: ItemInst): WaterQuality {
  return it.water ?? w.db.item(it.def).drink?.quality ?? (w.db.item(it.def).drink?.dirty ? waterSafetyDef(w).sources.pond : { pathogen: 0, ash: 0, source: '깨끗한 물' })
}
export function treatedWater(w: World, quality: WaterQuality, treatment: WaterTreatment): WaterQuality {
  const d = waterSafetyDef(w).treatments[treatment]
  return { ...quality, pathogen: Math.round(quality.pathogen * d.pathogenMult * 10000) / 10000, ash: Math.round(quality.ash * d.ashMult * 10000) / 10000, source: `${quality.source ?? '물'} · ${WATER_TREATMENT_LABEL[treatment]}` }
}
/** Dissolved salt is not removed by ordinary filtration, settling or boiling. */
export const waterSalinity = (q: WaterQuality): number => q.salinity ?? 0
export const drinkableSalinity = (w: World, q: WaterQuality): boolean => Number.isFinite(waterSalinity(q)) && waterSalinity(q) >= 0 && waterSalinity(q) <= waterSafetyDef(w).maxDrinkingSalinity!
export const salineWaterLoss = (w: World, q: WaterQuality, ml: number): number => waterSalinity(q) > 0 ? waterSalinity(q) * ml / 1000 * waterSafetyDef(w).saltFlushMlPerGram! : 0
export const suitableDrink = (w: World, it: ItemInst): boolean => drinkableSalinity(w, waterQuality(w, it))
export const WATER_TREATMENT_LABEL: Record<WaterTreatment, string> = { boil: '끓임', cloth: '천 여과', charcoal: '숯 여과', settle: '침전', pill: '정수정' }
export function calorieAbsorption(w: World, c: Creature): number {
  const d = waterSafetyDef(w)
  return dietStatus(w,c).absorption*((c.needs.ash ?? 0) >= d.nauseaAt ? d.nauseaAbsorption : 1) * (hasEffect(c, 'dysentery', turnOf(w)) ? d.dysenteryAbsorption : 1)
}
export type WaterObservation = {kind:'empty';label:'빈 물 용기'|'빈 병'} | {
  kind:'filled';source:string
  quality:{kind:'bands';pathogen:string;ash:string}|{kind:'clarity';cloudy:boolean}
  remainingMl:number;sipMl:number;frozen:boolean;settlesHours?:number
  salt?:{gramsPerLiter:number;remainingGrams:number;drinkable:boolean}
}

/** Only the viewer's existing public observations; never includes hidden contamination values. */
export function observeWater(w:World,c:Creature,it:ItemInst):WaterObservation|undefined {
  const def=w.db.item(it.def)
  if(!def.drink||def.drink.alcohol)return undefined
  if((it.uses??1)<=0)return{kind:'empty',label:def.waterVessel&&it.def!=='Item.WaterBottle'&&it.def!=='Item.DirtyWaterBottle'?'빈 물 용기':'빈 병'}
  const q = waterQuality(w, it), stage = (value: number) => [...waterSafetyDef(w).riskBands].reverse().find((b) => value >= b.at)?.label ?? '없음'
  return{kind:'filled',source:q.source??'물',quality:masteryStage(w,c,'survival')>=1?{kind:'bands',pathogen:stage(q.pathogen),ash:stage(q.ash)}:{kind:'clarity',cloudy:q.pathogen>0||q.ash>0},remainingMl:drinkVolume(w,it),sipMl:def.drink.water,frozen:!!it.waterFrozen,
    ...(waterSalinity(q)>0?{salt:{gramsPerLiter:Number(waterSalinity(q).toFixed(3)),remainingGrams:Number((waterSalinity(q)*drinkVolume(w,it)/1000).toFixed(3)),drinkable:drinkableSalinity(w,q)}}:{}),
    ...(it.waterSettlesAt?{settlesHours:Math.max(0,(it.waterSettlesAt-turnOf(w))/1200)}:{})}
}

export function waterLines(w: World, c: Creature, it: ItemInst): string[] {
  const view=observeWater(w,c,it)
  if(!view)return[]
  if(view.kind==='empty')return[view.label]
  const lines=[view.quality.kind==='bands'?`${view.source} — 병원체 ${view.quality.pathogen} / 재 ${view.quality.ash}`:`${view.source} — ${view.quality.cloudy?'탁함':'맑음'}`]
  lines.push(`남은 물 ${view.remainingMl}ml · 한 번에 최대 ${view.sipMl}ml`)
  if(view.salt)lines.push(`염도 ${view.salt.gramsPerLiter}g/L · 남은 소금 ${view.salt.remainingGrams}g${view.salt.drinkable?'':' · 음수 부적합: 마시면 수분 손실'}`,'끓임·천/숯 여과·침전·정수정은 소금을 없애지 못한다')
  if(view.frozen)lines.unshift('눈/얼음 — 불에서 녹여야 한다')
  if(view.settlesHours!==undefined)lines.push(`침전까지 약${view.settlesHours.toFixed(1)}시간`)
  return lines
}
