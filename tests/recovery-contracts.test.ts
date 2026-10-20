import {describe,it,expect} from 'vitest'
import {recoveryContractsFixture} from './recovery-contracts-fixture'
import {acceptRecovery,deliverRecovery,recoveryOffers,recoveryQuote} from '../src/core/recovery-contracts'
import {cancelSupply,contractAccess,contractsTick} from '../src/core/contracts'
import {reputation} from '../src/core/diplomacy'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {changeMap,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {turnOf,type World} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
const total=(d:ReturnType<typeof recoveryContractsFixture>)=>(d.p.money??0)+Object.values(d.m.markets??{}).reduce((n,m)=>n+m.money,0)+(d.m.contracts??[]).reduce((n,r)=>n+r.escrow,0)
describe('직접 확인한 용기의 같은 원본 물품 회수',()=>{
 it('열기 전에는 원본 물품이 있어도 식별 기록을 만들지 않는다',()=>{
  const d=recoveryContractsFixture('inspect');expect(d.source.cont!.items.some(i=>i.uid===d.book.uid)).toBe(true);expect(d.source.observed?.contents).toBeUndefined()
  const next=d.s.nextId,rng=structuredClone(d.s.rng);updatePlayerVision(d.w,d.p);expect(d.source.observed?.contents).toBeUndefined();expect(d.s.nextId).toBe(next);expect(d.s.rng).toEqual(rng)
 })
 it('실제 공개 수색은 원래UID/정의/개수와 직접 확인 시각만 복사한다',()=>{
  const d=recoveryContractsFixture('inspect'),at=d.s.time;d.act({type:'search'});expect(d.s.time-at).toBe(100);expect(d.source.observed!.contents).toMatchObject({terrain:'Terrain.Chest',at:turnOf(d.w),items:expect.arrayContaining([{uid:d.book.uid,def:d.book.def,count:1}])});expect(d.book).not.toHaveProperty('note')
 })
 it('열려 있어도 멀리 있거나 식별할 밝기가 없으면 내용물을 새로 기록하지 않는다',()=>{
  const d=recoveryContractsFixture('inspected'),old=structuredClone(d.source.observed!.contents);d.source.cont!.items=[];d.p.pos={x:6,y:15};updatePlayerVision(d.w,d.p);expect(d.source.observed!.contents).toEqual(old)
  d.p.pos={x:22,y:8};for(const it of Object.values(d.p.equip))if(it)it.lit=false;d.s.map.lights=[];invalidateLights(d.w);updatePlayerVision(d.w,d.p);expect(d.source.observed!.contents).toEqual(old)
 })
 it('숨은 현재 용기의 변경을 게시판이 몰래 읽지 않고 과거 원본 사본을 사용한다',()=>{
  const d=recoveryContractsFixture(),offer=d.offer!,map=d.m.scenes['Region.ShadeGrove'].map;map.tiles[d.pos.y*map.w+d.pos.x].cont!.items=[];const before=stateHash(d.s);expect(recoveryOffers(d.w,d.p,d.trader)[0]).toEqual(offer);expect(stateHash(d.s)).toBe(before)
 })
 it('구형 용기의 현재 물품으로 과거 원본ID를 추정하지 않는다',()=>{
  const d=recoveryContractsFixture(),map=d.m.scenes['Region.ShadeGrove'].map;delete map.tiles[d.pos.y*map.w+d.pos.x].observed!.contents;expect(recoveryOffers(d.w,d.p,d.trader)).toEqual([])
 })
 it('실제 수락1턴에 원래 보수만 예치하고 원본은 현장에 둔다',()=>{
  const d=recoveryContractsFixture(),o=d.offer!,at=d.s.time,cash=total(d),uid=d.book.uid;d.act({type:'recoveryAccept',target:d.trader.id,offer:o.id,expectedReward:o.reward});const r=d.m.contracts!.at(-1)!
  expect(d.s.time-at).toBe(100);expect(r.kind).toBe('recover');expect(r.escrow).toBe(o.reward);expect(d.market.money).toBe(1000-o.reward);expect(total(d)).toBe(cash);expect(d.source.cont!.items.some(i=>i.uid===uid)).toBe(true);expect(d.p.bag.some(i=>i.uid===uid)).toBe(false)
 })
 it('읽기 전용 게시/잔액 부족/보수 변경/중복 수락은 전체 상태를 보존한다',()=>{
  const d=recoveryContractsFixture(),o=d.offer!,before=stateHash(d.s);expect(recoveryOffers(d.w,d.p,d.trader)[0]).toEqual(o);expect(acceptRecovery(d.w,d.p,d.trader,o.id,o.reward+1)).toBeTruthy();expect(stateHash(d.s)).toBe(before);d.market.money=o.reward-1;const poor=stateHash(d.s);expect(acceptRecovery(d.w,d.p,d.trader,o.id)).toBeTruthy();expect(stateHash(d.s)).toBe(poor)
 })
 it('같은 종류의 다른 실제 물품으로는 원본을 대신하지 못한다',()=>{
  const d=recoveryContractsFixture('substitute'),r=d.record!,other=d.p.bag.find(i=>i.def===d.book.def)!;expect(other.uid).not.toBe(r.itemUid);const before=stateHash(d.s);expect(recoveryQuote(d.w,d.p,d.trader,r.id).error).toBeTruthy();expect(deliverRecovery(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('실제 꺼내기는 같은 원본UID를 옮기고 다른 현장 물품을 보존한다',()=>{
  const d=recoveryContractsFixture('pickup'),others=d.source.cont!.items.filter(i=>i.uid!==d.book.uid).map(i=>({...i}));d.act({type:'search'});d.act({type:'lootTake',uid:d.book.uid});expect(d.p.bag.find(i=>i.uid===d.book.uid)!.def).toBe(d.book.def);expect(d.source.cont!.items.some(i=>i.uid===d.book.uid)).toBe(false);expect(d.source.cont!.items).toEqual(others)
 })
 it('납품1턴에 같은 원본과 읽은 진행/상태를 상인에게 옮기고 예치금만 지급한다',()=>{
  const d=recoveryContractsFixture('deliver'),r=d.record!,item=d.p.bag.find(i=>i.uid===d.book.uid)!;item.readPages=3;item.readProgress=7;item.durability=57;const original={...item},next=d.s.nextId,cash=total(d),money=d.p.money??0,rep=reputation(d.w,d.trader.faction),at=d.s.time
  d.act({type:'recoveryDeliver',target:d.trader.id,contract:r.id,expectedReward:r.reward});expect(d.s.time-at).toBe(100);expect(r.status).toBe('completed');expect(r.escrow).toBe(0);expect(r.recipient).toMatchObject({uid:item.uid,def:item.def});expect(d.p.bag.some(i=>i.uid===item.uid)).toBe(false);const delivered=d.market.items.find(i=>i.uid===item.uid)!;expect(delivered).toMatchObject({uid:original.uid,readPages:3,readProgress:7,durability:57});expect(delivered).not.toHaveProperty('gx');expect(d.s.nextId).toBe(next);expect(total(d)).toBe(cash);expect(d.p.money).toBe(money+r.reward);expect(reputation(d.w,d.trader.faction)).toBe(rep+5)
 })
 it('완료한 원본은 같은/다른 시장 의뢰로 다시 지급하지 않는다',()=>{
  const d=recoveryContractsFixture('completed'),r=d.record!,before=stateHash(d.s);expect(deliverRecovery(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(recoveryOffers(d.w,d.p,d.trader)).toEqual([]);expect(stateHash(d.s)).toBe(before)
 })
 it('원본을 실제로 갖지 않거나 상태가 부족하면 현금을 바꾸지 않는다',()=>{
  const d=recoveryContractsFixture('deliver'),r=d.record!,item=d.p.bag.find(i=>i.uid===d.book.uid)!;item.durability=19;const before=stateHash(d.s);expect(deliverRecovery(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('틀린 보수/가득 찬 지갑은 원본 물품/장부를 전부 보존한다',()=>{
  const d=recoveryContractsFixture('deliver'),r=d.record!,before=stateHash(d.s);expect(deliverRecovery(d.w,d.p,d.trader,r.id,r.reward+1)).toBeTruthy();expect(stateHash(d.s)).toBe(before);d.p.money=Number.MAX_SAFE_INTEGER;const capped=stateHash(d.s);expect(deliverRecovery(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(capped)
 })
 it('취소/기한 만료는 원래 장부만 환급하고 현장 원본을 복제/이동하지 않는다',()=>{
  const d=recoveryContractsFixture('accepted');expect(cancelSupply(d.w,d.p,d.trader,d.record!.id)).toBeNull();expect(d.market.money).toBe(1000);expect(d.source.cont!.items.some(i=>i.uid===d.book.uid)).toBe(true)
  const e=recoveryContractsFixture('accepted');e.s.time=e.record!.deadline*100;contractsTick(e.w);expect(e.record!.status).toBe('expired');expect(e.market.money).toBe(1000);expect(e.source.cont!.items.some(i=>i.uid===e.book.uid)).toBe(true)
 })
 it('다른 실제 시장에서도 이미 맡은 같은 원본의 중복 의뢰는 게시하지 않는다',()=>{
  const d=recoveryContractsFixture('accepted');d.field();changeMap(d.w,'surface');const trader=d.s.creatures.find(c=>c.traderSite==='Region.ShadeGrove')!;expect(trader).toBeDefined();const positions=[{x:trader.pos.x-1,y:trader.pos.y},{x:trader.pos.x+1,y:trader.pos.y}];d.p.pos=positions.find(p=>d.w.db.terrain(d.s.map.tiles[p.y*d.s.map.w+p.x].t).passable&&!d.s.creatures.some(c=>c.alive&&c.pos.x===p.x&&c.pos.y===p.y))!;invalidateLights(d.w);updatePlayerVision(d.w,d.p);expect(contractAccess(d.w,d.p,trader)).toBeNull();const before=stateHash(d.s);expect(recoveryOffers(d.w,d.p,trader)).toEqual([]);expect(stateHash(d.s)).toBe(before)
 })
 it('전체 복원 뒤에도 원본은 실제 소지처 한 곳에만 있고 기억은 복제 물품이 아니다',()=>{
  const d=recoveryContractsFixture('completed'),copy=deserialize(serialize(d.s)),p=copy.creatures.find(c=>c.id===copy.playerId)!,scene=copy.overworld!.scenes['Region.ShadeGrove'],tile=scene.map.tiles[d.pos.y*scene.map.w+d.pos.x],market=copy.overworld!.markets![d.market.site];expect([...p.bag,...tile.cont!.items,...market.items].filter(i=>i.uid===d.book.uid)).toHaveLength(1);expect(market.items.some(i=>i.uid===d.book.uid)).toBe(true);expect(copy.overworld!.contracts!.find(r=>r.id===d.record!.id)!.status).toBe('completed')
 })
 it('진행 중20턴 전체 복원은 기억한 원본/실제 물품/예치/몸/난수를 보존한다',()=>{
  const d=recoveryContractsFixture('pending');expect(d.s.simulationPending).toBe(true);const w:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)))
 })
 it('141각인에 과거 용기 물품 관찰/의뢰를 소급하지 않는다',()=>{
  const d=recoveryContractsFixture(),raw=JSON.parse(serialize(d.s));raw.version=141;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:141}).toEqual(raw)
 })
 it.each([['/wealthMult',2],['/targets/0/item','Item.Stone'],['/targets/0/terrain','Terrain.KtFloor'],['/targets/0/pos',[200,1]]])('개별 원본/현장/보수 설정이 맞지 않으면 시작 전에 거절한다 (%s)',(path,value)=>{
  const {report}=loadMods([...readPackages(),{manifest:{id:'bad-recovery',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'RecoveryContract.Hearth',path,value}]}],['bad-recovery']);expect(report.errors.some(e=>e.includes('RecoveryContract.Hearth'))).toBe(true)
 })
})
