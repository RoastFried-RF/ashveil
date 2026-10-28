import {beforeAll,describe,it,expect} from 'vitest'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {configureScriptHost} from '../src/core/script-hooks'
import {generateSurface,generateDungeon} from '../src/core/mapgen'
import {applyScriptMapGen} from '../src/core/script-mapgen'
import {changeMap,newGame,SAVE_VERSION} from '../src/core/game'
import {deserialize,serialize} from '../src/core/save'
import type {ScriptHost} from '../src/core/script-contracts'
import type {World} from '../src/core/ctx'
let host:ScriptHost
beforeAll(async()=>{host=await createQuickJSScriptHost()})
const id='map-stages-test',body='const m=e.map,p=new Set(m.protectedCells);ctx.modState.calls=(ctx.modState.calls??0)+1;ctx.modState.maps=[...(ctx.modState.maps??[]),m.id];ctx.modState.roll=ctx.rng.int(0,100000);for(let y=1;y<m.h-1;y++)for(let x=1;x<m.w-1;x++)if(!p.has(y*m.w+x)&&["Terrain.Earth","Terrain.KtFloor","Terrain.CdFloor"].includes(m.palette[parseInt(m.terrainRows[y].slice(x*2,x*2+2),36)]))return[{type:"setTerrain",x,y,terrain:"Terrain.Mud"}];return []'
function setup(code=body){
 const loaded=loadMods([...readPackages(),{manifest:{id,name:'생성 단계 검사',version:'1',dependencies:['core'],scripts:{stage:2,entry:'scripts/main.js'}},defs:[],patches:[{op:'add',target:'WorldGen.Hearth',path:'/mapWorkers',value:{surface:id+':Paint',dungeon:id+':Paint'}}],scripts:[{file:'scripts/main.js',source:'export default defineMod({workers:{Paint:{kind:"MapGenStepWorker",execute(ctx,e){'+code+'}}}})'}]}],[id]);expect(loaded.report.errors).toEqual([]);expect(configureScriptHost(loaded.db,host)).toEqual([])
 const s=newGame(loaded.db,{seed:'actual-surface-and-floor-workers',background:'Bg.Hunter',scriptPreview:true}),w:World={db:loaded.db,s};return{w,id,db:loaded.db}
}
const plain=()=>loadMods(readPackages(),[]).db
function compareCandidate(w:World,kind:number){
 const control:World={db:plain(),s:structuredClone(w.s)},beforeActors=structuredClone(w.s.creatures),beforeNext=w.s.nextId,g=kind===0?generateSurface(w):generateDungeon(w,kind),b=kind===0?generateSurface(control):generateDungeon(control,kind),changes=g.map.tiles.map((t,i)=>t.t!==b.map.tiles[i].t?i:-1).filter(i=>i>=0)
 expect(changes).toHaveLength(1);b.map.tiles[changes[0]].t='Terrain.Mud';expect(g).toEqual(b);expect(w.s.creatures).toEqual(beforeActors);expect(w.s.nextId).toBe(beforeNext);for(const[k,v]of Object.entries(control.s.rng))expect(w.s.rng[k as keyof typeof w.s.rng]).toEqual(v);return g
}
describe('최초 지상과 모든 던전 층의 실제 지도 워커',()=>{
 it.each([0,1,2,3])('원래 %i층 지도/주민 후보/UID/난수에 검토한 지형 한 칸만 바꾼다',kind=>{const d=setup();compareCandidate(d.w,kind);expect(d.w.s.scriptState!.mods[id]).toMatchObject({calls:1,maps:[kind===0?'surface':'crypt'+kind]});expect(d.w.s.scriptState!.errors).toEqual([])})
 it('인물 미리보기 전체는 자기 생성 데이터/난수를 쓰지 않고 실제 새 게임에서 한 번만 실행한다',()=>{const d=setup();expect(d.w.s.scriptState).toBeUndefined();const actual=newGame(d.db,{seed:'actual-surface-and-floor-workers',background:'Bg.Hunter'});expect(actual.scriptState!.mods[id]).toMatchObject({calls:1,maps:['surface']});expect(actual.creatures.map(c=>c.id)).toEqual(d.w.s.creatures.map(c=>c.id));expect(actual.nextId).toBe(d.w.s.nextId)})
 it.each([0,1,2,3])('%i층의 전체 미리보기는 상태를 보존하고 실제 생성과 같은 후보를 낸다',kind=>{const d=setup(),before=structuredClone(d.w.s),peek=kind===0?generateSurface(d.w,{scriptPreview:true}):generateDungeon(d.w,kind,{scriptPreview:true});expect(d.w.s).toEqual(before);expect(kind===0?generateSurface(d.w):generateDungeon(d.w,kind)).toEqual(peek)})
 it('새 층은 한 번 생성하고 저장한 기존 지도/주민/물품을 돌아올 때 다시 만들지 않는다',()=>{const d=setup();d.w.s=newGame(d.db,{seed:'actual-cached-floor-worker',background:'Bg.Hunter'});changeMap(d.w,'crypt1');const first=structuredClone(d.w.s.map),calls=(d.w.s.scriptState!.mods[id]as {calls:number}).calls;changeMap(d.w,'surface');expect((d.w.s.scriptState!.mods[id]as {calls:number}).calls).toBe(calls);changeMap(d.w,'crypt1');expect(d.w.s.map.tiles).toEqual(first.tiles);expect((d.w.s.scriptState!.mods[id]as {calls:number}).calls).toBe(calls)})
 it('서로 다른 층의 생성 순서가 자기 지역별 난수와 후보를 밀지 않는다',()=>{const a=setup(),b=setup();const a1=generateDungeon(a.w,1),a2=generateDungeon(a.w,2),b2=generateDungeon(b.w,2),b1=generateDungeon(b.w,1);expect(a1).toEqual(b1);expect(a2).toEqual(b2);expect(a.w.s.rng).toEqual(b.w.s.rng)})
 it('저장한 다음 층 생성은 전체 상태가 같다',()=>{const d=setup();generateDungeon(d.w,1);d.w.s=deserialize(serialize(d.w.s));const copy:World={db:d.db,s:deserialize(serialize(d.w.s))};expect(generateDungeon(d.w,3)).toEqual(generateDungeon(copy,3));expect(serialize(d.w.s)).toBe(serialize(copy.s))})
 it.each(['home','waypoint','prop','light'])('원래 %s 지점은 지상/던전 워커가 바꿀 수 없다',kind=>{const d=setup('ctx.modState.bad=true;return [{type:"setTerrain",x:1,y:1,terrain:"Terrain.Mud"}]'),map={...d.w.s.map,w:5,h:5,tiles:Array.from({length:25},()=>({t:'Terrain.Earth',v:0,roof:false,blood:0,items:[]})),exits:[{x:4,y:4}],links:[],rooms:[],props:kind==='prop'?[{kind:'original',x:1,y:1,w:1,h:1}]:[],lights:kind==='light'?[{kind:'original',pos:{x:1,y:1},radius:1}]:[],waypoints:kind==='waypoint'?{original:{x:1,y:1}}:undefined},gen={map,start:{x:0,y:0},spawns:kind==='home'?[{def:'Creature.Reaver',pos:{x:3,y:3},home:{x:1,y:1}}]:[]},before=structuredClone(gen);expect(applyScriptMapGen(d.w,{id:'WorldGen.Hearth.surface',genWorker:id+':Paint'},gen)).toEqual(before);expect(d.w.s.scriptState!.mods).toEqual({});expect(d.w.s.scriptState!.errors[0].reason).toContain('앵커')})
 it('166각인은 버전만167로 옮기고 과거 지도를 재생성하지 않는다',()=>{const s=newGame(plain(),{seed:'map-stage-legacy'});s.version=166;expect(deserialize(JSON.stringify(s))).toEqual({...s,version:SAVE_VERSION});expect(s.scriptState).toBeUndefined()})
})
