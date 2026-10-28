import {beforeAll,describe,it,expect} from 'vitest'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {configureScriptHost} from '../src/core/script-hooks'
import {generateRegionLayout} from '../src/core/region-layout'
import {applyScriptMapGen} from '../src/core/script-mapgen'
import {newGame,SAVE_VERSION} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import type {World} from '../src/core/ctx'
import type {RegionLayoutDef} from '../src/core/types'
import type {ScriptHost} from '../src/core/script-contracts'
let host:ScriptHost
beforeAll(async()=>{host=await createQuickJSScriptHost()})
const paint='ctx.modState.calls=(ctx.modState.calls??0)+1;const m=e.map,p=new Set(m.protectedCells);for(let y=1;y<m.h-1;y++)for(let x=1;x<m.w-1;x++)if(!p.has(y*m.w+x)&&m.palette[parseInt(m.terrainRows[y].slice(x*2,x*2+2),36)]==="Terrain.Earth")return[{type:"setTerrain",x,y,terrain:"Terrain.Mud"}];return []'
function setup(body=paint){
 const id='map-worker-test',loaded=loadMods([...readPackages(),{manifest:{id,name:'지도 검사',version:'1',dependencies:['core'],scripts:{stage:2,entry:'scripts/main.js'}},defs:[],patches:[{op:'add',target:'RegionLayout.Blackwood',path:'/genWorker',value:id+':TerrainStep'}],scripts:[{file:'scripts/main.js',source:'export default defineMod({workers:{TerrainStep:{kind:"MapGenStepWorker",execute(ctx,e){'+body+'}}}})'}]}],[id]);expect(loaded.report.errors).toEqual([]);expect(configureScriptHost(loaded.db,host)).toEqual([])
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'actual-mapgen-worker',background:'Bg.Hunter'})},d=loaded.db.get<RegionLayoutDef>('RegionLayout.Blackwood');return{w,d,id}
}
const regionId='Region.Blackwood'
function baseline(w:World){const loaded=loadMods(readPackages(),[]),control:World={db:loaded.db,s:structuredClone(w.s)},d=loaded.db.get<RegionLayoutDef>('RegionLayout.Blackwood');return{control,gen:generateRegionLayout(control,d,{regionId})}}
describe('원래 최초 지도 후보를 검증하는 단계2 생성 워커',()=>{
 it('원래 지형 한 칸만 바꾸고 주민/앵커/실물/코어 난수를 보존한다',()=>{const d=setup(),actors=structuredClone(d.w.s.creatures),b=baseline(d.w),g=generateRegionLayout(d.w,d.d,{regionId}),changed=g.map.tiles.map((t,i)=>t.t!==b.gen.map.tiles[i].t?i:-1).filter(i=>i>=0);expect(changed).toHaveLength(1);expect(g.map.tiles[changed[0]].t).toBe('Terrain.Mud');b.gen.map.tiles[changed[0]].t='Terrain.Mud';expect(g).toEqual(b.gen);expect(d.w.s.creatures).toEqual(actors);expect(d.w.s.nextId).toBe(b.control.s.nextId);for(const[k,v]of Object.entries(b.control.s.rng))expect(d.w.s.rng[k as keyof typeof d.w.s.rng]).toEqual(v);expect(d.w.s.scriptState!.mods[d.id]).toEqual({calls:1})})
 it('실제 생성 미리보기는 모든 세계 상태를 보존하고 이후 실제 후보와 같다',()=>{const d=setup(),before=structuredClone(d.w.s),peek=generateRegionLayout(d.w,d.d,{scriptPreview:true,regionId});expect(d.w.s).toEqual(before);const actual=generateRegionLayout(d.w,d.d,{regionId});expect(actual).toEqual(peek);expect(d.w.s.scriptState!.mods[d.id]).toEqual({calls:1})})
 it('거절하는 미리보기도 오류/중단/물품ID/난수를 쓰지 않는다',()=>{const d=setup('while(true){}'),before=stateHash(d.w.s);generateRegionLayout(d.w,d.d,{scriptPreview:true,regionId});expect(stateHash(d.w.s)).toBe(before);expect(d.w.s.scriptState!.disabled).toEqual([])})
 it.each([
  'return[{type:"spawnCreature",def:"Creature.Reaver"}]',
  'return[{type:"setTerrain",x:e.map.start.x,y:e.map.start.y,terrain:"Terrain.RuinWall"}]',
  'const i=e.map.protectedCells[0];return[{type:"setTerrain",x:i%e.map.w,y:Math.floor(i/e.map.w),terrain:"Terrain.Mud"}]',
  'return[{type:"setTerrain",x:-1,y:0,terrain:"Terrain.Earth"}]',
  'return[{type:"setTerrain",x:1.5,y:1,terrain:"Terrain.Earth"}]',
  'return[{type:"setTerrain",x:1,y:1,terrain:"Item.Cloth"}]',
  'return[{type:"setTerrain",x:1,y:1,terrain:"Terrain.Earth",items:[]}]',
  'return Array.from({length:257},()=>({type:"setTerrain",x:1,y:1,terrain:"Terrain.Earth"}))',
  'while(true){}'
 ])('잘못된 출력은 원래 지도와 실제 물품/인원만 유지하고 자기 상태/난수는 버린다 (%s)',body=>{const d=setup('ctx.modState.bad=true;ctx.rng.int(1,10);'+body),actors=structuredClone(d.w.s.creatures),b=baseline(d.w),actual=generateRegionLayout(d.w,d.d,{regionId});expect(actual).toEqual(b.gen);expect(d.w.s.creatures).toEqual(actors);expect(d.w.s.nextId).toBe(b.control.s.nextId);expect(d.w.s.scriptState!.mods).toEqual({});expect(Object.keys(d.w.s.rng).some(k=>k.startsWith('mod.'))).toBe(false);expect(d.w.s.scriptState!.disabled).toEqual([d.id+':worker.TerrainStep.execute'])})
 it('시작점 주위를 막아 원래 출입구 연결을 끊으면 전체 변경을 거절한다',()=>{const d=setup('const m=e.map,p=new Set(m.protectedCells);return [[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>({type:"setTerrain",x:m.start.x+dx,y:m.start.y+dy,terrain:"Terrain.RuinWall"})).filter(o=>!p.has(o.y*m.w+o.x))'),map={...d.w.s.map,w:5,h:5,tiles:Array.from({length:25},()=>({t:'Terrain.Earth',v:0,roof:false,blood:0,items:[]})),exits:[{x:0,y:0}],links:[],rooms:[],props:[],lights:[]},gen={map,start:{x:2,y:2},spawns:[]},before=structuredClone(gen),actual=applyScriptMapGen(d.w,d.d,gen,{regionId});expect(actual).toEqual(before);expect(d.w.s.scriptState!.errors[0].reason).toContain('연결')})
 it('지도 입력은128×128에서도 기존64KiB 한도 안에서 읽기 전용으로 전달한다',()=>{const d=setup('ctx.modState.size=[e.map.w,e.map.h,e.map.terrainRows.length,e.map.terrainRows[0].length];return []'),map={...d.w.s.map,w:128,h:128,tiles:Array.from({length:128*128},()=>({t:'Terrain.Earth',v:0,roof:false,blood:0,items:[]})),exits:[{x:127,y:127}],links:[],rooms:[],props:[],lights:[]};const original={map,start:{x:0,y:0},spawns:[]};applyScriptMapGen(d.w,d.d,original,{regionId});expect(d.w.s.scriptState!.mods[d.id]).toEqual({size:[128,128,128,256]});expect(d.w.s.scriptState!.errors).toEqual([])})
 it('저장 복원 뒤 같은 다음 생성의 후보/자기 데이터/난수를 재현한다',()=>{const d=setup();generateRegionLayout(d.w,d.d,{regionId});const other:World={db:d.w.db,s:deserialize(serialize(d.w.s))};d.w.s=deserialize(serialize(d.w.s));expect(generateRegionLayout(d.w,d.d,{regionId:'Region.Second'})).toEqual(generateRegionLayout(other,d.d,{regionId:'Region.Second'}));expect(JSON.parse(serialize(other.s))).toEqual(JSON.parse(serialize(d.w.s)))})
 it('165각인은 버전만 올리고 옛 지도/물품/주민/생성 호출은 바꾸지 않는다',()=>{const {db}=loadMods(readPackages(),[]),s=newGame(db,{seed:'mapgen-worker-legacy'});s.version=165;expect(deserialize(JSON.stringify(s))).toEqual({...s,version:SAVE_VERSION});expect(s.scriptState).toBeUndefined()})
})
