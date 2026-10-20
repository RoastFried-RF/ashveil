import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { beddingSiteAvailable, furnitureQuote, residentBeddingGoal, residentBeddingSites, startFurniturePack } from '../src/core/bedding-move'
import { player, tileAt, type World } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct } from '../src/core/game'
import { addToBag, findItem, makeItem, removeStack } from '../src/core/items'
import { residentBedAt, residentBedError, residentRestGoal } from '../src/core/resident-rest'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { db } from './helpers'
const template=newGame(db,{seed:'bedding-move',overworld:true})
function setup(){
  const w:World={db,s:structuredClone(template)},p=player(w),m=w.s.overworld!,site=m.sites.find((s)=>s.kind==='settlement'&&s.faction==='coalition')!
  m.currentRegion=site.id;m.position={...site.cell};w.s.creatures=[p];w.s.time=12*1200*100;w.s.weather='clear';w.s.weatherUntil=1e12;w.s.wind={x:0,y:0};w.s.sources=[];w.s.storyteller.budget=-1e9;p.pos={x:20,y:20}
  for(let y=12;y<=25;y++)for(let x=17;x<=42;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
  initializeSettlement(w);const guard=w.s.creatures.find((c)=>c.def==='Creature.SettlementGuard')!,bed=w.s.map.residentBeds!.find((b)=>b.owner===guard.id)!,fire=w.s.map.residentHearth!
  p.pos={x:33,y:19}
  for(const c of w.s.creatures){c.nextAct=c.id===p.id||c.id===guard.id?w.s.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37,wetness:0,stress:0,protein:100,vitamin:100})}
  w.s.map.lights=[{pos:fire.pos,radius:12,kind:'campfire'}];invalidateLights(w)
  const adjacent=()=>{guard.pos={x:bed.pos.x+1,y:bed.pos.y}}
  const pack=()=>{adjacent();expect(startFurniturePack(w,guard,bed.pos)).toBeNull();guard.activity!.remaining=0;activityStep(w,guard);return findItem(guard,bed.packedUid!)!}
  return{w,p,guard,bed,fire,site,adjacent,pack}
}
function wait(w:World,n:number){for(let i=0;i<n;i++)expect(playerAct(w,{type:'wait'})).toBeNull()}
describe('고정 침구의 실제 포장·운반·재설치',()=>{
  it('읽기 전용 견적은 실제 배낭 공간을 확인하고 완료 전 침구·UID를 바꾸지 않는다',()=>{
    const{w,guard,bed,adjacent}=setup();adjacent();const hash=stateHash(w.s),id=w.s.nextId;expect(furnitureQuote(w,guard,bed.pos)).toMatchObject({error:null,turns:200});expect(stateHash(w.s)).toBe(hash);expect(startFurniturePack(w,guard,bed.pos)).toBeNull();activityStep(w,guard);expect(tileAt(w,bed.pos).t).toBe(bed.terrain);expect(bed.packedUid).toBeUndefined();expect(w.s.nextId).toBe(id)
  })
  it('고유 물품 없는 기존 침대는 완료 때1개로 실체화하고 바닥·아래 물품을 보존한다',()=>{
    const{w,guard,bed,pack}=setup(),id=w.s.nextId,source={...bed.pos},ground=makeItem(w,'Item.Wood');tileAt(w,source).items.push(ground);const next=w.s.nextId,item=pack();expect(item.def).toBe('Item.StrawBed');expect(item.count).toBe(1);expect(w.s.nextId).toBe(next+1);expect(item.uid).toBe(next);expect(item.uid).toBeGreaterThan(id);expect(tileAt(w,source).t).toBe(bed.base);expect(tileAt(w,source).items).toEqual([ground]);expect(residentBedAt(w,source)).toBeUndefined();expect(residentRestGoal(w,guard)).toBeNull()
  })
  it('추운 경비는 자기 침대를 실제로 포장·걸어 운반·설치한 뒤 따뜻한 자리에서 잔다',()=>{
    const{w,guard,bed,fire}=setup(),source={...bed.pos},id=w.s.nextId,worldId=w.s.overworld!.simulation!.nextItemId,cash=guard.money;guard.needs.fatigue=70;guard.needs.bodyTemp=36.4;let carried=false,moved=false,uid:number|undefined
    for(let n=0;n<300;n++){wait(w,1);if(bed.packedUid){carried=!!findItem(guard,bed.packedUid);uid=bed.packedUid;if(Math.max(Math.abs(guard.pos.x-source.x),Math.abs(guard.pos.y-source.y))>1)moved=true}}
    expect(carried).toBe(true);expect(moved).toBe(true);expect(Math.max(Math.abs(bed.pos.x-fire.pos.x),Math.abs(bed.pos.y-fire.pos.y))).toBeLessThanOrEqual(2);expect(bed.pos).not.toEqual(source);expect(tileAt(w,source).t).toBe('Terrain.Earth');expect(tileAt(w,bed.pos).placed?.item.uid).toBe(uid);expect(tileAt(w,bed.pos).placed?.owner).toBe(guard.id);expect(findItem(guard,uid!)).toBeUndefined();expect(w.s.nextId).toBe(id+1);expect(w.s.overworld!.simulation!.nextItemId).toBe(worldId);expect(guard.money).toBe(cash);expect(guard.activity?.kind).toBe('sleep')
  })
  it('실제 배치 물품의 UID·품질·내구·젖음과 원래 바닥은 그대로 되돌려 받는다',()=>{
    const{w,p,guard}=setup();p.pos={x:20,y:20};p.bag=[];const item=makeItem(w,'Item.Bed');item.quality=4;item.durability=47;item.wetness={torso:20};addToBag(w,p,item);tileAt(w,{x:21,y:20}).t='Terrain.KtFloor';expect(perform(w,p,{type:'place',uid:item.uid,dir:2}).ok).toBe(true);expect(tileAt(w,{x:21,y:20}).placed?.owner).toBe(p.id);guard.pos={x:21,y:19};let hash=stateHash(w.s);expect(startFurniturePack(w,guard,{x:21,y:20})).toContain('다른');expect(stateHash(w.s)).toBe(hash)
    const id=w.s.nextId;expect(startFurniturePack(w,p,{x:21,y:20})).toBeNull();p.activity!.remaining=0;activityStep(w,p);expect(findItem(p,item.uid)).toMatchObject({quality:4,durability:47,wetness:{torso:20}});expect(w.s.nextId).toBe(id);expect(tileAt(w,{x:21,y:20}).t).toBe('Terrain.KtFloor');hash=stateHash(w.s);expect(furnitureQuote(w,p,{x:21,y:20}).error).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
  })
  it('다른 사람·점유·가득 찬 배낭의 요청은 상태나 UID를 바꾸지 않는다',()=>{
    for(const kind of ['owner','occupied','bag']){const{w,p,guard,bed,adjacent}=setup();adjacent();if(kind==='owner')bed.owner=p.id;if(kind==='occupied')p.pos={...bed.pos};if(kind==='bag'){guard.bag=[];for(let y=0;y<6;y+=3)for(let x=0;x<10;x+=2){const it=makeItem(w,'Item.Bed');Object.assign(it,{gx:x,gy:y});guard.bag.push(it)}}const hash=stateHash(w.s);expect(furnitureQuote(w,guard,bed.pos).error).not.toBeNull();expect(startFurniturePack(w,guard,bed.pos)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)}
  })
  it('원격·물품 없는 여관 침대·움직일 손 없는 요청을 거부한다',()=>{
    const{w,p,guard,bed}=setup();p.pos={x:20,y:20};let hash=stateHash(w.s);expect(perform(w,p,{type:'packFurniture',pos:bed.pos}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash);p.pos={...w.s.map.innBeds![0].pos};expect(furnitureQuote(w,p,p.pos).error).not.toBeNull();guard.pos={x:bed.pos.x+1,y:bed.pos.y};guard.body.missing=['LeftUpperArm','RightUpperArm'];hash=stateHash(w.s);expect(startFurniturePack(w,guard,bed.pos)).not.toBeNull();expect(stateHash(w.s)).toBe(hash);const extra=makeItem(w,'Item.Bed');addToBag(w,guard,extra);hash=stateHash(w.s);expect(perform(w,guard,{type:'place',uid:extra.uid,dir:1}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
  it('수동 중단과 작업 도중 침구 교체는 새 침구를 생성하지 않는다',()=>{
    const{w,p}=setup();p.pos={x:20,y:20};p.bag=[];const item=makeItem(w,'Item.Bed');addToBag(w,p,item);perform(w,p,{type:'place',uid:item.uid,dir:2});const pos={x:21,y:20};expect(startFurniturePack(w,p,pos)).toBeNull();activityStep(w,p);expect(playerAct(w,{type:'stopActivity'})).toBeNull();expect(tileAt(w,pos).placed?.item.uid).toBe(item.uid);expect(findItem(p,item.uid)).toBeUndefined()
    expect(startFurniturePack(w,p,pos)).toBeNull();const replacement=makeItem(w,'Item.Bed');tileAt(w,pos).placed!.item=replacement;p.activity!.remaining=0;const id=w.s.nextId;activityStep(w,p);expect(p.activity).toBeUndefined();expect(findItem(p,replacement.uid)).toBeUndefined();expect(tileAt(w,pos).placed?.item.uid).toBe(replacement.uid);expect(w.s.nextId).toBe(id)
  })
  it('막힌 대각 모퉁이 너머로 고정 침구를 설치하거나 포장하지 않는다',()=>{
    const{w,p}=setup();p.pos={x:20,y:20};p.bag=[];const item=makeItem(w,'Item.Bed');addToBag(w,p,item);const pos={x:21,y:19};tileAt(w,{x:20,y:19}).t='Terrain.RuinWall';tileAt(w,{x:21,y:20}).t='Terrain.RuinWall';let hash=stateHash(w.s);expect(beddingSiteAvailable(w,p,pos)).toBe(false);expect(perform(w,p,{type:'place',uid:item.uid,dir:1}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
    removeStack(p,item.uid);tileAt(w,pos).t='Terrain.Bed';tileAt(w,pos).placed={base:'Terrain.Earth',item,owner:p.id};hash=stateHash(w.s);expect(startFurniturePack(w,p,pos)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
  })
  it('소유 물품이 사라져도 원래 위치에 침대를 다시 만들거나 유령 소유권을 남기지 않는다',()=>{
    const{w,p,guard,bed,pack}=setup(),source={...bed.pos},item=pack();removeStack(guard,item.uid);tileAt(w,p.pos).items.push(item);initializeSettlement(w);expect(residentBeddingGoal(w,guard)).toBeNull();expect(residentBedAt(w,source)).toBeUndefined();expect(tileAt(w,source).t).toBe('Terrain.Earth');guard.needs.fatigue=70;expect(residentRestGoal(w,guard)).toBeNull()
  })
  it('침구는 실제 배치 가능한 지붕 아래 빈 자리만 고르고 사물·사람·집무 자리를 덮지 않는다',()=>{
    const{w,guard,fire}=setup();guard.pos={x:fire.pos.x-2,y:fire.pos.y};const list=residentBeddingSites(w,guard),hash=stateHash(w.s);expect(list.length).toBeGreaterThan(0);expect(stateHash(w.s)).toBe(hash)
    for(const pos of list){expect(beddingSiteAvailable(w,guard,pos)).toBe(true);expect(tileAt(w,pos).roof).toBe(true);expect(Math.max(Math.abs(pos.x-fire.pos.x),Math.abs(pos.y-fire.pos.y))).toBeLessThanOrEqual(2)}
    const pos=list[0];tileAt(w,pos).items.push(makeItem(w,'Item.Wood'));expect(beddingSiteAvailable(w,guard,pos)).toBe(false);expect(beddingSiteAvailable(w,guard,guard.home!)).toBe(false)
  })
  it('이미 화덕 가까운 침대나 추위/피로가 없는 주민은 이사하지 않는다',()=>{
    const{w,guard,bed,fire}=setup();expect(residentBeddingGoal(w,guard)).toBeNull();guard.needs.fatigue=70;expect(residentBeddingGoal(w,guard)).toBeNull();guard.needs.bodyTemp=35.9;const goal=residentBeddingGoal(w,guard),hash=stateHash(w.s);expect(goal?.kind).toBe('pack');expect(stateHash(w.s)).toBe(hash);bed.pos={x:fire.pos.x+1,y:fire.pos.y+1};expect(residentBeddingGoal(w,guard)).toBeNull()
  })
  it('재설치한 침대의 개인 사용 권한은 새 위치를 따르고 포장 전 위치는 풀린다',()=>{
    const{w,p,guard,bed,pack}=setup(),old={...bed.pos},item=pack();guard.pos={x:20,y:20};const dest={x:21,y:20};expect(perform(w,guard,{type:'place',uid:item.uid,dir:2}).ok).toBe(true);expect(bed.pos).toEqual(dest);p.pos=dest;expect(residentBedError(w,p)).toContain('개인');p.pos=old;expect(residentBedError(w,p)).toBeNull();expect(tileAt(w,dest).placed?.item.uid).toBe(item.uid)
  })
  it('운반 중 각인과 이어 하기는 같은 UID·목표·바닥·몸을 재현한다',()=>{
    const{w,guard,bed,pack}=setup();pack();guard.needs.fatigue=70;guard.needs.bodyTemp=36.4;expect(bed.packedUid).toBeDefined();const copy={db,s:deserialize(serialize(w.s))};for(let n=0;n<4;n++){expect(playerAct(w,{type:'rest',turns:50})).toBeNull();expect(playerAct(copy,{type:'rest',turns:50})).toBeNull()}expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('바닥 기록 없는 구형 침대는 실제 포장을 완료할 때만 정해진 바닥으로 복원한다',()=>{
    const{w,guard,bed,adjacent}=setup();delete bed.base;adjacent();const raw=serialize(w.s),copy=deserialize(raw);expect(serialize(copy)).toBe(raw);expect(startFurniturePack(w,guard,bed.pos)).toBeNull();expect(tileAt(w,bed.pos).t).toBe(bed.terrain);guard.activity!.remaining=0;activityStep(w,guard);expect(tileAt(w,bed.pos).t).toBe('Terrain.Earth');expect(bed.base).toBe('Terrain.Earth')
  })
  it('v19를 불러와도 기존 침대·물품·몸을 옮기거나 복제하지 않는다',()=>{
    const{w}=setup(),old=JSON.parse(serialize(w.s));old.version=19;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:19}).toEqual(old)
  })
})
