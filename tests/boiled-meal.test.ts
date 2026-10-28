import {SAVE_VERSION} from '../src/core/game'
import {describe,expect,it} from 'vitest'
import {activityStep,consumeFor,perform} from '../src/core/actions'
import {boiledMealQuote,warmMealGain} from '../src/core/boiled-meal'
import {craftError,startCraft} from '../src/core/crafting'
import {campfireAt,extinguishCampfire,startFireWork} from '../src/core/campfire'
import {tileAt,TURNS_PER_HOUR} from '../src/core/ctx'
import {ageFood} from '../src/core/food-safety'
import {waterSafetyDef,treatedWater} from '../src/core/water-state'
import {drinkVolume} from '../src/core/wash-water'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {makeItem} from '../src/core/items'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import type {RecipeDef} from '../src/core/types'
import {finishBase} from './base-camp-fixture'
import {boiledMealFixture as setup} from './boiled-meal-fixture'
import {cultivationStatus} from '../src/core/cultivation'
function cook(d:ReturnType<typeof setup>){expect(startCraft(d.w,d.p,d.recipe,1)).toBeNull();finishBase(d.w,d.p);return d.p.bag.find(i=>i.uid===d.bowl.uid)!}
describe('원래 곡물·실제 물과 같은 그릇의 따뜻한 귀리죽',()=>{
 it('견적은 실제 원래 물220ml/그릇과 같은 유한 불을 읽기만 한다',()=>{
  const d=setup(),hash=stateHash(d.s),q=boiledMealQuote(d.w,d.p,d.w.db.get<RecipeDef>(d.recipe))
  expect(q.error).toBeNull();expect(q.plan?.bottleUid).toBe(d.bottle.uid);expect(q.plan?.vesselUid).toBe(d.bowl.uid);expect(q.plan?.ml).toBe(220);expect(stateHash(d.s)).toBe(hash)
 })
 it('실제399턴 동안 재료/물/몸을 소비하지 않고400턴 마지막에 같은 그릇만 바꾼다',()=>{
  const d=setup(),next=d.s.nextId;expect(startCraft(d.w,d.p,d.recipe,1)).toBeNull();for(let i=0;i<399;i++)activityStep(d.w,d.p)
  expect(d.bowl.def).toBe('Item.Bowl');expect(d.bottle.uses).toBe(5);expect(d.oats.count).toBe(3);expect(d.p.needs.kcal).toBe(0);activityStep(d.w,d.p)
  const out=d.p.bag.find(i=>i.uid===d.bowl.uid)!;expect(out.def).toBe('Item.OatmealBowl');expect(out.quality).toBe(3);expect(out.durability).toBe(81);expect(out.foodQ).toBeTypeOf('number');expect(out.uses).toBe(1);expect(drinkVolume(d.w,d.bottle)).toBe(780);expect(d.oats.count).toBe(2);expect(d.s.nextId).toBe(next);expect(d.p.workJob).toBeUndefined()
 })
 it('마지막220ml를 조리해도 원래 물병은 빈 채로 남는다',()=>{
  const d=setup(220);const out=cook(d);expect(out.def).toBe('Item.OatmealBowl');expect(d.bottle.def).toBe('Item.WaterBottle');expect(d.bottle.uses).toBe(0);expect(d.bottle.water).toBeUndefined()
 })
 it('실제 물의 재와 소금은 같은 그릇의 한 회분에 남고 병원체는 끓인다',()=>{
  const d=setup(),q=treatedWater(d.w,d.bottle.water!,'boil'),out=cook(d),water=waterSafetyDef(d.w)
  expect(q.pathogen).toBe(0);expect(out.foodSaltGrams).toBeCloseTo(.66,12);expect(out.contaminantAsh).toBeCloseTo(q.ash/water.ashDivisor*220/water.exposureMl,12);expect(out.water).toBeUndefined()
 })
 it('정적 화덕/불 없음·물 부족·그릇 없음·귀리 없음은 원본을 소비하지 않는다',()=>{
  for(const variant of ['fire','water','bowl','oats']){const d=setup(variant==='water'?200:1000,variant!=='fire');if(variant==='bowl')d.p.bag=d.p.bag.filter(i=>i.uid!==d.bowl.uid);if(variant==='oats')d.p.bag=d.p.bag.filter(i=>i.uid!==d.oats.uid);const hash=stateHash(d.s);expect(startCraft(d.w,d.p,d.recipe,1)).not.toBeNull();expect(stateHash(d.s)).toBe(hash)}
 })
 it('조리 중 원래 물의 양/수질이 바뀌면 진행을 멈추고 다른 물에 대입하지 않는다',()=>{
  for(const variant of ['water','quality','uid']){const d=setup();startCraft(d.w,d.p,d.recipe,1);activityStep(d.w,d.p);if(variant==='water')d.bottle.uses=4;if(variant==='quality')d.bottle.water!.ash=.3;if(variant==='uid')d.bottle.uid+=100;activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.p.workJob?.progress).toBe(1);expect(d.oats.count).toBe(3);expect(d.bowl.def).toBe('Item.Bowl');expect(startCraft(d.w,d.p,d.recipe,1)).not.toBeNull()}
 })
 it('그릇을 잃고 새 그릇을 가져와도 원래 진행을 복제하지 않는다',()=>{
  const d=setup();startCraft(d.w,d.p,d.recipe,1);activityStep(d.w,d.p);d.p.bag=d.p.bag.filter(i=>i.uid!==d.bowl.uid);d.add('Item.Bowl');activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(startCraft(d.w,d.p,d.recipe,1)).not.toBeNull();expect(d.oats.count).toBe(3)
 })
 it('원래 귀리를 잃으면 새 귀리가 있어도 실제 예약 재료를 소비하지 않는다',()=>{
  const d=setup();startCraft(d.w,d.p,d.recipe,1);activityStep(d.w,d.p);d.oats.uid+=100;activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.p.workJob?.progress).toBe(1);expect(d.oats.count).toBe(3)
 })
 it('원래 불이 꺼지면 일시 중단하고 같은 불을 다시 피워 남은 진행만 잇는다',()=>{
  const d=setup();startCraft(d.w,d.p,d.recipe,1);activityStep(d.w,d.p);extinguishCampfire(d.w,d.p,d.pos);activityStep(d.w,d.p);expect(d.p.workJob?.progress).toBe(1);expect(d.p.activity).toBeUndefined();const wood=d.add('Item.Wood');expect(startFireWork(d.w,d.p,d.pos,wood.uid)).toBeNull();finishBase(d.w,d.p);expect(startCraft(d.w,d.p,d.recipe,1)).toBeNull();expect(d.p.activity?.remaining).toBe(399);finishBase(d.w,d.p);expect(d.p.bag.find(i=>i.uid===d.bowl.uid)!.def).toBe('Item.OatmealBowl')
 })
 it('새 불 UID는 원래 조리 진행의 열원을 대신하지 못한다',()=>{
  const d=setup();startCraft(d.w,d.p,d.recipe,1);activityStep(d.w,d.p);const f=campfireAt(d.w,d.pos)!;f.tile.placed!.item.uid+=100;f.light.sourceUid=f.tile.placed!.item.uid;activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.oats.count).toBe(3)
 })
 it('실제 중단/재개는 원래 제작 진행을 보존하고 취소는 재료 없이 진행만 버린다',()=>{
  const d=setup();startCraft(d.w,d.p,d.recipe,1);activityStep(d.w,d.p);d.p.activity=undefined;expect(startCraft(d.w,d.p,d.recipe,1)).toBeNull();expect(d.p).toHaveProperty('activity.remaining',399);expect(perform(d.w,d.p,{type:'cancelWork'}).ok).toBe(true);expect(d.p.workJob).toBeUndefined();expect(d.oats.count).toBe(3);expect(d.bottle.uses).toBe(5)
 })
 it('실제 완성된 따뜻한 한 그릇만300kcal/단백10과 체온+.2를 주고 같은 빈 그릇이 된다',()=>{
  const d=setup(),out=cook(d),uid=out.uid;out.contaminantAsh=0;out.foodSaltGrams=0;d.p.needs.bodyTemp=34;d.p.needs.protein=0;d.p.needs.waterDeficit=1000
  expect(consumeFor(d.w,d.p,d.p,uid).ok).toBe(true);expect(d.p.needs.kcal).toBe(300);expect(d.p.needs.protein).toBeGreaterThan(0);expect(d.p.needs.bodyTemp).toBe(34.2);expect(d.p.needs.waterDeficit).toBe(780);expect(out.def).toBe('Item.Bowl');expect(out.uid).toBe(uid);expect(out.foodHeatedAt).toBeUndefined();expect(out.foodSaltGrams).toBeUndefined();expect(out.contaminantAsh).toBeUndefined();expect(consumeFor(d.w,d.p,d.p,uid).ok).toBe(false)
 })
 it('처음 생성/구형 음식에는 가짜 조리 온도를 만들지 않고 실제20분 뒤 식는다',()=>{
  const d=setup(),fresh=makeItem(d.w,'Item.OatmealBowl');expect(warmMealGain(d.w,fresh)).toBe(0);const out=cook(d);expect(warmMealGain(d.w,out)).toBe(.2);d.s.time+=400*100;expect(warmMealGain(d.w,out)).toBe(0);d.p.needs.bodyTemp=34;consumeFor(d.w,d.p,d.p,out.uid);expect(d.p.needs.bodyTemp).toBe(34)
 })
 it('따뜻한 음식이 발열을 내려 주는 가짜 해열제가 되지 않는다',()=>{
  const d=setup(),out=cook(d);d.p.needs.bodyTemp=39;consumeFor(d.w,d.p,d.p,out.uid);expect(d.p.needs.bodyTemp).toBe(39)
 })
 it('다른 실제 섭취자의 몸에만 원래 물/재/염분과 음식·따뜻함을 전달한다',()=>{
  const d=setup(),out=cook(d),recipient=d.doctor();recipient.needs.kcal=0;recipient.needs.bodyTemp=34;recipient.needs.waterDeficit=1000;recipient.needs.ash=0
  expect(consumeFor(d.w,d.p,recipient,out.uid).ok).toBe(true);expect(recipient.needs.kcal).toBe(300);expect(recipient.needs.bodyTemp).toBe(34.2);expect(recipient.needs.ash).toBeGreaterThan(0);expect(recipient.needs.waterDeficit).toBeGreaterThan(780);expect(d.p.needs.kcal).toBe(0)
 })
 it('15°C12시간에 같은 죽이 상하고 재가 사라지지 않는다',()=>{
  const d=setup(),out=cook(d),ash=out.contaminantAsh;ageFood(d.w,out,15,12*TURNS_PER_HOUR);expect(out.freshness).toBe(0);expect(out.contaminantAsh).toBe(ash)
 })
 it('진행 중 전체 저장은 원래 물/그릇/귀리/불과 같은 최종 상태를 보존한다',()=>{
  const d=setup();startCraft(d.w,d.p,d.recipe,1);activityStep(d.w,d.p);const copy={db:d.w.db,s:deserialize(serialize(d.s))};for(const w of[d.w,copy])finishBase(w,w.s.creatures.find(c=>c.id===w.s.playerId)!);expect(copy.s).toEqual(JSON.parse(serialize(d.s)))
 })
 it('완성된 실제 보온/원래 재·소금과 빈 그릇 경계도 전체 저장으로 보존한다',()=>{
  const d=setup(),out=cook(d),copy={db:d.w.db,s:deserialize(serialize(d.s))};for(const w of[d.w,copy]){const p=w.s.creatures.find(c=>c.id===w.s.playerId)!;consumeFor(w,p,p,out.uid)}expect(copy.s).toEqual(JSON.parse(serialize(d.s)))
 })
 it('규칙 변경은 같은 원래 진행을 새 물량/조리 결과로 바꾸지 않는다',()=>{
  const d=setup();startCraft(d.w,d.p,d.recipe,1);activityStep(d.w,d.p);d.w.db=loadMods([...readPackages(),{manifest:{id:'changed.meal',name:'다른 죽',version:'1'},defs:[],patches:[{op:'replace',target:d.recipe,path:'/boiledMeal/waterMl',value:221}]}],['changed.meal']).db;activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.oats.count).toBe(3);expect(drinkVolume(d.w,d.bottle)).toBe(1000)
 })
 it('새 귀리 종자는 실제 성장 상태로 시작하며 시각만 넘겨 수확하지 못한다',()=>{
  const d=setup(),seed=d.add('Item.OatSeed'),pos={x:20,y:19};expect(perform(d.w,d.p,{type:'place',uid:seed.uid,dir:0}).ok).toBe(true);const tile=tileAt(d.w,pos);expect(tile.t).toBe('Terrain.OatPlot');expect(tile.gatherAt).toBeUndefined();expect(cultivationStatus(d.w,pos)).toMatchObject({valid:true,ready:false,waterMl:0});expect(perform(d.w,d.p,{type:'gather',pos}).ok).toBe(false);d.s.time+=144000*100;expect(perform(d.w,d.p,{type:'gather',pos}).ok).toBe(false);expect(d.oats.count).toBe(3)
 })
 it('구형72의 몸/원래 물품/진행을 보존하고 가짜 뜨거운 음식을 만들지 않는다',()=>{
  const d=setup(),old=JSON.parse(serialize(d.s));old.version=72;const restored=deserialize(JSON.stringify(old));expect({...restored,version:72}).toEqual(old);expect(restored.version).toBe(SAVE_VERSION)
 })
 it('일반 제작과 보존식에는 새 물/그릇 요구를 추가하지 않는다',()=>{
  const d=setup(),r=d.w.db.get<RecipeDef>('Recipe.Bandage');expect(boiledMealQuote(d.w,d.p,r)).toEqual({error:null});expect(craftError(d.w,d.p,d.w.db.get<RecipeDef>(d.recipe))).toBeNull()
 })
})
