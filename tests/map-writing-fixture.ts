import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {hpMax} from '../src/core/body'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {tileAt} from '../src/core/ctx'
import {playerAct} from '../src/core/game'
import {mapDrawingQuote} from '../src/core/map-writing'
export function mapWritingFixture(seed='map-writing-proof'){
 const d=conditionThoughtsFixture(seed);d.p.literacy=2;d.p.literate=true;d.p.hp=hpMax(d.w,d.p);d.p.needs.vitamin=100;d.s.knowledge.rumors=[]
 for(let y=d.p.pos.y-4;y<=d.p.pos.y+4;y++)for(let x=d.p.pos.x-4;x<=d.p.pos.x+4;x++){const t=tileAt(d.w,{x,y});if(t)t.roof=false}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const paper=makeItem(d.w,'Item.Note'),ink=makeItem(d.w,'Item.Ink',3)
 if(addToBag(d.w,d.p,paper)||addToBag(d.w,d.p,ink))throw Error('map material bag')
 return{...d,paper,ink,action:{type:'drawMap' as const,paperUid:paper.uid,inkUid:ink.uid}}
}
export type MapWritingPhase='quote'|'drawn'|'interrupted'|'pending'|'stale'
export function mapWritingNativeFixture(phase:MapWritingPhase){
 const d=mapWritingFixture(),initialTime=d.s.time,initialQuote=mapDrawingQuote(d.w,d.p,d.paper.uid,d.ink.uid)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)}
 if(phase==='drawn')act(d.action)
 if(phase==='pending')act(d.action,2)
 if(phase==='interrupted'||phase==='stale'){act(d.action,10);act({type:'stopActivity'})}
 if(phase==='stale')act({type:'drop',uid:d.ink.uid})
 updatePlayerVision(d.w,d.p)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialQuote,paperUid:d.paper.uid,inkUid:d.ink.uid,inkBefore:3,pending:phase==='pending'}}
}
