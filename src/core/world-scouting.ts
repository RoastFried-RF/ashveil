// 실제 바깥길/갑판에 함께 있는 NPC가 자기 차례에 본 월드 지형과 현재 직접 대화의 보고만 기록한다.
import {capacity} from './body'
import {canObserveTerrain,hasLos} from './fov'
import {cheb,eq} from './geom'
import {isCompanion} from './companion-state'
import {hostile} from './diplomacy'
import {cartographyDef} from './cartography'
import {learnRumor} from './rumor-state'
import {inBounds,log,turnOf,type World} from './ctx'
import type {Creature,Rumor,WorldCell,WorldObservation} from './types'
function geography(c:WorldCell):WorldObservation['cell']{return{altitude:c.altitude,temperature:c.temperature,veil:c.veil,biome:c.biome,sea:c.sea,...(c.road?{road:true}:{}),...(c.oldRoad?{oldRoad:true}:{}),...(c.river?{river:true}:{}),...(c.lake?{lake:true}:{}),...(c.territory!==undefined?{territory:c.territory}:{})}}
export function observeNpcWorld(w:World,c:Creature):void{
 const m=w.s.overworld
 if(!m||m.currentRegion||w.s.map.kind!=='surface'||!w.s.map.worldCell||!eq(w.s.map.worldCell,m.position))return
 const r=cartographyDef(w).worldScouting
 if(!r||c.id===w.s.playerId||!w.s.creatures.includes(c)||c.mapId!==undefined&&c.mapId!==w.s.map.id||!inBounds(w,c.pos)||!c.alive||c.asleep||c.unconscious||c.captivity||w.db.body(c.body.def).kind!=='humanoid'||capacity(w,c,'consciousness')<.5||!canObserveTerrain(w,c))return
 const old=c.worldScouting,memory=old?.seed===w.s.seed&&old.w===m.w&&old.h===m.h?old:{seed:w.s.seed,w:m.w,h:m.h,cells:{}},at=turnOf(w)
 for(let y=Math.max(0,m.position.y-r.radius);y<=Math.min(m.h-1,m.position.y+r.radius);y++)for(let x=Math.max(0,m.position.x-r.radius);x<=Math.min(m.w-1,m.position.x+r.radius);x++){
  const index=y*m.w+x,cell=geography(m.cells[index]!),previous=memory.cells[index]
  if(previous&&JSON.stringify(previous.cell)===JSON.stringify(cell))continue
  if(!previous&&Object.keys(memory.cells).length>=r.maxCells){const oldest=Object.keys(memory.cells).map(Number).sort((a,b)=>memory.cells[a]!.at-memory.cells[b]!.at||a-b)[0]!;delete memory.cells[oldest]}
  memory.cells[index]={at,source:'survey',cell}
 }
 c.worldScouting=memory
}
export function hearScoutWorld(w:World,listener:Creature,speaker:Creature):number{
 const m=w.s.overworld,memory=speaker.worldScouting
 if(!m||!memory||memory.seed!==w.s.seed||memory.w!==m.w||memory.h!==m.h||!isCompanion(w,speaker)||speaker.companion!.employer!==listener.id||!w.s.creatures.includes(listener)||!w.s.creatures.includes(speaker)||!listener.alive||!speaker.alive||listener.asleep||speaker.asleep||listener.unconscious||speaker.unconscious||capacity(w,listener,'consciousness')<.5||capacity(w,speaker,'consciousness')<.5||capacity(w,listener,'hearing')<.2||capacity(w,speaker,'hearing')<.2||cheb(listener.pos,speaker.pos)>1||!hasLos(w,listener.pos,speaker.pos)||hostile(w,listener,speaker))return 0
 let count=0
 for(const [key,o]of Object.entries(memory.cells)){
  const index=Number(key);if(!Number.isSafeInteger(index)||index<0||index>=m.w*m.h||!Number.isFinite(o.at)||o.at<0||o.at>turnOf(w))continue
  const pos={x:index%m.w,y:Math.floor(index/m.w)},report={worldSeed:w.s.seed,w:m.w,h:m.h,pos,at:o.at,cell:structuredClone(o.cell)},rumor:Rumor={id:`scout-world:${w.s.seed}:${speaker.id}:${index}:${o.at}`,kind:'map',worldReport:report,source:speaker.name+'의 직접 월드 정찰',hop:0,writtenAt:o.at,foundAt:turnOf(w),text:`동료가 월드 (${pos.x}, ${pos.y})에서 당시 본 지형을 전했다.`}
  if(learnRumor(w,listener,rumor))count++
 }
 if(count&&listener.id===w.s.playerId)log(w,'info',speaker.name+'에게 실제로 본 당시 월드 지형'+count+'칸의 정찰 보고를 들었다.')
 return count
}
