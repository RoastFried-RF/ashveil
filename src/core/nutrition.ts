import {observeSevereHunger,severeHunger} from './permanent-loss'
import {rememberLifeEvent} from './life-memories'
import {infectionSystemic} from './infection-state'
import {scurvyLines} from './scurvy-state'
import {recordDietMeal,dietStatus,expireDiet} from './diet-state'
import { waterDaily } from './water'
import { calorieAbsorption } from './water-state'
// 03 §3. 대사율과 영양 장부. kcal0.01·수분1ml 미만은 잔여량으로 저장한다.
import { hygieneDaily, poisoningTick } from './food-safety'
import { addWound,isMissing } from './body'
import { clamp, log, rng, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import { thermalActivity, thermalState, type ThermalState } from './thermal'
import { addEffect, hasEffect, traitMul } from './traits'
import { hungerBand, metabolicSize, nutritionDef, nutritionMultiplier, thirstBand, overeatThreshold } from './nutrition-state'
import type { Creature } from './types'

export function metabolismRate(w: World, c: Creature, s: ThermalState, sleeping = false) {
  const d = nutritionDef(w), size = metabolicSize(w, c)
  const kind = sleeping ? 'sleep' : c.exerted ? 'combat' : ['boatCare', ...(w.s.map.vessel?['travel']:[]), 'deviceWork', 'machineCare', 'craft', 'repair', 'salvage', 'gather', 'gearCare', 'reload'].includes(c.activity?.kind ?? '') ? 'work' : thermalActivity(w, c) === 'walk' ? 'walk' : c.rested || c.activity?.kind === 'rest' ? 'rest' : 'idle'
  const activity = d.activity[kind], exercising = ['walk', 'work', 'combat'].includes(kind)
  const bulk = exercising ? Object.values(c.equip).reduce((n, it) => n + (it ? w.db.item(it.def).bulk ?? 0 : 0), 0) : 0
  const cold = c.needs.bodyTemp < 36.5 && hungerBand(w, c).shivering ? d.shiveringKcal : s.feels < s.low ? d.coldKcal : 0
  const wounds = c.body.wounds.reduce((n, wd) => n + Math.max(0, wd.severity - wd.healed), 0)
  const fever = hasEffect(c, 'fever', turnOf(w)) || c.needs.bodyTemp >= 38.5 || infectionSystemic(w,c).metabolicFever
  const kcalHour = (d.kcalPerDay / 24 * activity * size * (1 + bulk * d.bulkPerPoint) * (1 + cold) + wounds * d.woundKcalPerDay / 24) * (fever ? d.feverKcalMult : 1) * traitMul(w, c, 'kcalMult')
  const burns = c.body.wounds.filter((wd) => wd.def === 'Wound.Burn').reduce((n, wd) => n + Math.max(0, wd.severity - wd.healed), 0)
  const waterHour = d.waterPerDay / 24 * (.5 + .5 * activity) + Math.max(0, s.feels - d.hotThreshold) * d.hotWaterPerDegreeDay / 24 + (c.needs.bodyTemp > d.sweatThreshold ? d.sweatWaterPerHour : 0) + (fever ? d.feverWaterPerDay / 24 : 0) + (hasEffect(c, 'dysentery', turnOf(w)) ? d.dysenteryWaterPerDay / 24 : 0) + burns * d.burnWaterPerSeverityDay / 24
  return { kind, kcalHour, waterHour:waterHour+dietStatus(w,c).waterPerDay/24 }
}
export function hydrate(w: World, c: Creature, amount: number, loss = 0) {
  const d = nutritionDef(w), absorbed = Math.min(amount, d.maxDrink) + Math.max(0, amount - d.maxDrink) * d.excessDrinkMult
  c.needs.waterDeficit = Math.max(0, Math.round(c.needs.waterDeficit - absorbed + loss))
  if (c.needs.waterDeficit === 0) c.needs.waterRemainder = 0
}
export function nourish(w: World, c: Creature, kcal: number, protein = 0, vitamin = 0, source?:{uid:number;def:string}) {
  const n = c.needs, d = nutritionDef(w)
  if (kcal>0&&n.kcal + kcal > overeatThreshold(w,c)) {addEffect(c, 'overfull', turnOf(w) + d.overfullTurns);rememberLifeEvent(w,c,'overeat')}
  recordDietMeal(w,c,kcal,protein,source)
  kcal *= calorieAbsorption(w, c)
  const before = n.kcal
  n.kcal = Math.min(d.maxKcal, n.kcal + kcal)
  if (kcal > 0) n.lastMealKcal = Math.max(0, n.kcal - before)
  n.protein = clamp(Math.round((n.protein + protein * d.proteinPerGram) * 100) / 100, 0, 100)
  n.vitamin = clamp(n.vitamin + vitamin, 0, 100)
}
export function metabolismTick(w: World, c: Creature, thermal: ThermalState, sleeping: boolean) {
  const severelyHungryBefore=severeHunger(w,c)
  expireDiet(w,c)
  poisoningTick(w, c)
  if (w.s.hygieneEnabled === false) c.needs.hygiene = 70
  const n = c.needs, d = nutritionDef(w), rate = metabolismRate(w, c, thermal, sleeping)
  const kcal = (n.kcalRemainder ?? 0) + rate.kcalHour * 100 / TURNS_PER_HOUR, water = (n.waterRemainder ?? 0) + rate.waterHour / TURNS_PER_HOUR
  const spent = Math.floor(kcal + 1e-9), lost = Math.floor(water + 1e-9)
  n.kcal = Math.round(n.kcal * 100 - spent) / 100; n.waterDeficit += lost; n.kcalRemainder = Math.max(0, kcal - spent); n.waterRemainder = Math.max(0, water - lost)
  const day = Math.floor(turnOf(w) / TURNS_PER_DAY), elapsed = Math.max(0, day - (n.nutritionDay ?? day))
  n.nutritionDay = day
  for (let i = 0; i < elapsed; i++) {
    n.protein = Math.max(0, Math.round((n.protein - d.proteinDaily * metabolicSize(w, c)) * 100) / 100); n.vitamin = Math.max(0, n.vitamin - d.vitaminDaily); n.hygiene = Math.max(0, n.hygiene - d.hygieneDaily)
    waterDaily(w, c)
    hygieneDaily(w, c)
    const before = n.scurvy
    n.scurvy = clamp(n.scurvy + (n.vitamin === 0 ? d.scurvyDaily : -d.scurvyRecovery), 0, 100)
    if (before < 40 && n.scurvy >= 40 && c.body.scars?.length&&w.db.body(c.body.def).kind!=='mechanical') {
      const parts=w.db.body(c.body.def).parts
      for(const scar of c.body.scars){
       if(!parts.some(p=>p.id===scar.part)||isMissing(w,c,scar.part))continue
       const result=addWound(w,c,{def:'Wound.Cut',part:scar.part,severity:3,source:'괴혈병으로 흉터 재개방'})
       c.hp-=result.damage
      }
      if (c.hp <= 0) n.nutritionFatal = '괴혈병'
      if (c.faction === 'player') log(w, 'danger', '옛 흉터가 다시 벌어졌다. 신선한 음식이 필요하다.')
    }
    if (n.kcal <= -d.hunger.at(-1)!.deficit * metabolicSize(w, c) && rng(w, 'body').chance(d.starvationRisk)) n.nutritionFatal = '아사'
    if (n.scurvy >= 100 && rng(w, 'body').chance(d.scurvyRisk)) n.nutritionFatal = '괴혈병'
  }
  observeSevereHunger(w,c,severelyHungryBefore)
}

export function nutritionLines(w: World, c: Creature): string[] {
  const n = c.needs, rate = metabolismRate(w, c, thermalState(w, c), c.asleep || c.activity?.kind === 'sleep')
  const diet=dietStatus(w,c)
  return [
    ...scurvyLines(w,c),
    ...(diet.kcal>0?['최근'+diet.windowDays+'일 식사 중 단백질 열량 '+(diet.fraction*100).toFixed(1)+'% · '+(diet.active?'살코기 굶주림/설사 · 열량 흡수 ×'+diet.absorption:'식사 비중 안정')]:[]),
    `칼로리 균형 ${n.kcal.toFixed(0)} kcal · ${hungerBand(w, c).label} / 수분 결손 ${n.waterDeficit.toFixed(0)} ml · ${thirstBand(w, c).label}`,
    `현재 소모: 열량 ${rate.kcalHour.toFixed(1)} kcal/시간 · 수분 ${rate.waterHour.toFixed(1)} ml/시간`,
    `단백 상태 ${n.protein.toFixed(0)}/100 · 기력 회복×${nutritionMultiplier(w, c, 'energy').toFixed(2)} · 치유×${nutritionMultiplier(w, c, 'healing').toFixed(2)} · 면역×${nutritionMultiplier(w, c, 'immunity').toFixed(2)}`,
  ]
}
