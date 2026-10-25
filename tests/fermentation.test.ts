import {cultivationStatus} from '../src/core/cultivation'
import {SAVE_VERSION} from '../src/core/game'
import {describe,expect,it} from 'vitest'
import {perform,consumeFor} from '../src/core/actions'
import {startCraft,collectBatch,startGather} from '../src/core/crafting'
import {tileAt,type World} from '../src/core/ctx'
import {firstImpressionsFixture} from './first-impressions-fixture'
import {tradePrice,exchange} from '../src/core/economy'
import {foodServings} from '../src/core/food-vessels'
import {makeItem} from '../src/core/items'
import {preservationTick} from '../src/core/preservation'
import {batchStatus} from '../src/core/preservation-state'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {fermentationFixture as setup} from './fermentation-fixture'
import {finishBase} from './base-camp-fixture'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
function tick(w:World,n=1){for(let i=0;i<n;i++){w.s.time+=100;preservationTick(w)}}
function collect(d:ReturnType<typeof setup>){d.batch.processing!.progress=d.batch.processing!.total;expect(collectBatch(d.w,d.p,d.batch.id)).toBeNull();return d.p.bag.find(i=>i.uid===d.originalUid)!}
describe('실제 발효·다섯 회분과 원래 항아리',()=>{
 it('실제 원본 양배추5회분/소금/항아리를14일 배치에 넘기고 이른 음식이나 새 용기를 만들지 않는다',()=>{
  const {w,p,batch,jar,initial,nextId}=setup();expect(batch.processing!.total).toBe(14*28800);expect(batch.processing!.vessel).toEqual(initial.find(i=>i.uid===jar.uid));expect(batch.processing!.vessel!.durability).toBe(71);expect(batch.contaminantAsh).toBe(.1)
  expect(p.bag.some(i=>i.def==='Item.Cabbage'||i.def==='Item.Salt'||i.uid===jar.uid)).toBe(false);expect(w.s.nextId).toBe(nextId+1);expect(batch.processing!.inputs.reduce((n,i)=>n+i.count,0)).toBe(7)
 })
 it('조기 회수와 조회는 같은 원래 용기/현금/난수/진행을 보존한다',()=>{
  const {w,p,batch}=setup(),hash=stateHash(w.s);batchStatus(w,batch);expect(collectBatch(w,p,batch.id)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
 })
 it('실제14일의 각 연속 구간을 채운 뒤에만 원래 항아리로 다섯 회분을 한 번 회수한다',()=>{
  const d=setup();d.w.s.overworld=undefined;const next=d.w.s.nextId;tick(d.w,14*28800-1);expect(batchStatus(d.w,d.batch).remaining).toBe(1);expect(collectBatch(d.w,d.p,d.batch.id)).not.toBeNull()
  tick(d.w);expect(collectBatch(d.w,d.p,d.batch.id)).toBeNull();const out=d.p.bag.find(i=>i.uid===d.originalUid)!;expect(out.def).toBe('Item.PickledCabbageJar');expect(foodServings(d.w,out)).toBe(5);expect(out.foodVesselDef).toBe('Item.CeramicJar');expect(out.quality).toBe(2);expect(out.durability).toBe(71);expect(out.freshness).toBeLessThan(66);expect(out.contaminantAsh).toBe(.1);expect(d.w.s.nextId).toBe(next)
  const hash=stateHash(d.w.s);expect(collectBatch(d.w,d.p,d.batch.id)).not.toBeNull();expect(stateHash(d.w.s)).toBe(hash)
 },30000)
 it('같은 항아리의 첫 회분만 영양/수분/비타민을 전달하고 원래 남은 양을 줄인다',()=>{
  const d=setup(),out=collect(d);d.p.needs.kcal=0;d.p.needs.vitamin=20;d.p.needs.waterDeficit=500;d.p.needs.ash=0;const next=d.w.s.nextId
  expect(perform(d.w,d.p,{type:'consume',uid:out.uid}).ok).toBe(true);expect(d.p.needs.kcal).toBe(40);expect(d.p.needs.vitamin).toBe(28);expect(d.p.needs.waterDeficit).toBe(340);expect(d.p.needs.ash).toBe(.1);expect(foodServings(d.w,out)).toBe(4);expect(out.foodSealed).toBeUndefined();expect(out.foodLeftover).toBe(true);expect(d.w.s.nextId).toBe(next)
 })
 it('다섯 회분 뒤 같은 UID/품질/내구/현재 격자의 빈 용기만 남고 재를 다섯 배 만들지 않는다',()=>{
  const d=setup(),out=collect(d),uid=out.uid,next=d.w.s.nextId;out.gx=2;out.gy=3;d.p.needs.kcal=0;d.p.needs.vitamin=0;d.p.needs.waterDeficit=1000;d.p.needs.ash=0
  for(let i=0;i<5;i++)expect(perform(d.w,d.p,{type:'consume',uid}).ok).toBe(true)
  expect(out).toMatchObject({uid,def:'Item.CeramicJar',quality:2,durability:71,gx:2,gy:3});expect(out.uses).toBeUndefined();expect(out.freshness).toBeUndefined();expect(out.contaminantAsh).toBeUndefined();expect(out.foodVesselDef).toBeUndefined();expect(d.p.needs.kcal).toBe(200);expect(d.p.needs.vitamin).toBe(40);expect(d.p.needs.waterDeficit).toBe(200);expect(d.p.needs.ash).toBe(.5);expect(d.w.s.nextId).toBe(next);expect(d.p.bag.filter(i=>i.uid===uid)).toHaveLength(1)
  const hash=stateHash(d.w.s);expect(perform(d.w,d.p,{type:'consume',uid}).ok).toBe(false);expect(stateHash(d.w.s)).toBe(hash)
 })
 it('배낭이 가득 차면 같은 원래 항아리 하나만 실제 바닥에 놓인다',()=>{
  const d=setup();d.p.bag=[]
  for(let y=0;y<6;y++)for(let x=0;x<10;x++)d.p.bag.push({...makeItem(d.w,'Item.Stone'),gx:x,gy:y})
  d.batch.processing!.progress=d.batch.processing!.total;const next=d.w.s.nextId;expect(collectBatch(d.w,d.p,d.batch.id)).toBeNull()
  const jars=tileAt(d.w,d.p.pos).items.filter(i=>i.uid===d.originalUid);expect(jars).toHaveLength(1);expect(jars[0]).toMatchObject({def:'Item.PickledCabbageJar',quality:2,durability:71,uses:5});expect(d.p.bag.some(i=>i.uid===d.originalUid)).toBe(false);expect(d.w.s.nextId).toBe(next)
 })
 it('남은 음식은 원래 받은 사람의 실제 몸에만 전달한다',()=>{
  const d=setup(),out=collect(d),recipient=d.doctor();recipient.needs.kcal=0;recipient.needs.vitamin=0;const own=d.p.needs.kcal
  expect(consumeFor(d.w,d.p,recipient,out.uid).ok).toBe(true);expect(recipient.needs.kcal).toBe(40);expect(recipient.needs.vitamin).toBe(8);expect(d.p.needs.kcal).toBe(own);expect(out.uses).toBe(4)
 })
 it('먹일 수 없는 거리/손 상태와 빈 회분은 음식·몸·용기를 바꾸지 않는다',()=>{
  const d=setup(),out=collect(d),recipient=d.doctor();recipient.pos.x+=5;let hash=stateHash(d.w.s);expect(consumeFor(d.w,d.p,recipient,out.uid).ok).toBe(false);expect(stateHash(d.w.s)).toBe(hash)
  out.uses=0;hash=stateHash(d.w.s);expect(perform(d.w,d.p,{type:'consume',uid:out.uid}).ok).toBe(false);expect(stateHash(d.w.s)).toBe(hash)
 })
 it('중간 발효 전체 각인도 원래 용기와 영양/난수/진행을 같은 결과로 잇는다',()=>{
  const d=setup();tick(d.w,25);const copy={db:d.w.db,s:deserialize(serialize(d.w.s))};tick(d.w,17);tick(copy,17);expect(copy.s).toEqual(JSON.parse(serialize(d.w.s)));expect(copy.s.version).toBe(SAVE_VERSION);expect(copy.s.map.batches![0].processing!.vessel!.uid).toBe(d.originalUid)
 })
 it('한 회분을 먹은 전체 각인 뒤 네 번 먹어도 원래 항아리/몸/난수가 같다',()=>{
  const d=setup(),out=collect(d);perform(d.w,d.p,{type:'consume',uid:out.uid});const copy={db:d.w.db,s:deserialize(serialize(d.w.s))}
  for(const x of[d.w,copy])for(let i=0;i<4;i++)expect(perform(x,x.s.creatures.find(c=>c.id===x.s.playerId)!,{type:'consume',uid:out.uid}).ok).toBe(true)
  expect(copy.s).toEqual(JSON.parse(serialize(d.w.s)));expect(copy.s.creatures.find(c=>c.id===copy.s.playerId)!.bag.find(i=>i.uid===out.uid)!.def).toBe('Item.CeramicJar')
 })
 it('원래 빈 항아리를 다시 실제 절임에 쓰며 매 주기마다 새 용기를 만들지 않는다',()=>{
  const d=setup(),out=collect(d);for(let i=0;i<5;i++)perform(d.w,d.p,{type:'consume',uid:out.uid});for(let i=0;i<5;i++)d.add('Item.Cabbage');d.add('Item.Salt')
  expect(startCraft(d.w,d.p,'Recipe.FermentCabbage',1)).toBeNull();expect(d.p.workJob!.inputs.some(i=>i.uid===d.originalUid)).toBe(true)
 })
 it('실제 연합 상인의 유한 씨앗과 원래 항아리를 원래 현금으로 산다',()=>{
  const d=firstImpressionsFixture(),jar=d.market.items.find(i=>i.def==='Item.CeramicJar')!,seed=d.market.items.find(i=>i.def==='Item.CabbageSeed')!,cash=d.p.money!+d.market.money,uid=jar.uid
  expect(jar.count).toBe(3);expect(seed.count).toBe(4);expect(exchange(d.w,d.p,d.trader,[{uid:jar.uid,count:1},{uid:seed.uid,count:1}],[])).toBeNull();expect(d.p.money!+d.market.money).toBe(cash);expect(d.market.items.find(i=>i.uid===uid)!.count).toBe(2)
 })
 it('같은 씨앗에서 심은 밭은 미성숙 수확을 거절하고 성숙 초기 조건에서 원래 채소5회분만 낸다',()=>{
  const d=clinicalDiseaseFixture(),seed=d.add('Item.CabbageSeed'),pos={x:21,y:20}
  expect(perform(d.w,d.p,{type:'place',uid:seed.uid,dir:2}).ok).toBe(true);expect(d.p.bag.some(i=>i.uid===seed.uid)).toBe(false)
  const tile=tileAt(d.w,pos),crop=cultivationStatus(d.w,pos)!;expect(tile.t).toBe('Terrain.CabbagePlot');expect(tile.gatherAt).toBeUndefined();expect(crop.state.seedUid).toBe(seed.uid);expect(crop.ready).toBe(false)
  const hash=stateHash(d.s);expect(startGather(d.w,d.p,pos,1)).not.toBeNull();expect(stateHash(d.s)).toBe(hash)
  // Declared ripe fixture, not a claim that skipping five calendar days grows an unwatered crop.
  crop.state.growth=crop.total;expect(startGather(d.w,d.p,pos,1)).toBeNull();finishBase(d.w,d.p);expect(d.p.bag.filter(i=>i.def==='Item.Cabbage').reduce((n,i)=>n+i.count,0)).toBe(5);expect(tile.cultivation!.growth).toBe(0);expect(tile.cultivation!.seedUid).toBe(seed.uid);expect(tile.gatherAt).toBeUndefined()
 })
 it('항아리 없는 발효 준비는 원래 채소/소금·UID·난수를 소비하지 않는다',()=>{
  const d=clinicalDiseaseFixture();for(let i=0;i<5;i++)d.add('Item.Cabbage');d.add('Item.Salt');const hash=stateHash(d.s);expect(startCraft(d.w,d.p,'Recipe.FermentCabbage',1)).not.toBeNull();expect(stateHash(d.s)).toBe(hash)
 })
 it('용기 품질과 음식 품질을 구별하고 배치 메타데이터를 결과물에 복제하지 않는다',()=>{
  const d=setup(),out=collect(d);expect(out.quality).toBe(2);expect(out.foodQ).toBe(d.batch.foodQ);expect(out).not.toHaveProperty('processing');expect(out).not.toHaveProperty('recipe');expect(out).not.toHaveProperty('readyAt')
 })
 it('부분 항아리는 원래 거래 가격의 남은 양을 반영하며 두 용기를 합치지 않는다',()=>{
  const d=firstImpressionsFixture(),out=makeItem(d.w,'Item.PickledCabbageJar'),full=tradePrice(d.w,d.p,d.trader,out,true);out.uses=1;expect(tradePrice(d.w,d.p,d.trader,out,true)).toBeLessThan(full);expect(out.count).toBe(1)
 })
 it('새 음식도 기존 일반 음식 한 조각 소비를 바꾸지 않는다',()=>{
  const d=clinicalDiseaseFixture(),food=d.add('Item.Hardtack');expect(perform(d.w,d.p,{type:'consume',uid:food.uid}).ok).toBe(true);expect(d.p.bag.some(i=>i.uid===food.uid)).toBe(false)
 })
 it('현재 날씨만 있는 긴 건너뛰기는14일 발효를 소급 완료하지 않는다',()=>{
  const d=setup();d.w.s.time+=14*28800*100;preservationTick(d.w);expect(d.batch.processing!.progress).toBe(0);expect(collectBatch(d.w,d.p,d.batch.id)).not.toBeNull()
 })
 it('구형69 배치·일반 음식·몸·현금은 회분/용기를 생성하지 않고 버전만 올린다',()=>{
  const d=setup();d.w.s.map.batches=undefined;const food=d.add('Item.Jerky'),old=JSON.parse(serialize(d.w.s));old.version=69;const restored=deserialize(JSON.stringify(old));expect({...restored,version:69}).toEqual(old);expect(restored.creatures.find(c=>c.id===d.p.id)!.bag.find(i=>i.uid===food.uid)!.foodVesselDef).toBeUndefined()
 })
})
