import{createHash}from'node:crypto'
import{canonicalContent}from'../src/core/load-hash'
import {SAVE_VERSION} from '../src/core/game'
import {describe,expect,it} from 'vitest'
import {activityStep,consumeFor} from '../src/core/actions'
import {brewQuote,startBrew} from '../src/core/brewing'
import {campfireAt,extinguishCampfire} from '../src/core/campfire'
import {nearbyPines,needlesQuote,plantPines,startNeedles} from '../src/core/pines'
import {tileAt,turnOf,TURNS_PER_HOUR} from '../src/core/ctx'
import {ageFood} from '../src/core/food-safety'
import {foodPoisonRisk} from '../src/core/food-state'
import {makeItem} from '../src/core/items'
import {drinkVolume,spendDrinkVolume,spendWashWater} from '../src/core/wash-water'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {newGame,playerAct} from '../src/core/game'
import {waterPourQuote} from '../src/core/water-transfer'
import {finishBase} from './base-camp-fixture'
import {pineTeaFixture as setup} from './pine-tea-fixture'
function brew(d:ReturnType<typeof setup>){expect(startBrew(d.w,d.p,d.bottle.uid,d.leaves.uid)).toBeNull();finishBase(d.w,d.p)}
describe('실제 소나무·원래 물병과 유한 장작불의 솔잎차',()=>{
 it('견적은 실제 물/솔잎4묶음과10분을 읽고 상태·난수·UID를 바꾸지 않는다',()=>{
  const d=setup(),hash=stateHash(d.s),q=brewQuote(d.w,d.p,d.bottle.uid,d.leaves.uid)
  expect(q.error).toBeNull();expect(q.ml).toBe(1000);expect(q.turns).toBe(200);expect(q.leaves).toEqual([{uid:d.leaves.uid,def:'Item.PineNeedles',count:4}]);expect(stateHash(d.s)).toBe(hash)
 })
 it('모드의600ml 물병도 실제 남은600ml/솔잎2묶음만 사용한다',()=>{
  const d=setup(600),loaded=loadMods([...readPackages(),{manifest:{id:'small.tea.bottle',name:'작은 병',version:'1'},defs:[],patches:[{op:'replace',target:'Item.WaterBottle',path:'/uses',value:3},{op:'replace',target:'Item.DirtyWaterBottle',path:'/uses',value:3}]}],['small.tea.bottle']);expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;brew(d);expect(drinkVolume(d.w,d.bottle)).toBe(600);expect(d.leaves.count).toBe(8)
 })
 it('모드의 큰 물병에 담긴 물이 차 용량을 넘으면 자원을 소비하지 않는다',()=>{
  const d=setup(),loaded=loadMods([...readPackages(),{manifest:{id:'large.tea.bottle',name:'큰 병',version:'1'},defs:[],patches:[{op:'replace',target:'Item.DirtyWaterBottle',path:'/uses',value:6},{op:'replace',target:'Item.WaterBottle',path:'/uses',value:6}]}],['large.tea.bottle']);expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;d.bottle.uses=6;const hash=stateHash(d.s);expect(startBrew(d.w,d.p,d.bottle.uid,d.leaves.uid)).not.toBeNull();expect(stateHash(d.s)).toBe(hash)
 })
 it('실제199턴에는 물/솔잎/영양을 소비하지 않고 마지막에만 같은 물병으로 끓인다',()=>{
  const d=setup(),id=d.s.nextId;expect(startBrew(d.w,d.p,d.bottle.uid,d.leaves.uid)).toBeNull()
  for(let i=0;i<199;i++)activityStep(d.w,d.p)
  expect(d.bottle.def).toBe('Item.DirtyWaterBottle');expect(d.leaves.count).toBe(10);expect(d.p.needs.vitamin).toBe(0);activityStep(d.w,d.p)
  expect(d.bottle.def).toBe('Item.PineTeaBottle');expect(d.leaves.count).toBe(6);expect(drinkVolume(d.w,d.bottle)).toBe(1000);expect(d.bottle.quality).toBe(3);expect(d.bottle.durability).toBe(81);expect(d.s.nextId).toBe(id)
 })
 it('300ml에 실제 솔잎1묶음을 쓰고 원래 재/염분을 보존하며 병원체만 끓인다',()=>{
  const d=setup(300);brew(d);expect(d.leaves.count).toBe(9);expect(drinkVolume(d.w,d.bottle)).toBe(300);expect(d.bottle.water).toEqual({pathogen:0,ash:.22,salinity:3,source:'물 · 끓임'});expect(d.bottle.freshness).toBe(100);expect(d.bottle.foodAgedAt).toBe(turnOf(d.w))
 })
 it('정적 무료 화덕·꺼진 불·실제 부족한 솔잎은 원본 물/몸/시각을 소비하지 않는다',()=>{
  for(const variant of ['static','out','leaves']){const d=setup(1000,variant!=='static');if(variant==='out')extinguishCampfire(d.w,d.p,d.pos);if(variant==='leaves')d.leaves.count=3;const hash=stateHash(d.s);expect(startBrew(d.w,d.p,d.bottle.uid,d.leaves.uid)).not.toBeNull();expect(stateHash(d.s)).toBe(hash)}
 })
 it('빈 병·300ml 미만·얼어 있는 병·겹친 병에는 차를 만들지 않는다',()=>{
  for(const variant of ['empty','small','frozen','stack']){const d=setup();if(variant==='empty')d.bottle.uses=0;if(variant==='small')d.bottle.uses=1;if(variant==='frozen')d.bottle.waterFrozen=true;if(variant==='stack')d.bottle.count=2;expect(brewQuote(d.w,d.p,d.bottle.uid,d.leaves.uid).error).not.toBeNull()}
 })
 it('끓이는 중 물·수질·원래 솔잎·불 UID가 바뀌면 재료를 소비하지 않는다',()=>{
  for(const variant of ['water','quality','leaves','fire']){const d=setup();startBrew(d.w,d.p,d.bottle.uid,d.leaves.uid);activityStep(d.w,d.p);if(variant==='water')d.bottle.uses=4;if(variant==='quality')d.bottle.water!.ash=.3;if(variant==='leaves')d.leaves.uid+=100;if(variant==='fire'){const f=campfireAt(d.w,d.pos)!;f.tile.placed!.item.uid+=100;f.light.sourceUid=f.tile.placed!.item.uid}finishBase(d.w,d.p);expect(d.bottle.def).toBe('Item.DirtyWaterBottle');expect(d.leaves.count).toBe(10)}
 })
 it('실제 불이 꺼지면 중단하고 다른 불이나 재시도로 과거200턴을 채우지 않는다',()=>{
  const d=setup();startBrew(d.w,d.p,d.bottle.uid,d.leaves.uid);activityStep(d.w,d.p);extinguishCampfire(d.w,d.p,d.pos);finishBase(d.w,d.p);expect(d.bottle.def).toBe('Item.DirtyWaterBottle');expect(d.leaves.count).toBe(10)
 })
 it('사용자가 중단하면 원래 물과 솔잎이 남고 남은199턴을 이어 간다',()=>{
  const d=setup();startBrew(d.w,d.p,d.bottle.uid,d.leaves.uid);activityStep(d.w,d.p);expect(playerAct(d.w,{type:'stopActivity'})).toBeNull();expect(d.bottle.def).toBe('Item.DirtyWaterBottle');expect(d.leaves.count).toBe(10);expect(startBrew(d.w,d.p,d.bottle.uid,d.leaves.uid)).toBeNull();expect(d.p.activity!.total).toBe(200);expect(d.p.activity!.remaining).toBe(199)
 })
 it('1000ml의 세 잔과 마지막100ml는 정확한20비타민·50/3kcal와 같은 빈 병을 남긴다',()=>{
  const d=setup(),uid=d.bottle.uid;brew(d);d.bottle.water={pathogen:0,ash:0};d.p.needs.waterDeficit=1500
  for(const ml of [700,400,100]){expect(consumeFor(d.w,d.p,d.p,uid).ok).toBe(true);expect(drinkVolume(d.w,d.bottle)).toBe(ml)}
  expect(d.p.needs.vitamin).toBe(18);expect(consumeFor(d.w,d.p,d.p,uid).ok).toBe(true)
  expect(d.p.needs.vitamin).toBe(20);expect(d.p.needs.kcal).toBeCloseTo(50/3,12);expect(d.p.needs.waterDeficit).toBe(500);expect(d.bottle.def).toBe('Item.WaterBottle');expect(d.bottle.uid).toBe(uid);expect(d.bottle.uses).toBe(0);expect(d.bottle.water).toBeUndefined();expect(d.bottle.freshness).toBeUndefined();expect(d.p.bag.find(i=>i.uid===uid)).toBe(d.bottle);expect(consumeFor(d.w,d.p,d.p,uid).ok).toBe(false)
 })
 it('마지막 차를 씻기에 써도 비타민을 얻지 않고 같은 빈 물병을 보존한다',()=>{
  const d=setup(300);brew(d);expect(spendWashWater(d.w,d.p,300)).toBe(true);expect(d.bottle.def).toBe('Item.WaterBottle');expect(d.bottle.uses).toBe(0);expect(d.p.needs.vitamin).toBe(0);expect(d.p.bag).toContain(d.bottle)
 })
 it('차를 조금 덜어 써도 실제 남은ml만 남고 영양을 미리 주지 않는다',()=>{
  const d=setup(1000);brew(d);expect(spendDrinkVolume(d.w,d.bottle,100)).toBe(100);expect(drinkVolume(d.w,d.bottle)).toBe(900);expect(d.p.needs.vitamin).toBe(0)
 })
 it('솔잎차는 일반 물 붓기로 비타민을 복제하지 않는다',()=>{
  const d=setup();brew(d);const target=d.add('Item.WaterBottle');target.uses=0;expect(waterPourQuote(d.w,d.p,d.bottle.uid,target.uid,300).error).not.toBeNull()
 })
 it('15°C에서6시간 부패하고 원래 차의 식중독 위험을 계산한다',()=>{
  const d=setup();brew(d);ageFood(d.w,d.bottle,15,6*TURNS_PER_HOUR);expect(d.bottle.freshness).toBe(0);expect(foodPoisonRisk(d.w,d.p,d.bottle)).toBeGreaterThan(0);const ordinary=makeItem(d.w,'Item.WaterBottle');ageFood(d.w,ordinary,15,6*TURNS_PER_HOUR);expect(ordinary.freshness).toBeUndefined()
 })
 it('다른 실제 섭취자의 몸에만 한 잔과 재/염분을 전달한다',()=>{
  const d=setup(300);brew(d);const c=d.doctor();c.needs.vitamin=0;c.needs.kcal=0;c.needs.ash=0;c.needs.waterDeficit=1000
  expect(consumeFor(d.w,d.p,c,d.bottle.uid).ok).toBe(true);expect(c.needs.vitamin).toBe(6);expect(c.needs.kcal).toBe(5);expect(c.needs.ash).toBeGreaterThan(0);expect(c.needs.waterDeficit).toBeGreaterThan(700);expect(d.p.needs.vitamin).toBe(0)
 })
 it('진행 중 전체 각인은 원래 물/솔잎/불과 마지막 완료를 동일하게 복원한다',()=>{
  const d=setup();startBrew(d.w,d.p,d.bottle.uid,d.leaves.uid);activityStep(d.w,d.p);const copy={db:d.w.db,s:deserialize(serialize(d.s))};for(const w of[d.w,copy])finishBase(w,w.s.creatures.find(c=>c.id===w.s.playerId)!);expect(copy.s).toEqual(JSON.parse(serialize(d.s)));expect(copy.s.version).toBe(SAVE_VERSION)
 })
 it('부분 섭취 전체 각인에서도 마지막100ml/원래 빈 병이 한 번만 남는다',()=>{
  const d=setup();brew(d);for(let n=0;n<3;n++)consumeFor(d.w,d.p,d.p,d.bottle.uid);const copy={db:d.w.db,s:deserialize(serialize(d.s))};for(const w of[d.w,copy]){const p=w.s.creatures.find(c=>c.id===w.s.playerId)!;consumeFor(w,p,p,d.bottle.uid)}expect(copy.s).toEqual(JSON.parse(serialize(d.s)))
 })
 it('구형71을 열어도 과거 차·솔잎·소나무를 만들지 않는다',()=>{
  const d=setup(),old=JSON.parse(serialize(d.s));old.version=71;const restored=deserialize(JSON.stringify(old));expect({...restored,version:71}).toEqual(old)
 })
 it('실제 소나무는 원래 목재·충돌·엄폐를 보존하고 죽은 나무에는 솔잎이 없다',()=>{
  const d=setup(),pine=d.w.db.terrain('Terrain.PineTree'),dead=d.w.db.terrain('Terrain.Tree');expect(pine.gather).toEqual(dead.gather);for(const k of['passable','opaque','cover']as const)expect(pine[k]).toBe(dead[k]);expect(nearbyPines(d.w,d.p)).toContainEqual(d.pine);tileAt(d.w,d.pine).t='Terrain.Tree';expect(needlesQuote(d.w,d.p,d.pine).error).not.toBeNull()
 })
 it('실제20턴 마지막에만4묶음을 채집하고 목재 재생 시각을 바꾸지 않는다',()=>{
  const d=setup();d.p.bag=d.p.bag.filter(i=>i.uid!==d.leaves.uid);const tile=tileAt(d.w,d.pine);tile.gatherAt=123
  expect(startNeedles(d.w,d.p,d.pine)).toBeNull();for(let n=0;n<19;n++)activityStep(d.w,d.p);expect(d.p.bag.some(i=>i.def==='Item.PineNeedles')).toBe(false);activityStep(d.w,d.p);expect(d.p.bag.filter(i=>i.def==='Item.PineNeedles').reduce((n,i)=>n+i.count,0)).toBe(4);expect(tile.gatherAt).toBe(123);expect(tile.needleGatherAt).toBe(turnOf(d.w)+28800);expect(startNeedles(d.w,d.p,d.pine)).not.toBeNull();d.s.time+=28800*100;expect(startNeedles(d.w,d.p,d.pine)).toBeNull()
 })
 it('채집 중 원래 나무가 사라지면 솔잎이나 재생 시각을 생성하지 않는다',()=>{
  const d=setup();startNeedles(d.w,d.p,d.pine);activityStep(d.w,d.p);tileAt(d.w,d.pine).t='Terrain.Earth';finishBase(d.w,d.p);expect(d.leaves.count).toBe(10);expect(tileAt(d.w,d.pine).needleGatherAt).toBeUndefined()
 })
 it('소나무 생성은 별도 난수만 쓰며 원래 지도 기하와 다른 모든 상태를 보존한다',()=>{
  const d=setup(),map=structuredClone(d.s.map),before=structuredClone(d.s.rng);for(const t of map.tiles)if(t.t==='Terrain.PineTree')t.t='Terrain.Tree';for(const t of map.tiles)if(t.t==='Terrain.AshBerryBush')t.t='Terrain.Earth';const original=structuredClone(map);plantPines(d.w,map,'world.botany.test');for(let n=0;n<map.tiles.length;n++){if(map.tiles[n].t==='Terrain.PineTree')map.tiles[n].t='Terrain.Tree';if(map.tiles[n].t==='Terrain.AshBerryBush')map.tiles[n].t='Terrain.Earth'}expect(map).toEqual(original);for(const [key,value]of Object.entries(before))expect(d.s.rng[key as keyof typeof before]).toEqual(value);expect(d.s.rng['world.botany.test']).toBeDefined()
 })
 it('새 지도 생성 전체 상태는 소나무 지형과 독립 난수 외 기존 생성과 같다',()=>{
  const d=setup(),packages=readPackages().map(p=>({...p,patches:p.patches?.filter(x=>!(x.target==='WorldGen.Hearth'&&x.path==='/pines'))})),base=loadMods(packages,[]).db,a=newGame(base,{seed:'actual-pine-generation',overworld:true}),b=newGame(d.w.db,{seed:'actual-pine-generation',overworld:true});for(const t of b.map.tiles)if(t.t==='Terrain.PineTree')t.t='Terrain.Tree';delete b.rng['world.botany.monastery'];expect(a.loadHash).toBe(base.loadHash);expect(b.loadHash).toBe(d.w.db.loadHash);expect(a.loadHash).not.toBe(b.loadHash);const record=(p:ReturnType<typeof readPackages>[number])=>({id:p.manifest.id,version:p.manifest.version,hash:'sha256-'+createHash('sha256').update(canonicalContent(p)).digest('hex')});expect(a.contentMods).toEqual([record(packages.find(p=>p.manifest.id==='core')!)]);expect(b.contentMods).toEqual([record(readPackages().find(p=>p.manifest.id==='core')!)]);expect(a.contentMods).not.toEqual(b.contentMods);const before=JSON.parse(serialize(a)),after=JSON.parse(serialize(b));delete before.loadHash;delete after.loadHash;delete before.contentMods;delete after.contentMods;expect(after).toEqual(before)
 })
 it('실제 끓이기 규칙이 바뀌면 원래 물병의 진행을 다른 결과에 사용하지 않는다',()=>{
  const d=setup();startBrew(d.w,d.p,d.bottle.uid,d.leaves.uid);d.w.db=loadMods([...readPackages(),{manifest:{id:'changed.tea',name:'바뀐 차',version:'1'},defs:[],patches:[{op:'replace',target:'Item.PineNeedles',path:'/brew/turns',value:201}]}]).db;finishBase(d.w,d.p);expect(d.bottle.def).toBe('Item.DirtyWaterBottle');expect(d.leaves.count).toBe(10)
 })
})
