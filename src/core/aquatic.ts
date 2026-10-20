// 깊은 물에서 실제 시간을 보내야 기력/숨이 줄어든다. 구조는 같은 몸을 실제 빈 물가로 옮긴다.
import { channelTurns } from './action-time'
import { capacity } from './body'
import { aquaticRules, deepWaterAt, equippedBulk, inDeepWater } from './aquatic-state'
import { creatureAt, inBounds, log, rng, terrainAt, tileAt, turnOf, type World } from './ctx'
import { hasLos } from './fov'
import { cheb, DIRS, eq, type Pos } from './geom'
import { diagonalBlocked } from './path'
import type { Creature } from './types'
export function aquaticTick(w:World,c:Creature){
 if(!c.alive||c.body.machine||w.db.body(c.body.def).waterBreathing)return
 const d=aquaticRules(w),now=turnOf(w),deep=inDeepWater(w,c)
 if(!deep){
  const a=c.aquatic;if(!a)return
  a.submerged=false;a.air=d.breathTurns*Math.max(.1,capacity(w,c,'breathing'));a.hypoxia=Math.max(0,a.hypoxia-d.recoverPerTurn)
  if(!a.hypoxia){delete c.aquatic;if(c.id===w.s.playerId)log(w,'good','물가에서 숨을 되찾았다.')}
  return
 }
 const a=c.aquatic??={enteredAt:now,submerged:false,air:d.breathTurns*Math.max(.1,capacity(w,c,'breathing')),hypoxia:0}
 c.needs.energy=Math.max(0,c.needs.energy-d.energyPerTurn)
 const mobile=capacity(w,c,'moving')>=d.minMoving,breathing=capacity(w,c,'breathing')>=d.minBreathing,awake=!c.asleep&&!c.unconscious&&capacity(w,c,'consciousness')>=.3,strong=mobile&&breathing&&awake&&c.needs.energy>0,heavy=equippedBulk(w,c)>=d.bulkThreshold
 const before=a.submerged,oldAir=a.air
 if(!strong)a.submerged=true
 else if(!heavy)a.submerged=false
 else if(!a.submerged&&now-(a.checkedAt??now-d.checkTurns)>=d.checkTurns){a.checkedAt=now;if(rng(w,`body.water.${c.id}`).chance(d.sinkChance))a.submerged=true}
 if(a.submerged){
  if(a.air>0)a.air=Math.max(0,a.air-1)
  else a.hypoxia=Math.min(d.hypoxiaFatalTurns,a.hypoxia+1)
 }else{a.air=d.breathTurns*Math.max(.1,capacity(w,c,'breathing'));a.hypoxia=Math.max(0,a.hypoxia-d.recoverPerTurn)}
 if(!before&&a.submerged&&c.id===w.s.playerId)log(w,'danger','깊은 물속으로 가라앉았다. 실제 둔중과 기력·호흡을 확인하고 물가로 나가야 한다.')
 if(a.submerged&&oldAir>d.criticalAir&&a.air<=d.criticalAir&&c.id===w.s.playerId)log(w,'danger','숨을 참을 여력이 얼마 남지 않았다.')
}
function dryLanding(w:World,target:Creature):Pos|undefined{
 return DIRS.map(d=>({x:target.pos.x+d.x,y:target.pos.y+d.y})).find(pos=>inBounds(w,pos)&&terrainAt(w,pos).passable&&(terrainAt(w,pos).water!=='deep'||tileAt(w,pos).icy&&(tileAt(w,pos).iceHoleUntil??0)<=turnOf(w))&&!creatureAt(w,pos)&&hasLos(w,target.pos,pos)&&!diagonalBlocked(w,target.pos,pos.x-target.pos.x,pos.y-target.pos.y))
}
export function waterRescueQuote(w:World,provider:Creature,targetId:number){
 const target=w.s.creatures.find(c=>c.id===targetId),d=aquaticRules(w)
 let error:string|null=null
 if(!target?.alive||target===provider||!inDeepWater(w,target)||!target.aquatic?.submerged&&target.needs.energy>d.criticalAir)error='구조할 실제 익수자가 없다'
 else if(!w.s.creatures.includes(provider)||!provider.alive||provider.asleep||provider.unconscious||provider.captivity||deepWaterAt(w,provider.pos)||capacity(w,provider,'consciousness')<.5||capacity(w,provider,'manipulation')<.4||capacity(w,provider,'moving')<.5)error='물가에서 몸을 지탱하고 손을 쓸 수 있어야 한다'
 else if(cheb(provider.pos,target.pos)>1||!hasLos(w,provider.pos,target.pos)||diagonalBlocked(w,provider.pos,target.pos.x-provider.pos.x,target.pos.y-provider.pos.y))error='익수자 바로 곁의 물가여야 한다'
 const to=target?dryLanding(w,target):undefined
 if(!error&&!to)error='원래 몸을 끌어낼 실제 빈 물가가 없다'
 const turns=channelTurns(w,provider,d.rescueTurns);if(!error&&turns===null)error='현재 몸으로는 구조를 계속할 수 없다'
 return{error,target,to,turns:turns??0}
}
export function startWaterRescue(w:World,provider:Creature,target:number):string|null{
 const q=waterRescueQuote(w,provider,target);if(q.error)return q.error
 provider.activity={kind:'waterRescue',label:'익수자를 실제 물가로 끌어내기',remaining:q.turns,total:q.turns,waterRescue:{target,from:{...q.target!.pos},to:{...q.to!},provider:{...provider.pos}}}
 return null
}
export function waterRescueStep(w:World,provider:Creature):boolean{
 const a=provider.activity!,r=a.waterRescue
 if(!r){provider.activity=undefined;return true}
 const q=waterRescueQuote(w,provider,r.target)
 if(q.error||!eq(q.target!.pos,r.from)||!eq(provider.pos,r.provider)||!eq(q.to!,r.to)){provider.activity=undefined;return true}
 if(a.remaining>0)return false
 q.target!.pos={...r.to};q.target!.ai.path=undefined;q.target!.activity=undefined;q.target!.nextAct=Math.max(q.target!.nextAct,w.s.time+100)
 log(w,'good',`${q.target!.name}을(를) 실제 빈 물가로 끌어냈다. 호흡 회복에는 시간이 든다.`)
 provider.activity=undefined;return true
}
