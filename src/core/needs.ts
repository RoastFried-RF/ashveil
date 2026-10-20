import {fatigueStage} from './fatigue-state'
import {observeSocialTime} from './social-state'
import {hallucinationTick} from './hallucinations'
import { inDeepWater } from './aquatic-state'
import { weatherDef } from './climate-state'
import { machineRules } from './machine-state'
import { daylight } from './environment'
import { tileAt } from './ctx'
// 생존(열량·수분·비타민·피로·체온·젖음·기력)과 기분(사고 스택·스트레스)

import { bloodLoss, energyMax, hostileNear, regionPenalties } from './body'
import { gearTick } from './gear-care'
import { sleepRecoveryPerHour, sleepQuality } from './conditions'
import {observeSleep} from './sleep-memories'
import { log, rng, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { temperatureTick, thermalState, wetnessTick } from './thermal'
import { metabolismTick } from './nutrition'
import { hungerStage, thirstStage, nutritionMultiplier, thirstBand } from './nutrition-state'
import { addThought } from './thoughts'
import { addEffect, hasEffect, traitMul } from './traits'
import type { Creature } from './types'

export const KCAL_PER_DAY = 2500
export const WATER_PER_DAY = 2500
export const VITAMIN_PER_DAY = 2

export function newNeeds(turn = 0) {
  return { kcal: 0, waterDeficit: 0, protein: 100, vitamin: 100, hygiene: 100, nutritionDay: Math.floor(turn / TURNS_PER_DAY), kcalRemainder: 0, waterRemainder: 0, scurvy: 0, fatigue: 20, bodyTemp: 37, wetness: 0, energy: 100, stress: 10, sleepDebt: 0 }
}

export { insulation, hasWaterproof, comfortMin } from './thermal'

export function needsTick(w: World, c: Creature, sleeping: boolean) {
  if(machineRules(w,c))return
  observeSocialTime(w,c)
  const turn = turnOf(w)
  const n = c.needs
  if (w.s.overworld && turn % 600 === 0 && w.s.map.kind === 'surface' && !tileAt(w, c.pos).roof && daylight(w) >= .7) { const thought = weatherDef(w).thought; if (thought) addThought(w, c, thought) }
  const cdef = w.db.creature(c.def)
  wetnessTick(w, c, sleeping)
  gearTick(w, c)
  const thermal = thermalState(w, c, sleeping)
  metabolismTick(w, c, thermal, sleeping)

  // 피로
  if (!sleeping && hostileNear(w, c)) c.lastThreatAt = turn
  if (sleeping) {
    const quality=sleepQuality(w,c)
    observeSleep(w,c,quality)
    n.fatigue = Math.max(0, n.fatigue - sleepRecoveryPerHour(w, c,quality) / 1200)
    if (n.fatigue === 0) n.sleepDebt = Math.max(0, (n.sleepDebt ?? 0) - 0.5 / 1200)
  }
  else if (!hasEffect(c, 'stimulant', turn)) n.fatigue = Math.min(100, n.fatigue + 100 / 19200 * (c.exerted ? 1.5 : thermal.activity === 'work' ? 1.3 : 1))
  if (hasEffect(c, 'sedative', turn)) n.fatigue = Math.min(100, n.fatigue + 0.02)
  if (!sleeping && n.fatigue >= 100) n.sleepDebt = (n.sleepDebt ?? 0) + 1 / 1200
  if (c.faction === 'player' && !sleeping && (n.sleepDebt ?? 0) >= 8 && turn % 200 === 0 && rng(w, 'body').chance(0.05)) {
    addEffect(c, 'microsleep', turn + rng(w, 'body').int(1, 3))
    c.asleep = true
    log(w, 'danger', '깜박 졸았다. 눈을 뜨고 있을 수 없다.')
  }

  hallucinationTick(w,c)

  // 기력 (07 §6): 턴마다 (2 + ⌊활력/5⌋) × 몸통 계수, 대기·휴식 턴 ×2.
  // 배고픔·추위 단계 ×0.75, 실혈 15% ×0.5, 포자 기침 0, 수면 ×2
  const emax = energyMax(w, c)
  {
    let regen = (2 + Math.floor(c.stats.vit / 5)) * regionPenalties(w, c).energyRegen
    // 대기·휴식 턴 ×2 (07 §6)
    if (c.rested || c.activity?.kind === 'rest') regen *= 2
    regen *= nutritionMultiplier(w, c, 'energy')
    if (n.bodyTemp < 36) regen *= 0.75
    if (n.bodyTemp > 38.5) regen *= 0.5
    if (bloodLoss(c) >= 0.15) regen *= 0.5
    if (hasEffect(c, 'spores', turn)) regen = 0
    if (sleeping) regen *= 2
    regen *= traitMul(w, c, 'energyRegenMult')
    if(!inDeepWater(w,c))n.energy = Math.min(emax, n.energy + regen)
  }
  if (n.energy > emax) n.energy = emax
  c.rested = false

  temperatureTick(w, c, thermal)

  if (c.faction !== 'player') return
  warnings(w, c, cdef.label)

}

function warnOnce(w: World, c: Creature, key: string, text: string, kind: 'warn' | 'danger' = 'warn') {
  const m = c.needWarnings ??= {}
  if (m[key] === undefined) for (let i = w.s.log.length - 1; i >= 0; i--) { if (w.s.log[i].text === text) { m[key] = w.s.log[i].turn; break } }
  const turn = turnOf(w)
  if (m[key] !== undefined && turn - m[key] < 2400) return
  m[key] = turn
  log(w, kind, text)
}

function warnings(w: World, c: Creature, _label: string) {
  const n = c.needs
  if (hungerStage(w, c) === 1) warnOnce(w, c, 'hungry', '배가 고프다.')
  if (hungerStage(w, c) >= 2) warnOnce(w, c, 'starving', '굶주림에 기력이 빠진다.', 'danger')
  if (thirstStage(w, c) === 1) warnOnce(w, c, 'thirsty', '목이 마르다.')
  if (thirstStage(w, c) >= 2) warnOnce(w, c, 'dehydrated', '입술이 갈라진다. 탈수가 시작됐다.', 'danger')
  if (n.bodyTemp < 36 && n.bodyTemp >= 35) warnOnce(w, c, 'cold', '몸이 떨린다. 체온이 떨어지고 있다.')
  if (n.bodyTemp < 35) warnOnce(w, c, 'hypo', '손가락에 감각이 없다. 저체온이 심해진다.', 'danger')
  if (n.bodyTemp > 39.5 - thirstBand(w, c).heatShift) warnOnce(w, c, 'heat', '몸이 뜨겁고 정신이 흐려진다. 열을 식혀야 한다.', 'danger')
  if (fatigueStage(w,c)>0) warnOnce(w, c, 'tired', '눈꺼풀이 무겁다. 잠이 필요하다.')
  if (n.vitamin <= 0) warnOnce(w, c, 'scurvy', '비타민이 고갈됐다. 신선한 음식이 필요하다.', 'danger')
  if (n.wetness > 70) warnOnce(w, c, 'wet', '옷이 흠뻑 젖었다. 젖은 옷은 체온을 빼앗는다.')
}

export { activeThoughts, mood, addThought } from './thoughts'

export { psycheTick } from './psyche'
