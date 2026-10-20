import {describe,it,expect} from 'vitest'
import {rescueContractsFixture} from './rescue-contracts-fixture'
import {ransomFixture} from './ransom-fixture'
import {ransomQuote,startRansom,cancelRansom} from '../src/core/ransom'
import {killCreature} from '../src/core/combat'
import {activityStep} from '../src/core/actions'
import {releaseRansomedPrisoner,releaseCaptivity} from '../src/core/prisoners'
import {stopActivity,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {allItems} from '../src/core/items'
import {invalidateLights} from '../src/core/fov'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import type {World} from '../src/core/ctx'
describe('같은 포로/밧줄과 실제 개인 지갑의 몸값 합의',()=>{
 it('순수 견적은 실제 두 사람/포로의 곁에서20턴200표를 제시한다',()=>{
  const d=ransomFixture(),before=stateHash(d.s);expect(ransomQuote(d.w,d.p,d.captor,d.victim)).toMatchObject({error:null,price:200,turns:20});expect(stateHash(d.s)).toBe(before)
 })
 it('시작은 같은 원본의 두 활동만 만들고 돈/실물/포박을 옮기지 않는다',()=>{
  const d=ransomFixture(),next=d.s.nextId,cap=structuredClone(d.victim.captivity);expect(startRansom(d.w,d.p,d.captor.id,d.victim.id,200)).toBeNull();expect(d.p.activity).toMatchObject({kind:'ransom',total:20,ransom:{payer:d.p.id,holder:46,person:85,ropeUid:163,price:200}});expect(d.captor.activity).toMatchObject({kind:'ransomWait',ransom:{payer:d.p.id,holder:46,person:85,ropeUid:163}});expect(d.p.activity!.ransom).not.toBe(d.captor.activity!.ransom);expect(d.p.money).toBe(960);expect(d.captor.money).toBe(d.proof.originalHolderMoney);expect(d.victim.captivity).toEqual(cap);expect(d.s.nextId).toBe(next)
 })
 it('실제 공개20턴 완료 때만 같은 원본을 풀고 두 지갑의200표를 한 번만 옮긴다',()=>{
  const d=ransomFixture(),at=d.s.time,next=d.s.nextId,xp=d.p.xp,body=structuredClone(d.victim.body),items=allItems(d.victim).filter(i=>i.uid!==163).map(i=>[i.uid,i.def,i.count]),owner=d.victim.faction,contract=structuredClone(d.victim.companion),money=d.victim.money,bank=d.proof.originalBank
  d.act({type:'ransom',holder:d.captor.id,person:d.victim.id,expectedPrice:200});expect(d.s.time-at).toBe(2000);expect(d.p.money).toBe(760);expect(d.captor.money).toBe((d.proof.originalHolderMoney??0)+200);expect(d.victim.money).toBe(money);expect(d.s.overworld!.markets!['Region.ShepherdDale'].money).toBe(bank);expect(d.victim.captivity).toBeUndefined();expect(d.victim.alive).toBe(true);expect(d.victim.rescue).toMatchObject({by:d.p.id,captor:d.captor.id});expect(d.victim.body).toEqual(body);expect(d.victim.faction).toBe(owner);expect(d.victim.companion!.employer).toBe(contract!.employer);expect(d.victim.companion!.paidUntil).toBe(contract!.paidUntil);expect(allItems(d.victim).map(i=>[i.uid,i.def,i.count])).toEqual(items);expect(d.p.xp).toBe(xp);expect(d.s.nextId).toBe(next);expect(d.s.map.tiles.flatMap(t=>t.items).filter(i=>i.uid===163)).toHaveLength(1);expect(d.p.activity).toBeUndefined();expect(d.captor.activity).toBeUndefined();const before=stateHash(d.s);expect(startRansom(d.w,d.p,d.captor.id,d.victim.id,200)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('석방 자체가 실신이나 원래 몸을 치료하지 않는다',()=>{
  const d=ransomFixture(),body=structuredClone(d.victim.body);expect(startRansom(d.w,d.p,d.captor.id,d.victim.id)).toBeNull();for(let i=0;d.p.activity&&i<30;i++)activityStep(d.w,d.p);expect(d.victim.unconscious).toBe(true);expect(d.victim.body).toEqual(body);expect(d.victim.captivity).toBeUndefined();expect(d.p.money).toBe(760)
 })
 it('실제 합의 석방도 같은 인물의 구조 증거가 되고 실제 귀환 뒤에만 예치를 받는다',()=>{
  const d=rescueContractsFixture('field');d.s.overworld!.society!.reputation.reavers=0;d.captor.needs.kcal=1000;d.act({type:'ransom',holder:d.captor.id,person:d.victim.id,expectedPrice:200});expect(d.p.money).toBe(760);expect(d.captor.money).toBe(200);expect(d.record!.proof).toMatchObject({by:d.p.id,ropeUid:d.proof.originalRopeUid});expect(d.record!.escrow).toBe(292);expect(d.market.money).toBe(708);d.home(true);d.act({type:'rescueContractReport',target:d.trader.id,contract:d.record!.id,expectedReward:292});expect(d.p.money).toBe(1052);expect(d.captor.money).toBe(200);expect(d.record!.escrow).toBe(0);expect(d.record!.status).toBe('completed');expect(d.market.money).toBe(708)
 })
 it('완료 전 한 차례의 작업은 지급하거나 석방하지 않는다',()=>{
  const d=ransomFixture();expect(startRansom(d.w,d.p,d.captor.id,d.victim.id,200)).toBeNull();activityStep(d.w,d.p);expect(d.p.activity!.remaining).toBe(19);expect(d.p.money).toBe(960);expect(d.captor.money).toBe(d.proof.originalHolderMoney);expect(d.victim.captivity!.rope.uid).toBe(163)
 })
 it.each(['price','poor','copy','holderMissing','personMissing','busy']as const)('잘못된 시작은 전체 상태를 바꾸지 않는다 (%s)',mode=>{
  const d=ransomFixture();if(mode==='poor')d.p.money=199;if(mode==='busy')d.captor.activity={kind:'rest',remaining:1,total:1,label:'기존 휴식'};const before=stateHash(d.s);expect(startRansom(d.w,mode==='copy'?structuredClone(d.p):d.p,mode==='holderMissing'?999999:d.captor.id,mode==='personMissing'?999999:d.victim.id,mode==='price'?201:200)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it.each(['copyHolder','copyPerson','far','holderFar','wrongMap','targetMap','asleep','holderSleep','deaf','hands','hostile','wrongCaptor','ownFaction','walletOverflow','dark']as const)('몸/현재배우/거리/시야/같은 포박/지갑 조건이 맞지 않으면 견적은 불변이다 (%s)',mode=>{
  const d=ransomFixture();if(mode==='far')d.p.pos={x:3,y:3};if(mode==='holderFar')d.captor.pos={x:3,y:3};if(mode==='wrongMap')d.captor.mapId='other';if(mode==='targetMap')d.victim.mapId='other';if(mode==='asleep')d.p.asleep=true;if(mode==='holderSleep')d.captor.asleep=true;if(mode==='deaf')d.p.body.missing=['LeftEar','RightEar'];if(mode==='hands')d.p.body.missing=['LeftUpperArm','RightUpperArm'];if(mode==='hostile')d.s.overworld!.society!.reputation.reavers=-100;if(mode==='wrongCaptor')d.victim.captivity!.captor=99999;if(mode==='ownFaction')d.victim.captivity!.faction=d.p.faction;if(mode==='walletOverflow')d.captor.money=Number.MAX_SAFE_INTEGER;if(mode==='dark'){d.p.equip.off!.lit=false;d.s.map.kind='dungeon';d.s.map.ambient=0;d.s.map.lights=[];invalidateLights(d.w)}const before=stateHash(d.s);expect(ransomQuote(d.w,d.p,mode==='copyHolder'?structuredClone(d.captor):d.captor,mode==='copyPerson'?structuredClone(d.victim):d.victim).error).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('플레이어의 실제 중단은 상대 대기를 함께 정리하며 원래 돈/포박을 보존한다',()=>{
  const d=ransomFixture('stopped');expect(d.p.activity).toBeUndefined();expect(d.captor.activity).toBeUndefined();expect(d.p.money).toBe(960);expect(d.captor.money).toBe(d.proof.originalHolderMoney);expect(d.victim.captivity!.rope.uid).toBe(163)
 })
 it('상대가 중단해도 같은 협상만 정리하고 지갑을 건드리지 않는다',()=>{
  const d=ransomFixture();expect(startRansom(d.w,d.p,d.captor.id,d.victim.id)).toBeNull();stopActivity(d.w,d.captor);expect(d.p.activity).toBeUndefined();expect(d.captor.activity).toBeUndefined();expect(d.p.money).toBe(960);expect(d.captor.money).toBe(d.proof.originalHolderMoney);expect(d.victim.captivity).toBeDefined()
 })
 it.each(['rope','holderMove','personMove','payerMove','money','holderSleep','map','released']as const)('진행 중 원본/상대/현장/지갑이 바뀌면 지급 없이 협상을 끝낸다 (%s)',mode=>{
  const d=ransomFixture();expect(startRansom(d.w,d.p,d.captor.id,d.victim.id)).toBeNull();if(mode==='rope')d.victim.captivity!.rope.uid++;if(mode==='holderMove')d.captor.pos.x--;if(mode==='personMove')d.victim.pos.x++;if(mode==='payerMove')d.p.pos.x++;if(mode==='money')d.p.money=199;if(mode==='holderSleep')d.captor.asleep=true;if(mode==='map')d.s.map.id='other';if(mode==='released')releaseCaptivity(d.w,d.victim);const beforeP=d.p.money,beforeHolder=d.captor.money;activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.captor.activity).toBeUndefined();expect(d.p.money).toBe(beforeP);expect(d.captor.money).toBe(beforeHolder)
 })
 it.each(['payer','holder']as const)('실제 협상 당사자 사망은 같은 대기만 정리하고 몸값을 지급하지 않는다 (%s)',side=>{
  const d=ransomFixture();expect(startRansom(d.w,d.p,d.captor.id,d.victim.id)).toBeNull();killCreature(d.w,side==='payer'?d.p:d.captor,'제어한 협상 중 사망');expect(d.p.activity).toBeUndefined();expect(d.captor.activity).toBeUndefined();expect(d.p.money).toBe(960);expect(d.captor.money).toBe(d.proof.originalHolderMoney);expect(d.victim.captivity).toBeDefined()
 })
 it('협상 아닌 새 상대 활동을 중단 정리가 지우지 않는다',()=>{
  const d=ransomFixture();expect(startRansom(d.w,d.p,d.captor.id,d.victim.id)).toBeNull();const rest={kind:'rest' as const,remaining:10,total:10,label:'다른 휴식'};d.captor.activity=rest;cancelRansom(d.w,d.p);expect(d.captor.activity).toBe(rest);expect(d.p.activity).toBeUndefined()
 })
 it('작업 없이 석방 완료를 호출하거나 다른 밧줄을 넘겨도 실물을 바꾸지 않는다',()=>{
  const d=ransomFixture(),before=stateHash(d.s);expect(releaseRansomedPrisoner(d.w,d.p,d.captor,d.victim,163)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('같은 대기와20턴 협상의 지갑/포박/몸/난수가 전체 복원 뒤 정확히 같다',()=>{
  const d=ransomFixture('pending'),w:World={db:d.w.db,s:deserialize(serialize(d.s))};expect(d.s.simulationPending).toBe(true);const at=d.s.time;runUntilInput(d.w);runUntilInput(w);expect(d.s.time-at).toBe(2000);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.p.money).toBe(760);expect(d.captor.money).toBe(200);expect(d.victim.captivity).toBeUndefined()
 })
 it('149각인에 과거 몸값 지급이나 협상 대기를 소급하지 않는다',()=>{
  const d=ransomFixture(),raw=JSON.parse(serialize(d.s));raw.version=149;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:149}).toEqual(raw)
 })
 it.each([['/price',0],['/price',1.5],['/turns',0],['/turns',28801]]as const)('잘못된 몸값 Def를 거부한다 (%s)',(path,value)=>{
  const{report}=loadMods([...readPackages(),{manifest:{id:'bad-ransom',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'Ransom.Hearth',path,value}]}],['bad-ransom']);expect(report.errors.some(e=>e.includes('Ransom.Hearth'))).toBe(true)
 })
})
