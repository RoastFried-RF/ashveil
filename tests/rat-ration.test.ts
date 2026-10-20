import {SAVE_VERSION} from '../src/core/game'
import{describe,expect,it}from'vitest'
import{activityStep,perform,consumeFor}from'../src/core/actions'
import{killCreature}from'../src/core/combat'
import{createCreature}from'../src/core/creatures'
import{tileAt,turnOf,TURNS_PER_DAY,TURNS_PER_HOUR}from'../src/core/ctx'
import{startOpenFood}from'../src/core/open-food'
import{openFoodQuote}from'../src/core/open-food-state'
import{ageFood}from'../src/core/food-safety'
import{diseaseTick}from'../src/core/conditions'
import{diseasePain}from'../src/core/disease-state'
import{loadMods}from'../src/core/defs'
import{readPackages}from'../tools/loadContent'
import{deserialize,serialize,stateHash}from'../src/core/save'
import{exchange}from'../src/core/economy'
import{clinicalDiseaseFixture}from'./clinical-diseases-fixture'
import{firstImpressionsFixture}from'./first-impressions-fixture'
import{finishBase}from'./base-camp-fixture'
import{ratFoodFixture,rationFixture}from'./rat-ration-fixture'
function risk(d:ReturnType<typeof ratFoodFixture>,chance=1){const id='actual.raw.rat.risk';const loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Item.RawRatMeat',path:'/food/rawDisease/chance',value:chance}]}],[id]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));d.w.db=loaded.db}
describe('실제 굴쥐 사망·원본 고기와 날것 질병',()=>{
 it('원래 굴쥐는 같은 사망에서 고기1개만 남기고 실제 배낭으로 줍는다',()=>{
  const d=ratFoodFixture();expect(d.rat.alive).toBe(false);expect(d.meat.count).toBe(1);expect(d.p.bag.find(i=>i.uid===d.meat.uid)?.def).toBe('Item.RawRatMeat');expect(tileAt(d.w,d.rat.pos).items.some(i=>i.uid===d.meat.uid)).toBe(false);expect(d.p.needs.kcal).toBe(0);const hash=stateHash(d.s);killCreature(d.w,d.rat,'같은 사망 재시도');expect(stateHash(d.s)).toBe(hash)
 })
 it('다른 원래 짐승은 기존 생고기3개를 유지하고 굴쥐로 둔갑하지 않는다',()=>{
  const d=clinicalDiseaseFixture(),hound=createCreature(d.w,'Creature.AshHound',{x:21,y:20});hound.bag=[];hound.equip={};d.s.creatures.push(hound);killCreature(d.w,hound,'실제 원본 짐승 사망');expect(tileAt(d.w,hound.pos).items.filter(i=>i.def==='Item.RawMeat').reduce((n,i)=>n+i.count,0)).toBe(3);expect(tileAt(d.w,hound.pos).items.some(i=>i.def==='Item.RawRatMeat')).toBe(false)
 })
 it('실제 굴쥐 원본 한 개를200턴 구워야만 새 구운 고기가 생긴다',()=>{
  const d=ratFoodFixture();d.meat.freshness=73;d.meat.contaminantAsh=.2;d.meat.foodThawed=true;expect(perform(d.w,d.p,{type:'cook',uid:d.meat.uid}).ok).toBe(true);for(let n=0;n<199;n++)activityStep(d.w,d.p);expect(d.p.bag.find(i=>i.uid===d.meat.uid)).toBeDefined();activityStep(d.w,d.p);expect(d.p.bag.some(i=>i.uid===d.meat.uid)).toBe(false);const cooked=d.p.bag.find(i=>i.def==='Item.CookedRatMeat')!;expect(cooked.count).toBe(1);expect(cooked.freshness).toBe(73);expect(cooked.contaminantAsh).toBe(.2);expect(cooked.foodThawed).toBe(true);expect(d.w.db.item(cooked.def).food).toMatchObject({kcal:90,protein:18,vitamin:.5,water:40,freshHours:24});expect(d.w.db.item(cooked.def).food?.rawDisease).toBeUndefined();expect(d.p.needs.kcal).toBe(0)
 })
 it('원래 날고기를 먹은 당사자에게만 실제 음식UID를 원인으로1~3일 잠복 쥐열을 남긴다',()=>{
  const d=ratFoodFixture();risk(d);const original=d.meat.uid,def=d.meat.def,before=structuredClone(d.p.body.wounds)
  expect(consumeFor(d.w,d.p,d.p,original).ok).toBe(true);const disease=d.p.diseases!.find(s=>s.def==='Disease.RatFever')!;expect(disease.source).toEqual({kind:'실제 날고기 섭취',turn:turnOf(d.w),itemUid:original,foodDef:def});expect(disease.incubatesUntil-turnOf(d.w)).toBeGreaterThanOrEqual(TURNS_PER_DAY);expect(disease.incubatesUntil-turnOf(d.w)).toBeLessThanOrEqual(3*TURNS_PER_DAY);expect(d.p.body.wounds).toEqual(before);expect(d.p.bag.some(i=>i.uid===original)).toBe(false)
 })
 it('다른 실제 섭취자에게 건넨 원래 고기의 질병은 그 몸에만 생긴다',()=>{
  const d=ratFoodFixture();risk(d);const c=d.doctor();c.pos={x:22,y:20};expect(consumeFor(d.w,d.p,c,d.meat.uid).ok).toBe(true);expect(c.diseases?.find(s=>s.def==='Disease.RatFever')?.source?.itemUid).toBe(d.meat.uid);expect(d.p.diseases?.some(s=>s.def==='Disease.RatFever')).toBeFalsy()
 })
 it('먹기 전/조리만 했을 때는 질병을 만들거나 음식 노출 난수를 쓰지 않는다',()=>{
  const d=ratFoodFixture();risk(d);const before=structuredClone(d.s.rng);expect(d.p.diseases).toBeUndefined();perform(d.w,d.p,{type:'cook',uid:d.meat.uid});finishBase(d.w,d.p);expect(d.p.diseases).toBeUndefined();const other=Object.fromEntries(Object.entries(d.s.rng).filter(([key])=>key!=='cooking.'+d.meat.uid));expect(other).toEqual(before);expect(d.s.rng['cooking.'+d.meat.uid]).toBeDefined()
 })
 it('같은 원래 고기를 구워 먹으면 쥐열 노출 난수와 질병이 생기지 않는다',()=>{
  const d=ratFoodFixture();risk(d);perform(d.w,d.p,{type:'cook',uid:d.meat.uid});finishBase(d.w,d.p);const out=d.p.bag.find(i=>i.def==='Item.CookedRatMeat')!,before=structuredClone(d.s.rng);expect(consumeFor(d.w,d.p,d.p,out.uid).ok).toBe(true);expect(d.p.diseases).toBeUndefined();expect(d.s.rng).toEqual(before);expect(d.p.needs.vitamin).toBe(.5)
 })
 it('실제 노출확률0과 이미 면역인 몸은 새 질병 노출 난수를 소비하지 않는다',()=>{
  for(const variant of['zero','immune']){const d=ratFoodFixture();risk(d,variant==='zero'?0:1);if(variant==='immune')d.p.immuneDiseases=['Disease.RatFever'];const before=structuredClone(d.s.rng);consumeFor(d.w,d.p,d.p,d.meat.uid);expect(d.p.diseases).toBeUndefined();expect(d.s.rng).toEqual(before)}
 })
 it('이미 같은 질병이 있는 몸에 같은 음식으로 잠복 시각을 다시 뽑지 않는다',()=>{
  const d=ratFoodFixture();risk(d);d.p.diseases=[{def:'Disease.RatFever',progress:10,immunity:0,incubatesUntil:turnOf(d.w)+1000}];const before=structuredClone(d.p.diseases),rng=structuredClone(d.s.rng);consumeFor(d.w,d.p,d.p,d.meat.uid);expect(d.p.diseases).toEqual(before);expect(d.s.rng).toEqual(rng)
 })
 it('실제 음식 질병도 잠복 중 통증 없이 같은 시각에 발병/관절통을 시작한다',()=>{
  const d=ratFoodFixture();risk(d);consumeFor(d.w,d.p,d.p,d.meat.uid);const s=d.p.diseases![0];expect(diseasePain(d.w,d.p)).toBe(0);d.s.time=s.incubatesUntil*100;diseaseTick(d.w,d.p,false);expect(diseasePain(d.w,d.p)).toBe(10);expect(s.source?.itemUid).toBe(d.meat.uid)
 })
 it('원래 고기 조리 중 전체 저장은 같은 재료/신선도/몸과 결과를 보존한다',()=>{
  const d=ratFoodFixture();perform(d.w,d.p,{type:'cook',uid:d.meat.uid});activityStep(d.w,d.p);const copy={db:d.w.db,s:deserialize(serialize(d.s))};for(const w of[d.w,copy])finishBase(w,w.s.creatures.find(c=>c.id===w.s.playerId)!);expect(copy.s).toEqual(JSON.parse(serialize(d.s)))
 })
 it('먹고 없어진 원래 음식UID와 실제 잠복 시각도 전체 각인에 남는다',()=>{
  const d=ratFoodFixture();risk(d);consumeFor(d.w,d.p,d.p,d.meat.uid);expect(deserialize(serialize(d.s))).toEqual(JSON.parse(serialize(d.s)))
 })
 it('구형74의 기존 생고기에 과거 굴쥐 종이나 질병 노출을 지어내지 않는다',()=>{
  const d=clinicalDiseaseFixture(),meat=d.add('Item.RawMeat'),old=JSON.parse(serialize(d.s));old.version=74;const restored=deserialize(JSON.stringify(old));expect({...restored,version:74}).toEqual(old);expect(restored.version).toBe(SAVE_VERSION);expect(restored.creatures.find(c=>c.id===d.p.id)!.bag.find(i=>i.uid===meat.uid)!.def).toBe('Item.RawMeat')
 })

})
describe('원래 개척 배급 팩·실제 개봉과 같은 빈 포장',()=>{
 it('맨손 견적/섭취 거절은 원래 밀봉 팩·몸·난수를 바꾸지 않는다',()=>{
  const d=rationFixture(false),hash=stateHash(d.s);expect(openFoodQuote(d.w,d.p,d.pack.uid).error).not.toBeNull();expect(consumeFor(d.w,d.p,d.p,d.pack.uid).ok).toBe(false);expect(stateHash(d.s)).toBe(hash)
 })
 it('실제2턴 개봉과 별도1턴 식사 후 같은 UID/품질/내구의 빈 포장이 남는다',()=>{
  const d=rationFixture(),uid=d.pack.uid,next=d.s.nextId;expect(consumeFor(d.w,d.p,d.p,uid).ok).toBe(true);activityStep(d.w,d.p);expect(d.pack.def).toBe('Item.RationPack');expect(d.p.needs.kcal).toBe(0);activityStep(d.w,d.p);expect(d.pack.def).toBe('Item.OpenedRationPack');expect(d.p.needs.kcal).toBe(0);activityStep(d.w,d.p);expect(d.pack.def).toBe('Item.EmptyRationWrapper');expect(d.pack.uid).toBe(uid);expect(d.pack.quality).toBe(2);expect(d.pack.durability).toBe(81);expect(d.p.needs.kcal).toBe(1200);expect(d.p.needs.vitamin).toBe(30);expect(d.s.nextId).toBe(next)
 })
 it('원래 칼이 사라지면 새 도구로 몰래 대입하지 않고 원래 팩을 남긴다',()=>{
  const d=rationFixture();startOpenFood(d.w,d.p,d.pack.uid);activityStep(d.w,d.p);d.p.bag=d.p.bag.filter(i=>i.uid!==d.blade!.uid);d.add('Item.RustyKnife');activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.pack.def).toBe('Item.RationPack');expect(d.p.needs.kcal).toBe(0)
 })
 it('밀봉은 보존되지만 실제 개봉한 뒤15°C7일에 같은 내용물이 상한다',()=>{
  const d=rationFixture();ageFood(d.w,d.pack,15,1000*TURNS_PER_HOUR);expect(d.pack.freshness).toBeUndefined();startOpenFood(d.w,d.p,d.pack.uid);finishBase(d.w,d.p);expect(d.pack.freshness).toBe(100);ageFood(d.w,d.pack,15,168*TURNS_PER_HOUR);expect(d.pack.freshness).toBe(0)
 })
 it('실제 원래 다른 섭취자만 한 회분1200kcal/비타민30을 받는다',()=>{
  const d=rationFixture(),c=d.doctor();c.needs.kcal=0;c.needs.vitamin=0;consumeFor(d.w,d.p,c,d.pack.uid);finishBase(d.w,d.p);expect(c.needs.kcal).toBe(1200);expect(c.needs.vitamin).toBe(30);expect(d.p.needs.kcal).toBe(0);expect(d.pack.def).toBe('Item.EmptyRationWrapper')
 })
 it('마지막 같은 빈 포장은 더 먹거나 원래 영양/물품을 다시 만들 수 없다',()=>{
  const d=rationFixture();consumeFor(d.w,d.p,d.p,d.pack.uid);finishBase(d.w,d.p);const hash=stateHash(d.s);expect(consumeFor(d.w,d.p,d.p,d.pack.uid).ok).toBe(false);expect(stateHash(d.s)).toBe(hash)
 })
 it('원래 팩의 개봉/식사 경계 전체 저장은 정확히 한 회분과 같은 빈 포장을 잇는다',()=>{
  const d=rationFixture();consumeFor(d.w,d.p,d.p,d.pack.uid);activityStep(d.w,d.p);activityStep(d.w,d.p);const copy={db:d.w.db,s:deserialize(serialize(d.s))};for(const w of[d.w,copy])finishBase(w,w.s.creatures.find(c=>c.id===w.s.playerId)!);expect(copy.s).toEqual(JSON.parse(serialize(d.s)));expect(d.pack.def).toBe('Item.EmptyRationWrapper')
 })
 it('실제 길드의 유한 배급 팩을 원래 현금으로 한 개만 산다',()=>{
  const d=firstImpressionsFixture('guild');d.p.money=1000;const pack=d.market.items.find(i=>i.def==='Item.RationPack')!,uid=pack.uid,cash=d.p.money+d.market.money;expect(pack.count).toBe(1);expect(exchange(d.w,d.p,d.trader,[{uid,count:1}],[])).toBeNull();expect(d.p.money!+d.market.money).toBe(cash);expect(d.market.items.some(i=>i.uid===uid)).toBe(false);expect(d.p.bag.filter(i=>i.def==='Item.RationPack').reduce((n,i)=>n+i.count,0)).toBe(1);const hash=stateHash(d.s);expect(exchange(d.w,d.p,d.trader,[{uid,count:1}],[])).not.toBeNull();expect(stateHash(d.s)).toBe(hash)
 })
})
