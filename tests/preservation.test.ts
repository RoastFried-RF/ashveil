import {SAVE_VERSION} from '../src/core/game'
import {describe,expect,it} from 'vitest'
import {perform} from '../src/core/actions'
import {campfireAt,expireCampfires,extinguishCampfire,startFireWork} from '../src/core/campfire'
import {batchStatus,preservationRate} from '../src/core/preservation-state'
import {preservationTick} from '../src/core/preservation'
import {collectBatch,craftError,startCraft} from '../src/core/crafting'
import {tileAt,turnOf,type World} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {playerAct} from '../src/core/game'
import {scentStrength,smells} from '../src/core/perception'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {readPackages} from '../tools/loadContent'
import {finishBase} from './base-camp-fixture'
import {preservationFixture as setup} from './preservation-fixture'
function tick(w:World,n=1){for(let i=0;i<n;i++){w.s.time+=100;preservationTick(w);expireCampfires(w)}}
describe('원본 음식·연료·실제 환경의 훈제와 건조',()=>{
 it('준비 완료 때 실제 원본 고기만 배치에 넣고 연료/결과를 복제하지 않는다',()=>{
  const {p,raw,wood,batch}=setup();expect(p.bag.some(i=>i.uid===raw.uid)).toBe(false);expect(wood.count).toBe(2);expect(batch.processing).toMatchObject({method:'smoke',progress:0,total:7200,inputs:[{uid:raw.uid,def:raw.def,count:1}]});expect(batch.freshness).toBe(73);expect(batch.contaminantAsh).toBe(.5);expect(p.bag.some(i=>i.def==='Item.SmokedMeat')).toBe(false)
 })
 it('견적/화면/이른 회수는 시간·배치·난수·물품을 바꾸지 않는다',()=>{
  const {w,p,batch}=setup(),hash=stateHash(w.s);expect(batchStatus(w,batch).remaining).toBe(7200);preservationRate(w,batch);expect(collectBatch(w,p,batch.id)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
 })
 it('정적 화덕은 유한 연료 훈제를 대신하지 못하고 실제 불을 끄면 준비를 거절한다',()=>{
  const {w,p,pos,add}=setup();expect(extinguishCampfire(w,p,pos)).toBeNull();add('Item.RawMeat');const hash=stateHash(w.s);expect(craftError(w,p,w.db.get('Recipe.SmokeMeat'))).toContain('땔감');expect(startCraft(w,p,'Recipe.SmokeMeat',1)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
 })
 it('원래 장작2400턴은 마지막 유효 구간까지 세고 꺼진 뒤에는 가공이 멈춘다',()=>{
  const {w,batch,pos}=setup();tick(w,2400);expect(batch.processing!.progress).toBe(2400);expect(campfireAt(w,pos)!.light.off).toBe(true);tick(w,300);expect(batch.processing!.progress).toBe(2400);expect(batchStatus(w,batch).reason).toContain('땔감')
 })
 it('같은 원본 불에 실제 땔감을 보충하면 나머지6시간을 채우고 같은 재료 한 번만 회수한다',()=>{
  const {w,p,batch,pos,wood,raw}=setup();tick(w,2400);expect(startFireWork(w,p,pos,wood.uid)).toBeNull();finishBase(w,p);tick(w,2400);expect(startFireWork(w,p,pos,wood.uid)).toBeNull();finishBase(w,p);tick(w,2399)
  expect(batch.processing!.progress).toBe(7199);expect(collectBatch(w,p,batch.id)).not.toBeNull();tick(w);expect(batchStatus(w,batch).remaining).toBe(0)
  expect(collectBatch(w,p,batch.id)).toBeNull();const out=p.bag.find(i=>i.def==='Item.SmokedMeat')!;expect(out.count).toBe(1);expect(out.uid).not.toBe(raw.uid);expect(out.freshness).toBeLessThan(73);expect(out.contaminantAsh).toBe(.5);expect(out.foodQ).toBe(batch.foodQ);expect(wood.count).toBe(0)
  const hash=stateHash(w.s);expect(collectBatch(w,p,batch.id)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
 })
 it('불을 끄거나 다른 모닥불 UID로 바꿔도 원래 훈제의6시간을 공짜로 채우지 않는다',()=>{
  const {w,p,batch,pos}=setup();tick(w,10);extinguishCampfire(w,p,pos);tick(w,10);expect(batch.processing!.progress).toBe(10)
  const fire=campfireAt(w,pos)!;fire.tile.placed!.item.uid+=100;fire.light.sourceUid=fire.tile.placed!.item.uid;fire.light.off=false;fire.light.fuelUntil=turnOf(w)+7200
  tick(w,10);expect(batch.processing!.progress).toBe(10);expect(batchStatus(w,batch).reason).toContain('원래')
 })
 it('한 턴 재정산과 현재 환경만 있는 긴 시각 점프는 과거 가공을 만들어 넣지 않는다',()=>{
  const {w,batch}=setup();tick(w,1);const hash=stateHash(w.s);preservationTick(w);expect(stateHash(w.s)).toBe(hash);w.s.time+=7200*100;preservationTick(w);expect(batch.processing!.progress).toBe(1)
 })
 it('실제 스케줄러가 기다린20턴을 같은 원본 배치와 연료에서 정산한다',()=>{
  const {w,p,batch}=setup(),at=w.s.time;expect(playerAct(w,{type:'rest',turns:20})).toBeNull();expect(w.s.time-at).toBe(2000);expect(batch.processing!.progress).toBe(20);expect(p.alive).toBe(true)
 })
 it('실제 바람의 약/강 조건과 원래 불은4일/2일 건조 진행을 결정한다',()=>{
  const {w,p,pos,batch}=setup('dry');extinguishCampfire(w,p,pos);tileAt(w,batch.pos).roof=false;w.s.overworld=undefined;w.s.wind={x:1,y:0}
  expect(preservationRate(w,batch).rate).toBe(1);tick(w,3);expect(batch.processing!.progress).toBe(3);w.s.wind={x:2,y:0};tick(w,3);expect(batch.processing!.progress).toBe(9);expect(batch.processing!.total).toBe(4*28800)
 })
 it('원래 생고기 한 회분은 실제 강한 바람2일 뒤 두 조각과 같은 총 재로 회수된다',()=>{
  const {w,p,batch,raw}=setup('dry');w.s.overworld=undefined;tileAt(w,batch.pos).roof=false;w.s.wind={x:2,y:0}
  tick(w,57600-1);expect(batchStatus(w,batch).remaining).toBe(2);expect(collectBatch(w,p,batch.id)).not.toBeNull()
  tick(w);expect(collectBatch(w,p,batch.id)).toBeNull();const out=p.bag.filter(i=>i.def==='Item.AirDriedMeat');expect(out.reduce((n,i)=>n+i.count,0)).toBe(2);expect(out.reduce((n,i)=>n+(i.contaminantAsh??0)*i.count,0)).toBe(.5);expect(out[0].freshness).toBeLessThan(73);expect(p.bag.some(i=>i.uid===raw.uid)).toBe(false)
 })
 it('실제 비바람 중에는 노출된 건조가 멈추고 무풍·실내도 열원 없이는 진행하지 않는다',()=>{
  const {w,p,pos,batch}=setup('dry');w.s.overworld=undefined;tileAt(w,batch.pos).roof=false;w.s.wind={x:2,y:0};w.s.weather='ashrain';tick(w,10);expect(batch.processing!.progress).toBe(0)
  w.s.weather='clear';w.s.wind={x:0,y:0};extinguishCampfire(w,p,pos);tick(w,10);expect(batch.processing!.progress).toBe(0);tileAt(w,batch.pos).roof=true;w.s.wind={x:4,y:0};tick(w,10);expect(batch.processing!.progress).toBe(0)
 })
 it('지붕은 실제 빗물을 막고 그 아래 원래 불의 건조는 계속된다',()=>{
  const {w,batch}=setup('dry');w.s.overworld=undefined;w.s.weather='ashrain';tick(w,2);expect(batch.processing!.progress).toBe(4)
 })
 it('준비한 음식은 멈춰 있거나 완료되어도 실제 시간에 상하며 신선도를100으로 씻지 않는다',()=>{
  const {w,p,pos,batch}=setup();extinguishCampfire(w,p,pos);const at=turnOf(w);tick(w,1200);expect(batch.processing!.progress).toBe(0);expect(batch.freshness).toBeLessThan(73)
  batch.processing!.progress=batch.processing!.total;const old=batch.freshness!,loss=73-old;tick(w,1200);expect(batch.freshness).toBeLessThan(old);expect(old-batch.freshness!).toBeLessThan(loss/2);expect(turnOf(w)-at).toBe(2400)
 })
 it('전체 각인 뒤 같은 유한 불/날씨/배치와 원본 재료로 동일하게 이어진다',()=>{
  const {w,batch}=setup();tick(w,37);const copy={db:w.db,s:deserialize(serialize(w.s))};expect(copy.s.version).toBe(SAVE_VERSION);expect(copy.s).toEqual(JSON.parse(serialize(w.s)))
  tick(w,1200);tick(copy,1200);expect(copy.s).toEqual(JSON.parse(serialize(w.s)));expect(copy.s.map.batches![0].processing!.inputs).toEqual(batch.processing!.inputs)
 })
 it('비활성 원래 지도와 먼 장면에서도 같은 유한 연료 구간만 정산한다',()=>{
  const {w,batch}=setup();const map=w.s.map;w.s.map={...map,id:'other',batches:undefined};w.s.maps={original:map};tick(w,11);expect(batch.processing!.progress).toBe(11)
 })
 it('제작법이 달라진 뒤 원래 배치를 다른 음식으로 회수하지 않는다',()=>{
  const {w,p,batch}=setup();w.db=loadMods([...readPackages(),{manifest:{id:'different.output',name:'다른 결과',version:'1'},defs:[],patches:[{op:'replace',target:'Recipe.SmokeMeat',path:'/output/count',value:3}]}]).db
  tick(w);expect(batch.processing!.progress).toBe(0);batch.processing!.progress=batch.processing!.total;const hash=stateHash(w.s);expect(collectBatch(w,p,batch.id)).toContain('제작법');expect(stateHash(w.s)).toBe(hash)
 })
 it('실제 훈제식의 냄새 반경+2는 수량으로 중첩하지 않고 원래 짐승 감지에 쓰인다',()=>{
  const {w,p,add}=setup();p.scent=100;p.bag=p.bag.filter(i=>!w.db.item(i.def).food);const baseline=scentStrength(w,p),out=add('Item.SmokedMeat');expect(scentStrength(w,p)).toBe(baseline+2);out.count=3;expect(scentStrength(w,p)).toBe(baseline+2)
  const observer=structuredClone(p);observer.id=1000;observer.pos={x:p.pos.x+6,y:p.pos.y};observer.def='Creature.Reaver';observer.body.missing=[];w.s.wind={x:0,y:0};w.s.overworld=undefined
  expect(smells(w,observer,p)).toBe(true);p.bag=p.bag.filter(i=>i.uid!==out.uid);expect(smells(w,observer,p)).toBe(false)
 })
 it('새 음식의 보존 배수/비타민과 두 조각 수량은 기존 육포를 전역 수정하지 않는다',()=>{
  const {w}=setup('dry'),raw=w.db.item('Item.RawMeat').food!,smoked=w.db.item('Item.SmokedMeat').food!,dried=w.db.item('Item.AirDriedMeat').food!
  expect(smoked.freshHours).toBe(raw.freshHours!*10);expect(dried.freshHours).toBe(raw.freshHours!*20);expect(smoked.vitamin).toBe(raw.vitamin!*.3);expect(dried.vitamin!*2).toBe(raw.vitamin!*.5);expect(w.db.item('Item.Jerky').food!.freshHours).toBe(2880)
 })
 it('원래 소비 행동은 실제 훈제식 영양과 남아 있던 재만 전달한다',()=>{
  const {w,p,batch}=setup();batch.processing!.progress=batch.processing!.total;expect(collectBatch(w,p,batch.id)).toBeNull();const out=p.bag.find(i=>i.def==='Item.SmokedMeat')!,before=p.needs.kcal;p.needs.ash=0
  expect(perform(w,p,{type:'consume',uid:out.uid}).ok).toBe(true);expect(p.needs.kcal-before).toBe(210);expect(p.needs.ash).toBe(.5)
 })
 it('구형68의 염장/무두질 배치와 몸·난수·현금은 버전만 바꿔 보존한다',()=>{
  const {w,p}=setup();w.s.map.batches=[{id:w.s.nextId++,recipe:'Recipe.SaltMeat',readyAt:turnOf(w)+2*28800,pos:{...p.pos},quality:1,crafter:p.id,freshness:62}];const old=JSON.parse(serialize(w.s));old.version=68;const restored=deserialize(JSON.stringify(old));expect({...restored,version:68}).toEqual(old);expect(restored.map.batches![0].processing).toBeUndefined();expect(restored.version).toBe(SAVE_VERSION)
 })
})
