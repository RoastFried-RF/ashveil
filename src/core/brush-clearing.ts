import {channelTurns} from './action-time'
import {capacity} from './body'
import {inBounds,log,player,terrainAt,tileAt,type World} from './ctx'
import {canSee,hasLos,invalidateLights} from './fov'
import {cheb,DIRS,type Pos} from './geom'
import {gatherFireError} from './gather-state'
import {edgeLoss} from './gear-care'
import {diagonalBlocked} from './path'
import {emitNoise} from './perception'
import type {Creature} from './types'

/** 열매 채집과 별개인 영구 제거다. 열매·장작·물품을 새로 만들지 않는다. */
export function brushClearingQuote(w:World,c:Creature,pos:Pos,toolUid?:number){
 const fail=(error:string)=>({error,tool:undefined,turns:0,signature:''})
 if(!Number.isSafeInteger(pos.x)||!Number.isSafeInteger(pos.y)||!inBounds(w,pos)||cheb(c.pos,pos)>1||!hasLos(w,c.pos,pos)||!canSee(w,c,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))return fail('보이는 덤불 곁에서 작업해야 한다')
 const terrain=terrainAt(w,pos),rule=terrain.clearing,tile=tileAt(w,pos)
 if(!rule)return fail('벨 수 있는 덤불이 없다')
 if(tile.placed||tile.cultivation||tile.cont||tile.device)return fail('설치물·재배 작물이나 보관함은 이 작업으로 없앨 수 없다')
 if(gatherFireError(w,pos))return fail('불이 붙었거나 타버린 덤불은 벨 수 없다')
 if(!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)return fail('깨어서 칼을 쓸 손이 필요하다')
 const tools=[c.equip.main,c.equip.off].filter(it=>!!it&&rule.tools.includes(it.def)&&(it.durability??100)>0&&(it.edge??0)>0)
 const tool=toolUid===undefined?tools[0]:tools.find(it=>it?.uid===toolUid)
 if(!tool)return fail('날이 남은 도구를 손에 장착해야 한다: '+rule.tools.map(id=>w.db.item(id).label).join('·'))
 const turns=channelTurns(w,c,rule.turns,{dexterous:false})
 if(turns===null)return fail('몸 상태로는 덤불을 벨 수 없다')
 return{error:null,tool,turns,signature:JSON.stringify({terrain:tile.t,clearing:rule})}
}
export function nearbyBrushClearing(w:World,c:Creature){
 return[{x:0,y:0},...DIRS].map(d=>({x:c.pos.x+d.x,y:c.pos.y+d.y})).filter(pos=>inBounds(w,pos)&&terrainAt(w,pos).clearing&&hasLos(w,c.pos,pos)&&canSee(w,c,pos)&&!diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))
}
export function startBrushClearing(w:World,c:Creature,pos:Pos):string|null{
 if(c.activity)return '하던 일을 마친 뒤 덤불을 베야 한다'
 const q=brushClearingQuote(w,c,pos);if(q.error)return q.error
 c.activity={kind:'clearBrush',target:{...pos},remaining:q.turns,total:q.turns,label:terrainAt(w,pos).label+' 베기',woundCount:c.body.wounds.length,brushCut:{map:w.s.map.id,region:w.s.overworld?.currentRegion,toolUid:q.tool!.uid,signature:q.signature}}
 return null
}
export function brushClearingStep(w:World,c:Creature):boolean{
 const act=c.activity!,saved=act.brushCut,pos=act.target
 if(!saved||!pos){c.activity=undefined;return true}
 const q=brushClearingQuote(w,c,pos,saved.toolUid)
 if(saved.map!==w.s.map.id||saved.region!==w.s.overworld?.currentRegion||q.error||q.signature!==saved.signature){
  if(c.id===w.s.playerId)log(w,'warn','덤불 베기 중단: '+(q.error??'원래 덤불·도구·지역이 바뀌었다')+'.')
  c.activity=undefined;return true
 }
 const rule=terrainAt(w,pos).clearing!
 emitNoise(w,c.pos,rule.noise,c.id)
 if(act.remaining>0)return false
 const tile=tileAt(w,pos),label=terrainAt(w,pos).label
 edgeLoss(w,q.tool,rule.edgeLoss)
 tile.t=rule.result;delete tile.gatherAt
 invalidateLights(w);c.activity=undefined
 if(c.id===w.s.playerId||canSee(w,player(w),c.pos))log(w,'info',label+'을(를) 베었다. 열매가 다시 자라지 않는 빈 땅이 됐다.')
 return true
}
