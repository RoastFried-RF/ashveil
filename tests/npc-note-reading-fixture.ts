import {cartographyFixture,initialMapReport} from './cartography-fixture'
import {createCreature} from '../src/core/creatures'
import {hpMax} from '../src/core/body'
import {addToBag} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {tileAt} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function npcNoteReadingFixture(){
 const d=cartographyFixture(),npc=createCreature(d.w,'Creature.Settler',{x:d.p.pos.x+1,y:d.p.pos.y})
 npc.faction='player';npc.pos={x:d.p.pos.x+1,y:d.p.pos.y};npc.home={...npc.pos};npc.nextAct=d.s.time;npc.traits=[];npc.background=undefined;npc.age=undefined;npc.bag=[];npc.equip={};npc.body.wounds=[];npc.body.missing=[];npc.effects=[];npc.traumas=[];npc.asleep=false;npc.unconscious=false;npc.literacy=2;npc.literate=true;npc.stats={str:10,agi:10,vit:10,per:10,wil:10};npc.hp=hpMax(d.w,npc)
 Object.assign(npc.needs,{kcal:1000,waterDeficit:0,fatigue:20,sleepDebt:0,stress:0,bodyTemp:37,wetness:0,vitamin:100,protein:100})
 d.s.creatures.push(npc)
 const note=d.addReport(initialMapReport());d.p.bag=d.p.bag.filter(i=>i!==note);if(addToBag(d.w,npc,note))throw Error('원래 NPC 쪽지')
 // 처음부터 이 사람이 소유하던 원래 쪽지다. 전달/과거 독서 턴을 실행했다는 뜻이 아니다.
 for(let y=d.p.pos.y-2;y<=d.p.pos.y+2;y++)for(let x=d.p.pos.x-2;x<=d.p.pos.x+2;x++){const tile=tileAt(d.w,{x,y});if(tile)tile.roof=false}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return{...d,npc,note,originalDocument:structuredClone(note.note!.mapDocument!)}
}
export type NpcNoteReadingPhase='unread'|'read'|'heard'|'pending'
export function npcNoteReadingNativeFixture(phase:NpcNoteReadingPhase){
 const d=npcNoteReadingFixture(),initialTime=d.s.time
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)}
 if(phase!=='unread')act({type:'wait'})
 if(phase==='heard'||phase==='pending')act({type:'talk',target:d.npc.id})
 if(phase==='pending')act({type:'rest',turns:20},2)
 return{...d,act,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,npcId:d.npc.id,noteUid:d.note.uid,originalDocument:d.originalDocument,pending:phase==='pending',initialOriginalNpcPossessionExplicit:true}}
}
