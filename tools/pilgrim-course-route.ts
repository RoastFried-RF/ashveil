import assert from'node:assert/strict'
import{creatureAt,inBounds,player,terrainAt,type World}from'../src/core/ctx'
import{DIRS,cheb,dirIndex,type Pos}from'../src/core/geom'
import{diagonalBlocked,findPath}from'../src/core/path'
import{hasLos}from'../src/core/fov'
import type{Action}from'../src/core/actions'

/** A* avoidance is a cost, not an exclusion. Keep finite physical waits separate from walking. */
export function approachCourseDestination(w:World,pos:Pos,act:(action:Action)=>void,stepLimit=80){
 let walked=0,attempts=0
 const budget=stepLimit===80?stepLimit+1200:stepLimit
 for(;cheb(player(w).pos,pos)>1&&walked<stepLimit&&attempts<budget;attempts++){
  const p=player(w),paths=DIRS.map(v=>({x:pos.x+v.x,y:pos.y+v.y})).filter(q=>inBounds(w,q)&&terrainAt(w,q).passable&&hasLos(w,q,pos)&&!diagonalBlocked(w,q,pos.x-q.x,pos.y-q.y)&&(!creatureAt(w,q)||creatureAt(w,q)!.id===p.id)).map(q=>findPath(w,p.pos,q,{avoidCreatures:true,selfId:p.id})).filter((path):path is NonNullable<typeof path>=>!!path?.length).sort((a,b)=>a.length-b.length)
  assert.ok(paths[0]?.length,'Actual route to known local destination')
  const before={...p.pos},next=paths[0][0];act({type:'move',dir:dirIndex(next.x-p.pos.x,next.y-p.pos.y)})
  if(cheb(before,player(w).pos)>0)walked++
 }
 if(stepLimit===80)assert.ok(cheb(player(w).pos,pos)<=1,'Finite physical approach budget exhausted')
 return{walked,attempts}
}
