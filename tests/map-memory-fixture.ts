import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {hpMax} from '../src/core/body'
import {tileAt,turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
export function mapMemoryFixture(){
 const d=conditionThoughtsFixture('map-memory-proof'),{w,s,p}=d
 p.pos={x:20,y:20};p.stats={str:10,agi:10,vit:10,per:10,wil:10};p.hp=hpMax(w,p);p.asleep=false;p.unconscious=false;p.needs.vitamin=100
 s.map.lights=[];s.map.props=[];s.map.rooms=[];s.map.links=[];s.map.ambient=1;s.map.daylightMult=1;s.fx=[]
 for(const t of s.map.tiles){t.t='Terrain.Earth';t.roof=false;t.blood=0;t.items=[];delete t.seen;delete t.observed;delete t.room;delete t.deco;delete t.cont}
 for(let y=0;y<s.map.h;y++)tileAt(w,{x:22,y}).t='Terrain.KtWall'
 const door={x:22,y:20},target={x:25,y:20},unknown={x:30,y:20},observedAt=turnOf(w)-100
 tileAt(w,door).t='Terrain.DoorClosed'
 // 유효한 초기 탐험 기록이다. 이전 탐험이나 나무 소실을 화면에서 실행했다고 주장하지 않는다.
 for(let y=18;y<=22;y++)for(let x=24;x<=28;x++){const t=tileAt(w,{x,y});t.seen=true;t.observed={terrain:t.t,at:observedAt}}
 tileAt(w,target).observed={terrain:'Terrain.Tree',at:observedAt};tileAt(w,unknown).t='Terrain.Chest'
 invalidateLights(w);updatePlayerVision(w,p)
 const index=target.y*s.map.w+target.x,unknownIndex=unknown.y*s.map.w+unknown.x
 if(s.visible.includes(index))throw Error('닫힌 문 뒤의 초기 기억 칸이 보인다')
 return{...d,door,target,unknown,index,unknownIndex,observedAt}
}
export type MapMemoryPhase='remembered'|'revealed'|'pending'
export function mapMemoryNativeFixture(phase:MapMemoryPhase){
 const d=mapMemoryFixture(),initialTime=d.s.time
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)}
 if(phase!=='remembered'){act({type:'move',dir:2});act({type:'move',dir:2})}
 if(phase==='pending')act({type:'rest',turns:20},2)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialPriorExplorationExplicit:true,pending:phase==='pending'}}
}
