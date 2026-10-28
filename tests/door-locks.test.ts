import {describe,expect,it} from 'vitest'
import {activityStep,perform} from '../src/core/actions'
import {containerPryQuote,nearbyContainerLocks} from '../src/core/container-locks'
import {tileAt} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {installOptionalDoorLock} from '../src/core/door-locks'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {playerAct,SAVE_VERSION} from '../src/core/game'
import {addToBag,makeItem,removeStack} from '../src/core/items'
import {generateDungeon} from '../src/core/mapgen'
import {findPath} from '../src/core/path'
import {deserialize,serialize} from '../src/core/save'
import {readPackages} from '../tools/loadContent'
import {prisonerFixture} from './prisoner-fixture'

function setup(){const d=prisonerFixture();d.s.creatures=[d.p];d.s.overworld=undefined;d.s.maps={};d.s.offCreatures={};d.s.map.kind='dungeon';d.s.map.depth=3;d.p.bag=[];d.p.equip={};const pos={x:21,y:20},tile=tileAt(d.w,pos);Object.assign(tile,{t:'Terrain.RustedDoorClosed',locked:true,items:[]});const knife=makeItem(d.w,'Item.RustyKnife');expect(addToBag(d.w,d.p,knife)).toBe(0);invalidateLights(d.w);updatePlayerVision(d.w,d.p);return{...d,pos,tile,knife}}
type Fixture=ReturnType<typeof setup>
function finish(d:Fixture){for(let i=0;d.p.activity&&i<100;i++)activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined()}
function unchanged(d:Fixture,action:Parameters<typeof perform>[2]){const before=serialize(d.s);expect(perform(d.w,d.p,action).ok).toBe(false);expect(serialize(d.s)).toBe(before)}

describe('실제 문 잠금과 같은 도구의 작업',()=>{
 it('미리보기는30작업턴·같은 도구를 읽고 전체 상태/난수/UID 불변이다',()=>{const d=setup(),before=serialize(d.s);expect(containerPryQuote(d.w,d.p,d.pos)).toMatchObject({error:null,turns:30,tool:{uid:d.knife.uid}});expect(nearbyContainerLocks(d.w,d.p)).toMatchObject([{door:true,pos:d.pos}]);expect(serialize(d.s)).toBe(before)})
 it('잠긴 문에 부딪혀도 문/위치/시간/난수를 바꾸지 않는다',()=>{const d=setup();unchanged(d,{type:'move',dir:2});expect(d.tile.t).toBe('Terrain.RustedDoorClosed');expect(d.tile.locked).toBe(true)})
 it('도구가 없거나 마모분을 낼 수 없으면 원자적으로 거절한다',()=>{const d=setup();d.knife.durability=4;unchanged(d,{type:'pryContainer',pos:d.pos});d.p.bag=[];unchanged(d,{type:'pryContainer',pos:d.pos})})
 it('29턴에는 원래 문·내구·물품을 보존하고30번째에만 잠금을 해제한다',()=>{const d=setup(),next=d.s.nextId;expect(perform(d.w,d.p,{type:'pryContainer',pos:d.pos})).toEqual({ok:true,tu:0});expect(d.p.activity?.label).toBe('문 잠금쇠 벌리기');for(let i=0;i<29;i++)activityStep(d.w,d.p);expect(d.tile.locked).toBe(true);expect(d.knife.durability).toBe(100);finish(d);expect(d.tile.locked).toBe(false);expect(d.tile.t).toBe('Terrain.RustedDoorClosed');expect(d.knife.durability).toBe(95);expect(d.s.nextId).toBe(next);expect(d.tile.items).toEqual([]);expect(d.s.noiseEvents.filter(e=>e.source===d.p.id&&e.radius===8)).toHaveLength(3)})
 it('실제30턴 뒤 별도1턴 열기/닫기이며 닫아도 잠금쇠가 재생되지 않는다',()=>{const d=setup(),time=d.s.time;expect(playerAct(d.w,{type:'pryContainer',pos:d.pos})).toBeNull();expect(d.s.time-time).toBe(3000);expect(d.tile.t).toBe('Terrain.RustedDoorClosed');expect(playerAct(d.w,{type:'move',dir:2})).toBeNull();expect(d.s.time-time).toBe(3100);expect(d.p.pos).toEqual({x:20,y:20});expect(d.tile.t).toBe('Terrain.RustedDoorOpen');expect(playerAct(d.w,{type:'closeDoor',dir:2})).toBeNull();expect(d.tile.t).toBe('Terrain.RustedDoorClosed');expect(d.tile.locked).toBe(false);expect(playerAct(d.w,{type:'move',dir:2})).toBeNull();expect(d.s.time-time).toBe(3300);expect(d.knife.durability).toBe(95)})
 it('손·도구가 있는NPC도 같은30작업턴·내구5를 사용한다',()=>{const d=setup();d.target.pos={x:22,y:20};d.target.bag=[d.knife];d.p.bag=[];d.s.creatures.push(d.target);expect(perform(d.w,d.target,{type:'pryContainer',pos:d.pos}).ok).toBe(true);for(let i=0;d.target.activity&&i<31;i++)activityStep(d.w,d.target);expect(d.tile.locked).toBe(false);expect(d.knife.durability).toBe(95)})
 it('원래UID 도구를 바꾸거나 닫힌 문 자체가 바뀌면 완료하지 않는다',()=>{for(const kind of ['tool','open','map']){const d=setup();perform(d.w,d.p,{type:'pryContainer',pos:d.pos});activityStep(d.w,d.p);if(kind==='tool'){removeStack(d.p,d.knife.uid);addToBag(d.w,d.p,makeItem(d.w,d.knife.def))}else if(kind==='open')d.tile.t='Terrain.RustedDoorOpen';else d.s.map.id='different-map';finish(d);expect(d.tile.locked).toBe(true);expect(d.knife.durability).toBe(100)}})
 it('미완료 문 작업을 전체193 복원한 뒤 같은 남은 턴/도구로 끝낸다',()=>{const d=setup();perform(d.w,d.p,{type:'pryContainer',pos:d.pos});for(let i=0;i<12;i++)activityStep(d.w,d.p);const copy={db:d.w.db,s:deserialize(serialize(d.s))},p=copy.s.creatures.find(c=>c.id===d.p.id)!;expect(copy.s.version).toBe(SAVE_VERSION);expect(serialize(copy.s)).toBe(serialize(d.s));finish(d);for(let i=0;p.activity&&i<31;i++)activityStep(copy,p);expect(serialize(copy.s)).toBe(serialize(d.s))})
 it('192 각인의 원래 일반 문/상자를 소급해 잠그지 않는다',()=>{const d=setup();d.tile.t='Terrain.DoorClosed';delete d.tile.locked;const old=JSON.parse(serialize(d.s));old.version=192;const loaded=deserialize(JSON.stringify(old));old.version=SAVE_VERSION;expect(JSON.parse(serialize(loaded))).toEqual(old)})
 it('열쇠/기계봉인 문에 잠금 작업 수치를 얹는 정의는 거절한다',()=>{for(const[path,value]of [['/keyItem','Item.RustyKnife'],['/sealed',true]]as const){const loaded=loadMods([...readPackages(),{manifest:{id:'bad-door-lock',name:'충돌하는 문',version:'1',dependencies:['core']},defs:[],patches:[{op:'add',target:'Terrain.RustedDoorClosed',path,value}]}],['bad-door-lock']);expect(loaded.report.errors.join('\n')).toContain('잠금')}})
 it('실제 소음8은 같은 문 건너의 얕게 잠든 인물을 깨운다',()=>{const d=setup();d.target.pos={x:22,y:20};d.target.asleep=true;d.target.deepSleep=false;d.s.creatures.push(d.target);perform(d.w,d.p,{type:'pryContainer',pos:d.pos});for(let i=0;i<10;i++)activityStep(d.w,d.p);expect(d.target.asleep).toBe(false);expect(d.tile.locked).toBe(true)})
 it('닫힌 대각 모서리 너머로는 일반 문도 열거나 닫지 않는다',()=>{const d=setup();d.tile.t='Terrain.KtWall';tileAt(d.w,{x:20,y:21}).t='Terrain.KtWall';const corner=tileAt(d.w,{x:21,y:21});corner.t='Terrain.DoorClosed';unchanged(d,{type:'move',dir:3});corner.t='Terrain.DoorOpen';unchanged(d,{type:'closeDoor',dir:3})})
})

describe('우회 가능한 최초 문과 실제 경로',()=>{
 function corridor(alternate:boolean){const d=setup(),map=d.s.map;map.w=7;map.h=5;map.tiles=Array.from({length:35},()=>({t:'Terrain.KtWall',v:0,roof:true,blood:0,items:[]}));const cells=[[1,2],[2,2],[3,2],[4,2],...(alternate?[[1,1],[2,1],[3,1]]:[])];for(const[x,y]of cells)map.tiles[y*7+x].t='Terrain.KtFloor';map.tiles[2*7+2].t='Terrain.DoorClosed';d.p.pos={x:1,y:2};const room={x:3,y:1,w:2,h:3};return{...d,map,room}}
 it('우회가 없는 유일한 통로는 잠그지 않고 전체 상태/난수/UID를 보존한다',()=>{const d=corridor(false),before=serialize(d.s);expect(installOptionalDoorLock(d.w,d.map,d.p.pos,[d.room])).toBeUndefined();expect(serialize(d.s)).toBe(before)})
 it('다른 모든 원래 칸을 보존하는 우회로가 있으면 같은 문 하나만 잠근다',()=>{const d=corridor(true),before=structuredClone(d.map.tiles),rng=structuredClone(d.s.rng),next=d.s.nextId;expect(installOptionalDoorLock(d.w,d.map,d.p.pos,[d.room])).toBe(16);expect(d.map.tiles.filter(t=>t.locked)).toHaveLength(1);for(let i=0;i<35;i++)expect(d.map.tiles[i]).toEqual(i===16?{...before[i],t:'Terrain.RustedDoorClosed',locked:true}:before[i]);expect(d.s.rng).toEqual(rng);expect(d.s.nextId).toBe(next)})
 it('잠긴 문은 경로 중간/목표 모두에서 피하고 잠금 해제 후 다시 통과한다',()=>{const d=corridor(true);installOptionalDoorLock(d.w,d.map,d.p.pos,[d.room]);const door={x:2,y:2},target={x:4,y:2},path=findPath(d.w,d.p.pos,target)!;expect(path).not.toContainEqual(door);expect(path.at(-1)).toEqual(target);expect(findPath(d.w,d.p.pos,door)).toBeNull();d.map.tiles[16].locked=false;expect(findPath(d.w,d.p.pos,door)?.at(-1)).toEqual(door)})
 it('실제8시드×3층에서도 문은최대1개·우회로 보존이며 적어도 한 번 출현한다',()=>{
  const d=setup();let total=0
  for(let seed=0;seed<8;seed++)for(let depth=1;depth<=3;depth++){
   d.s.seed='optional-door-'+seed;const{map,start}=generateDungeon(d.w,depth),locked=map.tiles.map((t,i)=>t.locked&&t.t==='Terrain.RustedDoorClosed'?i:-1).filter(i=>i>=0);expect(locked.length).toBeLessThanOrEqual(1);total+=locked.length
   if(!locked.length)continue
   const flood=(allowLocked:boolean)=>{const seen=new Set<number>(),queue=[start.y*map.w+start.x];for(let i=0;i<queue.length;i++){const key=queue[i];if(seen.has(key))continue;const tile=map.tiles[key],def=d.w.db.terrain(tile.t);if(!def.passable&&!(def.door==='closed'&&!def.sealed&&(allowLocked||!tile.locked)))continue;seen.add(key);const x=key%map.w,y=Math.floor(key/map.w);for(const[dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]])if(x+dx>=0&&x+dx<map.w&&y+dy>=0&&y+dy<map.h)queue.push((y+dy)*map.w+x+dx)}return seen}
   const before=flood(true),after=flood(false);for(const key of locked)before.delete(key);expect([...after].sort((a,b)=>a-b)).toEqual([...before].sort((a,b)=>a-b))
  }
  expect(total).toBeGreaterThan(0)
 },15000)
})
