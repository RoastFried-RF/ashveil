import {describe,it,expect}from'vitest'
import {ashCakeSupplyFixture}from'./ash-cake-fixture'
import {ashDepositCount,initializeAshDeposits,refreshAshExposure,settleAshDeposits,takeAshDeposit}from'../src/core/ash-deposits'
import {tileAt,turnOf,TURNS_PER_DAY,type World}from'../src/core/ctx'
import {serialize,deserialize}from'../src/core/save'
import {finishGather,nearbyGather,startGather}from'../src/core/crafting'
import {observedGatherAvailable}from'../src/core/gather-state'
import {SAVE_VERSION,playerAct}from'../src/core/game'

const pos={x:30,y:24}
function setup(){const d=ashCakeSupplyFixture(),tower=d.s.overworld!.towers.find(t=>t.id==='Region.ChimneySeven')!,pool=Object.values(tower.ashDeposits!).find(p=>p.pos.x===pos.x)!;return{...d,tower,pool,start:turnOf(d.w)}}
const advance=(d:ReturnType<typeof setup>,turns:number)=>{d.s.time+=turns*100}

describe('actual tower emissions, finite catchments and physical gathering',()=>{
 it('generates original drifts once without allocating item UIDs or query side effects',()=>{
  const d=setup(),before=serialize(d.s);expect(d.pool.initial).toBe(4);expect(ashDepositCount(d.w,pos)).toBe(4)
  for(let i=0;i<5;i++){observedGatherAvailable(d.w,pos);nearbyGather(d.w,d.p);initializeAshDeposits(d.w,true)}
  expect(serialize(d.s)).toBe(before)
 })
 it('integrates the real 80% source with exact fractional carry across arbitrary clock partitions',()=>{
  const d=setup(),copy:World={db:d.w.db,s:deserialize(serialize(d.s))},carry=d.pool.remainder
  advance(d,TURNS_PER_DAY);settleAshDeposits(d.w);expect(d.pool.stock).toBe(8);expect(d.pool.deposited).toBe(4);expect(d.pool.remainder).toBe(carry+2304000000)
  const end=turnOf(d.w);while(turnOf(copy)<end){copy.s.time=Math.min(end,turnOf(copy)+137)*100;settleAshDeposits(copy)}
  expect(copy.s.overworld!.towers).toEqual(d.s.overworld!.towers)
 })
 it('changes output at the recorded boundary and stops new ash immediately on shutdown',()=>{
  const d=setup();d.tower.history=[{turn:0,output:80},{turn:d.start+TURNS_PER_DAY/2,output:0}];d.tower.output=0
  advance(d,TURNS_PER_DAY);settleAshDeposits(d.w);expect(d.pool.deposited).toBe(2);const before={...d.pool}
  advance(d,100*TURNS_PER_DAY);settleAshDeposits(d.w);expect({...d.pool,at:before.at}).toEqual(before)
 })
 it('caps storage and accounts for actual overflow instead of banking hidden harvestable units',()=>{
  const d=setup();advance(d,10*TURNS_PER_DAY);settleAshDeposits(d.w)
  expect(d.pool.stock).toBe(12);expect(d.pool.deposited).toBe(48);expect(d.pool.lost).toBe(40)
  expect(takeAshDeposit(d.w,pos,12)).toBe(12);expect(ashDepositCount(d.w,pos)).toBe(0)
  advance(d,TURNS_PER_DAY);expect(ashDepositCount(d.w,pos)).toBe(4)
  expect(d.pool.initial+d.pool.deposited).toBe(d.pool.stock+d.pool.taken+d.pool.lost)
 })
 it('closes exposure intervals so reopening a covered floor cannot collect its covered past',()=>{
  const d=setup();advance(d,TURNS_PER_DAY/2);settleAshDeposits(d.w);tileAt(d.w,pos).roof=true;refreshAshExposure(d.w)
  advance(d,10*TURNS_PER_DAY);settleAshDeposits(d.w);expect(d.pool.deposited).toBe(2)
  tileAt(d.w,pos).roof=false;refreshAshExposure(d.w);advance(d,TURNS_PER_DAY/2);settleAshDeposits(d.w);expect(d.pool.deposited).toBe(4)
 })
 it('gathers only one physical bundle after a real job even when the catchment holds twelve',()=>{
  const d=setup();advance(d,10*TURNS_PER_DAY);settleAshDeposits(d.w);d.p.pos={x:30,y:25}
  const before=d.p.bag.reduce((n,i)=>n+(i.def==='Item.PilgrimAsh'?i.count:0),0)
  expect(startGather(d.w,d.p,pos,1)).toBeNull();expect(d.p.activity!.remaining).toBe(200)
  // Isolated completion of the declared job; normal scheduler/UI coverage is separate.
  finishGather(d.w,d.p)
  expect(d.p.bag.reduce((n,i)=>n+(i.def==='Item.PilgrimAsh'?i.count:0),0)).toBe(before+1);expect(d.pool.stock).toBe(11);expect(d.pool.taken).toBe(1)
 })
 it('empty drifts stay empty under observation and are excluded from starting a job',()=>{
  const d=setup();d.p.pos={x:30,y:25};takeAshDeposit(d.w,pos,4);const before=serialize(d.s)
  expect(observedGatherAvailable(d.w,pos)).toBe(false);expect(nearbyGather(d.w,d.p)).not.toContainEqual(pos);expect(startGather(d.w,d.p,pos,1)).not.toBeNull();expect(serialize(d.s)).toBe(before)
 })
 it('save/restore and content initialization preserve the same exact historical stock',()=>{
  const d=setup();takeAshDeposit(d.w,pos,3);advance(d,7777)
  const copy:World={db:d.w.db,s:deserialize(serialize(d.s))},before=serialize(copy.s);initializeAshDeposits(copy,true)
  expect(serialize(copy.s)).toBe(before);expect(ashDepositCount(copy,pos)).toBe(ashDepositCount(d.w,pos));expect(copy.s.version).toBe(SAVE_VERSION)
 })
 it('old visited ground gets no retroactive ash and unrelated property is never overwritten',()=>{
  const d=setup();delete d.tower.ashDeposits;tileAt(d.w,pos).t='Terrain.Earth';tileAt(d.w,{x:34,y:24}).t='Terrain.Earth';tileAt(d.w,{x:34,y:24}).roof=true
  advance(d,30*TURNS_PER_DAY);initializeAshDeposits(d.w)
  expect(ashDepositCount(d.w,pos)).toBe(0);expect(tileAt(d.w,{x:34,y:24}).t).toBe('Terrain.Earth');expect(Object.values(d.tower.ashDeposits!)).toHaveLength(1)
 })
 it.each(['Terrain.KtFloor','Terrain.DoorOpen','Terrain.Fungus'])('does not replace an existing %s with newly adopted content',terrain=>{
  const d=setup();delete d.tower.ashDeposits;tileAt(d.w,pos).t=terrain;tileAt(d.w,{x:34,y:24}).roof=true
  initializeAshDeposits(d.w,true);expect(tileAt(d.w,pos).t).toBe(terrain);expect(d.tower.ashDeposits).toBeUndefined()
 })
 it('removed deposit terrain retains the ledger and cannot receive a second initial stock',()=>{
  const d=setup();takeAshDeposit(d.w,pos,4);tileAt(d.w,pos).t='Terrain.Earth';refreshAshExposure(d.w);advance(d,10*TURNS_PER_DAY);settleAshDeposits(d.w);initializeAshDeposits(d.w,true)
  expect(d.pool.stock).toBe(0);expect(d.pool.taken).toBe(4);expect(tileAt(d.w,pos).t).toBe('Terrain.Earth')
 })
 it('leaving, saving the dormant map, and returning settles the same catchment without replenishing its initial stock',()=>{
  const d=setup();takeAshDeposit(d.w,pos,3);d.p.pos={...d.s.map.exits[0]!}
  for(const c of d.s.creatures)if(c.id!==d.p.id)c.nextAct=d.s.time+1e9
  expect(playerAct(d.w,{type:'leave'})).toBeNull()
  const copy:World={db:d.w.db,s:deserialize(serialize(d.s))};copy.s.time+=10*TURNS_PER_DAY*100
  expect(playerAct(copy,{type:'enterRegion'})).toBeNull()
  const pool=Object.values(copy.s.overworld!.towers.find(t=>t.id===d.tower.id)!.ashDeposits!).find(p=>p.pos.x===pos.x)!
  expect(pool.initial).toBe(4);expect(pool.taken).toBe(3);expect(pool.stock).toBe(12);expect(pool.deposited).toBe(48);expect(pool.lost).toBe(37)
  const before=serialize(copy.s);initializeAshDeposits(copy,true);expect(serialize(copy.s)).toBe(before)
 })
 it.each(['stock','deposited','taken','lost','remainder','at','rate','capacity']as const)('rejects corrupt %s even with escaped JSON names',field=>{
  const d=setup();d.pool[field]=-1;const raw=serialize(d.s).replaceAll('"ashDeposits"','"ash\\u0044eposits"');expect(()=>deserialize(raw)).toThrow(/재/)
 })
 it('migration preserves an old body and does not manufacture a source ledger',()=>{const d=setup();delete d.tower.ashDeposits;d.s.version=220;const body=structuredClone(d.p.body),copy=deserialize(serialize(d.s));expect(copy.version).toBe(221);expect(copy.overworld!.towers.find(t=>t.id===d.tower.id)!.ashDeposits).toBeUndefined();expect(copy.creatures.find(c=>c.id===d.p.id)!.body).toEqual(body)})
})
