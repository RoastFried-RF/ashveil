import {SAVE_VERSION} from '../src/core/game'
import {describe,expect,it} from 'vitest'
import {activityStep,consumeFor,perform} from '../src/core/actions'
import {playerAct} from '../src/core/game'
import {aiDecide} from '../src/core/ai'
import {residentFoodKcal} from '../src/core/resident-provisions'
import {openFoodQuote,readyFood} from '../src/core/open-food-state'
import {startOpenFood} from '../src/core/open-food'
import {ageFood} from '../src/core/food-safety'
import {turnOf,TURNS_PER_HOUR} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {finishBase} from './base-camp-fixture'
function setup(tool='Item.HuntingKnife'){
 const d=clinicalDiseaseFixture('actual-sealed-food'),can=d.add('Item.CannedMeat'),blade=tool?d.add(tool):undefined
 d.p.background=undefined;d.p.traits=[];d.p.skills={};d.p.needs.kcal=0;d.p.needs.vitamin=0;return{...d,can,blade}
}
describe('원래 밀봉 음식의 실제 도구·개봉과 같은 빈 용기',()=>{
 it('견적은 원래 도구/음식의2턴을 읽고 몸·음식·난수·UID를 바꾸지 않는다',()=>{
  const d=setup(),hash=stateHash(d.s),q=openFoodQuote(d.w,d.p,d.can.uid);expect(q.error).toBeNull();expect(q.turns).toBe(2);expect(q.tool?.uid).toBe(d.blade!.uid);expect(stateHash(d.s)).toBe(hash)
 })
 it('맨손으로12턴 두드리는 가짜 경로는 원본 내용물/몸을 소비하지 않는다',()=>{
  const d=setup(''),hash=stateHash(d.s);expect(perform(d.w,d.p,{type:'consume',uid:d.can.uid}).ok).toBe(false);expect(stateHash(d.s)).toBe(hash);expect(d.p.activity).toBeUndefined();expect(d.can.def).toBe('Item.CannedMeat')
 })
 it.each(['Item.HuntingKnife','Item.RustyKnife','Item.Hatchet'])('실제 원래 %s로만 원래 용기를 딴다',tool=>{
  const d=setup(tool),next=d.s.nextId;expect(startOpenFood(d.w,d.p,d.can.uid)).toBeNull();finishBase(d.w,d.p);expect(d.can.def).toBe('Item.OpenedCannedMeat');expect(d.can.uses).toBe(1);expect(d.s.nextId).toBe(next)
 })
 it('부서진 칼과 돌은 도구를 대신하지 못한다',()=>{
  const d=setup();d.blade!.durability=0;d.add('Item.Stone');const hash=stateHash(d.s);expect(startOpenFood(d.w,d.p,d.can.uid)).not.toBeNull();expect(stateHash(d.s)).toBe(hash)
 })
 it('첫 작업턴에는 밀봉/영양/원래 UID를 유지하고 두 번째 완료 때만 실제로 연다',()=>{
  const d=setup(),next=d.s.nextId;expect(startOpenFood(d.w,d.p,d.can.uid)).toBeNull();activityStep(d.w,d.p);expect(d.p.activity!.remaining).toBe(1);expect(d.can.def).toBe('Item.CannedMeat');expect(d.p.needs.kcal).toBe(0)
  activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.can.def).toBe('Item.OpenedCannedMeat');expect(d.can.foodAgedAt).toBe(turnOf(d.w));expect(d.can.foodSealed).toBeUndefined();expect(d.can.foodLeftover).toBeUndefined();expect(d.p.needs.kcal).toBe(0);expect(d.s.nextId).toBe(next)
 })
 it('실제 기본 먹기 입력은2턴 개봉과1턴 식사를 마쳐야 섭취하고 같은 빈 통을 남긴다',()=>{
  const d=setup(),at=d.s.time,next=d.s.nextId;expect(playerAct(d.w,{type:'consume',uid:d.can.uid})).toBeNull();expect(d.s.time-at).toBe(300);expect(d.p.needs.kcal).toBeGreaterThan(449);expect(d.p.needs.kcal).toBeLessThanOrEqual(450);expect(d.can.def).toBe('Item.EmptyTin');expect(d.p.bag.filter(i=>i.uid===d.can.uid)).toHaveLength(1);expect(d.s.nextId).toBe(next)
 })
 it('실제 따기만 하면 원래 음식이 남고 나중 한 턴 식사로 같은 빈 통이 된다',()=>{
  const d=setup(),at=d.s.time;expect(playerAct(d.w,{type:'openFood',uid:d.can.uid})).toBeNull();expect(d.s.time-at).toBe(200);expect(d.p.needs.kcal).toBeLessThanOrEqual(0);expect(d.can.def).toBe('Item.OpenedCannedMeat')
  expect(playerAct(d.w,{type:'consume',uid:d.can.uid})).toBeNull();expect(d.s.time-at).toBe(300);expect(d.can.def).toBe('Item.EmptyTin')
 })
 it('중단하면 원래 밀봉과 몸은 그대로이고 개봉 진행은 다음 시도에 남지 않는다',()=>{
  const d=setup();startOpenFood(d.w,d.p,d.can.uid);activityStep(d.w,d.p);expect(playerAct(d.w,{type:'stopActivity'})).toBeNull();expect(d.can.def).toBe('Item.CannedMeat');expect(d.p.needs.kcal).toBe(0)
  expect(startOpenFood(d.w,d.p,d.can.uid)).toBeNull();expect(d.p.activity!.remaining).toBe(2)
 })
 it('원래 도구를 잃고 다른 칼을 가져도 진행 중 작업에 몰래 대입하지 않는다',()=>{
  const d=setup();startOpenFood(d.w,d.p,d.can.uid);activityStep(d.w,d.p);d.p.bag=d.p.bag.filter(i=>i.uid!==d.blade!.uid);d.add('Item.RustyKnife');activityStep(d.w,d.p)
  expect(d.p.activity).toBeUndefined();expect(d.can.def).toBe('Item.CannedMeat');expect(d.p.needs.kcal).toBe(0)
 })
 it('손/의식이 달라지면 같은 개봉을 중단하고 내용물을 미리 주지 않는다',()=>{
  const d=setup();startOpenFood(d.w,d.p,d.can.uid);d.p.body.missing=['LeftUpperArm','RightUpperArm'];activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.can.def).toBe('Item.CannedMeat');expect(d.p.needs.kcal).toBe(0)
 })
 it('원래 다른 섭취자에게 실제 개봉 완료 때만 음식을 전달한다',()=>{
  const d=setup(),recipient=d.doctor();recipient.needs.kcal=0;expect(consumeFor(d.w,d.p,recipient,d.can.uid).ok).toBe(true);expect(recipient.needs.kcal).toBe(0);activityStep(d.w,d.p);expect(recipient.needs.kcal).toBe(0);activityStep(d.w,d.p);expect(recipient.needs.kcal).toBe(0);activityStep(d.w,d.p);expect(recipient.needs.kcal).toBe(450);expect(d.p.needs.kcal).toBe(0);expect(d.can.def).toBe('Item.EmptyTin')
 })
 it('섭취자가 떠나면 실제 열린 음식은 남고 멀리 영양을 전달하지 않는다',()=>{
  const d=setup(),recipient=d.doctor();recipient.needs.kcal=0;consumeFor(d.w,d.p,recipient,d.can.uid);activityStep(d.w,d.p);recipient.pos.x+=5;activityStep(d.w,d.p);activityStep(d.w,d.p);expect(recipient.needs.kcal).toBe(0);expect(d.can.def).toBe('Item.OpenedCannedMeat');expect(d.can.uses).toBe(1)
 })
 it('밀봉은 무기한이지만 실제 개봉 뒤15°C의24시간에 원래 음식이 상한다',()=>{
  const d=setup();ageFood(d.w,d.can,15,240*TURNS_PER_HOUR);expect(d.can.freshness).toBeUndefined();startOpenFood(d.w,d.p,d.can.uid);finishBase(d.w,d.p);expect(d.can.freshness).toBe(100);ageFood(d.w,d.can,15,24*TURNS_PER_HOUR);expect(d.can.freshness).toBe(0);expect(d.can.def).toBe('Item.OpenedCannedMeat')
 })
 it('실제 상한 개봉 음식의 한 번 섭취는 원래 재 노출과 남은 빈 용기를 보존한다',()=>{
  const d=setup();d.can.contaminantAsh=.5;startOpenFood(d.w,d.p,d.can.uid);finishBase(d.w,d.p);d.can.freshness=50;d.p.needs.ash=0;expect(perform(d.w,d.p,{type:'consume',uid:d.can.uid}).ok).toBe(true);expect(d.p.needs.ash).toBe(.5);expect(d.can.def).toBe('Item.EmptyTin');expect(d.can.contaminantAsh).toBeUndefined()
 })
 it('진행 중 전체 각인은 원래 음식/도구/마지막 작업과 몸·난수를 같은 결과로 잇는다',()=>{
  const d=setup();consumeFor(d.w,d.p,d.p,d.can.uid);activityStep(d.w,d.p);const copy={db:d.w.db,s:deserialize(serialize(d.s))}
  for(const x of[d.w,copy]){const p=x.s.creatures.find(c=>c.id===x.s.playerId)!;finishBase(x,p)}
  expect(copy.s).toEqual(JSON.parse(serialize(d.s)));expect(copy.s.version).toBe(SAVE_VERSION);expect(d.can.def).toBe('Item.EmptyTin')
 })
 it('개봉 뒤 식사 한 턴 전에 중단하면 열린 음식은 남고 다음에1턴만 먹는다',()=>{
  const d=setup();consumeFor(d.w,d.p,d.p,d.can.uid);activityStep(d.w,d.p);activityStep(d.w,d.p);expect(d.p.activity?.kind).toBe('foodMeal');expect(d.can.def).toBe('Item.OpenedCannedMeat');expect(d.p.needs.kcal).toBe(0)
  expect(playerAct(d.w,{type:'stopActivity'})).toBeNull();expect(d.can.def).toBe('Item.OpenedCannedMeat');const at=d.s.time;expect(playerAct(d.w,{type:'consume',uid:d.can.uid})).toBeNull();expect(d.s.time-at).toBe(100);expect(d.can.def).toBe('Item.EmptyTin')
 })
 it('개봉 완료/식사 대기 사이 전체 각인도 음식과 원래 한 회분을 한 번만 전달한다',()=>{
  const d=setup();consumeFor(d.w,d.p,d.p,d.can.uid);activityStep(d.w,d.p);activityStep(d.w,d.p);const copy={db:d.w.db,s:deserialize(serialize(d.s))}
  for(const x of[d.w,copy])activityStep(x,x.s.creatures.find(c=>c.id===x.s.playerId)!)
  expect(copy.s).toEqual(JSON.parse(serialize(d.s)));expect(d.can.def).toBe('Item.EmptyTin');expect(d.p.needs.kcal).toBe(450)
 })
 it('진행 중 원래 개봉 규칙이 달라지면 새로운 결과로 바꾸지 않는다',()=>{
  const d=setup();startOpenFood(d.w,d.p,d.can.uid);d.w.db=loadMods([...readPackages(),{manifest:{id:'different.open',name:'다른 개봉',version:'1'},defs:[],patches:[{op:'replace',target:'Item.CannedMeat',path:'/openFood/turns',value:3}]}]).db;finishBase(d.w,d.p);expect(d.can.def).toBe('Item.CannedMeat');expect(d.p.needs.kcal).toBe(0)
 })
 it('자동 식사는 열 수 없는 통조림을 피해 실제 먹을 수 있는 원래 음식을 고른다',()=>{
  const d=setup(''),c=d.doctor(),can=makeItem(d.w,'Item.CannedMeat'),bread=makeItem(d.w,'Item.Hardtack');addToBag(d.w,c,can);addToBag(d.w,c,bread);c.needs.kcal=-1000
  expect(readyFood(d.w,c,can)).toBe(false);expect(aiDecide(d.w,c)).toEqual({type:'consume',uid:bread.uid});expect(residentFoodKcal(d.w,c)).toBe(350)
  const jar=makeItem(d.w,'Item.PickledCabbageJar');addToBag(d.w,c,jar);expect(residentFoodKcal(d.w,c)).toBe(550);jar.uses=1;expect(residentFoodKcal(d.w,c)).toBe(390)
 })
 it('일반 음식은 기존 즉시 한 회분 소비를 유지하고 개봉 활동을 만들지 않는다',()=>{
  const d=setup(),food=makeItem(d.w,'Item.DriedApple');expect(addToBag(d.w,d.p,food)).toBe(0);expect(perform(d.w,d.p,{type:'consume',uid:food.uid}).tu).toBe(100);expect(d.p.activity).toBeUndefined()
 })
 it('구형70은 원래 밀봉 음식/몸·난수·현금을 보존하고 과거 개봉을 만들지 않는다',()=>{
  const d=setup(),old=JSON.parse(serialize(d.s));old.version=70;const restored=deserialize(JSON.stringify(old));expect({...restored,version:70}).toEqual(old);expect(restored.creatures.find(c=>c.id===d.p.id)!.bag.find(i=>i.uid===d.can.uid)!.def).toBe('Item.CannedMeat')
 })
})
