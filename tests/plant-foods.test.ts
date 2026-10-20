import {SAVE_VERSION} from '../src/core/game'
import {firstImpressionsFixture}from'./first-impressions-fixture'
import {exchange}from'../src/core/economy'
import {describe,expect,it}from'vitest'
import {activityStep,perform,consumeFor}from'../src/core/actions'
import {calendar,seasons}from'../src/core/climate-state'
import {nearbyGather,startGather}from'../src/core/crafting'
import {gatherSeasonError,nearbySeasonalGather,seasonalGatherError}from'../src/core/gather-state'
import {plantPines}from'../src/core/pines'
import {tileAt,turnOf,TURNS_PER_DAY,TURNS_PER_HOUR}from'../src/core/ctx'
import {ageFood}from'../src/core/food-safety'
import {foodPoisonRisk}from'../src/core/food-state'
import {deserialize,serialize,stateHash}from'../src/core/save'
import {makeItem}from'../src/core/items'
import {loadMods}from'../src/core/defs'
import {readPackages}from'../tools/loadContent'
import {finishBase}from'./base-camp-fixture'
import {plantFoodsFixture as setup}from'./plant-foods-fixture'
describe('실제 밭작물·여름 열매와 유한 치즈',()=>{
 it('여름 견적은 실제 계절과 원래 덤불을 읽고 상태·난수·UID를 바꾸지 않는다',()=>{
  const d=setup(),hash=stateHash(d.s);expect(calendar(d.w).season.id).toBe('Season.Summer');expect(nearbySeasonalGather(d.w,d.p)).toContainEqual(d.bush);expect(seasonalGatherError(d.w,d.bush)).toBeNull();expect(nearbyGather(d.w,d.p)).toContainEqual(d.bush);expect(stateHash(d.s)).toBe(hash)
 })
 it('봄·가을·겨울의 같은 덤불은 실제 열매/재생 시각을 만들지 않는다',()=>{
  for(const season of['Season.Spring','Season.Autumn','Season.Winter']){const d=setup(season),hash=stateHash(d.s);expect(gatherSeasonError(d.w,d.w.db.terrain('Terrain.AshBerryBush'))).not.toBeNull();expect(nearbyGather(d.w,d.p)).not.toContainEqual(d.bush);expect(startGather(d.w,d.p,d.bush,1)).not.toBeNull();expect(stateHash(d.s)).toBe(hash)}
 })
 it('실제12턴 마지막에만 원래 덤불의 열매5개를 얻고2일 재생 시각을 남긴다',()=>{
  const d=setup(),next=d.s.nextId;expect(startGather(d.w,d.p,d.bush,1)).toBeNull();for(let n=0;n<11;n++)activityStep(d.w,d.p);expect(d.p.bag.some(i=>i.def==='Item.AshBerry')).toBe(false);activityStep(d.w,d.p);expect(d.p.bag.filter(i=>i.def==='Item.AshBerry').reduce((n,i)=>n+i.count,0)).toBe(5);expect(tileAt(d.w,d.bush).gatherAt).toBe(turnOf(d.w)+2*TURNS_PER_DAY);expect(d.s.nextId).toBe(next+1);expect(startGather(d.w,d.p,d.bush,1)).not.toBeNull()
 })
 it('실제 재생 시각 전에는 다시 딸 수 없고 두 날 뒤에만 다음 열매가 열린다',()=>{
  const d=setup();startGather(d.w,d.p,d.bush,1);finishBase(d.w,d.p);const target=tileAt(d.w,d.bush).gatherAt!;d.s.time=(target-1)*100;expect(startGather(d.w,d.p,d.bush,1)).not.toBeNull();d.s.time=target*100;expect(startGather(d.w,d.p,d.bush,1)).toBeNull();finishBase(d.w,d.p);expect(d.p.bag.filter(i=>i.def==='Item.AshBerry').reduce((n,i)=>n+i.count,0)).toBe(10)
 })
 it('여름 끝에 시작해도 가을이 오면 실제 열매와 재생 시각 없이 중단한다',()=>{
  const d=setup(),days=seasons(d.w).find(s=>s.id==='Season.Summer')!.lengthDays;d.s.time+=(days-1)*TURNS_PER_DAY*100+(TURNS_PER_DAY-12*1200-1)*100;expect(calendar(d.w).season.id).toBe('Season.Summer');expect(startGather(d.w,d.p,d.bush,1)).toBeNull();activityStep(d.w,d.p);d.s.time+=100;expect(calendar(d.w).season.id).toBe('Season.Autumn');activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.p.bag.some(i=>i.def==='Item.AshBerry')).toBe(false);expect(tileAt(d.w,d.bush).gatherAt).toBeUndefined()
 })
 it('채집 중 원래 덤불이 사라지거나 다른 채집 규칙이 되면 열매를 생성하지 않는다',()=>{
  const d=setup();startGather(d.w,d.p,d.bush,1);activityStep(d.w,d.p);tileAt(d.w,d.bush).t='Terrain.Tree';finishBase(d.w,d.p);expect(d.p.bag.some(i=>i.def==='Item.AshBerry')).toBe(false);expect(d.p.bag.some(i=>i.def==='Item.Wood')).toBe(false);expect(tileAt(d.w,d.bush).gatherAt).toBeUndefined()
 })
 it('채집을 중단하면 미리 열매나 재생 시각을 주지 않고12턴부터 다시 시작한다',()=>{
  const d=setup();startGather(d.w,d.p,d.bush,1);activityStep(d.w,d.p);d.p.activity=undefined;expect(startGather(d.w,d.p,d.bush,1)).toBeNull();expect(d.p).toHaveProperty('activity.remaining',12);expect(d.p.bag.some(i=>i.def==='Item.AshBerry')).toBe(false)
 })
 it('덤불은 원래 흙의 충돌·이동·소음·시야와 토양 성질을 보존한다',()=>{
  const d=setup(),earth=d.w.db.terrain('Terrain.Earth'),bush=d.w.db.terrain('Terrain.AshBerryBush');for(const key of['passable','opaque','moveMult','noiseMult','soil']as const)expect(bush[key]).toBe(earth[key])
 })
 it('실제 여름 열매의 한 개만50kcal/비타민10/수분80ml를 준다',()=>{
  const d=setup();startGather(d.w,d.p,d.bush,1);finishBase(d.w,d.p);const berry=d.p.bag.find(i=>i.def==='Item.AshBerry')!;d.p.needs.waterDeficit=1000;expect(consumeFor(d.w,d.p,d.p,berry.uid).ok).toBe(true);expect(berry.count).toBe(4);expect(d.p.needs.kcal).toBe(50);expect(d.p.needs.vitamin).toBe(10);expect(d.p.needs.waterDeficit).toBe(920)
 })
 it('열매는15°C의 실제3일에 상하며 겨울 생성에 과거 열매를 추가하지 않는다',()=>{
  const d=setup(),berry=d.add('Item.AshBerry');ageFood(d.w,berry,15,72*TURNS_PER_HOUR);expect(berry.freshness).toBe(0);const winter=setup('Season.Winter');expect(winter.p.bag.some(i=>i.def==='Item.AshBerry')).toBe(false)
 })
 it('신선한 생감자는 싹 위험 없이 읽고 싹 난 상태는 기존 부패 위험에10%를 더한다',()=>{
  const d=setup(),it=d.add('Item.RawPotato');expect(foodPoisonRisk(d.w,d.p,it)).toBe(0);it.freshness=60;const risk=foodPoisonRisk(d.w,d.p,it);expect(risk).toBeCloseTo(.15,12);const db=loadMods([...readPackages(),{manifest:{id:'no.sprouts',name:'싹 비교',version:'1'},defs:[],patches:[{op:'replace',target:'Item.RawPotato',path:'/food/sprouts/risk',value:0}]}],['no.sprouts']).db;expect(risk-foodPoisonRisk({...d.w,db},d.p,it)).toBeCloseTo(.1,12)
 })
 it('실제 감자 한 개를200턴 구워도 원래 신선도/재/해동 손상을 지우지 않는다',()=>{
  const d=setup(),raw=d.add('Item.RawPotato',2);raw.freshness=50;raw.contaminantAsh=.4;raw.foodThawed=true;expect(perform(d.w,d.p,{type:'cook',uid:raw.uid}).ok).toBe(true);for(let n=0;n<199;n++)activityStep(d.w,d.p);expect(raw.count).toBe(2);activityStep(d.w,d.p);const out=d.p.bag.find(i=>i.def==='Item.BakedPotato')!;expect(raw.count).toBe(1);expect(out.freshness).toBe(50);expect(out.contaminantAsh).toBe(.4);expect(out.foodThawed).toBe(true);expect(d.w.db.item(out.def).food).toMatchObject({kcal:150,protein:4,vitamin:4,water:120});expect(d.w.db.item(out.def).food?.sprouts).toBeUndefined()
 })
 it('음식을 굽기만 해서는 몸에 열량/비타민을 미리 주지 않는다',()=>{
  const d=setup(),raw=d.add('Item.RawPotato');perform(d.w,d.p,{type:'cook',uid:raw.uid});finishBase(d.w,d.p);expect(d.p.needs.kcal).toBe(0);expect(d.p.needs.vitamin).toBe(0)
 })
 it('구운 감자/순무/치즈는03의 실제 한 회분만 소비한다',()=>{
  for(const [def,kcal,vit,ml]of[['Item.BakedPotato',150,4,120],['Item.Turnip',60,6,180],['Item.Cheese',400,1,35]]as const){const d=setup(),it=d.add(def,2);d.p.needs.waterDeficit=1000;expect(consumeFor(d.w,d.p,d.p,it.uid).ok).toBe(true);expect(it.count).toBe(1);expect(d.p.needs.kcal).toBe(kcal);expect(d.p.needs.vitamin).toBe(vit);expect(d.p.needs.waterDeficit).toBe(1000-ml)}
 })
 it('실제 원래 다른 섭취자에게 전달한 순무만 그 몸의 영양/수분을 바꾼다',()=>{
  const d=setup(),it=d.add('Item.Turnip'),c=d.doctor();c.needs.kcal=0;c.needs.vitamin=0;c.needs.waterDeficit=1000;expect(consumeFor(d.w,d.p,c,it.uid).ok).toBe(true);expect(c.needs.kcal).toBe(60);expect(c.needs.vitamin).toBe(6);expect(c.needs.waterDeficit).toBe(820);expect(d.p.needs.kcal).toBe(0)
 })
 it('생감자/순무/치즈는 실제30/21/60일 신선 기간을 쓴다',()=>{
  const d=setup();for(const[def,days]of[['Item.RawPotato',30],['Item.Turnip',21],['Item.Cheese',60]]as const){const it=makeItem(d.w,def);ageFood(d.w,it,15,days*24*TURNS_PER_HOUR);expect(it.freshness).toBeCloseTo(0,12)}
 })
 it('실제 감자/순무 종자를 흙에 심고 성장 전 거절/원래5개 수확을 연결한다',()=>{
  for(const[seed,plot,out]of[['Item.PotatoSeed','Terrain.PotatoPlot','Item.RawPotato'],['Item.TurnipSeed','Terrain.TurnipPlot','Item.Turnip']]as const){const d=setup(),it=d.add(seed),pos={x:20,y:19};expect(perform(d.w,d.p,{type:'place',uid:it.uid,dir:0}).ok).toBe(true);const tile=tileAt(d.w,pos);expect(tile.t).toBe(plot);expect(startGather(d.w,d.p,pos,1)).not.toBeNull();d.s.time=tile.gatherAt!*100;expect(startGather(d.w,d.p,pos,1)).toBeNull();finishBase(d.w,d.p);expect(d.p.bag.filter(i=>i.def===out).reduce((n,i)=>n+i.count,0)).toBe(5)}
 })
 it('돌바닥에는 실제 종자를 잃지 않고 심기를 거절한다',()=>{
  const d=setup(),it=d.add('Item.PotatoSeed'),pos={x:20,y:19};tileAt(d.w,pos).t='Terrain.KtFloor';const hash=stateHash(d.s);expect(perform(d.w,d.p,{type:'place',uid:it.uid,dir:0}).ok).toBe(false);expect(stateHash(d.s)).toBe(hash)
 })
 it('열매/작물 진행 중 전체 저장은 같은 수확·원래 재생 시각과 몸·난수를 잇는다',()=>{
  const d=setup();startGather(d.w,d.p,d.bush,1);activityStep(d.w,d.p);const copy={db:d.w.db,s:deserialize(serialize(d.s))};for(const w of[d.w,copy])finishBase(w,w.s.creatures.find(c=>c.id===w.s.playerId)!);expect(copy.s).toEqual(JSON.parse(serialize(d.s)))
 })
 it('새 덤불 생성은 독립 난수만 사용하고 나머지 지도 전체 상태를 보존한다',()=>{
  const d=setup(),map=structuredClone(d.s.map);for(const t of map.tiles){if(t.t==='Terrain.PineTree')t.t='Terrain.Tree';if(t.t==='Terrain.AshBerryBush')t.t='Terrain.Earth'}const original=structuredClone(map),before=structuredClone(d.s.rng);plantPines(d.w,map,'world.botany.food-test');for(const t of map.tiles){if(t.t==='Terrain.PineTree')t.t='Terrain.Tree';if(t.t==='Terrain.AshBerryBush')t.t='Terrain.Earth'}expect(map).toEqual(original);for(const [key,value]of Object.entries(before))expect(d.s.rng[key]).toEqual(value);expect(d.s.rng['world.botany.food-test.forage']).toBeDefined()
 })
 it('실제 연합의 새 음식/종자를 유한 원래 재고와 현금으로 구입한다',()=>{
  const d=firstImpressionsFixture();d.p.money=1000;const cash=d.p.money+d.market.money,defs=['Item.RawPotato','Item.PotatoSeed','Item.Turnip','Item.TurnipSeed','Item.Cheese'],original=defs.map(def=>d.market.items.find(i=>i.def===def)!),before=original.map(i=>i.count)
  expect(original.every(Boolean)).toBe(true);expect(exchange(d.w,d.p,d.trader,original.map(i=>({uid:i.uid,count:1})),[])).toBeNull();expect(d.p.money!+d.market.money).toBe(cash)
  original.forEach((i,n)=>expect(d.market.items.find(row=>row.uid===i.uid)!.count).toBe(before[n]!-1));for(const def of defs)expect(d.p.bag.some(i=>i.def===def)).toBe(true)
 })
 it('원래 치즈 재고를 모두 산 뒤에는 같은 재고UID로 현금/치즈를 복제하지 않는다',()=>{
  const d=firstImpressionsFixture();d.p.money=1000;const cheese=d.market.items.find(i=>i.def==='Item.Cheese')!,uid=cheese.uid,count=cheese.count
  expect(exchange(d.w,d.p,d.trader,[{uid,count}],[])).toBeNull();expect(d.p.bag.filter(i=>i.def==='Item.Cheese').reduce((n,i)=>n+i.count,0)).toBe(count);expect(d.market.items.some(i=>i.uid===uid)).toBe(false);const hash=stateHash(d.s);expect(exchange(d.w,d.p,d.trader,[{uid,count:1}],[])).not.toBeNull();expect(stateHash(d.s)).toBe(hash)
 })
 it('구형73은 같은 원래 지도/몸/물품을 보존하며 과거 덤불·열매를 만들지 않는다',()=>{
  const d=setup(),old=JSON.parse(serialize(d.s));old.version=73;const restored=deserialize(JSON.stringify(old));expect({...restored,version:73}).toEqual(old);expect(restored.version).toBe(SAVE_VERSION)
 })

})
