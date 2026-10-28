import type {CampfireDef} from '../src/core/types'
import {describe,it,expect} from 'vitest'
import {activityStep} from '../src/core/actions'
import {terrainFireFixture,terrainFireNativeFixture} from './terrain-fire-fixture'
import {db} from './helpers'
import {terrainFireTick,terrainFireQuote,nearbyTerrainFires,extinguishTerrainFire} from '../src/core/terrain-fire'
import {fireTurnsLeft} from '../src/core/campfire'
import {playerAct,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {turnOf,type World} from '../src/core/ctx'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {drinkVolume} from '../src/core/wash-water'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
function approach(d:ReturnType<typeof terrainFireFixture>){for(const dir of [0,6,6])d.act({type:'move',dir})}
function step(d:ReturnType<typeof terrainFireFixture>,n=1){for(let i=0;i<n;i++){d.s.time+=100;terrainFireTick(d.w)}}
describe('실제 불씨에서 마른 나무로 옮겨 붙는 유한 화재',()=>{
 it('차가운 원래 꾸러미나 무한 배경 빛은 나무를 태우거나 화재 난수를 만들지 않는다',()=>{const d=terrainFireFixture();d.s.map.lights.push({pos:d.firePos,radius:6,kind:'campfire'});const before=stateHash(d.s);terrainFireTick(d.w);expect(stateHash(d.s)).toBe(before);expect(d.tree.terrainFire).toBeUndefined()})
 it('실제 목재1개와 공개 점화 노동을 완료한 원래 모닥불의 불씨만 발화시킨다',()=>{const d=terrainFireFixture(),at=d.s.time;d.ignite();expect((d.s.time-at)/100).toBe(100);expect(d.wood.count).toBe(2);expect(fireTurnsLeft(d.w,d.firePos)).toBeGreaterThan(2300);expect(d.tree.terrainFire).toMatchObject({sourceUid:d.kit.uid,family:'dead-tree',remaining:600,total:600});expect(d.second.terrainFire).toBeUndefined()})
 it('태어나는 같은 시점에 조회나 중복 틱으로 연료/피해/난수를 더 진행하지 않는다',()=>{const d=terrainFireFixture();d.ignite();const before=stateHash(d.s);terrainFireTick(d.w);terrainFireTick(d.w);nearbyTerrainFires(d.w,d.p);terrainFireQuote(d.w,d.p,d.treePos);expect(stateHash(d.s)).toBe(before)})
 it('실제 다음 불씨 검사에서 인접한 원래 나무로 번지고 출처는 원래 화재ID다',()=>{const d=terrainFireFixture();d.ignite();const id=d.tree.terrainFire!.id;step(d,10);expect(d.second.terrainFire).toMatchObject({sourceUid:id});expect(d.second.terrainFire!.id).not.toBe(id);expect(d.tree.terrainFire!.remaining).toBe(590)})
 it('유한 나무 연료가 소진되면 바닥으로 바뀌고 같은 곳에서 목재를 무한 채집하지 못한다',()=>{const d=terrainFireFixture();d.ignite();const id=d.tree.terrainFire!.id;step(d,600);expect(d.tree.t).toBe('Terrain.Earth');expect(d.tree.terrainFire).toBeUndefined();expect(d.w.db.terrain(d.tree.t).gather).toBeUndefined();expect(d.s.map.lights.some(l=>l.terrainFireId===id)).toBe(false)})
 it('실제 타는 나무에 인접한 같은 몸은 실제 화상/체력 피해를 받는다',()=>{const d=terrainFireFixture();d.ignite();approach(d);const hp=d.p.hp;step(d,20);expect(d.p.body.wounds.some(w=>w.def==='Wound.Burn'&&w.source==='나무와 지형의 화재')).toBe(true);expect(d.p.hp).toBeLessThan(hp)})
 it('몸이 같은 물병의 실제500ml를 끼얹고 원래 병과 남은500ml를 보존한다',()=>{const d=terrainFireFixture();d.ignite();approach(d);const uid=d.bottle.uid,at=d.s.time;expect(playerAct(d.w,{type:'putOutTerrainFire',pos:d.treePos})).toBeNull();expect((d.s.time-at)/100).toBe(1);expect(d.tree.terrainFire).toBeUndefined();expect(d.bottle.uid).toBe(uid);expect(drinkVolume(d.w,d.bottle)).toBe(500);expect(d.tree.fireWetUntil).toBeGreaterThan(turnOf(d.w));expect(d.tree.combustionRemaining!.remaining).toBeLessThan(600)})
 it('물을 끼얹거나 조회해도 이미 탄 나무의 남은 연료를 원래600으로 복원하지 않는다',()=>{const d=terrainFireFixture();d.ignite();approach(d);step(d,30);const left=d.tree.terrainFire!.remaining;expect(extinguishTerrainFire(d.w,d.p,d.treePos)).toBeNull();expect(d.tree.combustionRemaining!.remaining).toBe(left);step(d,10);expect(d.tree.terrainFire).toBeUndefined();d.tree.fireWetUntil=turnOf(d.w);while(turnOf(d.w)%10)step(d);terrainFireTick(d.w);step(d,10);expect(d.tree.terrainFire!.remaining).toBeLessThanOrEqual(left)})
 it('실제 물이 부족하거나 닿지 않으면 몸/불/물/시간/난수를 원자적으로 보존한다',()=>{for(const mode of ['water','distance','sleep']){const d=terrainFireFixture();d.ignite();if(mode!=='distance')approach(d);if(mode==='water')d.bottle.uses=1;if(mode==='sleep')d.p.asleep=true;const before=stateHash(d.s);expect(extinguishTerrainFire(d.w,d.p,d.treePos)).toBeTruthy();expect(stateHash(d.s)).toBe(before)}})
 it('시간이 비어 있던 구간의 화상·연료·옛 난수는 소급해서 만들지 않는다',()=>{const d=terrainFireFixture();d.ignite();const old=d.tree.terrainFire!.remaining;d.s.time+=100*100;terrainFireTick(d.w);expect(d.tree.terrainFire!.remaining).toBe(old)})
 it('화재 중 실제 미완료 휴식의 전체 각인 복원과19턴 진행이 같다',()=>{const d=terrainFireFixture();d.ignite();d.act({type:'rest',turns:20},2);const copy:World={db:d.w.db,s:deserialize(serialize(d.s))},at=d.s.time;runUntilInput(d.w);runUntilInput(copy);expect((d.s.time-at)/100).toBe(19);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)))})
 it('구형118의 과거 산불이나 타버린 나무를 추정하지 않는다',()=>{const d=terrainFireFixture(),raw=JSON.parse(serialize(d.s));raw.version=118;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:118}).toEqual(raw)})
 it('화재의 잘못된 시간/확률/소진 지형은 콘텐츠 검사에서 거절한다',()=>{for(const [target,path,value]of [['Campfire.Hearth','/wildfire/checkTurns',0],['Campfire.Hearth','/wildfire/sparkChance',2],['Terrain.Tree','/combustion/burnedAs','Terrain.Absent']]as const){const id='bad-tree-fire',m=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target,path,value}]}],[id]);expect(m.report.errors.length).toBeGreaterThan(0)}})
 it('원래 나무에서 실제 목재를 먼저 채집했다면 같은 재료를 바로 불씨 연료로 중복 사용하지 않는다',()=>{const d=terrainFireFixture();approach(d);d.act({type:'gather',pos:d.treePos});expect(d.tree.gatherAt).toBeGreaterThan(turnOf(d.w));d.ignite();expect(d.tree.terrainFire).toBeUndefined();expect(d.p.bag.filter(i=>i.def==='Item.Wood').reduce((n,i)=>n+i.count,0)).toBe(3)})
 it('작업 도중 불붙은 원래 재료를 채집 완료하여 온전한 목재를 복제하지 않는다',()=>{const d=terrainFireFixture();d.ignite();approach(d);const wood=d.p.bag.filter(i=>i.def==='Item.Wood').reduce((n,i)=>n+i.count,0);d.p.activity={kind:'gather',remaining:1,target:{...d.treePos},label:'초기 진행 중인 채집'};activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.p.bag.filter(i=>i.def==='Item.Wood').reduce((n,i)=>n+i.count,0)).toBe(wood)})

 it('실제 기본 확률 장면은 검사 전용 모드 없이 브라우저와 같은 원래 콘텐츠 DB를 사용한다',()=>{const d=terrainFireNativeFixture('unlit');expect(d.w.db).toBe(db);expect(d.w.db.get<CampfireDef>('Campfire.Hearth').wildfire!.sparkChance).toBe(.02)})

})
