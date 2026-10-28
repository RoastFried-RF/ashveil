// 05 §2·5. P1 달력 결정 전 기본90일은 Growth.Human 콘텐츠에서 조정한다.
import { log, rng, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { effectiveStat } from './traits'
import {bodyDef,hpMax} from './body'
import type { Creature, GrowthDef, Stats } from './types'

export function ageBand(w: World, years: number) {
  const rules = w.db.get<GrowthDef>('Growth.Human')
  return rules.ageBands.filter((b) => b.min <= years).sort((a, b) => b.min - a.min)[0]!
}
export function initializeAge(w: World, c: Creature, years: number) {
  const rules = w.db.get<GrowthDef>('Growth.Human')
  c.age = { years, nextBirthday: turnOf(w) + rules.yearDays * TURNS_PER_DAY, masteryMult: ageBand(w, years).masteryMult }
}
export function willForChecks(w: World, c: Creature): number { return effectiveStat(w, c, 'wil') + (c.age ? ageBand(w, c.age.years).willBonus : 0) }
export function regenerationPeriod(w: World, c: Creature): number {
  return Math.max(1, Math.floor(100 / effectiveStat(w, c, 'vit')) + (c.age ? ageBand(w, c.age.years).regenOffset : 0))
}
export function growthTick(w: World, c: Creature) {
  if (!c.age || !c.alive || bodyDef(w,c).kind!=='humanoid') return
  const turn = turnOf(w), rules = w.db.get<GrowthDef>('Growth.Human')
  if(turn<c.age.nextBirthday)return
  const isPlayer=c.id===w.s.playerId,r = rng(w, isPlayer?'body':`body.age.${c.id}`)
  const say=(text:string,kind:'info'|'warn'='info')=>{if(isPlayer)log(w,kind,text)}
  while (turn >= c.age.nextBirthday) {
    const birthday=c.age.nextBirthday
    c.age.years++; c.age.nextBirthday += rules.yearDays * TURNS_PER_DAY
    const band = ageBand(w, c.age.years)
    c.age.masteryMult = band.masteryMult
    say(`생일이다. ${c.age.years}세가 되었다.`)
    c.history.push({ turn:isPlayer?turn:birthday, kind: 'birthday', text: `${c.age.years}세 생일` })
    if (band.statLoss && r.chance(band.statLoss)) {
      const stats: (keyof Stats)[] = ['str', 'agi', 'vit']
      const candidates=stats.filter((k) => c.stats[k] > 1),key = candidates.length?r.pick(candidates):undefined
      if (key) { c.stats[key]--;c.hp=Math.min(c.hp,hpMax(w,c));say(`나이가 들며 ${key === 'str' ? '근력' : key === 'agi' ? '민첩' : '활력'}이(가)1 줄었다.`,'warn') }
    }
    if (!c.age.jointPain && band.jointPain && r.chance(band.jointPain)) { c.age.jointPain = true;say('관절이 쑤시기 시작했다. 만성 관절통이 남았다.','warn') }
    if (!c.age.senses && band.senses && r.chance(band.senses)) { c.age.senses = true;say('눈과 귀가 예전 같지 않다. 시력·청력 상한이0.9가 되었다.','warn') }
  }
}
