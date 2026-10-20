import {describe,it,expect} from 'vitest'
import {cultivationNativeFixture} from './cultivation-fixture'
import {cultivationStatus,cultivationTick,cultivationWaterQuote,waterCultivation} from '../src/core/cultivation'
import {cropHarvestContaminants} from '../src/core/crop-contamination'
import {mergeFoodWater} from '../src/core/food-contamination'
import {tileAt,turnOf,type World} from '../src/core/ctx'
import {consumeFor} from '../src/core/actions'
import {playerAct,SAVE_VERSION} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {makeItem,addToBag,canStack} from '../src/core/items'
import {drinkVolume} from '../src/core/wash-water'
import {waterSafetyDef,treatedWater} from '../src/core/water-state'
import {startCraft,collectBatch,startGather} from '../src/core/crafting'
import {finishBase} from './base-camp-fixture'
import {boiledMealFixture} from './boiled-meal-fixture'
import {unheatedMealFixture} from './unheated-meal-fixture'
import {prepareUnheatedMeal} from '../src/core/unheated-meal'
import {cookingTick,takeCooking} from '../src/core/cooking'
import {preservationFixture} from './preservation-fixture'
import {loadMods,type PatchOp} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
const quality={pathogen:60,ash:20,source:'초기 실제 오염수'}
function watered(){const d=cultivationNativeFixture('dry');d.bottle().water={...quality};d.act({type:'waterCrop',pos:d.pos,uid:d.waterUid,ml:1000});return d}
function harvest(d=watered()){
 // 남은3턴은 명시한 초기 성장 조건. 과거28797턴을 실행했다고 주장하지 않는다.
 d.crop().state.growth=d.crop().total-3;d.crop().state.waterUnits=3072;d.crop().state.lastAt=turnOf(d.w)
 for(let i=0;i<3;i++)d.act({type:'wait'})
 d.act({type:'gather',pos:d.pos});return{...d,root:d.p.bag.find(i=>i.def==='Item.ShadeRoot'&&i.foodWater)!}
}
function mod(value:unknown){const patches:PatchOp[]=[{op:'replace',target:'WorldGen.Hearth',path:'/cropIrrigationTransfer',value}];return loadMods([...readPackages(),{manifest:{id:'irrigation-test',name:'관수 오염 검사',version:'1'},defs:[],patches}],['irrigation-test'])}
function tick(w:World,n=1){for(let i=0;i<n;i++){w.s.time+=100;cultivationTick(w)}}
describe('실제 유한 관수에서 같은 수확물로 옮은 오염',()=>{
 it('원래1000ml만 한 번 쓰고 설정된 병원체/재 몫을 현재 작물에만 기록한다',()=>{const d=watered();expect(drinkVolume(d.w,d.bottle())).toBe(0);expect(d.crop().state.irrigation).toEqual({ml:100,pathogenMl:6000,ash:.2});expect(d.p.needs.waterExposure).toBeUndefined();expect(d.p.needs.ash??0).toBe(0)})
 it('깨끗한 물은 가짜 오염 기록이나 노출/난수를 만들지 않는다',()=>{const d=cultivationNativeFixture('watered');expect(d.crop().state.irrigation).toBeUndefined();expect(cropHarvestContaminants(d.w,d.pos,2)).toEqual({})})
 it('관수 견적과 수확 오염 조회는 전체 상태를 바꾸지 않는다',()=>{const d=watered(),before=stateHash(d.s);for(let i=0;i<3;i++){cultivationStatus(d.w,d.pos);cropHarvestContaminants(d.w,d.pos,2);cultivationWaterQuote(d.w,d.p,d.pos,d.waterUid,1)}expect(stateHash(d.s)).toBe(before)})
 it('두 번 나눈 실제500ml는 총1000ml 몫만 더하고 다른 물병을 쓰지 않는다',()=>{const d=cultivationNativeFixture('dry');d.bottle().water={...quality};d.act({type:'waterCrop',pos:d.pos,uid:d.waterUid,ml:500});expect(d.crop().state.irrigation).toEqual({ml:50,pathogenMl:3000,ash:.1});d.act({type:'waterCrop',pos:d.pos,uid:d.waterUid,ml:500});expect(d.crop().state.irrigation).toEqual({ml:100,pathogenMl:6000,ash:.2});expect(drinkVolume(d.w,d.bottle())).toBe(0)})
 it.each([-1,Infinity,NaN,1e308])('잘못된 실제 수질 %s는 물·성장·시간·난수를 소비하지 않는다',value=>{const d=cultivationNativeFixture('dry');d.bottle().water={...quality,pathogen:value};const before=stateHash(d.s);expect(waterCultivation(d.w,d.p,d.pos,d.waterUid,1000)).not.toBeNull();expect(stateHash(d.s)).toBe(before)})
 it('소금기 실패는 오염을 먼저 기록하지 않는다',()=>{const d=cultivationNativeFixture('dry');d.bottle().water={...quality,salinity:400};const before=stateHash(d.s);expect(waterCultivation(d.w,d.p,d.pos,d.waterUid,1000)).not.toBeNull();expect(stateHash(d.s)).toBe(before);expect(d.crop().state.irrigation).toBeUndefined()})
 it('실제 비는 빈 자리에 들어간0.05ml만 기록하고 넘친 물의 오염을 추가하지 않는다',()=>{const d=cultivationNativeFixture('watered');d.crop().state.growth=d.crop().total;d.crop().state.waterUnits=28800000-1440;d.s.weather='ashrain';tick(d.w);expect(d.crop().state.waterUnits).toBe(28800000);expect(d.crop().state.irrigation!.ml).toBeCloseTo(.005,12);expect(d.crop().state.irrigation!.ash).toBeCloseTo(.00002,12);const before=structuredClone(d.crop().state.irrigation);tick(d.w);expect(d.crop().state.irrigation).toEqual(before)})
 it('지붕 아래 비와 정지한 지난 날씨로 새 오염을 지어내지 않는다',()=>{const d=cultivationNativeFixture('watered');tileAt(d.w,d.pos).roof=true;d.s.weather='ashrain';d.s.time+=28800*100;cultivationTick(d.w);expect(d.crop().state.irrigation).toBeUndefined()})
 it('성장/증발은 이미 옮은 오염을 새로 만들거나 지우지 않는다',()=>{const d=watered(),before=structuredClone(d.crop().state.irrigation);tick(d.w,200);expect(d.crop().state.irrigation).toEqual(before);expect(d.crop().state.growth).toBe(201)})
 it('실제15턴 수확은 두 뿌리에 같은 실제 몫을 나누고 깨끗한 기존 더미와 섞지 않는다',()=>{const d=watered(),clean=makeItem(d.w,'Item.ShadeRoot',2);expect(addToBag(d.w,d.p,clean)).toBe(0);const h=harvest(d);expect(h.root).toMatchObject({count:2,contaminantAsh:.1,foodWater:{ml:50,quality:{pathogen:60,ash:0}}});expect(h.p.bag.find(i=>i.uid===clean.uid)).toMatchObject({count:2});expect(canStack(h.root,clean)).toBe(false);const otherwiseSame={...h.root};delete otherwiseSame.foodWater;delete otherwiseSame.contaminantAsh;expect(canStack(h.root,otherwiseSame)).toBe(false);expect(canStack(otherwiseSame,{...otherwiseSame,uid:99999})).toBe(true);expect(h.crop().state.irrigation).toBeUndefined();expect(h.crop().state.growth).toBe(0);expect(h.crop().state.seedUid).toBe(h.seedsUid)})
 it('같은 밭을 즉시 다시 수확해 오염/음식을 복제하지 않는다',()=>{const d=harvest(),before=stateHash(d.s);expect(startGather(d.w,d.p,d.pos,1)).not.toBeNull();expect(stateHash(d.s)).toBe(before);expect(d.root.count).toBe(2)})
 it('한 뿌리 섭취는 실제 한 회분 노출과45ml 영양 수분만 주고 남은 뿌리 몫을 보존한다',()=>{const d=harvest(),ash=d.p.needs.ash??0;d.p.needs.waterDeficit=1000;expect(consumeFor(d.w,d.p,d.p,d.root.uid).ok).toBe(true);expect(d.p.needs.waterExposure).toEqual({ml:50,pathogenMl:3000});expect(d.p.needs.ash).toBeCloseTo(ash+.1,12);expect(d.p.needs.waterDeficit).toBe(955);expect(d.root.count).toBe(1);expect(d.root.foodWater!.ml).toBe(50);expect(d.root.contaminantAsh).toBe(.1)})
 it('같은 원래 밭/물/오염을 저장 뒤 재개해 실제 수확 결과 전체가 같다',()=>{const d=watered(),copy:World={db:d.w.db,s:deserialize(serialize(d.s))};for(const w of[d.w,copy]){const q=cultivationStatus(w,d.pos)!;q.state.growth=q.total;q.state.waterUnits=0;expect(playerAct(w,{type:'gather',pos:d.pos})).toBeNull()}expect(serialize(d.w.s)).toBe(serialize(copy.s))})
 it('전이 설정을 꺼도 원래 작물 서명과 이미 옮은 오염은 바뀌지 않는다',()=>{const d=watered(),before=serialize(d.s),l=mod({pathogenFraction:0,ashFraction:0});expect(l.report.errors).toEqual([]);d.w.db=l.db;expect(d.crop().valid).toBe(true);expect(serialize(d.s)).toBe(before)})
 it.each([{pathogenFraction:-.1,ashFraction:.1},{pathogenFraction:1.1,ashFraction:.1},{pathogenFraction:.1,ashFraction:'1'},{ashFraction:0},false,[]])('잘못된 전이 설정 %j는 콘텐츠 로드에서 거절한다',value=>{expect(mod(value).report.errors.some(e=>e.includes('cropIrrigationTransfer'))).toBe(true)})
 it.each([{ml:-1,pathogenMl:0,ash:0},{ml:0,pathogenMl:1,ash:0},{ml:1,pathogenMl:0,ash:NaN}])('잘못된 오염 기록 %j는 그대로 보존하고 밭을 임의로 재생하지 않는다',irrigation=>{const d=watered();d.crop().state.irrigation=irrigation;d.s.time+=100;const before=stateHash(d.s);expect(d.crop().valid).toBe(false);cultivationTick(d.w);expect(stateHash(d.s)).toBe(before)})
 it('170각인은 실제 오염 이력을 추정하지 않고 버전만171로 올린다',()=>{const d=cultivationNativeFixture('watered');d.s.version=170;const before=JSON.parse(serialize(d.s));expect(deserialize(JSON.stringify(before))).toEqual({...before,version:SAVE_VERSION});expect(d.crop().state.irrigation).toBeUndefined()})
 it('재료를 합치거나 여러 회분으로 나눠도 총 병원체와 원래 물량은 보존한다',()=>{const water=mergeFoodWater([{water:{ml:50,quality:{pathogen:60,ash:0}},count:2},{water:{ml:100,quality:{pathogen:0,ash:20}},count:1}],4)!;expect(water.ml).toBe(50);expect(water.quality.pathogen).toBe(30);expect(water.quality.ash).toBe(10)})
 it('실제 끓인 죽은 재료의 병원체만 없애고 원래 재를 남긴다',()=>{const d=boiledMealFixture();d.oats.foodWater={ml:50,quality:{pathogen:60,ash:0}};d.oats.contaminantAsh=.1;const wd=waterSafetyDef(d.w),expected=.1+d.bottle.water!.ash*1.1/wd.ashDivisor*220/wd.exposureMl;expect(startCraft(d.w,d.p,d.recipe,1)).toBeNull();expect(d.p.bag.some(i=>i.def==='Item.OatmealBowl')).toBe(false);finishBase(d.w,d.p);const out=d.p.bag.find(i=>i.uid===d.bowl.uid)!;expect(out.foodWater).toBeUndefined();expect(out.contaminantAsh).toBeCloseTo(expected,12);expect(d.p.needs.waterExposure).toBeUndefined()})
 it('끓이기 전에는 원래 재료의 병원체가 남고 실제400턴 뒤에만 사라진다',()=>{const d=unheatedMealFixture();d.oats.foodWater={ml:50,quality:{pathogen:60,ash:0}};d.oats.contaminantAsh=.1;expect(prepareUnheatedMeal(d.w,d.p,d.recipe)).toBeNull();const b=d.s.map.cooking![0],ash=b.item.contaminantAsh!,source=b.item.foodWater!,treated=treatedWater(d.w,source.quality,'boil'),wd=waterSafetyDef(d.w),expectedAsh=ash+(treated.ash-source.quality.ash)/wd.ashDivisor*source.ml/wd.exposureMl;expect(b.item.foodWater!.ml).toBe(270);expect(b.item.foodWater!.quality.pathogen*270).toBeCloseTo(3176,9);for(let i=0;i<399;i++){d.s.time+=100;cookingTick(d.w)}expect(b.item.foodWater!.ml).toBe(270);d.s.time+=100;cookingTick(d.w);expect(b.item.foodWater).toBeUndefined();expect(b.item.contaminantAsh).toBeGreaterThan(ash);expect(b.item.contaminantAsh).toBeCloseTo(expectedAsh,12)})
 it('덜 익은 혼합물을 실제로 먹으면 재료에서 옮은 병원체도 같은 섭취 기록에 더한다',()=>{const d=unheatedMealFixture();d.oats.foodWater={ml:50,quality:{pathogen:60,ash:0}};expect(prepareUnheatedMeal(d.w,d.p,d.recipe)).toBeNull();const b=d.s.map.cooking![0];expect(takeCooking(d.w,d.p,b.item.uid)).toBeNull();expect(consumeFor(d.w,d.p,d.p,b.item.uid).ok).toBe(true);expect(d.p.needs.waterExposure!.ml).toBe(270);expect(d.p.needs.waterExposure!.pathogenMl).toBeCloseTo(3176,9)})
 it('훈연 준비와 완료로 선언한 초기 가공물 회수는 같은 병원체 몫을 보존한다',()=>{const d=preservationFixture(),raw=d.add('Item.RawMeat');raw.foodWater={ml:50,quality:{pathogen:60,ash:0}};raw.contaminantAsh=.1;expect(startCraft(d.w,d.p,d.recipe,1)).toBeNull();finishBase(d.w,d.p);const b=d.s.map.batches!.at(-1)!;expect(b.foodWater).toMatchObject({ml:50,quality:{pathogen:60}});b.processing!.progress=b.processing!.total;expect(collectBatch(d.w,d.p,b.id)).toBeNull();const out=d.p.bag.find(i=>i.foodWater)!;expect(out.foodWater).toMatchObject({ml:50,quality:{pathogen:60}});expect(out.contaminantAsh).toBe(.1)})
})
