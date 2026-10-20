import {describe,it,expect} from 'vitest'
import {rescueRemainsFixture} from './rescue-remains-fixture'
import {rescueRemainsQuote,surveyRescueRemains,rescueReportQuote,reportRescue} from '../src/core/rescue-contracts'
import {cancelSupply,contractsTick} from '../src/core/contracts'
import {allItems} from '../src/core/items'
import {updatePlayerVision,invalidateLights} from '../src/core/fov'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {type World} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
describe('같은 구조 대상 시신의 실제 원래 유품',()=>{
 it('시신만 보아서는 소지품을 조회하거나 유품을 만들지 않는다',()=>{
  const d=rescueRemainsFixture(),before=stateHash(d.s);expect(d.victim.alive).toBe(false);expect(d.s.knowledge.prisonerSightings![d.victim.id]!.state).toBe('dead');const q=rescueRemainsQuote(d.w,d.p,d.record!.id);expect(q.error).toContain('수색');expect(q.item).toBeUndefined();expect(d.record!.relic).toBeUndefined();expect(stateHash(d.s)).toBe(before)
 })
 it('실제 공개 시신 수색을 끝낸 뒤에만 원래 소지품을 식별한다',()=>{
  const d=rescueRemainsFixture(),at=d.s.time;d.act({type:'search'});expect(d.s.time-at).toBe(200);expect(d.victim.searched).toBe(true);expect(d.s.loot).toMatchObject({kind:'corpse',id:d.victim.id});expect(rescueRemainsQuote(d.w,d.p,d.record!.id).error).toBeNull();expect(d.record!.relic).toBeUndefined()
 })
 it('견적은 실제 열린 같은 시신의 원래 물품만 읽으며 조회 자체는 불변이다',()=>{
  const d=rescueRemainsFixture('searched'),before=stateHash(d.s),q=rescueRemainsQuote(d.w,d.p,d.record!.id);expect(q.error).toBeNull();expect(allItems(d.victim)).toContain(q.item);expect(q.turns).toBe(1);expect(stateHash(d.s)).toBe(before)
 })
 it('현장 전환1턴은 원래 물품ID 사본만 남기고 보수/물품을 옮기지 않는다',()=>{
  const d=rescueRemainsFixture('searched'),at=d.s.time,next=d.s.nextId,item=rescueRemainsQuote(d.w,d.p,d.record!.id).item!;d.act({type:'rescueContractRemains',contract:d.record!.id});expect(d.s.time-at).toBe(100);expect(d.record!.relic).toMatchObject({uid:item.uid,def:item.def});expect(allItems(d.victim).some(i=>i.uid===item.uid)).toBe(true);expect(d.p.bag.some(i=>i.uid===item.uid)).toBe(false);expect(d.record!.escrow).toBe(292);expect(d.market.money).toBe(708);expect(d.p.money).toBe(960);expect(d.s.nextId).toBe(next)
 })
 it.each(['asleep','unconscious','hands','copy','far','dark','wrongMap','targetMap','closed','otherCorpse','unknownCapture','wrongRegion','living']as const)('현장/시신/열람/몸/목격 조건이 맞지 않으면 전체 상태를 바꾸지 않는다 (%s)',mode=>{
  const d=rescueRemainsFixture('searched');if(mode==='asleep')d.p.asleep=true;if(mode==='unconscious')d.p.unconscious=true;if(mode==='hands')d.p.body.missing=['LeftUpperArm','RightUpperArm'];if(mode==='far')d.p.pos={x:21,y:32};if(mode==='dark'){d.p.equip.off!.lit=false;d.s.map.kind='dungeon';d.s.map.ambient=0;d.s.map.lights=[];invalidateLights(d.w)}if(mode==='wrongMap')d.record!.mapId='other';if(mode==='targetMap')d.victim.mapId='other';if(mode==='closed')d.s.loot=undefined;if(mode==='otherCorpse')d.s.loot!.id=d.captor.id;if(mode==='unknownCapture')delete d.s.knowledge.prisonerSightings![d.victim.id]!.lastCapture;if(mode==='wrongRegion')d.record!.region='other';if(mode==='living')d.victim.alive=true
  const before=stateHash(d.s);expect(surveyRescueRemains(d.w,mode==='copy'?structuredClone(d.p):d.p,d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('시신을 다시 보는 것만으로 기록한 유품이나 위치를 원격 갱신하지 않는다',()=>{
  const d=rescueRemainsFixture('converted'),before=structuredClone(d.record!.relic);d.act({type:'lootClose'});d.home();d.victim.bag=[];d.victim.equip={};updatePlayerVision(d.w,d.p);expect(d.record!.relic).toEqual(before);expect(rescueReportQuote(d.w,d.p,d.trader,d.record!.id).error).toContain('같은 원래 유품')
 })
 it('빈 시신에서 가짜 유품이나 보수를 생성하지 않는다',()=>{
  const d=rescueRemainsFixture('searched');const items=allItems(d.victim);d.victim.bag=[];d.victim.equip={};d.s.map.tiles[d.victim.pos.y*d.s.map.w+d.victim.pos.x].items.push(...items);const before=stateHash(d.s);expect(surveyRescueRemains(d.w,d.p,d.record!.id)).toContain('원래 유품이 없다');expect(stateHash(d.s)).toBe(before)
 })
 it('이미 다른 원본회수 장부에 묶인 물품을 다시 유품 보수로 쓰지 않는다',()=>{
  const d=rescueRemainsFixture('searched'),items=allItems(d.victim);for(const item of items)d.m.contracts!.push({id:'existing-'+item.uid,kind:'recover',template:'known',site:d.market.site,faction:d.trader.faction,issuer:d.trader.name,label:'기존 원본',accepted:1,deadline:9999999,reward:1,reputation:0,escrow:1,status:'active',region:d.record!.region,mapId:d.record!.mapId,pos:{...d.victim.pos},terrain:'Terrain.Chest',item:item.def,itemUid:item.uid,observedAt:1,distance:0,minDurability:0});const before=stateHash(d.s);expect(surveyRescueRemains(d.w,d.p,d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('전환을 반복해 다른 물품으로 바꾸지 않는다',()=>{
  const d=rescueRemainsFixture('converted'),before=stateHash(d.s);expect(surveyRescueRemains(d.w,d.p,d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('실제 꺼내기0턴에 같은UID가 시신에서 배낭으로 한 번만 옮겨진다',()=>{
  const d=rescueRemainsFixture('converted'),at=d.s.time,next=d.s.nextId,uid=d.relic!.uid;d.act({type:'lootTake',uid});expect(d.s.time).toBe(at);expect(d.s.nextId).toBe(next);expect(allItems(d.victim).some(i=>i.uid===uid)).toBe(false);expect(d.p.bag.filter(i=>i.uid===uid)).toHaveLength(1)
 })
 it('같은 종류의 다른 물품은 거절하고 실제 원본은 원래 시신에 남는다',()=>{
  const d=rescueRemainsFixture('substitute'),before=stateHash(d.s);expect(d.p.bag.some(i=>i.def===d.relic!.def&&i.uid!==d.relic!.uid)).toBe(true);expect(allItems(d.victim).some(i=>i.uid===d.relic!.uid)).toBe(true);expect(reportRescue(d.w,d.p,d.trader,d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('유품 납품1턴은 같은 원본만 상인에게 넘기며 원래 시신/몸/ID와 유한 예치를 보존한다',()=>{
  const d=rescueRemainsFixture('deliver'),at=d.s.time,next=d.s.nextId,uid=d.relic!.uid,item=structuredClone(d.p.bag.find(i=>i.uid===uid)!);d.act({type:'rescueContractReport',target:d.trader.id,contract:d.record!.id,expectedReward:292});expect(d.s.time-at).toBe(100);expect(d.s.nextId).toBe(next);expect(d.p.bag.some(i=>i.uid===uid)).toBe(false);expect(d.market.items.filter(i=>i.uid===uid)).toHaveLength(1);const delivered=d.market.items.find(i=>i.uid===uid)!;expect(delivered.def).toBe(item.def);expect(delivered.durability).toBe(item.durability);expect(d.record!.relicRecipient).toMatchObject({uid,def:item.def});expect(d.record!.returned).toBeUndefined();expect(d.victim.alive).toBe(false);expect(d.p.money).toBe(1252);expect(d.market.money).toBe(708);expect(d.record!.escrow).toBe(0);const before=stateHash(d.s);expect(reportRescue(d.w,d.p,d.trader,d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('취소와 기한은 유품을 지우거나 가져오지 않고 예치만 시장에 돌려놓는다',()=>{
  const d=rescueRemainsFixture('deliver'),uid=d.relic!.uid;expect(cancelSupply(d.w,d.p,d.trader,d.record!.id)).toBeNull();expect(d.p.bag.some(i=>i.uid===uid)).toBe(true);expect(d.p.money).toBe(960);expect(d.market.money).toBe(1000)
  const e=rescueRemainsFixture('converted');e.s.time=e.record!.deadline*100;contractsTick(e.w);expect(e.record!.status).toBe('expired');expect(allItems(e.victim).some(i=>i.uid===e.relic!.uid)).toBe(true);expect(e.market.money).toBe(1000)
 })
 it('145각인에 과거 시신/유품 사본을 소급하지 않는다',()=>{
  const d=rescueRemainsFixture('corpse'),raw=JSON.parse(serialize(d.s));raw.version=145;const restored=deserialize(JSON.stringify(raw));expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:145}).toEqual(raw)
 })
 it('진행 중20턴의 같은 시신/유품/몸/난수/예치가 전체 복원 뒤 같다',()=>{
  const d=rescueRemainsFixture('pending'),w:World={db:d.w.db,s:deserialize(serialize(d.s))};expect(d.s.simulationPending).toBe(true);runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.record!.escrow).toBe(292);expect(d.victim.alive).toBe(false)
 })
 it.each([['/surveyTurns',0],['/surveyTurns',1.5],['/minDurability',-1],['/minDurability',101]]as const)('잘못된 유품 Def 수치를 거부한다 (%s)',(path,value)=>{
  const{report}=loadMods([...readPackages(),{manifest:{id:'bad-rescue-remains',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'RescueRemains.Hearth',path,value}]}],['bad-rescue-remains']);expect(report.errors.some(e=>e.includes('RescueRemains.Hearth'))).toBe(true)
 })
})
