import {describe,it,expect} from 'vitest'
import {sourceControlsFixture} from './source-controls-fixture'
import {activityStep} from '../src/core/actions'
import {fieldDeviceQuote,initializeFieldDevices,startFieldDevice,cancelFieldDevice} from '../src/core/field-devices'
import {changeMap,playerAct,runUntilInput,settleReentry,SAVE_VERSION} from '../src/core/game'
import {player,tileAt,turnOf,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {makeWorld} from './helpers'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'

describe('동쪽 관로의 실제 현장 봉쇄',()=>{
 it('실제1층의 동쪽 석벽만 기구로 쓰며 기존 이동/시야 규칙과 원래 인원은 보존한다',()=>{
  const d=sourceControlsFixture(),t=tileAt(d.w,d.pos),base=d.w.db.terrain('Terrain.KtWall'),terrain=d.w.db.terrain(t.t)
  expect(d.device.uid).toBeLessThan(0);expect(d.s.map.id).toBe('crypt1');expect(t.t).toBe('Terrain.ConduitCrack');expect(terrain.passable).toBe(base.passable);expect(terrain.opaque).toBe(base.opaque);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds);expect(d.source.count).toBe(18)
  const before=stateHash(d.s);initializeFieldDevices(d.w);initializeFieldDevices(d.w);expect(stateHash(d.s)).toBe(before)
 })
 it('고정 현장은 기존 음수 기구ID 아래에서 배정하고 물품/인물 ID와 난수를 밀지 않는다',()=>{
  const d=sourceControlsFixture(),tile=tileAt(d.w,d.pos),other=structuredClone(d.s.map);other.id='stored-fixed-device';other.tiles[d.pos.y*other.w+d.pos.x].device!.uid=-7;d.s.maps[other.id]=other;tile.t='Terrain.KtWall';delete tile.device;delete d.s.map.waypoints;const next=d.s.nextId,rng=structuredClone(d.s.rng);initializeFieldDevices(d.w);expect(tile.device!.uid).toBe(-8);expect(d.s.nextId).toBe(next);expect(d.s.rng).toEqual(rng);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
 })
 it('다른지도/공급원 없는 다른지역에는 균열을 만들지 않는다',()=>{
  const w=makeWorld('source-control-no-map','Bg.Hunter',true);expect(w.s.map.tiles.some(t=>t.device?.def==='FieldDevice.ConduitCrack')).toBe(false)
  changeMap(w,'crypt2');expect(w.s.map.tiles.some(t=>t.device?.def==='FieldDevice.ConduitCrack')).toBe(false)
 })
 it('조회와 자재 없는 거절은 원래 상태/UID/난수를 소비하지 않는다',()=>{
  const d=sourceControlsFixture(),before=stateHash(d.s);expect(fieldDeviceQuote(d.w,d.p,d.pos,d.device.uid,'seal').turns).toBe(400);expect(stateHash(d.s)).toBe(before)
  d.p.bag=d.p.bag.filter(i=>i.uid!==d.stones.uid);const noStone=stateHash(d.s);expect(startFieldDevice(d.w,d.p,d.pos,d.device.uid,'seal')).toContain('부족');expect(stateHash(d.s)).toBe(noStone)
 })
 it('마지막 실제400번째 작업에서만 돌4개를 원래현장으로 옮기고 회복/진입을 막는다',()=>{
  const d=sourceControlsFixture(),ids=d.s.creatures.map(c=>c.id),at=turnOf(d.w);expect(startFieldDevice(d.w,d.p,d.pos,d.device.uid,'seal')).toBeNull()
  for(let i=0;i<399;i++)activityStep(d.w,d.p)
  expect(d.source.closed).toBeUndefined();expect(d.stones.count).toBe(4);expect(d.device.installed).toEqual([])
  activityStep(d.w,d.p);expect(d.source.closed).toEqual({at,by:d.p.id,mapId:'crypt1',deviceUid:d.device.uid});expect(d.source.count).toBe(18);expect(d.p.bag.some(i=>i.uid===d.stones.uid)).toBe(false);expect(d.device.installed.reduce((n,i)=>n+i.count,0)).toBe(4);expect(d.device.installed.every(i=>i.def==='Item.Stone')).toBe(true);expect(d.p.bag.find(i=>i.uid===d.hammer.uid)).toBe(d.hammer);expect(tileAt(d.w,d.pos).t).toBe('Terrain.ClosedConduitCrack');expect(d.s.creatures.map(c=>c.id)).toEqual(ids);expect(d.device.completed).toEqual(['seal'])
 })
 it('공개 작업 입력은 실제400턴에 원래 인원/소지품을 보존하며 봉쇄를 완료한다',()=>{
  const d=sourceControlsFixture(),at=d.s.time;d.act({type:'deviceWork',pos:d.pos,uid:d.device.uid,operation:'seal'});expect(d.s.time-at).toBe(40000);expect(d.source.closed!.at).toBe(at/100+399);expect(d.source.count).toBe(18);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds);expect(d.p.alive).toBe(true);expect(d.device.completed).toEqual(['seal'])
 })
 it('실제마지막1턴의 공개입력이 원래공사를 한 번만 완료한다',()=>{
  const d=sourceControlsFixture('lastTurn'),at=d.s.time;expect(playerAct(d.w,{type:'deviceWork',pos:d.pos,uid:d.device.uid,operation:'seal'})).toBeNull();expect(d.s.time-at).toBe(100);expect(d.source.closed).toBeDefined();expect(d.source.count).toBe(18)
  const before=stateHash(d.s);expect(startFieldDevice(d.w,d.p,d.pos,d.device.uid,'seal')).toContain('이미');expect(stateHash(d.s)).toBe(before)
 })
 it('10회 작업 진척을 중단/복원/재개하면 남은390작업만 남는다',()=>{
  const d=sourceControlsFixture('paused');expect(d.device.work!.progress).toBe(10);expect(d.source.closed).toBeUndefined();expect(d.stones.count).toBe(4)
  const copy:World={db:d.w.db,s:deserialize(serialize(d.s))},p=player(copy);expect(startFieldDevice(copy,p,d.pos,d.device.uid,'seal')).toBeNull();expect(p.activity!.remaining).toBe(390)
  for(let i=0;p.activity&&i<400;i++)activityStep(copy,p);expect(copy.s.sources!.find(s=>s.id==='conduit')!.closed).toBeDefined();expect(d.source.closed).toBeUndefined()
 })
 it('예약 자재/도구가 사라지면 완료 효과/소비 없이 멈춘 진행을 남긴다',()=>{
  const d=sourceControlsFixture('lastTurn');d.p.bag=d.p.bag.filter(i=>i.uid!==d.hammer.uid);activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.source.closed).toBeUndefined();expect(d.device.work!.progress).toBe(399);expect(d.stones.count).toBe(4)
 })
 it('예약 해제는 봉쇄하지 않고 원래 돌과 인원을 보존한다',()=>{
  const d=sourceControlsFixture('paused');expect(cancelFieldDevice(d.w,d.p,d.pos,d.device.uid)).toBeNull();expect(d.device.work).toBeUndefined();expect(d.source.closed).toBeUndefined();expect(d.stones.count).toBe(4)
 })
 it('막힌 관로는 긴 재진입 뒤에도 재점거/회복하지 않고 다른 공급원은 별도 회복한다',()=>{
  const d=sourceControlsFixture('completed');d.source.count=2;const other=d.s.sources!.find(s=>s.id==='pilgrims')!;other.count=0;const before=d.source.lastRegenDay,ids=d.s.creatures.map(c=>c.id),leftAt=turnOf(d.w);d.s.time+=14*TURNS_PER_DAY*100
  for(const room of d.s.map.rooms){room.discovered=true;room.clearedAt=leftAt-4*TURNS_PER_DAY;room.residents=['Creature.Shade']}
  settleReentry(d.w,d.s.map,[],leftAt);expect(d.source.count).toBe(2);expect(d.source.lastRegenDay).toBe(before);expect(other.count).toBeGreaterThan(0);expect(d.s.creatures.map(c=>c.id)).toEqual(ids)
 })
 it('봉쇄 전에 이미 지나간 날짜의 회복을 소급해서 없애지 않는다',()=>{
  const d=sourceControlsFixture('completed');d.source.count=2;d.source.lastRegenDay=10;d.source.closed!.at=20*TURNS_PER_DAY;d.s.time=22*TURNS_PER_DAY*100;d.s.map.rooms=[];settleReentry(d.w,d.s.map,[],10*TURNS_PER_DAY);expect(d.source.count).toBe(4);expect(d.source.lastRegenDay).toBe(18)
 })
 it('139각인에 과거 봉쇄를 소급하지 않는다',()=>{
  const d=sourceControlsFixture(),raw=JSON.parse(serialize(d.s));raw.version=139;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:139}).toEqual(raw)
 })
 it('진행 중 작업 전체를 복원하면 남은TU/돌/기구/공급원이 같다',()=>{
  const d=sourceControlsFixture('pending');expect(d.s.simulationPending).toBe(true);const w:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)))
 })
 it.each([['/placement/terrain','Terrain.KtFloor'],['/operations/0/effect/selfTerrain','Terrain.KtFloor'],['/operations/0/effect/sealSource/region','Region.Missing']])('불일치한 실제 장소/기구 설정을 시작 전에 거절한다 (%s)',(path,value)=>{
  const {report}=loadMods([...readPackages(),{manifest:{id:'bad-source',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'FieldDevice.ConduitCrack',path,value}]}],['bad-source']);expect(report.errors.length).toBeGreaterThan(0)
 })
})
