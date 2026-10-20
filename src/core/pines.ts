import {capacity} from './body'
import {channelTurns} from './action-time'
import {inBounds,log,rng,tileAt,turnOf,type World} from './ctx'
import {hasLos} from './fov'
import {cheb,DIRS,type Pos} from './geom'
import {diagonalBlocked} from './path'
import {addToBag,makeItem} from './items'
import type {Creature,MapState,WorldGenDef} from './types'
export function plantPines(w:World,map:MapState,stream:Parameters<typeof rng>[1]){
 const d=w.db.tryGet<WorldGenDef>('WorldGen.Hearth')
 if(!d||map.kind!=='surface')return
 for(const key of ['pines','forage']as const){
  const rule=d[key];if(!rule)continue
  const r=rng(w,key==='pines'?stream:(stream+'.forage')as Parameters<typeof rng>[1])
  for(const tile of map.tiles)if(tile.t===rule.sourceTerrain&&r.chance(rule.chance))tile.t=rule.terrain
 }
}
export function needlesQuote(w:World,c:Creature,pos:Pos){
 const tile=inBounds(w,pos)?tileAt(w,pos):undefined,rule=tile&&w.db.terrain(tile.t).needles
 let error:string|null=null
 if(!rule)error='실제로 살아 있는 소나무를 찾아야 한다'
 else if(!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)error='깨어서 솔잎을 다룰 손이 필요하다'
 else if(cheb(c.pos,pos)>1||!hasLos(w,c.pos,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))error='소나무 바로 곁이어야 한다'
 else if((tile!.needleGatherAt??0)>turnOf(w))error='새 솔잎이 자라기를 기다려야 한다'
 const turns=rule?channelTurns(w,c,rule.turns):null
 if(!error&&turns===null)error='몸 상태로 솔잎을 모을 수 없다'
 return{error,tile,rule,turns:turns??0}
}
export function nearbyPines(w:World,c:Creature){
 return[{x:0,y:0},...DIRS].map(d=>({x:c.pos.x+d.x,y:c.pos.y+d.y})).filter(p=>inBounds(w,p)&&!!w.db.terrain(tileAt(w,p).t).needles&&hasLos(w,c.pos,p))
}
export function startNeedles(w:World,c:Creature,pos:Pos):string|null{
 if(c.activity)return '하던 일을 먼저 마쳐야 한다'
 const q=needlesQuote(w,c,pos);if(q.error)return q.error
 c.activity={kind:'gatherNeedles',target:{...pos},remaining:q.turns,total:q.turns,label:'솔잎 모으기',needleRule:JSON.stringify({terrain:q.tile!.t,rule:q.rule})};return null
}
export function needlesStep(w:World,c:Creature){
 const act=c.activity;if(!act?.target)return true
 const q=needlesQuote(w,c,act.target)
 if(q.error||JSON.stringify({terrain:q.tile!.t,rule:q.rule})!==act.needleRule){c.activity=undefined;if(c.id===w.s.playerId)log(w,'warn','솔잎 채집 중단: '+(q.error??'원래 나무가 달라졌다'));return true}
 if(act.remaining>0)return false
 const it=makeItem(w,q.rule!.item,q.rule!.count),left=addToBag(w,c,it)
 if(left)tileAt(w,c.pos).items.push({...it,count:left,uid:c.bag.some(i=>i.uid===it.uid)?w.s.nextId++:it.uid,gx:undefined,gy:undefined,rot:undefined})
 q.tile!.needleGatherAt=turnOf(w)+q.rule!.regrowTurns;c.activity=undefined
 if(c.id===w.s.playerId)log(w,'info','실제 소나무에서 솔잎'+q.rule!.count+'묶음을 모았다.')
 return true
}
