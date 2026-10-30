import {foodExposureDiseaseMultiplier} from './food-exposure-state'
import {diseaseRecoveryLoss} from './permanent-loss'
import {infectionSystemic} from './infection-state'
import {biteRiskTick} from './bite-disease'
import type {RngStream} from './rng'
import {diseaseStream} from './disease-state'
import { drugEffects, pharmacologyDef, withdrawalStage } from './drug-state'
import { prostheticAt } from './prosthetic-state'
import { foodSafetyDef } from './food-state'
// 질병 노출·면역 경주, 수면 질, 말단 동상. 모든 생물에 같은 규칙을 쓴다.
import { nutritionDef, nutritionMultiplier, nutritionSleep } from './nutrition-state'
import { addStun, addWound, bloodLoss, bodyDef, isMissing, painStage, painTotal } from './body'
import { clamp, log, rng, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import { beddingAt } from './camping'
import { cheb } from './geom'
import { apparelItems, qualityInfo } from './items'
import { emitNoise } from './perception'
import { addEffect, hasEffect, traitMul } from './traits'
import { nerveFrostbiteMultiplier } from './recovery'
import { thermalState } from './thermal'
import type { Creature, DiseaseDef } from './types'

/** 수면 질 (03 §6.2). 침구·체온·내의 젖음·통증·위협·배고픔 */
export function sleepQuality(w: World, c: Creature): number {
  const s = thermalState(w, c, true), n = c.needs
  const temp = n.bodyTemp < 36.5 ? 0.4 : s.feels < s.low ? 0.7 : s.feels > s.high ? 0.8 : 1
  const pain = [1, 0.95, 0.85, 0.7, 0.5, 0][painStage(painTotal(w, c))]
  if (pain === 0) return 0 // 극심한 통증에서는 잠들 수 없다.
  const threat = (c.lastThreatAt ?? -Infinity) + TURNS_PER_HOUR > turnOf(w) ? 0.8 : 1
  const drugSleep = drugEffects(w, c).sleep + (withdrawalStage(w, c) >= 2 ? pharmacologyDef(w).withdrawalSleep : 0)
  return clamp((drugSleep + beddingAt(w, c.pos).quality * temp * (s.innerWetness >= 50 ? 0.6 : 1) * pain * threat * nutritionSleep(w, c) * (hasEffect(c, 'lice', turnOf(w)) ? foodSafetyDef(w).liceSleepMult : 1) * traitMul(w, c, 'sleepQuality')) * infectionSystemic(w,c).sleep, 0.2, 1.2)
}

export function sleepRecoveryPerHour(w: World, c: Creature, quality = sleepQuality(w,c)): number {
  const d = nutritionDef(w)
  return 12.5 * quality * (c.needs.vitamin < d.lowVitamin ? d.lowVitaminRecovery : 1)
}

export function exposeDisease(w: World, c: Creature, id: string, chance: number, source?:{kind:string;turn:number;creature?:number;wound?:number;itemUid?:number;foodDef?:string}, stream:RngStream='body'): boolean {
  if(w.db.body(c.body.def).kind==='mechanical')return false
  if (c.immuneDiseases?.includes(id) || w.db.creature(c.def).diseaseImmune?.includes(id) || c.diseases?.some((d) => d.def === id)) return false
  const def = w.db.get<DiseaseDef>(id), r = rng(w, stream)
  if (!r.chance(chance*foodExposureDiseaseMultiplier(w,c,id))) return false
  ;(c.diseases ??= []).push({ def: id, incubatesUntil: turnOf(w) + r.int(def.incubationDays[0] * TURNS_PER_DAY, def.incubationDays[1] * TURNS_PER_DAY), progress: 0, immunity: 0, ...(source?{source:{...source}}:{}) })
  return true
}

/** 실제 추위/누운 시간/원래 상처의 한 번 노출만 정산한다. */
function clinicalExposureTick(w:World,c:Creature,sleeping:boolean){
 const turn=turnOf(w)
 for(const d of w.db.all<DiseaseDef>('Disease')){
  if(d.coldExposure){
   const cold=c.needs.bodyTemp<d.coldExposure.below,marked=c.diseaseExposure?.cold?.includes(d.id)
   if(cold&&!marked){((c.diseaseExposure??={}).cold??=[]).push(d.id);exposeDisease(w,c,d.id,d.coldExposure.chance,{kind:'저체온 노출',turn},diseaseStream('exposure.'+c.id))}
   if(!cold&&marked)c.diseaseExposure!.cold=c.diseaseExposure!.cold!.filter(id=>id!==d.id)
  }
  const bed=d.lyingExposure
  if(bed){
   const lying=sleeping||c.unconscious||c.activity?.kind==='rest'||c.breakdown?.kind==='lie',fracture=c.body.wounds.find(wd=>wd.part===bed.part&&wd.fracture&&wd.severity>wd.healed)
   if(lying&&fracture){const counts=(c.diseaseExposure??={}).lying??={},before=counts[d.id]??0;counts[d.id]=Math.min(bed.turns,before+1);if(before<bed.turns&&counts[d.id]===bed.turns)exposeDisease(w,c,d.id,bed.chance,{kind:'갈비뼈 골절 후 장기 누움',turn,wound:fracture.id},diseaseStream('exposure.'+c.id))}
   else if(c.diseaseExposure?.lying?.[d.id]!==undefined)delete c.diseaseExposure.lying[d.id]
  }
 }
 for(const wd of c.body.wounds)for(const risk of wd.diseaseRisk??[]){
  const d=w.db.get<DiseaseDef>(risk.def),rule=d.woundExposure
  if(risk.checked||!rule||wd.ageTurns<rule.checkTurns)continue
  risk.checked=true
  if(wd.severity>wd.healed&&wd.contam>=rule.contamination&&!wd.cauterized)exposeDisease(w,c,d.id,rule.chance,{kind:'흙·녹이 묻은 깊은 찔림',turn,wound:wd.id},diseaseStream('exposure.'+c.id))
 }
}
export function diseaseTick(w: World, c: Creature, sleeping: boolean) {
  if(w.db.body(c.body.def).kind==='mechanical')return
  const turn = turnOf(w)
  biteRiskTick(w,c)
  clinicalExposureTick(w,c,sleeping)
  const sp = tileAt(w, c.pos).spores
  if (sp && sp.until > turn) for (const d of w.db.all<DiseaseDef>('Disease')) if (d.sporeChance) exposeDisease(w, c, d.id, d.sporeChance)
  for (const o of w.s.creatures) {
    if (!o.alive || o.id === c.id || cheb(c.pos, o.pos) > 1) continue
    const d = w.db.creature(o.def).contactDisease
    if (d) exposeDisease(w, c, d.id, d.chance * (hasEffect(c, 'grabbed', turn) ? d.grabbedMult ?? 1 : 1))
  }
  for(const s of c.diseases??[]){
   const d=w.db.get<DiseaseDef>(s.def)
   if(!d.fatalAfterTurns||s.immunity>=100||turn<s.incubatesUntil)continue
   s.progress=Math.min(100,(turn-s.incubatesUntil)/d.fatalAfterTurns*100)
   if(!s.onsetNotified){s.onsetNotified=true;if(c.faction==='player')log(w,'danger',d.label+' 증상: '+(d.symptom??'오래 잠복하던 병이 드러났다.'))}
  }
  if (turn % TURNS_PER_HOUR !== 0) return
  let fever=0
  for (const d of c.diseases ?? []) {
    if (turn < d.incubatesUntil || d.immunity >= 100) continue
    const def = w.db.get<DiseaseDef>(d.def)
    if(def.fatalAfterTurns)d.progress=Math.min(100,Math.max(0,(turn-d.incubatesUntil)/def.fatalAfterTurns*100))
    else d.progress += def.perDay / 24 * (1 - (def.antibioticResponse??1)*Math.max(hasEffect(c, 'antibiotic', turn) ? 0.4 : 0, drugEffects(w, c).antibiotic))
    d.immunity += (def.immunePerDay??25) / 24 * (1 + (c.stats.vit - 10) * 0.04) * traitMul(w, c, 'immunityMult') * (sleeping ? 1.2 : c.exerted ? 0.8 : 1) * nutritionMultiplier(w, c, 'immunity')
    if (d.immunity >= 100) {
      diseaseRecoveryLoss(w,c,d.def,d.source?.turn??d.incubatesUntil)
      if (def.effect) c.effects = c.effects.filter((e) => e.kind !== def.effect)
      if (def.permanentImmunity !== false) (c.immuneDiseases ??= []).push(d.def)
      if (c.faction === 'player') log(w, 'good', `${def.label}을(를) 이겨냈다.${def.permanentImmunity !== false ? ' 영구 면역을 얻었다.' : ''}`)
      continue
    }
    if (def.effect) addEffect(c, def.effect, turn + TURNS_PER_HOUR + 1)
    if (def.fever > 0) { fever=Math.max(fever,def.fever); if(!def.gradualFever)c.needs.bodyTemp = Math.max(c.needs.bodyTemp, def.fever) }
    if(def.clinical?.seizure){const rule=def.clinical.seizure,r=rng(w,diseaseStream('seizure.'+c.id+'.'+def.id));if(r.chance(rule.hourChance)){addStun(c,turn,rule.stunTurns);if(c.id===w.s.playerId)log(w,'danger',def.label+'의 근경련으로 쓰러졌다.');const bones=bodyDef(w,c).parts.filter(p=>p.bone!==undefined&&!isMissing(w,c,p.id));if(bones.length&&r.chance(rule.fractureChance)){const p=bones[r.int(0,bones.length-1)];addWound(w,c,{def:'Wound.Bruise',part:p.id,severity:rule.severity,source:def.label+'의 근경련',fracture:{grade:'hairline',progress:0}})}}}
    if (def.coughNoise) emitNoise(w, c.pos, def.coughNoise, c.id)
    if (!def.fatalAfterTurns && c.faction === 'player' && d.progress < def.perDay / 12) log(w, 'danger', `${def.label} 증상: ${def.symptom ?? '반점과 기침, 고열이 시작됐다.'}`)
  }
  c.diseases = c.diseases?.filter((d) => d.immunity < 100)
  if(fever>0)addEffect(c,'fever',turn+TURNS_PER_HOUR+1,fever)
  else c.effects=c.effects.filter(e=>e.kind!=='fever')
}

/** 03 §7.5. 200턴마다 노출을 합산해 동상→괴사를 만들고 해동·재동결을 기록한다 */
export function frostbiteTick(w: World, c: Creature) {
  if(w.db.body(c.body.def).kind==='mechanical')return
  const turn = turnOf(w)
  if (turn % 200 !== 0) return
  const s = thermalState(w, c), clothes = apparelItems(w, c)
  const coldFactor = traitMul(w, c, 'frostbiteMult')
  for (const p of bodyDef(w, c).parts) {
    if (isMissing(w, c, p.id) || prostheticAt(w, c, p.id) || !p.groups.some((g) => ['finger', 'toe', 'ear', 'nose'].includes(g))) continue
    const slot = p.groups.includes('finger') ? 'hand' : p.groups.includes('toe') ? 'foot' : 'skull'
    const ins = clothes.filter(({ def }) => def.apparel!.groups.includes(slot)).reduce((n, { def, it }) => {
      const ap = def.apparel!, wet = Math.max(0, ...Object.values(it.wetness ?? {}))
      return n + ap.insulation * qualityInfo(it).ins * (1 - wet * (ap.wetLoss ?? 70) / 10000) * (it.half ? 0.5 : 1)
    }, 0)
    const liner=c.equip.lining,lined=liner&&!liner.half&&(liner.durability??100)>0&&(w.db.item(liner.def).apparel?.insulation??0)>0&&w.db.item(liner.def).apparel?.groups.includes('chest')
    const metal = !lined&&c.equip.chest && w.db.item(c.equip.chest.def).apparel?.armor.sharp && w.db.item(c.equip.chest.def).apparel!.insulation === 0
    const feels = s.feels + ins * 2.5 - (c.cond?.shock ? 5 : 0) - (metal && s.air <= -10 ? 5 : 0)
    const state = (c.frostbite ??= {})[p.id] ??= { exposure: 0, grade: 0, frozen: true }
    if (feels < -5) {
      state.exposure += (-5 - feels) * 0.5 * (bloodLoss(c) >= 0.3 ? 1.5 : 1) * coldFactor * nerveFrostbiteMultiplier(w, c, p)
      if (!state.frozen && state.wound) {
        const wd = c.body.wounds.find((x) => x.id === state.wound)
        if (wd) { const extra = Math.ceil(wd.severity * 0.5); wd.severity += extra; c.hp -= extra; wd.thawed = false }
      }
      state.frozen = true
    } else if (feels > 0) {
      state.exposure = Math.max(0, state.exposure - 5)
      state.frozen = false
      const wd = c.body.wounds.find((x) => x.id === state.wound)
      if (wd) wd.thawed = true
    }
    const grade = state.exposure >= 100 ? 3 : state.exposure >= 60 ? 2 : state.exposure >= 30 ? 1 : 0
    if (grade > state.grade && grade >= 2) {
      const wound = addWound(w, c, { part: p.id, def: grade === 3 ? 'Wound.Necrosis' : 'Wound.Frostbite', severity: grade === 3 ? c.body.maxHp[p.id]! : 3, source: '동상' }).wound
      c.hp -= wound.severity
      state.wound = wound.id
      if (c.faction === 'player') log(w, 'danger', `${p.label}: 동상 ${grade}도${grade === 3 ? ' — 괴사' : ''}.`)
    }
    state.grade = Math.max(grade, state.grade >= 2 ? state.grade : 0)
  }
  if (Object.values(c.frostbite ?? {}).some((f) => f.grade >= 1)) addEffect(c, 'frostbite', turn + 201)
  else c.effects = c.effects.filter((e) => e.kind !== 'frostbite')
}
