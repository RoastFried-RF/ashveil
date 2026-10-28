import {describe,it,expect} from 'vitest'
import {companionRecoveryFixture} from './companion-recovery-fixture'
import {assignCompanionRecovery,collectRecoveryCargo,collectRecoveryQuote,companionRecoveryFetch,companionRecoveryQuote,companionRecoveryReturn,companionRecoverySearchError,stopCompanionRecovery} from '../src/core/companion-recovery'
import {commandCompanion,companionDecision,dismissCompanion} from '../src/core/companions'
import {companionDef} from '../src/core/companion-state'
import {activityStep,perform} from '../src/core/actions'
import {makeItem} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {tileAt,turnOf,type World} from '../src/core/ctx'
const finish=(d:ReturnType<typeof companionRecoveryFixture>,limit=100)=>{for(let i=0;d.guard.companionRecovery&&i<limit;i++)d.act({type:'wait'})}
function fill(w:World){return Array.from({length:60},(_,i)=>({...makeItem(w,'Item.Cloth',5),gx:i%10,gy:Math.floor(i/10)}))}
describe('실제 고용 동료의 같은 현장 원본 회수',()=>{
 it('실제 고용한 원래 경비의 몸/소속/명단과 고용료를 보존한다',()=>{
  const d=companionRecoveryFixture();expect(d.guard.companion!.status).toBe('employed');expect(d.guard.faction).toBe(d.proof.originalOwner);expect(d.proof.originalRoster).toContain(d.guard.id);expect(d.p.money).toBe(960);expect(d.guard.money).toBe(40);expect(d.guard.equip.off!.uid).toBe(d.proof.originalLampUid);expect(d.p.equip.off).toBeUndefined();expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
 })
 it('조회와 잘못된 의뢰/복사본 지시는 전체 상태를 바꾸지 않는다',()=>{
  const d=companionRecoveryFixture(),before=stateHash(d.s);expect(companionRecoveryQuote(d.w,d.guard,d.record!.id).error).toBeNull();expect(assignCompanionRecovery(d.w,d.guard,'missing')).toBeTruthy();expect(assignCompanionRecovery(d.w,structuredClone(d.guard),d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  expect(perform(d.w,structuredClone(d.p),{type:'companionRecoveryAssign',target:d.guard.id,contract:d.record!.id}).ok).toBe(false);expect(stateHash(d.s)).toBe(before)
 })
 it.each(['asleep','unpaid','far','wrongMap','unconscious']as const)('대화/몸/고용 상태가 맞지 않으면 원자적으로 거절한다 (%s)',mode=>{
  const d=companionRecoveryFixture();if(mode==='asleep')d.guard.asleep=true;if(mode==='unpaid')d.guard.companion!.status='unpaid';if(mode==='far')d.guard.pos={x:5,y:5};if(mode==='wrongMap')d.guard.mapId='other';if(mode==='unconscious')d.guard.unconscious=true;const before=stateHash(d.s);expect(assignCompanionRecovery(d.w,d.guard,d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('실제 배정1턴은 기억한 원본/위치를 사본으로 맡기고 물품/보수를 움직이지 않는다',()=>{
  const d=companionRecoveryFixture(),at=d.s.time;d.act({type:'companionRecoveryAssign',target:d.guard.id,contract:d.record!.id});expect(d.s.time-at).toBe(100);expect(d.guard.companionRecovery).toMatchObject({id:d.record!.id,itemUid:d.book.uid,item:d.book.def,phase:'outbound'});expect(d.guard.companionRecovery!.pos).toEqual(d.record!.pos);expect(d.guard.companionRecovery!.pos).not.toBe(d.record!.pos);expect(d.source.cont!.items.some(i=>i.uid===d.book.uid)).toBe(true);expect(d.market.money).toBe(692);expect(d.record!.status).toBe('active')
 })
 it('실제 동료의 걸음/회수/귀환 뒤 같은 원본만 주인공에게 돌아오며 납품 보수는 남는다',()=>{
  const d=companionRecoveryFixture('assigned'),start={...d.guard.pos},at=d.s.time,knowledge=structuredClone(d.source.observed!.contents),next=d.s.nextId;let walked=false,carried=false
  for(let i=0;d.guard.companionRecovery&&i<100;i++){d.act({type:'wait'});walked||=d.guard.pos.x!==start.x||d.guard.pos.y!==start.y;carried||=d.guard.bag.some(it=>it.uid===d.book.uid)}
  expect(walked).toBe(true);expect(carried).toBe(true);expect(d.s.time).toBeGreaterThan(at);expect(d.p.bag.filter(it=>it.uid===d.book.uid)).toHaveLength(1);expect(d.guard.bag.some(it=>it.uid===d.book.uid)).toBe(false);expect(d.source.cont!.items.some(it=>it.uid===d.book.uid)).toBe(false);expect(d.guard.companionRecovery).toBeUndefined();expect(d.guard.recoveryCargo).toBeUndefined();expect(d.record!.status).toBe('active');expect(d.record!.escrow).toBe(308);expect(d.market.money).toBe(692);expect(d.p.money).toBe(960);expect(d.guard.money).toBe(40);expect(d.source.observed!.contents).toEqual(knowledge);expect(d.s.nextId).toBe(next);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
 })
 it('임무 중 피로하면 원래 수면 판단이 회수보다 먼저다',()=>{
  const d=companionRecoveryFixture('assigned');d.guard.needs.fatigue=companionDef(d.w).sleepAt;const decision=companionDecision(d.w,d.guard,[]);expect(decision?.action?.type).toBe('sleep');expect(d.source.cont!.items.some(it=>it.uid===d.book.uid)).toBe(true)
 })
 it('실제 칸에 원본이 없으면 그 사실을 곁에 돌아와 보고하고 기억/돈을 위조하지 않는다',()=>{
  const d=companionRecoveryFixture(),knowledge=structuredClone(d.source.observed!.contents),item=d.source.cont!.items.find(it=>it.uid===d.book.uid)!;d.source.cont!.items=d.source.cont!.items.filter(it=>it!==item);tileAt(d.w,{x:25,y:16}).items.push(item);d.act({type:'companionRecoveryAssign',target:d.guard.id,contract:d.record!.id});finish(d);expect(d.guard.companionRecovery).toBeUndefined();expect(d.p.bag.some(it=>it.uid===item.uid)).toBe(false);expect(d.guard.bag.some(it=>it.uid===item.uid)).toBe(false);expect(tileAt(d.w,{x:25,y:16}).items.some(it=>it.uid===item.uid)).toBe(true);expect(d.source.observed!.contents).toEqual(knowledge);expect(d.s.log.some(x=>x.text.includes('원래 칸에 그 원본이 없다'))).toBe(true);expect(d.record!.escrow).toBe(308)
 })
 it('동료 배낭이 차 있으면 원본을 남기고 돌아와 보고한다',()=>{
  const d=companionRecoveryFixture();d.guard.bag=fill(d.w);d.act({type:'companionRecoveryAssign',target:d.guard.id,contract:d.record!.id});finish(d);expect(d.source.cont!.items.some(it=>it.uid===d.book.uid)).toBe(true);expect(d.p.bag.some(it=>it.uid===d.book.uid)).toBe(false);expect(d.guard.companionRecovery).toBeUndefined();expect(d.s.log.some(x=>x.text.includes('배낭 공간이 부족'))).toBe(true)
 })
 it('원본을 받을 주인공 배낭이 차 있으면 동료가 실제 원본을 보관한다',()=>{
  const d=companionRecoveryFixture();d.p.bag=fill(d.w);d.act({type:'companionRecoveryAssign',target:d.guard.id,contract:d.record!.id});finish(d,50);expect(d.guard.bag.filter(it=>it.uid===d.book.uid)).toHaveLength(1);expect(d.guard.recoveryCargo!.uid).toBe(d.book.uid);expect(d.p.bag.some(it=>it.uid===d.book.uid)).toBe(false);expect(collectRecoveryQuote(d.w,d.guard).error).toContain('자리');d.p.bag=d.p.bag.filter(it=>it.gx!==9||(it.gy??0)<4);finish(d,10);expect(d.p.bag.filter(it=>it.uid===d.book.uid)).toHaveLength(1);expect(d.guard.recoveryCargo).toBeUndefined()
 })
 it('어두운 현장에서는 원본을 식별해 꺼내지 않고 자기 등불을 켠 뒤 이어 간다',()=>{
  const d=companionRecoveryFixture();d.guard.equip.off!.lit=false;invalidateLights(d.w);d.act({type:'companionRecoveryAssign',target:d.guard.id,contract:d.record!.id});finish(d,25);expect(d.source.cont!.items.some(it=>it.uid===d.book.uid)).toBe(true);expect(d.guard.companionRecovery!.reason).toContain('빛');expect(perform(d.w,d.guard,{type:'toggleLight',uid:d.guard.equip.off!.uid}).ok).toBe(true);finish(d);expect(d.p.bag.some(it=>it.uid===d.book.uid)).toBe(true)
 })
 it('주인공이 맡긴 지시 중단/일반 대기 명령은 원본을 생성하거나 소비하지 않는다',()=>{
  const d=companionRecoveryFixture('assigned');d.act({type:'companionRecoveryStop',target:d.guard.id});expect(d.guard.companionRecovery).toBeUndefined();expect(d.source.cont!.items.some(it=>it.uid===d.book.uid)).toBe(true)
  const e=companionRecoveryFixture('assigned');expect(commandCompanion(e.w,e.guard,'hold')).toBeNull();expect(e.guard.companionRecovery).toBeUndefined();expect(e.source.cont!.items.some(it=>it.uid===e.book.uid)).toBe(true)
 })
 it('운반 중 중단/해산해도 원본은 같은 사람에게 남고 곁에서 자발적으로 돌려받는다',()=>{
  const d=companionRecoveryFixture('carrying');d.p.pos={x:d.guard.pos.x-1,y:d.guard.pos.y};invalidateLights(d.w);updatePlayerVision(d.w,d.p);expect(stopCompanionRecovery(d.w,d.guard)).toBeNull();expect(d.guard.bag.some(it=>it.uid===d.book.uid)).toBe(true);expect(dismissCompanion(d.w,d.guard)).toBeNull();expect(d.guard.recoveryCargo!.uid).toBe(d.book.uid);expect(collectRecoveryCargo(d.w,d.guard)).toBeNull();expect(d.p.bag.filter(it=>it.uid===d.book.uid)).toHaveLength(1);expect(d.guard.money).toBe(40);expect(d.p.money).toBe(960)
 })
 it('원격 회수/가짜 동료/주인공 배우로는 물품을 옮기지 않는다',()=>{
  const d=companionRecoveryFixture('carrying'),before=stateHash(d.s);expect(collectRecoveryCargo(d.w,d.guard)).toBeTruthy();expect(companionRecoveryFetch(d.w,structuredClone(d.guard))).toBeTruthy();expect(companionRecoveryReturn(d.w,d.p)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('계약 기한이 지나도 이미 전달한 물리 지시를 원격으로 지우지 않고 보수는 돌려놓는다',()=>{
  const d=companionRecoveryFixture('assigned');d.record!.deadline=turnOf(d.w)+3;finish(d);expect(d.p.bag.some(it=>it.uid===d.book.uid)).toBe(true);expect(d.record!.status).toBe('expired');expect(d.record!.escrow).toBe(0);expect(d.market.money).toBe(1000);expect(d.p.money).toBe(960)
 })
 it('원래 임무와 지도에 묶인 수색만 끝내며 바뀐 지시는 원자적으로 멈춘다',()=>{
  const d=companionRecoveryFixture('assigned');d.guard.pos={x:22,y:8};d.source.cont!.opened=false;invalidateLights(d.w);expect(companionRecoveryFetch(d.w,d.guard)).toBeNull();expect(d.guard.activity!.kind).toBe('search');expect(d.guard.activity!.recoveryContract).toBe(d.record!.id);const copy=structuredClone(d.guard.activity!);d.guard.companionRecovery!.mapId='other';expect(companionRecoverySearchError(d.w,d.guard,copy)).toBeTruthy();activityStep(d.w,d.guard);expect(d.guard.activity).toBeUndefined();expect(d.source.cont!.opened).toBe(false);expect(d.source.cont!.items.some(it=>it.uid===d.book.uid)).toBe(true)
 })
 it('진행 중20턴의 원래 인물/이동/운반/원본/보수가 전체 복원 뒤에도 같다',()=>{
  const d=companionRecoveryFixture('pending');expect(d.s.simulationPending).toBe(true);const w:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.p.bag.some(it=>it.uid===d.book.uid)).toBe(true);expect(d.record!.status).toBe('active');expect(d.record!.escrow).toBe(308)
 })
 it('142각인에 과거 동료 지시/운반 원본을 소급하지 않는다',()=>{
  const d=companionRecoveryFixture(),raw=JSON.parse(serialize(d.s));raw.version=142;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:142}).toEqual(raw)
 })
})
