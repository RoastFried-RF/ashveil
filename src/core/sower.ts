/** Finite, definition-driven garden machinery. No species-ID switch or spawning. */
import type {Action,ActResult} from './actions'
import {capacity,hpMax,isMissing,partEff} from './body'
import {fx,pushBack,shoveChance,sporeCloud} from './combat'
import {creatureAt,creatureById,inBounds,log,player,rng,terrainAt,turnOf,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {recordGardenReport} from './garden-alert'
import {cheb,dirIndex,eq,type Pos} from './geom'
import {removeOne} from './items'
import {machineAction,machineReady,machineRules} from './machine-state'
import {diagonalBlocked,findPath} from './path'
import {emitNoise} from './perception'
import {placementQuote} from './placement'
import type {Creature,ItemInst,SowerRules,SowerState} from './types'
const fail=(msg:string):ActResult=>({ok:false,tu:0,msg})
export const sowerRules=(w:World,c:Creature)=>w.db.creature(c.def).sower
const initial=(rule:SowerRules):SowerState=>({rule:JSON.stringify(rule),routeIndex:0,moves:0,seedsSpent:0,resumeAt:0,alarmWound:0})
const view=(c:Creature,rule:SowerRules)=>c.sowerState??initial(rule)
const state=(c:Creature,rule:SowerRules)=>c.sowerState??=initial(rule)
function ready(w:World,c:Creature){const d=sowerRules(w,c);return !!d&&c.alive&&w.s.creatures.includes(c)&&!c.unconscious&&!c.asleep&&!c.activity&&machineReady(w,c)&&capacity(w,c,'consciousness')>=.3&&view(c,d).rule===JSON.stringify(d)&&d.route.every(p=>inBounds(w,p))}
function signalReady(w:World,c:Creature){const d=sowerRules(w,c);return !!d&&!isMissing(w,c,d.signalPart)&&partEff(w,c,d.signalPart)>=.3&&capacity(w,c,'signal')>=.3}
function attackWound(w:World,c:Creature,target:Creature|undefined,id?:number){return target&&target.alive&&target.id!==c.id&&canSee(w,c,target.pos)?c.body.wounds.find(wd=>(id===undefined||wd.id===id)&&wd.sourceId===target.id&&wd.severity>wd.healed):undefined}
export function recordSowerMove(w:World,c:Creature){const d=sowerRules(w,c);if(!d||view(c,d).rule!==JSON.stringify(d))return;const s=state(c,d);s.moves=Math.min(d.seedEveryMoves,s.moves+1)}
export function recordSowerPlacement(w:World,c:Creature,p:Pos,it:ItemInst){
 const d=sowerRules(w,c);if(!d||it.def!==d.seedItem||view(c,d).rule!==JSON.stringify(d))return
 const s=state(c,d);s.moves=0;s.seedsSpent++;s.lastSeed={uid:it.uid,at:turnOf(w),pos:{...p}};machineAction(w,c,'work')
 if(canSee(w,player(w),c.pos)){fx(w,{k:'status',id:c.id,text:'파종',color:'#aebd75',turn:turnOf(w)});log(w,'info','파종기가 적재함의 종자 캡슐 한 개로 실제 밭을 심었다.')}
}
export function sowerWaypoint(w:World,c:Creature):ActResult{
 const d=sowerRules(w,c);if(!d||!ready(w,c))return fail('파종기의 원래 경로와 전원을 확인해야 한다')
 const s=view(c,d);if(s.resumeAt>turnOf(w)||!eq(c.pos,d.route[s.routeIndex%d.route.length]))return fail('원래 경유지에 도착해야 한다')
 const actual=state(c,d);actual.routeIndex=(actual.routeIndex+1)%d.route.length;actual.resumeAt=turnOf(w)+d.waitAtWaypointTurns;machineAction(w,c,'work')
 return{ok:true,tu:d.waitAtWaypointTurns*100}
}
export function sowerAlarm(w:World,c:Creature,targetId:number,woundId:number):ActResult{
 const d=sowerRules(w,c),target=creatureById(w,targetId),wound=attackWound(w,c,target,woundId)
 if(!d||!ready(w,c)||!signalReady(w,c)||!wound||wound.id<=view(c,d).alarmWound)return fail('실제로 관찰한 새 공격과 작동하는 신호기가 필요하다')
 state(c,d).alarmWound=wound.id;recordGardenReport(w,c,target!);machineAction(w,c,'work');emitNoise(w,c.pos,10,c.id)
 for(const recipient of w.s.creatures){const r=w.db.creature(recipient.def).survey;if(!r||recipient.id===c.id||recipient.faction!==c.faction||!recipient.alive||!machineReady(w,recipient)||recipient.unconscious||recipient.asleep||cheb(c.pos,recipient.pos)>d.callRadius||isMissing(w,recipient,r.antenna)||partEff(w,recipient,r.antenna)<.3||capacity(w,recipient,'signal')<.3)continue
  const s=recipient.surveyState??={progress:0,nextReportAt:0,patrolIndex:0};s.call={source:c.id,at:turnOf(w),expiresAt:turnOf(w)+d.callTurns,pos:{...c.pos}}
 }
 if(canSee(w,player(w),c.pos)){fx(w,{k:'status',id:c.id,text:'구역 경보',color:'#ddb96b',turn:turnOf(w)});log(w,'warn','공격받은 파종기가 구역 경보를 보내고 주변 측량기를 호출했다.')}
 return{ok:true,tu:100}
}
export function sowerPush(w:World,c:Creature,targetId:number):ActResult{
 const d=sowerRules(w,c),target=creatureById(w,targetId)
 if(!d||!ready(w,c)||capacity(w,c,'tool')<.3||capacity(w,c,'moving')<=0||!target?.alive||target.id===c.id||cheb(c.pos,target.pos)!==1||!canSee(w,c,target.pos)||!hasLos(w,c.pos,target.pos)||diagonalBlocked(w,c.pos,target.pos.x-c.pos.x,target.pos.y-c.pos.y)||w.db.creature(target.def).sizeClass==='huge')return fail('곁의 경로를 막은 실제 대상을 밀 수 없다')
 c.facing=dirIndex(target.pos.x-c.pos.x,target.pos.y-c.pos.y);const moved=rng(w,'combat').int(0,99)<shoveChance(w,c,target)
 machineAction(w,c,'attack');emitNoise(w,c.pos,5,c.id);target.ai.alertTurn=turnOf(w)
 if(moved)pushBack(w,c,target,d.pushDistance)
 if(canSee(w,player(w),c.pos)){fx(w,{k:'status',id:c.id,text:'경로 밀기',color:'#c9b38b',turn:turnOf(w)});log(w,'warn',moved?'파종기가 경로를 막은 대상을 밀어냈다.':'파종기의 밀어내기를 버텼다.')}
 return{ok:true,tu:100}
}
export function sowerSpray(w:World,c:Creature,targetId:number,uid:number):ActResult{
 const d=sowerRules(w,c),target=creatureById(w,targetId),item=c.bag.find(i=>i.uid===uid),s=d?view(c,d):undefined
 if(!d||!ready(w,c)||capacity(w,c,'tool')<.3||!attackWound(w,c,target)||cheb(c.pos,target!.pos)>d.spray.radius||!hasLos(w,c.pos,target!.pos)||!item||item.def!==d.spray.item||item.count<1||(s?.nextSprayAt??-Infinity)>turnOf(w))return fail('실제 공격자와 남은 균 캡슐, 준비된 분사구가 필요하다')
 removeOne(w,c,uid);state(c,d).lastSpray={uid,at:turnOf(w)};state(c,d).nextSprayAt=turnOf(w)+d.spray.cooldown;machineAction(w,c,'work');sporeCloud(w,c.pos,d.spray.radius,d.spray.turns,d.spray.concentration,true);emitNoise(w,c.pos,5,c.id)
 if(canSee(w,player(w),c.pos))log(w,'warn','파종기가 적재된 균 캡슐 한 개를 소모해 가까운 곳에 포자를 분사했다.')
 return{ok:true,tu:100}
}
export function sowerStatus(w:World,c:Creature){
 const d=sowerRules(w,c);if(!d)return
 const s=view(c,d)
 return{route:d.route.map(p=>({...p})),routeIndex:s.routeIndex,moves:s.moves,seedsSpent:s.seedsSpent,remaining:c.bag.filter(i=>i.def===d.seedItem).reduce((n,i)=>n+i.count,0),pending:s.moves>=d.seedEveryMoves,changedRules:s.rule!==JSON.stringify(d)}
}
export function decideSower(w:World,c:Creature,nav:{toward(p:Pos):Action|null}):Action{
 const d=sowerRules(w,c),m=c.body.machine,mechanical=machineRules(w,c)
 if(!d||!m||!mechanical||!ready(w,c))return{type:'wait'}
 const s=view(c,d);c.ai.target=undefined
 if(m.power<mechanical.retreatPower||c.hp<=hpMax(w,c)*.4){c.ai.mode='return';return c.home?nav.toward(c.home)??{type:'wait'}:{type:'wait'}}
 const wounds=c.body.wounds.filter(wd=>wd.severity>wd.healed&&wd.sourceId!==undefined).sort((a,b)=>b.id-a.id)
 for(const wd of wounds){const target=creatureById(w,wd.sourceId);if(!attackWound(w,c,target,wd.id))continue
  if(wd.id>s.alarmWound&&signalReady(w,c))return{type:'sowerAlarm',target:target!.id,wound:wd.id}
  const capsule=c.bag.find(i=>i.def===d.spray.item&&i.count>0)
  if(capsule&&cheb(c.pos,target!.pos)<=d.spray.radius&&hasLos(w,c.pos,target!.pos)&&(s.nextSprayAt??-Infinity)<=turnOf(w)&&capacity(w,c,'tool')>=.3)return{type:'sowerSpray',target:target!.id,uid:capsule.uid}
 }
 c.ai.mode='patrol'
 if(s.resumeAt>turnOf(w))return{type:'wait'}
 const seed=c.bag.filter(i=>i.def===d.seedItem&&i.count>0).sort((a,b)=>a.uid-b.uid)[0]
 if(s.moves>=d.seedEveryMoves&&seed){for(const index of[4,3,5,2,6,1,7,0]){const dir=(c.facing+index)%8;if(!placementQuote(w,c,seed.uid,dir).error)return{type:'place',uid:seed.uid,dir}}}
 const destination=d.route[s.routeIndex%d.route.length]
 if(eq(c.pos,destination))return{type:'sowerWaypoint'}
 const direct={x:c.pos.x+Math.sign(destination.x-c.pos.x),y:c.pos.y+Math.sign(destination.y-c.pos.y)}
 const clear=inBounds(w,direct)&&terrainAt(w,direct).passable&&!terrainAt(w,direct).water&&!diagonalBlocked(w,c.pos,direct.x-c.pos.x,direct.y-c.pos.y)
 const path=clear?undefined:findPath(w,c.pos,destination,{avoidCreatures:false,selfId:c.id,maxNodes:1200,avoidWater:true}),next=clear?direct:path?.[0],obstacle=next&&creatureAt(w,next)
 if(next&&obstacle&&obstacle.id!==c.id&&cheb(c.pos,next)===1&&!diagonalBlocked(w,c.pos,next.x-c.pos.x,next.y-c.pos.y)&&canSee(w,c,next)&&terrainAt(w,next).passable&&!terrainAt(w,next).water){return w.db.creature(obstacle.def).sizeClass==='huge'||capacity(w,c,'tool')<.3?{type:'wait'}:{type:'sowerPush',target:obstacle.id}}
 if(clear)return{type:'move',dir:dirIndex(direct.x-c.pos.x,direct.y-c.pos.y)}
 return nav.toward(destination)??{type:'wait'}
}
