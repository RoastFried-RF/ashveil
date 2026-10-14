// 경고 체계 (12 §6): 상태에서 경고 띠를 계산한다
import {
  bloodLoss, canSee, hostile, hpMax, moraleOf, painStage, painTotal, player, regionState, totalBleed, REGION_LABEL, STATE_LABEL,
  type Region, type World,
} from '../core'

export interface Banner { p: 0 | 1 | 2; text: string; turns?: number }

const REGIONS: Region[] = ['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg']

export function computeBanners(w: World): Banner[] {
  const pl = player(w)
  const out: Banner[] = []
  const bleed = totalBleed(w, pl)
  const blood = pl.body.blood, max = pl.body.bloodMax
  const toDeath = bleed > 0.05 ? Math.floor((blood - max * 0.5) / bleed) : Infinity
  const loss = bloodLoss(pl)
  if (toDeath < 30) out.push({ p: 0, text: `출혈 사망까지 ~${toDeath}턴`, turns: toDeath })
  if (loss >= 0.3) out.push({ p: 0, text: `혈액 손실 ${Math.round(loss * 100)}%` })
  if (pl.hp <= hpMax(w, pl) * 0.15) out.push({ p: 0, text: `HP ${Math.ceil(pl.hp)} — 위독` })
  if (pl.needs.bodyTemp < 32) out.push({ p: 0, text: `체온 ${pl.needs.bodyTemp.toFixed(1)}°C` })
  if (bleed > 0.3 && toDeath >= 30) out.push({ p: 1, text: `출혈 ${bleed.toFixed(1)} ml/턴`, turns: toDeath })
  const foes = w.s.creatures.filter((o) => o.alive && !o.asleep && hostile(pl, o) && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos)).length
  if (foes) out.push({ p: 1, text: `적 ${foes}` })
  // 공포 (07 §8 대칭): 사기 25 미만이면 명중 −10
  if (foes && moraleOf(w, pl) < 25) out.push({ p: 1, text: '공포 — 명중 −10' })
  const bad = REGIONS.map((r) => [r, regionState(w, pl, r)] as const).filter(([, s]) => s >= 3)
  if (bad.length) out.push({ p: 1, text: bad.map(([r, s]) => `${REGION_LABEL[r]} ${STATE_LABEL[s]}`).join(' · ') })
  if (painStage(painTotal(w, pl)) >= 3) out.push({ p: 1, text: '통증 심각' })
  if (pl.needs.bodyTemp < 35 && pl.needs.bodyTemp >= 32) out.push({ p: 1, text: '저체온' })
  if (pl.needs.kcal < 900) out.push({ p: 2, text: pl.needs.kcal < 0 ? '굶주림' : '배고픔' })
  if (pl.needs.water < 900) out.push({ p: 2, text: pl.needs.water < 0 ? '탈수' : '갈증' })
  if (pl.needs.fatigue > 75) out.push({ p: 2, text: pl.needs.fatigue > 90 ? '탈진' : '지침' })
  for (const it of Object.values(pl.equip)) if (it && (it.durability ?? 100) < 30) { out.push({ p: 2, text: `${w.db.item(it.def).label} 부서지기 직전` }); break }
  return out.sort((a, b) => a.p - b.p || (a.turns ?? Infinity) - (b.turns ?? Infinity)).slice(0, 3)
}

