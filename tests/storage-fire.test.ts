import {describe,it,expect} from 'vitest'
import {storageFireFixture} from './storage-fire-fixture'
import {terrainFireTick,extinguishTerrainFire} from '../src/core/terrain-fire'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {drinkVolume} from '../src/core/wash-water'
import {baseStoreError} from '../src/core/base-camp'
import {openContainer,perform} from '../src/core/actions'
import type {World} from '../src/core/ctx'
const hot=()=>{const d=storageFireFixture();d.ignite();expect(d.tile.terrainFire?.family).toBe('wood-stash');return d}
function step(d:ReturnType<typeof storageFireFixture>,turns=1){for(let i=0;i<turns;i++){d.s.time+=100;terrainFireTick(d.w)}}
const loose=(item:ReturnType<typeof storageFireFixture>['water'])=>{const copy=structuredClone(item);delete copy.gx;delete copy.gy;delete copy.rot;return copy}
describe('유한 목제 보관함 화재와 원래 내용물 보존',()=>{
 it('실제 설치한 보관함과 원래 네 내용물/빈 바닥은 불이 없으면 바뀌지 않는다',()=>{const d=storageFireFixture(),before=serialize(d.s);terrainFireTick(d.w);expect(serialize(d.s)).toBe(before);expect(d.tile.placed!.item.uid).toBe(d.chest.uid);expect(d.tile.placed!.base).toBe('Terrain.KtFloor')})
 it('실제 모닥불 점화100턴/목재1개 뒤에만 목제 보관함이 발화한다',()=>{const d=storageFireFixture(),at=d.s.time,ids=d.stash.items.map(i=>i.uid);d.ignite();expect(d.s.time-at).toBe(10000);expect(d.wood.count).toBe(2);expect(d.tile.terrainFire).toMatchObject({sourceUid:d.kit.uid,placedUid:d.chest.uid,total:600});expect(d.stash.items.map(i=>i.uid)).toEqual(ids)})
 it('소진 때 같은 원래 UID/물량/소금/병원체/효력/변질/수량을 바닥에 남긴다',()=>{const d=hot();d.p.pos={x:d.pos.x+5,y:d.pos.y+5};const before=d.stash.items.map(loose),oldGround=loose(d.ground),ids=d.s.nextId;step(d,d.tile.terrainFire!.remaining);expect(d.tile.t).toBe('Terrain.KtFloor');expect(d.tile.cont).toBeUndefined();expect(d.tile.placed).toBeUndefined();expect(d.tile.terrainFire).toBeUndefined();expect(d.tile.items).toEqual([oldGround,...before]);expect(d.tile.items.map(i=>i.uid)).toEqual([d.ground.uid,...before.map(i=>i.uid)]);expect(d.s.nextId).toBe(ids);expect(drinkVolume(d.w,d.water)).toBe(300)})
 it('물품 격자만 지우고 같은 나무 두 더미를 자동 병합하거나 UID를 삼키지 않는다',()=>{const d=hot();step(d,600);const stacks=d.tile.items.filter(i=>i.def==='Item.Wood');expect(stacks.map(i=>[i.uid,i.count])).toEqual([[d.ground.uid,1],[d.storedWood.uid,2]]);expect(d.tile.items.every(i=>i.gx===undefined&&i.gy===undefined&&i.rot===undefined)).toBe(true)})
 it('불이 붙은 뒤 내용물을 또 열어도 재추첨/새 실물 생성은 없다',()=>{const d=hot(),before=d.s.nextId,items=structuredClone(d.stash.items);openContainer(d.w,d.p,d.pos);expect(d.s.nextId).toBe(before);expect(d.stash.items).toEqual(items);step(d,600);expect(d.s.loot).toEqual({kind:'floor',pos:d.pos})})
 it('이미 열린 내용물 창은 소진 때 같은 자리 바닥으로 바뀐다',()=>{const d=hot();d.s.loot={kind:'cont',pos:{...d.pos}};step(d,600);expect(d.s.loot).toEqual({kind:'floor',pos:d.pos});expect(d.tile.cont).toBeUndefined()})
 it('다른 자리 용기나 시체의 열린 창을 소진된 보관함으로 바꾸지 않는다',()=>{for(const loot of[{kind:'cont' as const,pos:{x:0,y:0}},{kind:'corpse' as const,pos:{x:0,y:0},id:999}]){const d=hot();d.s.loot=structuredClone(loot);step(d,600);expect(d.s.loot).toEqual(loot)}})
 it('중복 틱은 내용물을 두 번 쏟거나 시각/난수를 더 쓰지 않는다',()=>{const d=hot();step(d,600);const before=serialize(d.s);terrainFireTick(d.w);terrainFireTick(d.w);expect(serialize(d.s)).toBe(before)})
 it('원래500ml로 소화하면 내용물/같은 보관함·부분 연료를 보존한다',()=>{const d=hot();step(d,5);const left=d.tile.terrainFire!.remaining,contents=structuredClone(d.stash.items),uid=d.bottle.uid;expect(extinguishTerrainFire(d.w,d.p,d.pos)).toBeNull();expect(d.tile.t).toBe('Terrain.Stash');expect(d.tile.cont!.items).toEqual(contents);expect(d.tile.combustionRemaining!.remaining).toBe(left);expect(d.bottle.uid).toBe(uid);expect(drinkVolume(d.w,d.bottle)).toBe(500)})
 it('불타는 같은 자리에 새 보관함을 덧씌워 연료를 복구하지 않는다',()=>{const d=hot(),chest=d.add('Item.StorageChest'),before=stateHash(d.s);expect(perform(d.w,d.p,{type:'place',uid:chest.uid,dir:0}).ok).toBe(false);expect(stateHash(d.s)).toBe(before)})
 it('같은 원본 보관함/내용물/부분 연소를 전체197 각인에서 복원한다',()=>{const d=hot();step(d,23);expect(serialize(deserialize(serialize(d.s)))).toBe(serialize(d.s));const copy:World={db:d.w.db,s:deserialize(serialize(d.s))};for(let i=0;i<600;i++){d.s.time+=100;copy.s.time+=100;terrainFireTick(d.w);terrainFireTick(copy)}expect(serialize(copy.s)).toBe(serialize(d.s))})
 it('실제 미완료 활동 재개도 같은 화상과 물품의 전체 결과다',()=>{const d=hot();d.act({type:'rest',turns:20},2);const copy:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(copy);expect(serialize(copy.s)).toBe(serialize(d.s))})
 it('닫힌 원래 자루 내부의 UID와 수량은 풀거나 합치지 않고 함께 남긴다',()=>{const d=hot(),inside=structuredClone(d.sack.contents);step(d,600);expect(d.tile.items.find(i=>i.uid===d.sack.uid)!.contents).toEqual(inside);expect(d.sack.contents![0].uid).toBe(d.nested.uid);expect(d.tile.items.some(i=>i.uid===d.nested.uid)).toBe(false)})
 it('실제 거점 보관함이 소진되면 이전 창고 접근을 거절하고 물품을 재생성하지 않는다',()=>{const d=hot();d.p.pos={x:d.pos.x+5,y:d.pos.y+5};d.s.map.baseCamp={owner:d.p.id,at:0,store:{...d.pos},storeUid:d.chest.uid,tasks:{}};expect(baseStoreError(d.w,d.p,false)).toBeNull();step(d,600);const before=serialize(d.s);expect(baseStoreError(d.w,d.p,false)).toContain('없어지거나');expect(serialize(d.s)).toBe(before);expect(d.tile.cont).toBeUndefined()})
 it('구형196은 과거 보관함 연소나 내용물 이동을 소급하지 않고 버전만 올린다',()=>{const d=storageFireFixture(),old=JSON.parse(serialize(d.s));old.version=196;const restored=deserialize(JSON.stringify(old));expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:196}).toEqual(old)})
})
