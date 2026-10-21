import { painTotal, energyMax, capacity } from './body'
import { clamp, log, rng, turnOf, type World } from './ctx'
import { addToBag, findItem, findSpot, itemDef, removeOne } from './items'
import { administerDrug } from './pharmacology'
import { masteryStage, practice } from './skills'
import { addEffect, effectiveStat, traitAdd } from './traits'
import { addThought } from './thoughts'
import { knowledgeDef, pillBelief, recordPill } from './knowledge-state'
import { pillPotency } from './pill-aging'
import type { Creature, ItemInst, PillBelief, PillEffectDef } from './types'
export function identification(w: World, c: Creature, appearance: string, taste = false) {
  const d = knowledgeDef(w), secret = w.s.knowledge.pillMap[appearance], effect = w.db.pill(secret)
  const score = effectiveStat(w,c,'per') + masteryStage(w,c,'medicine') * d.masteryScore + traitAdd(w,c,'identifyBonus') + (taste ? d.tasteBonus : 0)
  const difficulty = effect.identifyDifficulty ?? d.defaultDifficulty
  const chance = clamp(d.baseChance + (score - difficulty) * d.chancePerPoint, d.minChance, d.maxChance)
  return { score, difficulty, chance, mistake: Math.min(100-chance, Math.max(0,difficulty-score)) }
}
function discover(w:World,c:Creature,appearance:string,method:PillBelief['evidence'][number]['method']) {
  const effect=w.s.knowledge.pillMap[appearance]
  recordPill(w,appearance,method,'효과를 확인했다.',effect,'certain')
  practice(w,c,'medicine',`pill:${appearance}`)
  log(w,'good',`${w.db.item(appearance).label}의 정체를 알아냈다: ${w.db.pill(effect).label}.`)
}
export function identifyPill(w:World,c:Creature,appearance:string,taste=false) {
  if(c.id!==w.s.playerId)return
  const d=identification(w,c,appearance,taste),method=taste?'taste':'examine',roll=rng(w,'world.knowledge').float()*100
  if(roll<d.chance) {discover(w,c,appearance,method);return}
  // 오인8%p는 실패74%의8%가 아니라 전체 확률에서8%다.
  if(roll<d.chance+d.mistake) {
    const options=w.db.all<PillEffectDef>('PillEffect').filter((p)=>p.id!==w.s.knowledge.pillMap[appearance]&&!pillBelief(w,appearance)?.ruledOut.includes(p.id)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)
    if(options.length){const belief=rng(w,'world.knowledge').pick(options).id;recordPill(w,appearance,method,'냄새와 맛에서 정체를 추측했다.',belief,'likely');log(w,'info',`${w.db.item(appearance).label}: ${w.db.pill(belief).label}일 것 같다.`);return}
  }
  recordPill(w,appearance,method,'감별해도 정체를 알 수 없었다.');log(w,'info','냄새와 색만으로는 알 수 없었다.')
}
function context(w:World,c:Creature) {return {pain:painTotal(w,c),infection:c.body.wounds.some((wd)=>(wd.infection?.progress??0)>0)||!!c.diseases?.some((d)=>d.incubatesUntil<=turnOf(w)&&d.progress>0)}}
function noticeable(w:World,c:Creature,e:PillEffectDef,before:ReturnType<typeof context>) {
  return e.noticeable==='always'||e.noticeable==='pain'&&before.pain>=knowledgeDef(w).noticeablePain&&painTotal(w,c)<before.pain||e.noticeable==='infection'&&before.infection
}
export function applyPillEffect(w: World, c: Creature, effect: string, duration: number, amount=1) {
  const turn=turnOf(w)
  switch(effect){
    case 'painkiller':addEffect(c,'analgesic',turn+duration);break
    case 'stimulant':addEffect(c,'stimulant',turn+duration);c.needs.energy=energyMax(w,c);c.needs.fatigue=Math.max(0,c.needs.fatigue-40*amount);break
    case 'antibiotic':addEffect(c,'antibiotic',turn+duration);break
    case 'sedative':addEffect(c,'sedative',turn+duration);c.needs.stress=Math.max(0,c.needs.stress-30*amount);break
    case 'toxin':c.needs.waterDeficit+=400*amount;c.needs.kcal-=300*amount;addThought(w,c,'Thought.Vomited');if(c.id===w.s.playerId)log(w,'danger','위가 뒤집힌다. 먹은 것을 게워냈다.');break
    case 'vitamin':c.needs.vitamin=Math.min(100,c.needs.vitamin+40*amount);break
  }
}
/** 한 정제 또는 남은 조각을 실제로 투여한다. 맛보기에서는 소지품을 먼저 분리한다. */
export function usePill(w:World,c:Creature,it:ItemInst,taste=false):string|null {
  const d=itemDef(w,it),id=w.s.knowledge.pillMap[it.def]
  if(!d.unidentified||!id)return '알약이 아니다'
  if(!c.alive)return '죽은 사람은 약을 쓸 수 없다'
  if(!taste&&!findItem(c,it.uid))return '사용할 알약이 없다'
  if(it.pillAge?.spoiled&&!knowledgeDef(w).pillAging)return '이 변질 정제를 처리할 규칙이 없다'
  const rule=knowledgeDef(w).pillAging,spoiled=!!it.pillAge?.spoiled&&!!rule
  const fraction=taste?Math.min(knowledgeDef(w).tasteFraction,it.pillRemaining??1):it.pillRemaining??1
  const amount=fraction*pillPotency(it)*(spoiled?rule!.spoiledAmount:1)
  const before=context(w,c),effect=w.db.pill(spoiled?rule!.spoiledEffect:id),known=!!w.s.knowledge.pillKnown[it.def]&&!spoiled
  if(effect.drug){const err=administerDrug(w,c,effect.drug,it.def,amount,undefined,known);if(err)return err}
  else applyPillEffect(w,c,effect.effect,effect.durationTurns,amount)
  if(!taste)removeOne(w,c,it.uid)
  if(c.id===w.s.playerId){
    log(w,'info',`${d.label}을(를) ${taste?'조금 맛보았다':'삼켰다'}.`)
    if(spoiled){
      recordPill(w,it.def,taste?'taste':'use','이번 정제에서 불쾌한 반응이 나타났다. 이 더미의 상태를 외형 전체의 정체로 단정할 수 없다.')
    } else if(!known){
      if(noticeable(w,c,effect,before))discover(w,c,it.def,taste?'taste':'use')
      else {
        const b=recordPill(w,it.def,taste?'taste':'use','눈에 띄는 변화가 없었다.')
        for(const e of w.db.all<PillEffectDef>('PillEffect')) {
          const expected = e.noticeable==='always' || e.noticeable==='pain' && before.pain>=knowledgeDef(w).noticeablePain || e.noticeable==='infection' && before.infection
          if(expected && e.id!==id && !b.ruledOut.includes(e.id))b.ruledOut.push(e.id)
        }
        if (b.confidence==='likely' && b.belief && b.ruledOut.includes(b.belief)) { b.belief=undefined;b.confidence='unknown';log(w,'info','관찰한 반응이 앞선 추정과 맞지 않는다.') }
      }
    }
    const belief=pillBelief(w,it.def)
    c.history.push({turn:turnOf(w),kind:'pill',text:`${d.label}${belief?.belief?` (${w.db.pill(belief.belief).label}${belief.confidence==='likely'?' 추정':''})`:''} ${taste?'맛보기':'복용'}`})
  }
  return null
}
export function tasteError(w:World,c:Creature,uid:number):string|null {
  const it=findItem(c,uid)
  if(!it||itemDef(w,it).unidentified!=='pill')return '맛볼 알약이 없다'
  if(it.pillAge?.spoiled&&!knowledgeDef(w).pillAging)return '이 변질 정제를 처리할 규칙이 없다'
  const effect = w.db.pill(w.s.knowledge.pillMap[it.def])
  if (effect.drug && w.db.get<import('./types').DrugDef>(effect.drug).external) return '외용약은 맛볼 수 없다'
  if(!c.alive)return '죽은 사람은 약을 맛볼 수 없다'
  if(c.unconscious||capacity(w,c,'manipulation')<.2)return '손을 쓸 수 없다'
  if(it.count>1&&!findSpot(w,c,itemDef(w,it)))return '남은 알약 조각을 둘 배낭 한 칸이 필요하다'
  return null
}
export function startTaste(w:World,c:Creature,uid:number):string|null {
  const err=tasteError(w,c,uid);if(err)return err
  const n=knowledgeDef(w).tasteTurns
  c.activity={kind:'taste',remaining:n,total:n,uid,label:`${itemDef(w,findItem(c,uid)!).label} 맛보기`};return null
}
export function finishTaste(w:World,c:Creature,uid:number):string|null {
  const err=tasteError(w,c,uid);if(err)return err
  const it=findItem(c,uid)!,fraction=knowledgeDef(w).tasteFraction,remaining=(it.pillRemaining??1)-fraction
  // 분리 뒤 투여해야 수면제가 시작한 새 활동을 잃지 않는다.
  let sample=it
  if(it.count>1){sample=removeOne(w,c,uid)!;sample.pillRemaining=remaining;if(addToBag(w,c,sample))throw new Error('맛보기 조각 배치 불변식 위반')}
  else if(remaining>0)it.pillRemaining=remaining
  else removeOne(w,c,uid)
  // 방금 줄인 남은 양 대신 항상 실제 시음량을 투여한다.
  const error=usePill(w,c,{...sample,pillRemaining:fraction},true);if(error)return error
  if(c.id===w.s.playerId&&!w.s.knowledge.pillKnown[sample.def]&&!sample.pillAge?.spoiled)identifyPill(w,c,sample.def,true)
  return null
}
