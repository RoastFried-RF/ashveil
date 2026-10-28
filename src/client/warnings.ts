import {translate,type Language,type MessageValue} from './locales/message'
import {translateDef} from './locales/content'
// 경고 체계 (12 §6): 상태에서 경고 띠를 계산한다
import {
  bloodLoss, canSee, hungerBand, hungerStage, thirstBand, thirstStage, hostile, hpMax, moraleOf, painStage, painTotal, player, regionState, totalBleed, REGION_LABEL, STATE_LABEL,
  type Region, type World,
} from '../core'
import { thermalGuidance } from './thermal-guidance'

export interface Banner { p: 0 | 1 | 2; text: string; turns?: number }

const REGIONS: Region[] = ['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg']

export function computeBanners(w: World, language:Language='ko'): Banner[] {
  const text=(source:string,...values:MessageValue[])=>translate(source,language,...values)
  const pl = player(w)
  const out: Banner[] = []
  const heatShift = thirstBand(w, pl).heatShift
  const bleed = totalBleed(w, pl)
  const blood = pl.body.blood, max = pl.body.bloodMax
  const toDeath = bleed > 0.05 ? Math.floor((blood - max * 0.5) / bleed) : Infinity
  const loss = bloodLoss(pl)
  if (toDeath < 30) out.push({ p: 0, text: text('출혈 사망까지 ~{0}턴',toDeath), turns: toDeath })
  if (loss >= 0.3) out.push({ p: 0, text: text('혈액 손실 {0}%',Math.round(loss*100)) })
  if (pl.hp <= hpMax(w, pl) * 0.15) out.push({ p: 0, text: text('HP {0} — 위독',Math.ceil(pl.hp)) })
  if (pl.needs.bodyTemp < 32) out.push({ p: 0, text: text('체온 {0}°C',pl.needs.bodyTemp.toFixed(1)) })
  if (pl.needs.bodyTemp > 41 - heatShift) out.push({ p: 0, text: text('고체온 {0}°C — 위독',pl.needs.bodyTemp.toFixed(1)) })
  if (bleed > 0.3 && toDeath >= 30) out.push({ p: 1, text: text('출혈 {0} ml/턴',bleed.toFixed(1)), turns: toDeath })
  const foes = w.s.creatures.filter((o) => o.alive && !o.asleep && hostile(w, pl, o) && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos)).length
  if (foes) out.push({ p: 1, text: text('적 {0}',foes) })
  // 공포 (07 §8 대칭): 사기 25 미만이면 명중 −10
  if (foes && moraleOf(w, pl) < 25) out.push({ p: 1, text: text('공포 — 명중 −10') })
  const bad = REGIONS.map((r) => [r, regionState(w, pl, r)] as const).filter(([, s]) => s >= 3)
  if (bad.length) out.push({ p: 1, text: bad.map(([r, s]) => `${text(REGION_LABEL[r])} ${text(STATE_LABEL[s])}`).join(' · ') })
  if (painStage(painTotal(w, pl)) >= 3) out.push({ p: 1, text: text('통증 심각') })
  if (pl.needs.bodyTemp < 35 && pl.needs.bodyTemp >= 32) out.push({ p: 1, text: text('저체온') })
  const thermal = thermalGuidance(w, pl)
  if (thermal.notice && pl.needs.bodyTemp >= 35) out.push({ p: 2, text: text('{0} · 일지의 생존에서 비교',text(thermal.notice)) })
  if (pl.needs.bodyTemp > 39.5 - heatShift && pl.needs.bodyTemp <= 41 - heatShift) out.push({ p: 1, text: text('열사병 위험') })
  if (hungerStage(w, pl) >= 1) out.push({ p: hungerStage(w, pl) >= 4 ? 1 : 2, text: text(hungerBand(w,pl).label) })
  if (thirstStage(w, pl) >= 1) out.push({ p: thirstStage(w, pl) >= 4 ? 0 : 2, text: text(thirstBand(w,pl).label) })
  if (pl.needs.fatigue > 75) out.push({ p: 2, text: text(pl.needs.fatigue>90?'탈진':'지침') })
  for (const it of Object.values(pl.equip)) if (it && (it.durability ?? 100) < 30) { out.push({ p: 2, text: text('{0} 부서지기 직전',translateDef(w.db.item(it.def),'label',language)) }); break }
  return out.sort((a, b) => a.p - b.p || (a.turns ?? Infinity) - (b.turns ?? Infinity)).slice(0, 3)
}

