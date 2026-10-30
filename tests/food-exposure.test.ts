import {describe,expect,it} from 'vitest'
import {consumeFor} from '../src/core/actions'
import {player,TURNS_PER_DAY,turnOf} from '../src/core/ctx'
import {Rng,seedState} from '../src/core/rng'
import {exposeDisease} from '../src/core/conditions'
import type {DiseaseDef} from '../src/core/types'
import {makeItem,addToBag} from '../src/core/items'
import {serialize,deserialize} from '../src/core/save'
import {foodExposureTick} from '../src/core/food-exposure'
import {foodExposureDiseaseMultiplier,foodExposureLines,foodExposureLungDose} from '../src/core/food-exposure-state'
import {makeWorld} from './helpers'

function scene(count=30){
 const w=makeWorld('ashcake-unit','Bg.Deserter'),c=player(w);c.bag=[];c.needs.hygiene=100;c.hands={kind:'washed',at:turnOf(w)}
 const food=Array.from({length:count},()=>makeItem(w,'Item.Ashcake'))
 for(const item of food)expect(addToBag(w,c,item)).toBe(0)
 return{w,c,food}
}

describe('actual food course and distinct pulmonary ledger',()=>{
 it('does not invent past doses, immunity or injury for an old save or a read book',()=>{
  const {w,c}=scene(0);c.booksRead=['Item.SettlementMycologyRecords'];c.literacyBooks=[...c.booksRead];w.s.version=219
  const copy={db:w.db,s:deserialize(serialize(w.s))},person=player(copy)
  expect(copy.s.version).toBe(220);expect(person.foodExposureTraining).toBeUndefined()
  copy.s.time+=60*TURNS_PER_DAY*100;const before=serialize(copy.s);foodExposureTick(copy,person)
  expect(foodExposureLungDose(person)).toBe(0);expect(foodExposureDiseaseMultiplier(copy,person,'Disease.GreyFever')).toBe(1);expect(serialize(copy.s)).toBe(before)
 })
 it('charges every actual serving but gives a binge only one qualifying meal, retaining original bowls',()=>{
  const {w,c,food}=scene(),renal=c.needs.ash
  for(const item of food){const uid=item.uid;expect(consumeFor(w,c,c,uid)).toMatchObject({ok:true,tu:100});expect(item.def).toBe('Item.Bowl');expect(item.uid).toBe(uid)}
  expect(c.foodExposureTraining?.[0].doseCount).toBe(30);expect(c.foodExposureTraining?.[0].course?.receipts).toHaveLength(1)
  expect(c.bag.filter(i=>i.def==='Item.Bowl')).toHaveLength(30);expect(foodExposureLungDose(c)).toBe(10);expect(c.needs.ash).toBe(renal)
  expect(foodExposureDiseaseMultiplier(w,c,'Disease.GreyFever')).toBe(1)
 })
 it('requires actual retained meals and the full elapsed period, preserving injury and knowledge boundaries on restore',()=>{
  const {w,c,food}=scene(),start=w.s.time
  // Unit boundaries only: these explicit clocks do not claim a naturally played month.
  for(let day=0;day<30;day++){w.s.time=start+day*TURNS_PER_DAY*100;c.hands={kind:'washed',at:turnOf(w)};expect(consumeFor(w,c,c,food[day].uid).ok).toBe(true)}
  const dormant=deserialize(serialize(w.s))
  foodExposureTick(w,c);expect(foodExposureDiseaseMultiplier(w,c,'Disease.GreyFever')).toBe(1)
  w.s.time=start+30*TURNS_PER_DAY*100-100;foodExposureTick(w,c);expect(foodExposureDiseaseMultiplier(w,c,'Disease.GreyFever')).toBe(1)
  w.s.time+=100;foodExposureTick(w,c)
  expect(foodExposureDiseaseMultiplier(w,c,'Disease.GreyFever')).toBe(.7);expect(foodExposureDiseaseMultiplier(w,c,'Disease.RatFever')).toBe(1)
  expect(c.immuneDiseases??[]).not.toContain('Disease.GreyFever');expect(foodExposureLungDose(c)).toBe(10);expect(foodExposureLines(w,c)).toEqual([])
  c.booksRead=['Item.SettlementMycologyRecords'];c.literacyBooks=[...c.booksRead];expect(foodExposureLines(w,c).join('\n')).toContain('×0.7')
  c.misreadBooks=[...c.booksRead];expect(foodExposureLines(w,c)).toEqual([]);expect(foodExposureDiseaseMultiplier(w,c,'Disease.GreyFever')).toBe(.7)
  const restored={db:w.db,s:deserialize(serialize(w.s))};expect(serialize(restored.s)).toBe(serialize(w.s));expect(foodExposureLungDose(player(restored))).toBe(10);expect(foodExposureDiseaseMultiplier(restored,player(restored),'Disease.GreyFever')).toBe(.7)
  dormant.time=start+60*TURNS_PER_DAY*100;const late={db:w.db,s:dormant};foodExposureTick(late,player(late));expect(player(late).foodExposureTraining?.[0].completedAt).toBe(start/100+30*TURNS_PER_DAY);expect(foodExposureDiseaseMultiplier(late,player(late),'Disease.GreyFever')).toBe(.7)
 })
 it('resets a missed course without healing accumulated pulmonary burden',()=>{
  const {w,c,food}=scene(2);expect(consumeFor(w,c,c,food[0].uid).ok).toBe(true)
  w.s.time+=(2*TURNS_PER_DAY+1)*100;foodExposureTick(w,c)
  expect(c.foodExposureTraining?.[0].course).toBeUndefined();expect(foodExposureLungDose(c)).toBeCloseTo(1/3)
  c.hands={kind:'washed',at:turnOf(w)};expect(consumeFor(w,c,c,food[1].uid).ok).toBe(true)
  expect(c.foodExposureTraining?.[0].doseCount).toBe(2);expect(c.foodExposureTraining?.[0].course?.receipts).toEqual([{uid:food[1].uid,at:turnOf(w)}]);expect(foodExposureDiseaseMultiplier(w,c,'Disease.GreyFever')).toBe(1)
 })
 it('multiplies only the matching disease roll and consumes only the original chance/incubation draws',()=>{
  const {w,c,food}=scene(),start=w.s.time
  for(let day=0;day<30;day++){w.s.time=start+day*TURNS_PER_DAY*100;c.hands={kind:'washed',at:turnOf(w)};expect(consumeFor(w,c,c,food[day].uid).ok).toBe(true)}
  w.s.time=start+30*TURNS_PER_DAY*100;foodExposureTick(w,c)
  const original=serialize(w.s),now=turnOf(w)
  for(const disease of ['Disease.GreyFever','Disease.RatFever'])for(let i=0;i<20;i++){
   const copy={db:w.db,s:deserialize(original)},person=player(copy),state=seedState('food-exposure-roll-'+i,'body')
   copy.s.rng.body=[...state];const expected=new Rng([...state]),roll=expected.float(),mult=disease==='Disease.GreyFever'?.7:1
   const infected=roll<.8*mult,def=w.db.get<DiseaseDef>(disease)
   const incubation=infected?now+expected.int(def.incubationDays[0]*TURNS_PER_DAY,def.incubationDays[1]*TURNS_PER_DAY):undefined
   expect(exposeDisease(copy,person,disease,.8)).toBe(infected)
   expect(copy.s.rng.body).toEqual(expected.s)
   expect(person.diseases?.find(d=>d.def===disease)?.incubatesUntil).toBe(incubation)
   expect(person.foodExposureTraining).toEqual(c.foodExposureTraining)
  }
  expect(serialize(w.s)).toBe(original)
 })
 it('does not credit a second attempt to consume the original empty vessel',()=>{
  const {w,c,food}=scene(1);expect(consumeFor(w,c,c,food[0].uid).ok).toBe(true)
  const before=serialize(w.s);expect(consumeFor(w,c,c,food[0].uid).ok).toBe(false);expect(serialize(w.s)).toBe(before)
 })
 it('shows learned meal deadlines and an expired course without mutating the original ledger',()=>{
  const {w,c,food}=scene(1);expect(consumeFor(w,c,c,food[0].uid).ok).toBe(true)
  c.booksRead=['Item.SettlementMycologyRecords'];c.literacyBooks=[...c.booksRead]
  const before=serialize(w.s),lines=foodExposureLines(w,c).join('\n')
  expect(lines).toContain('간격을 지킨 식사 1/30회')
  expect(lines).toContain('다음 과정 기록');expect(lines).toContain('연속 기록 한계');expect(lines).toContain('최소 관찰 완료')
  expect(serialize(w.s)).toBe(before)
  w.s.time+=(2*TURNS_PER_DAY+1)*100
  const expired=serialize(w.s),visible=foodExposureLines(w,c).join('\n')
  expect(visible).toContain('간격을 지킨 식사 0/30회');expect(visible).not.toContain('다음 과정 기록')
  expect(c.foodExposureTraining?.[0].course?.receipts).toHaveLength(1)
  expect(foodExposureLungDose(c)).toBeCloseTo(1/3);expect(serialize(w.s)).toBe(expired)
 })
 it('rejects malformed new save records rather than inventing a completed course',()=>{
  const {w,c,food}=scene(1);expect(consumeFor(w,c,c,food[0].uid).ok).toBe(true)
  const before=serialize(w.s)
  for(const mutate of [
   (copy:typeof w.s)=>{copy.creatures.find(x=>x.id===copy.playerId)!.foodExposureTraining![0].course!.receipts[0].uid=0},
   (copy:typeof w.s)=>{copy.creatures.find(x=>x.id===copy.playerId)!.foodExposureTraining![0].course!.receipts[0].uid=copy.nextId},
   (copy:typeof w.s)=>{copy.creatures.find(x=>x.id===copy.playerId)!.foodExposureTraining![0].course!.receipts[0].at=turnOf(w)+1},
   (copy:typeof w.s)=>{copy.creatures.find(x=>x.id===copy.playerId)!.foodExposureTraining![0].doseCount=0},
   (copy:typeof w.s)=>{copy.creatures.find(x=>x.id===copy.playerId)!.foodExposureTraining![0].completedAt=turnOf(w)},
  ]){const copy=JSON.parse(before) as typeof w.s;mutate(copy);expect(()=>deserialize(JSON.stringify(copy))).toThrow()}
  expect(serialize(w.s)).toBe(before)
 })
})
