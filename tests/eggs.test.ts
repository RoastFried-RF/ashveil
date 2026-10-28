import {SAVE_VERSION} from '../src/core/game'
import{describe,expect,it}from'vitest'
import{perform,consumeFor}from'../src/core/actions'
import{fragileDropChance}from'../src/core/fragile'
import{tileAt,turnOf,TURNS_PER_HOUR}from'../src/core/ctx'
import{ageFood}from'../src/core/food-safety'
import{makeItem,addToBag}from'../src/core/items'
import{stateHash,serialize,deserialize}from'../src/core/save'
import{exchange}from'../src/core/economy'
import{startClaimBase,openBaseStore}from'../src/core/base-camp'
import{baseFixture,finishBase}from'./base-camp-fixture'
import{firstImpressionsFixture}from'./first-impressions-fixture'
import type{TerrainDef}from'../src/core/types'
import{eggFixture as setup}from'./eggs-fixture'
describe('실제 원래 달걀·바닥 충격과 같은 내용물',()=>{
 it('실제 견적은 몸·물품·시각·난수·UID를 바꾸지 않는다',()=>{
  const d=setup(),hash=stateHash(d.s);expect(fragileDropChance(d.w,d.egg,d.p.pos)).toBe(.3);expect(stateHash(d.s)).toBe(hash);expect(d.egg.def).toBe('Item.Egg')
 })
 it('깨지는 실제 바닥 낙하는 원래3개/UID/품질/내구/재를 그대로 보존한다',()=>{
  const d=setup(1),uid=d.egg.uid,next=d.s.nextId;d.egg.contaminantAsh=.4;d.egg.freshness=73;d.egg.foodThawed=true
  expect(perform(d.w,d.p,{type:'drop',uid}).ok).toBe(true);const out=tileAt(d.w,d.p.pos).items.find(i=>i.uid===uid)!;expect(out).toMatchObject({uid,def:'Item.CrackedEgg',count:3,quality:2,durability:81,contaminantAsh:.4,freshness:73,foodThawed:true});expect(d.p.bag.some(i=>i.uid===uid)).toBe(false);expect(d.s.nextId).toBe(next);expect(d.p.needs.kcal).toBe(0)
 })
 it('원래 시간까지 달걀로 부패한 뒤에만 깨진6시간 기록을 시작한다',()=>{
  const d=setup(1);d.s.map.kind='dungeon';d.s.map.depth=3;d.s.time+=TURNS_PER_HOUR*100/2;expect(perform(d.w,d.p,{type:'drop',uid:d.egg.uid}).ok).toBe(true);const actual=tileAt(d.w,d.p.pos).items.find(i=>i.uid===d.egg.uid)!;expect(actual.freshness).toBeCloseTo(100-100/336/2,10);expect(actual.foodAgedAt).toBe(turnOf(d.w));expect(actual.def).toBe('Item.CrackedEgg');ageFood(d.w,actual,15,6*TURNS_PER_HOUR);expect(actual.freshness).toBe(0)
 })
 it('충격 확률0은 같은 물품을 실제 바닥에 놓지만 파손 난수를 소비하지 않는다',()=>{
  const d=setup(0),before=structuredClone(d.s.rng);expect(perform(d.w,d.p,{type:'drop',uid:d.egg.uid}).ok).toBe(true);expect(d.egg.def).toBe('Item.Egg');expect(d.s.rng).toEqual(before)
 })
 it('물과 실제 침구는 원래 달걀을 완충하며 파손 난수를 소비하지 않는다',()=>{
  for(const kind of['water','bed']){const d=setup(1);tileAt(d.w,d.p.pos).t=kind==='water'?'Terrain.ShallowWater':d.w.db.all<TerrainDef>('Terrain').find(t=>t.bedding)!.id;const before=structuredClone(d.s.rng);expect(fragileDropChance(d.w,d.egg,d.p.pos)).toBe(0);expect(perform(d.w,d.p,{type:'drop',uid:d.egg.uid}).ok).toBe(true);expect(d.egg.def).toBe('Item.Egg');expect(d.s.rng).toEqual(before)}
 })
 it('파손하지 않는 일반 음식의 바닥 이동은 기존 난수/음식을 유지한다',()=>{
  const d=setup(),food=d.add('Item.Hardtack'),before=structuredClone(d.s.rng);perform(d.w,d.p,{type:'drop',uid:food.uid});expect(food.def).toBe('Item.Hardtack');expect(d.s.rng).toEqual(before)
 })
 it('실제 배낭 위치 이동은 충격이 아니고 원래 달걀/난수를 보존한다',()=>{
  const d=setup(1),before=structuredClone(d.s.rng);expect(perform(d.w,d.p,{type:'moveItem',uid:d.egg.uid,gx:5,gy:3}).ok).toBe(true);expect(d.egg.def).toBe('Item.Egg');expect(d.egg.gx).toBe(5);expect(d.s.rng).toEqual(before)
 })
 it('실제 설치/점유한 보관함에 넣기는 바닥 낙하가 아니다',()=>{
  const d=baseFixture();expect(startClaimBase(d.w,d.p,d.store)).toBeNull();finishBase(d.w,d.p);const actual=setup(1);d.w.db=actual.w.db;const it=makeItem(d.w,'Item.Egg');expect(addToBag(d.w,d.p,it)).toBe(0);const next=d.s.nextId;expect(openBaseStore(d.w,d.p)).toBeNull();const before=structuredClone(d.s.rng);expect(perform(d.w,d.p,{type:'lootPut',uid:it.uid}).ok).toBe(true);expect(tileAt(d.w,d.store).cont!.items.find(i=>i.uid===it.uid)?.def).toBe('Item.Egg');expect(d.s.rng).toEqual(before);expect(d.s.nextId).toBe(next)
 })
 it('바닥 전리품 칸으로 놓는 같은 이동에도 실제 충격 규칙을 적용한다',()=>{
  const d=setup(1);d.s.loot={kind:'floor',pos:{...d.p.pos}};expect(perform(d.w,d.p,{type:'lootPut',uid:d.egg.uid}).ok).toBe(true);expect(tileAt(d.w,d.p.pos).items.find(i=>i.uid===d.egg.uid)?.def).toBe('Item.CrackedEgg')
 })
 it('없는 원본이나 같은 턴에 금지된 낙하는 상태/난수를 바꾸지 않는다',()=>{
  const d=setup(1);let hash=stateHash(d.s);expect(perform(d.w,d.p,{type:'drop',uid:999999}).ok).toBe(false);expect(stateHash(d.s)).toBe(hash);d.p.freeActTurn=turnOf(d.w);hash=stateHash(d.s);expect(perform(d.w,d.p,{type:'drop',uid:d.egg.uid}).ok).toBe(false);expect(stateHash(d.s)).toBe(hash)
 })
 it('같은 깨진 내용물을 줍고 다시 버려도 원래 껍데기나 새 내용물을 만들지 않는다',()=>{
  const d=setup(1),uid=d.egg.uid;perform(d.w,d.p,{type:'drop',uid});expect(perform(d.w,d.p,{type:'pickup',uid}).ok).toBe(true);d.s.time+=100;const before=structuredClone(d.s.rng);expect(perform(d.w,d.p,{type:'drop',uid}).ok).toBe(true);expect(tileAt(d.w,d.p.pos).items.filter(i=>i.uid===uid)).toHaveLength(1);expect(tileAt(d.w,d.p.pos).items.find(i=>i.uid===uid)!.def).toBe('Item.CrackedEgg');expect(d.s.rng).toEqual(before)
 })
 it('실제 깨짐은 원래 위치/당사자의 작은 소음으로 인근 청각에 전달한다',()=>{
  const d=setup(1),c=d.doctor();c.ai.mode='guard';c.ai.dest=undefined;perform(d.w,d.p,{type:'drop',uid:d.egg.uid});expect(d.s.noiseEvents.at(-1)).toMatchObject({pos:d.p.pos,radius:2,source:d.p.id,turn:turnOf(d.w)});expect(c.ai.mode).toBe('investigate');expect(c.ai.dest).toEqual(d.p.pos)
 })
 it('실제 얼었던 달걀의 원래 동결/해동 상태를 파손으로 세탁하지 않는다',()=>{
  const d=setup(1);d.egg.foodThawed=true;d.egg.foodFrozen=true;perform(d.w,d.p,{type:'drop',uid:d.egg.uid});expect(d.egg.foodThawed).toBe(true);expect(d.egg.foodFrozen).toBe(true)
 })
 it('원래 달걀과 깨진 내용물은 모두 한 개80kcal/비타민1/수분45ml만 전달한다',()=>{
  for(const cracked of[false,true]){const d=setup(1);if(cracked){perform(d.w,d.p,{type:'drop',uid:d.egg.uid});perform(d.w,d.p,{type:'pickup',uid:d.egg.uid})}const it=d.p.bag.find(i=>i.uid===d.egg.uid)!;expect(consumeFor(d.w,d.p,d.p,it.uid).ok).toBe(true);expect(it.count).toBe(2);expect(d.p.needs.kcal).toBe(80);expect(d.p.needs.vitamin).toBe(1);expect(d.p.needs.waterDeficit).toBe(955)}
 })
 it('다른 실제 섭취자만 원래 한 개의 영양/수분을 받는다',()=>{
  const d=setup(),c=d.doctor();c.needs.kcal=0;c.needs.vitamin=0;c.needs.waterDeficit=1000;expect(consumeFor(d.w,d.p,c,d.egg.uid).ok).toBe(true);expect(c.needs.kcal).toBe(80);expect(c.needs.vitamin).toBe(1);expect(c.needs.waterDeficit).toBe(955);expect(d.p.needs.kcal).toBe(0);expect(d.egg.count).toBe(2)
 })
 it('원래 달걀은15°C14일, 깨진 원래 내용물은6시간에 상한다',()=>{
  const d=setup();ageFood(d.w,d.egg,15,336*TURNS_PER_HOUR);expect(d.egg.freshness).toBe(0);const cracked=makeItem(d.w,'Item.CrackedEgg');ageFood(d.w,cracked,15,6*TURNS_PER_HOUR);expect(cracked.freshness).toBe(0)
 })
 it('구형75는 과거 충격이나 새 달걀/난수를 소급하지 않고 전체 원본을 유지한다',()=>{
  const d=setup(),old=JSON.parse(serialize(d.s));old.version=75;const restored=deserialize(JSON.stringify(old));expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:75}).toEqual(old);expect(restored.creatures.find(c=>c.id===d.p.id)!.bag.find(i=>i.uid===d.egg.uid)!.def).toBe('Item.Egg')
 })
 it('파손 후 전체 저장은 같은 UID/수량/신선도/재와 실제 작은 소음을 보존한다',()=>{
  const d=setup(1);d.egg.contaminantAsh=.4;perform(d.w,d.p,{type:'drop',uid:d.egg.uid});const copy=deserialize(serialize(d.s));expect(copy).toEqual(JSON.parse(serialize(d.s)));expect(copy.map.tiles[d.p.pos.y*copy.map.w+d.p.pos.x].items.find(i=>i.uid===d.egg.uid)?.def).toBe('Item.CrackedEgg')
 })
 it('파손 전 전체 저장도 다음 실제 낙하의 원래 난수/내용물을 동일하게 잇는다',()=>{
  const d=setup(),copy={db:d.w.db,s:deserialize(serialize(d.s))};for(const w of[d.w,copy])perform(w,w.s.creatures.find(c=>c.id===w.s.playerId)!,{type:'drop',uid:d.egg.uid});expect(copy.s).toEqual(JSON.parse(serialize(d.s)))
 })
 it('실제 연합의 유한 달걀을 원래 현금으로 사고 소진 뒤 복제하지 않는다',()=>{
  const d=firstImpressionsFixture();d.p.money=1000;const egg=d.market.items.find(i=>i.def==='Item.Egg')!,uid=egg.uid,count=egg.count,cash=d.p.money+d.market.money;expect(count).toBe(6);expect(exchange(d.w,d.p,d.trader,[{uid,count}],[])).toBeNull();expect(d.p.money!+d.market.money).toBe(cash);expect(d.p.bag.filter(i=>i.def==='Item.Egg').reduce((n,i)=>n+i.count,0)).toBe(6);expect(d.market.items.some(i=>i.uid===uid)).toBe(false);const hash=stateHash(d.s);expect(exchange(d.w,d.p,d.trader,[{uid,count:1}],[])).not.toBeNull();expect(stateHash(d.s)).toBe(hash)
 })
})
