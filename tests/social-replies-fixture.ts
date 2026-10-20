import {merchantAppraisalFixture} from './merchant-appraisal-fixture'
import {ensureSociety,factionDef} from '../src/core/diplomacy'
import {creatureAt,inBounds,tileAt} from '../src/core/ctx'
import {DIRS,dirIndex} from '../src/core/geom'
import {startBreakdown} from '../src/core/psyche'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {BreakDef} from '../src/core/types'
export function socialRepliesFixture(guard=false,atGate=true){
 const d=merchantAppraisalFixture('social-replies'),speaker=guard?d.s.creatures.find(c=>c.residentSite===d.s.overworld!.currentRegion&&c.def===factionDef(d.w,c.faction)?.guard)!:d.trader,exit={...d.s.map.exits[0]!}
 if(!speaker)throw Error('original local speaker missing')
 const inside=atGate?DIRS.map(dir=>({x:exit.x+dir.x,y:exit.y+dir.y})).find(p=>inBounds(d.w,p)&&p.x>0&&p.y>0&&p.x<d.s.map.w-1&&p.y<d.s.map.h-1&&!creatureAt(d.w,p))!:{...d.p.pos}
 if(!inside)throw Error('real exit neighbour missing')
 d.p.pos=inside
 const pos=DIRS.map(dir=>({x:inside.x+dir.x,y:inside.y+dir.y})).find(p=>inBounds(d.w,p)&&(p.x!==exit.x||p.y!==exit.y)&&!creatureAt(d.w,p))!
 speaker.pos=pos;speaker.traits=[];speaker.traumas=[];speaker.effects=[];speaker.breakdown=undefined;speaker.needs.stress=0
 for(const p of [d.p.pos,speaker.pos]){tileAt(d.w,p).t='Terrain.Earth';tileAt(d.w,p).roof=true}
 const rep=(n:number)=>{ensureSociety(d.w)!.reputation[speaker.faction]=n}
 const irritable=()=>startBreakdown(d.w,speaker,d.w.db.get<BreakDef>('Break.Irritable'))
 const speak=(budget?:number)=>{const error=playerAct(d.w,{type:'talk',target:speaker.id},budget);if(error)throw Error(error)}
 const depart=()=>{const dir=dirIndex(exit.x-d.p.pos.x,exit.y-d.p.pos.y);let error=playerAct(d.w,{type:'move',dir});if(error)throw Error(error);if(d.p.pos.x!==exit.x||d.p.pos.y!==exit.y)throw Error('actual exit not reached');error=playerAct(d.w,{type:'leave'});if(error)throw Error(error)}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,speaker,exit,rep,irritable,speak,depart}
}
export type SocialReplyPhase='welcome'|'insult'|'ordered'|'expelled'|'ordinary'|'pending'
export function socialReplyNativeFixture(phase:SocialReplyPhase){
 const d=socialRepliesFixture(phase==='ordered'||phase==='expelled'||phase==='pending'),initialTime=d.s.time
 if(phase==='welcome')d.rep(20)
 else if(phase==='insult'){d.rep(0);d.irritable()}
 else d.rep(-20)
 d.speak()
 if(phase==='expelled')d.depart()
 if(phase==='pending'){const error=playerAct(d.w,{type:'rest',turns:20},2);if(error)throw Error(error)}
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,speakerId:d.speaker.id,sourceSite:d.speaker.residentSite,sourceFaction:d.speaker.faction,exit:d.exit,pending:phase==='pending'}}
}
