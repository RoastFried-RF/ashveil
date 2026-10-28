import {describe,it,expect} from 'vitest'
import {patrolContractsFixture} from './patrol-contracts-fixture'
import {patrolOffers,acceptPatrolContract,patrolVisitQuote,visitPatrolContract,patrolReportQuote,reportPatrolContract} from '../src/core/patrol-contracts'
import {cancelSupply,contractsTick} from '../src/core/contracts'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {turnOf,tileAt} from '../src/core/ctx'
import {makeItem} from '../src/core/items'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {invalidateLights} from '../src/core/fov'
import {reputation} from '../src/core/diplomacy'
const cash=(d:ReturnType<typeof patrolContractsFixture>)=>(d.p.money??0)+d.market.money+(d.m.contracts??[]).reduce((n,r)=>n+r.escrow,0)
describe('실제 정착지 경로 순찰',()=>{
 it('조회는 순서 사본만 반환하고 원격 적·인구·난수·현물·장부를 바꾸지 않는다',()=>{
  const d=patrolContractsFixture(),before=stateHash(d.s),offer=patrolOffers(d.w,d.p,d.trader)[0];expect(offer).toEqual(d.offer);offer.points[0].pos.x++;expect(patrolOffers(d.w,d.p,d.trader)[0]).toEqual(d.offer);expect(stateHash(d.s)).toBe(before)
 })
 it('실제 수락1턴에 기존 장부20만 예치하고 과거 이동을 순찰로 소급하지 않는다',()=>{
  const d=patrolContractsFixture(),at=d.s.time,total=cash(d);d.act({type:'patrolContractAccept',target:d.trader.id,offer:d.offer.id,expectedReward:d.offer.reward});const r=d.m.contracts!.at(-1)!;expect(d.s.time-at).toBe(100);expect(r.escrow).toBe(20);expect(r).toHaveProperty('visits',[]);expect(d.market.money).toBe(980);expect(d.p.money).toBeUndefined();expect(cash(d)).toBe(total)
 })
 it('잔액 부족·바뀐 보수·중복 수락은 전체 상태를 보존한다',()=>{
  const d=patrolContractsFixture();let before=stateHash(d.s);expect(acceptPatrolContract(d.w,d.p,d.trader,d.offer.id,21)).toBeTruthy();expect(stateHash(d.s)).toBe(before);d.market.money=19;before=stateHash(d.s);expect(patrolOffers(d.w,d.p,d.trader)).toEqual([]);expect(acceptPatrolContract(d.w,d.p,d.trader,d.offer.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  const e=patrolContractsFixture('accepted');before=stateHash(e.s);expect(acceptPatrolContract(e.w,e.p,e.trader,e.offer.id)).toBeTruthy();expect(stateHash(e.s)).toBe(before)
 })
 it('실제 순서대로 걷고 확인1턴씩만 기록하며 현장 확인에 돈을 지급하지 않는다',()=>{
  const d=patrolContractsFixture('first'),r=d.record!,total=cash(d)
  for(let i=0;i<r.points.length;i++){d.walk(r.points[i].pos);const before=stateHash(d.s),q=patrolVisitQuote(d.w,d.p,r.id);expect(q.error).toBeNull();expect(stateHash(d.s)).toBe(before);const at=d.s.time;d.act({type:'patrolContractVisit',contract:r.id});expect(d.s.time-at).toBe(100);expect(r.visits).toHaveLength(i+1);expect(r.visits[i]).toMatchObject({at:at/100,by:d.p.id,index:i});expect(d.p.money).toBeUndefined();expect(cash(d)).toBe(total)}
  expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActors);expect(r.visits.every((v,i)=>i===0||v.at>r.visits[i-1].at)).toBe(true)
 })
 it('나중 지점에 먼저 가도 첫 지점 대신 인정하지 않는다',()=>{
  const d=patrolContractsFixture('accepted');d.walk(d.record!.points[1].pos);const before=stateHash(d.s);expect(visitPatrolContract(d.w,d.p,d.record!.id)).toBeTruthy();expect(d.record!.visits).toEqual([]);expect(stateHash(d.s)).toBe(before)
 })
 it.each(['copy','npc','otherMap','otherRegion','asleep','unconscious','captive','dark','deadline']as const)('실제 현장/몸/주체 조건 실패는 상태를 보존한다 (%s)',mode=>{
  const d=patrolContractsFixture('first'),r=d.record!;let actor=d.p
  if(mode==='copy')actor=structuredClone(d.p);if(mode==='npc')actor=d.trader;if(mode==='otherMap')d.p.mapId='crypt1';if(mode==='otherRegion')d.m.currentRegion='Region.GreyCloister';if(mode==='asleep')d.p.asleep=true;if(mode==='unconscious')d.p.unconscious=true;if(mode==='captive')d.p.captivity={captor:46,faction:'reavers',at:turnOf(d.w),rope:makeItem(d.w,'Item.Rope')}as typeof d.p.captivity;if(mode==='dark'){d.s.map.ambient=0;d.s.map.daylightMult=0;d.s.map.lights=[];for(const c of d.s.creatures)for(const it of Object.values(c.equip))if(it)it.lit=false;invalidateLights(d.w)}if(mode==='deadline')r.deadline=turnOf(d.w)
  const before=stateHash(d.s);expect(visitPatrolContract(d.w,actor,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('수락과 같은 시각 및 같은 시각 재확인은 진행을 만들지 않는다',()=>{
  const d=patrolContractsFixture('first'),r=d.record!;r.accepted=turnOf(d.w);const before=stateHash(d.s);expect(visitPatrolContract(d.w,d.p,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  r.accepted--;expect(visitPatrolContract(d.w,d.p,r.id)).toBeNull();d.walk(r.points[1].pos);r.visits[0].at=turnOf(d.w);const after=stateHash(d.s);expect(visitPatrolContract(d.w,d.p,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(after)
 })
 it('전체 순찰 후 실제 의뢰인에게 걸어 돌아와 보고1턴에 예치금만 지급한다',()=>{
  const d=patrolContractsFixture('report'),r=d.record!,total=cash(d),at=d.s.time,rep=reputation(d.w,d.trader.faction);expect(patrolReportQuote(d.w,d.p,d.trader,r.id).error).toBeNull();d.act({type:'patrolContractReport',target:d.trader.id,contract:r.id,expectedReward:20});expect(d.s.time-at).toBe(100);expect(r.status).toBe('completed');expect(r.escrow).toBe(0);expect(d.p.money).toBe(20);expect(d.market.money).toBe(980);expect(cash(d)).toBe(total);expect(reputation(d.w,d.trader.faction)).toBe(rep+2);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActors);expect(patrolOffers(d.w,d.p,d.trader)).toEqual([])
  const before=stateHash(d.s);expect(reportPatrolContract(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it.each(['partial','overflow','badReward','copy','copyTrader','outOfOrder','future']as const)('잘못된 보고는 예치·기록·전체 상태를 보존한다 (%s)',mode=>{
  const d=patrolContractsFixture(mode==='partial'?'accepted':'report'),r=d.record!;if(mode==='overflow')d.p.money=Number.MAX_SAFE_INTEGER;if(mode==='outOfOrder')r.visits.reverse();if(mode==='future')r.visits[2].at=turnOf(d.w)+1
  const before=stateHash(d.s);expect(reportPatrolContract(d.w,mode==='copy'?structuredClone(d.p):d.p,mode==='copyTrader'?structuredClone(d.trader):d.trader,r.id,mode==='badReward'?21:20)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('취소/기한은 실제 장부로만 반환하고 확인 기록/과거 이동을 조작하지 않는다',()=>{
  const d=patrolContractsFixture('second'),visits=structuredClone(d.record!.visits);expect(cancelSupply(d.w,d.p,d.trader,d.record!.id)).toBeTruthy();d.walk(d.trader.pos);expect(cancelSupply(d.w,d.p,d.trader,d.record!.id)).toBeNull();expect(d.market.money).toBe(1000);expect(d.p.money).toBeUndefined();expect(d.record!.visits).toEqual(visits)
  const e=patrolContractsFixture('accepted');e.s.time=e.record!.deadline*100;contractsTick(e.w);expect(e.record!.status).toBe('expired');expect(e.market.money).toBe(1000);expect(e.p.money).toBeUndefined()
 })
 it('수락 조건은 실제 화덕/현재 지도/주체를 확인하고 복사한 사람을 거절한다',()=>{
  const d=patrolContractsFixture();expect(patrolOffers(d.w,structuredClone(d.p),d.trader)).toEqual([]);expect(patrolOffers(d.w,d.p,structuredClone(d.trader))).toEqual([]);tileAt(d.w,{x:32,y:18}).t='Terrain.Dirt';expect(patrolOffers(d.w,d.p,d.trader)).toEqual([])
 })
 it('미완료 순찰과20턴 활동 전체는 저장 복원 뒤 동일한 결과를 낸다',()=>{
  const d=patrolContractsFixture('pending'),encoded=serialize(d.s);expect(deserialize(encoded)).toEqual(d.s);const restored={db:d.w.db,s:deserialize(encoded)},at=d.s.time;runUntilInput(d.w);runUntilInput(restored);expect(d.s.time-at).toBe(2000);expect(restored.s).toEqual(d.s);expect(d.record!.visits).toEqual([])
 })
 it('152각인은 버전만 올리고 과거 순찰을 생성하지 않는다',()=>{
  const d=patrolContractsFixture(),s=structuredClone(d.s);s.version=152;expect(deserialize(JSON.stringify(s))).toEqual({...s,version:SAVE_VERSION})
 })
 it.each([['/wealthMult',2],['/routes/0/region','Region.GreyCloister'],['/routes/0/points/0/pos',[-1,20]],['/routes/0/points',[]],['/routes/0/anchor/terrain','Terrain.Missing'],['/deadlineDays',0]])('잘못된 경로/수치를 시작 전에 거절한다 (%s)',(path,value)=>{
  const {report}=loadMods([...readPackages(),{manifest:{id:'bad-patrol',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'PatrolContract.Hearth',path,value}]}],['bad-patrol']);expect(report.errors.some(e=>e.includes('PatrolContract.Hearth'))).toBe(true)
 })
})
