import type {Pos} from '../../core/geom'

export const WALK_STEP_MS=150
export interface WalkMotion {from:Pos;to:Pos;t:number;queue:Pos[];stride:number}
const equal=(a:Pos,b:Pos)=>a.x===b.x&&a.y===b.y
const adjacent=(a:Pos,b:Pos)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))<=1
export const createWalkMotion=(p:Pos):WalkMotion=>({from:{...p},to:{...p},t:1,queue:[],stride:0})
export const walkPosition=(m:WalkMotion):Pos=>({x:m.from.x+(m.to.x-m.from.x)*m.t,y:m.from.y+(m.to.y-m.from.y)*m.t})
export const walking=(m:WalkMotion)=>m.t<1||m.queue.length>0
export function resetWalk(m:WalkMotion,p:Pos){m.from={...p};m.to={...p};m.t=1;m.queue=[];m.stride=0}

/** Ordered observed tile steps; visual lag never turns a normal diagonal into a teleport. */
export function observeWalk(m:WalkMotion,destination:Pos,moves:readonly {from:Pos;to:Pos}[]=[]){
 let tail=m.queue.at(-1)??m.to
 const append=(p:Pos)=>{if(equal(tail,p))return true;if(!adjacent(tail,p))return false;m.queue.push({...p});tail=p;return true}
 if(moves.length){
  const start=moves.findIndex(move=>equal(move.from,tail))
  if(start>=0)for(const move of moves.slice(start)){
   if(!equal(tail,move.from)||!append(move.to)){resetWalk(m,destination);return}
  }
 }
 if(!append(destination)){resetWalk(m,destination);return}
 if(m.t===1&&m.queue.length){m.from={...m.to};m.to=m.queue.shift()!;m.t=0}
}

export function advanceWalk(m:WalkMotion,dt:number,instant=false){
 if(instant){resetWalk(m,m.queue.at(-1)??m.to);return}
 // A slow browser frame cannot jump straight to a distant logical destination.
 const catchUp=Math.min(3,1+Math.max(0,m.queue.length-1)*.35)
 let remaining=Math.max(0,Math.min(96/catchUp,dt))
 const duration=WALK_STEP_MS/catchUp
 while(remaining>0&&walking(m)){
  if(m.t===1){m.from={...m.to};m.to=m.queue.shift()!;m.t=0}
  const part=Math.min(1-m.t,remaining/duration)
  m.t=Math.min(1,m.t+part);m.stride=(m.stride+part)%2;remaining-=part*duration
 }
}
