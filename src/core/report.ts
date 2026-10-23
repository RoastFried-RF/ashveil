// 사망 보고서·연대기: 죽음의 원인 사슬을 남겨 다음 판에서 배우게 한다.

import { bloodLoss, painLabel, painTotal, part, woundDef } from './body'
import { clock, fmtClock, START_TURN, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { WEATHER_LABEL } from './environment'
import { allItems, itemLabel } from './items'
import type { Creature, DeathReport } from './types'
import {buildDiscoveryArchive} from './discovery-archive'

export function buildReport(w: World, c: Creature, kind: 'death' | 'escape' | 'retire', cause: string): DeathReport {
  const turn = turnOf(w)
  const bg = c.background ? w.db.background(c.background).label : '떠돌이'
  const traits = c.traits.map((t) => w.db.trait(t).label)
  const days = Math.round(((turn - START_TURN) / TURNS_PER_DAY) * 10) / 10
  const chain = c.history.slice(-10).map((h) => `[${fmtClock(h.turn)}] ${h.text}`)
  const vitals = [
    `혈액 ${Math.round(c.body.blood)} / ${c.body.bloodMax} ml (손실 ${(bloodLoss(c) * 100).toFixed(0)}%)`,
    `체온 ${c.needs.bodyTemp.toFixed(1)}°C · 젖음 ${c.needs.wetness.toFixed(0)}%`,
    `열량 균형 ${Math.round(c.needs.kcal)} kcal · 수분 결손 ${Math.round(c.needs.waterDeficit)} ml · 단백 ${c.needs.protein.toFixed(0)} · 비타민 ${c.needs.vitamin.toFixed(0)}`,
    `통증 ${painLabel(painTotal(w, c))} · 스트레스 ${c.needs.stress.toFixed(0)}`,
  ]
  for (const wd of c.body.wounds) {
    const tags = [wd.arterial ? '동맥' : '', wd.fracture ? '골절' : '', wd.infection ? `감염 ${wd.infection.progress.toFixed(0)}%` : '', wd.bandage ? '붕대' : '', wd.cauterized ? '소작' : ''].filter(Boolean)
    vitals.push(`· ${part(w, c, wd.part).label} ${woundDef(w, wd).label} (${wd.source})${tags.length ? ' [' + tags.join(', ') + ']' : ''}`)
  }
  const kills = Object.entries(w.s.knowledge.bestiary).filter(([, b]) => b.killed > 0).map(([id, b]) => `${w.db.creature(id).label} ${b.killed}`)
  const meals = c.history.filter((h) => h.kind === 'meal')
  const lastMeal = meals.length ? meals[meals.length - 1].text : '없음'
  const unknown = allItems(c).filter((i) => w.db.item(i.def).unidentified && !w.s.knowledge.pillKnown[i.def]).map((i) => itemLabel(w, i))
  const stats = [
    `생존 ${days}일 (${fmtClock(turn)}) · 레벨 ${c.level}`,
    `가장 깊이 내려간 곳: ${deepest(w)}`,
    `날씨: ${WEATHER_LABEL[w.s.weather]}`,
    `처치한 것: ${kills.length ? kills.join(', ') : '없음'}`,
    `마지막 식사: ${lastMeal}`,
  ]
  if (unknown.length) stats.push(`끝내 먹어보지 못한 약: ${unknown.join(', ')}`)
  const { day } = clock(turn)
  const killer = c.killedBy ? `, ${c.killedBy}` : ''
  const epitaph = kind === 'retire' ? `떠돌이 ${c.name}, ${day}일차. 원정을 마치고 정착했다.` : kind === 'escape'
    ? `떠돌이 ${c.name}, ${day}일차. 회색 고원 폐허를 벗어나 동쪽 길로 사라졌다.`
    : `떠돌이 ${c.name}, ${day}일차. ${cause}${killer}. 마지막으로 먹은 것: ${lastMeal}.`
  return {
    discoveries:buildDiscoveryArchive(w,c),
    title: kind === 'retire'?'떠돌이를 내려놓다':kind === 'escape' ? '고원을 벗어나다' : '여기 잠들다',
    name: c.name,
    background: bg,
    traits,
    cause,
    chain,
    vitals,
    stats,
    daysSurvived: days,
    epitaph,
  }
}

function deepest(w: World): string {
  const depths = Object.values(w.s.maps).map((m) => m.depth).concat(w.s.map.depth)
  const d = Math.max(0, ...depths)
  return d === 0 ? '지상' : `지하 ${d}층`
}
