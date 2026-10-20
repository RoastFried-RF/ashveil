import {channelTurns} from './action-time'
import {capacity} from './body'
import {inBounds,log,terrainAt,tileAt,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {cheb,DIRS,type Pos} from './geom'
import {allItems,findItem,itemDef} from './items'
import {diagonalBlocked} from './path'
import {emitNoise} from './perception'
import type {Creature,TerrainDef} from './types'

export const containerLocked=(w:World,pos:Pos)=>!!tileAt(w,pos).locked
export function containerLockTool(w:World,c:Creature,def:TerrainDef){return def.lock?allItems(c).filter(it=>(it.durability??0)>=def.lock!.wear&&itemDef(w,it).toolTags?.some(tag=>def.lock!.tools.includes(tag))).sort((a,b)=>a.uid-b.uid)[0]:undefined}
/** 탐색자는 잠금 표시와 자신의 도구만 본다. 내부 물품을 보지 않는다. */
export function canSearchContainer(w:World,c:Creature,pos:Pos){return !containerLocked(w,pos)||!!containerLockTool(w,c,terrainAt(w,pos))&&capacity(w,c,'manipulation')>=.2}
export function containerPryQuote(w:World,c:Creature,pos:Pos,toolUid?:number){
 const fail=(error:string)=>({error,tool:undefined,turns:0,signature:''})
 if(!Number.isSafeInteger(pos.x)||!Number.isSafeInteger(pos.y)||!inBounds(w,pos)||cheb(c.pos,pos)>1||!hasLos(w,c.pos,pos)||!canSee(w,c,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))return fail('보이는 상자 곁에서 작업해야 한다')
 const def=terrainAt(w,pos),cfg=def.lock
 if(!def.container||!containerLocked(w,pos))return fail('잠긴 상자가 없다')
 if(!cfg)return fail('원래 상자의 잠금 정의를 복원해야 한다')
 if(!c.alive||c.asleep||c.unconscious||capacity(w,c,'manipulation')<.2)return fail('깨어서 도구를 쓸 손이 필요하다')
 const tool=toolUid===undefined?containerLockTool(w,c,def):findItem(c,toolUid)
 if(!tool||(tool.durability??0)<cfg.wear||!itemDef(w,tool).toolTags?.some(tag=>cfg.tools.includes(tag)))return fail('닳지 않은 칼·도끼나 망치가 필요하다')
 const turns=channelTurns(w,c,cfg.turns)
 if(turns===null)return fail('몸 상태로는 잠금쇠를 벌릴 수 없다')
 return{error:null,tool,turns,signature:JSON.stringify({terrain:def.id,lock:cfg})}
}
export function startContainerPry(w:World,c:Creature,pos:Pos):string|null{
 const quote=containerPryQuote(w,c,pos);if(quote.error)return quote.error
 c.activity={kind:'pryContainer',target:{...pos},remaining:quote.turns,total:quote.turns,label:'상자 잠금쇠 벌리기',containerPry:{map:w.s.map.id,region:w.s.overworld?.currentRegion,terrain:terrainAt(w,pos).id,toolUid:quote.tool!.uid,signature:quote.signature}}
 return null
}
/** 공통 활동 루프가 한 턴을 센 뒤 호출한다. 완료 전에는 내용물을 생성/열지 않는다. */
export function containerPryStep(w:World,c:Creature):boolean{
 const act=c.activity!,work=act.containerPry,pos=act.target
 const quote=work&&pos&&work.map===w.s.map.id&&work.region===w.s.overworld?.currentRegion?containerPryQuote(w,c,pos,work.toolUid):undefined
 if(!quote||quote.error||quote.signature!==work!.signature){if(c.id===w.s.playerId)log(w,'warn','잠금쇠 작업을 중단했다. 원래 상자·도구 곁에서 계속해야 한다.');c.activity=undefined;return true}
 const cfg=terrainAt(w,pos!).lock!
 if((act.elapsed??0)%10===0||act.remaining<=0)emitNoise(w,pos!,cfg.noise,c.id)
 if(act.remaining>0)return false
 quote.tool!.durability=Math.max(0,(quote.tool!.durability??0)-cfg.wear)
 tileAt(w,pos!).locked=false
 if(c.id===w.s.playerId)log(w,'good','같은 상자의 잠금쇠를 벌렸다. 이제 수색할 수 있다.')
 c.activity=undefined;return true
}
export function nearbyContainerLocks(w:World,c:Creature){return[{x:0,y:0},...DIRS].map(d=>({x:c.pos.x+d.x,y:c.pos.y+d.y})).filter(pos=>inBounds(w,pos)&&canSee(w,c,pos)&&terrainAt(w,pos).container&&containerLocked(w,pos)).map(pos=>({pos,label:terrainAt(w,pos).label,quote:containerPryQuote(w,c,pos)}))}
