import {describe,it,expect} from 'vitest'
import {woodDoorFireFixture} from './wood-door-fire-fixture'
import {terrainFireTick,extinguishTerrainFire} from '../src/core/terrain-fire'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {drinkVolume} from '../src/core/wash-water'
import {hpMax} from '../src/core/body'
import {type World} from '../src/core/ctx'
import {generateRegionLayout} from '../src/core/region-layout'
import {db} from './helpers'
import type {RegionLayoutDef,RegionSiteDef} from '../src/core/types'
function hot(){const d=woodDoorFireFixture();d.ignite();return d}
describe('실제 생성한 집의 나무문과 같은 원본 재료의 화재',()=>{
 it('그늘 숲의 세 실제 지역은 원래 가족 집에 구별된 나무문을 생성한다',()=>{const d=woodDoorFireFixture(null);for(const id of ['Region.ShadeGrove','Region.ShadeHollow','Region.ShadeBasin']){const site=db.get<RegionSiteDef>(id),layout=db.get<RegionLayoutDef>(site.layout!),map=generateRegionLayout(d.w,layout).map,b=layout.buildings[0]!;expect(map.tiles[b.door[1]*map.w+b.door[0]]!.t).toBe('Terrain.WoodDoorClosed')}expect(d.w.db).toBe(db)})
 it('일반 돌문과 봉인 금고 문은 나무문의 연소 설정을 물려받지 않는다',()=>{for(const id of ['Terrain.DoorClosed','Terrain.DoorOpen','Terrain.ZeroVaultSealedDoor','Terrain.ZeroVaultDoorOpen','Terrain.SeedVaultDoor'])expect(db.terrain(id).combustion,id).toBeUndefined()})
 it('차가운 꾸러미나 기존 배경 등불로 실제 문에 불을 만들지 않는다',()=>{const d=woodDoorFireFixture(),before=stateHash(d.s);terrainFireTick(d.w);expect(stateHash(d.s)).toBe(before);expect(d.door.terrainFire).toBeUndefined()})
 it('실제 점화 노동과 원래 목재1개로 같은 생성 문에 실제 화재가 붙는다',()=>{const d=hot();expect(d.wood.count).toBe(2);expect(d.door.terrainFire).toMatchObject({sourceUid:d.kit.uid,family:'wood-door',total:600});expect(d.door.t).toBe('Terrain.WoodDoorClosed')})
 it('실제 문 열기1턴은 원본 화재ID/시각/남은 재료를 이어간다',()=>{const d=hot();d.approach();const before=structuredClone(d.door.terrainFire!),at=d.s.time,pos={...d.p.pos};d.act({type:'move',dir:4});expect((d.s.time-at)/100).toBe(1);expect(d.p.pos).toEqual(pos);expect(d.door.t).toBe('Terrain.WoodDoorOpen');expect(d.door.terrainFire).toMatchObject({id:before.id,startedAt:before.startedAt,sourceUid:before.sourceUid,remaining:before.remaining-1,total:600})})
 it('반복 열기/닫기로 연소를 지우거나 원래600턴 연료로 채우지 않는다',()=>{const d=hot();d.approach();const id=d.door.terrainFire!.id,left=d.door.terrainFire!.remaining;for(let i=0;i<3;i++){d.act({type:'move',dir:4});d.act({type:'closeDoor',dir:4})}expect(d.door.t).toBe('Terrain.WoodDoorClosed');expect(d.door.terrainFire!.id).toBe(id);expect(d.door.terrainFire!.remaining).toBe(left-6)})
 it('실제600턴 소진된 문은 통로가 되고 온전한 새 문이나 목재를 만들지 않는다',()=>{const d=hot(),id=d.door.terrainFire!.id;for(let i=0;i<600;i++)d.act({type:'wait'});expect(d.door.t).toBe('Terrain.Earth');expect(d.door.terrainFire).toBeUndefined();expect(d.s.map.lights.some(l=>l.terrainFireId===id)).toBe(false);expect(d.door.items).toEqual([]);d.approach();d.act({type:'move',dir:4});expect(d.p.pos).toEqual(d.doorPos)})
 it('불붙은 열린 문을 실제 물500ml로 끄고 같은 원본 병/열린 상태/남은 연료를 보존한다',()=>{const d=hot();d.approach();d.act({type:'move',dir:4});const left=d.door.terrainFire!.remaining,uid=d.bottle.uid,at=d.s.time;d.act({type:'putOutTerrainFire',pos:d.doorPos});expect((d.s.time-at)/100).toBe(1);expect(d.door.t).toBe('Terrain.WoodDoorOpen');expect(d.door.terrainFire).toBeUndefined();expect(d.door.combustionRemaining!.remaining).toBe(left);expect(d.bottle.uid).toBe(uid);expect(drinkVolume(d.w,d.bottle)).toBe(500);d.act({type:'closeDoor',dir:4});expect(d.door.combustionRemaining!.remaining).toBe(left)})
 it('같은 불씨 앞의 금속 봉인 문에는 실제 연료와 화재UID를 새로 만들지 않는다',()=>{const d=woodDoorFireFixture();d.door.t='Terrain.ZeroVaultSealedDoor';const next=d.s.nextId;d.ignite();expect(d.door.terrainFire).toBeUndefined();expect(d.s.nextId).toBe(next);expect(d.wood.count).toBe(2)})
 it('물이 부족한 실제 문 소화 실패는 원자적으로 상태/시간/난수를 보존한다',()=>{const d=hot();d.approach();d.bottle.uses=1;const before=stateHash(d.s);expect(extinguishTerrainFire(d.w,d.p,d.doorPos)).toBeTruthy();expect(stateHash(d.s)).toBe(before)})
 it('타는 닫힌 문을 저장하고19턴 더 진행한 몸/문/연료/난수가 전체 같다',()=>{const d=hot();d.act({type:'rest',turns:20},2);const copy:World={db:d.w.db,s:deserialize(serialize(d.s))},at=d.s.time;runUntilInput(d.w);runUntilInput(copy);expect((d.s.time-at)/100).toBe(19);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)))})
 it('타는 문 곁의 저장 재개는 실제 화상에서 기존T2로 멈추고 전체가 같다',()=>{const d=hot();d.approach();d.act({type:'move',dir:4});d.act({type:'rest',turns:20},2);const copy:World={db:d.w.db,s:deserialize(serialize(d.s))},at=d.s.time;runUntilInput(d.w);runUntilInput(copy);expect((d.s.time-at)/100).toBe(16);expect(d.p.activity).toBeUndefined();expect(d.p.hp).toBeLessThan(hpMax(d.w,d.p));expect(d.p.body.wounds.some(w=>w.def==='Wound.Burn')).toBe(true);expect(d.s.log.at(-1)!.text).toContain('다쳤다');expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)))})
 it('구형119에 과거 문 화재나 젖음을 만들지 않고 버전만 이관한다',()=>{const d=woodDoorFireFixture(),old=JSON.parse(serialize(d.s));old.version=119;const restored=deserialize(JSON.stringify(old));expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:119}).toEqual(old)})
})
