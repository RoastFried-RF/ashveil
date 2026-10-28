import {rememberLifeEvent} from './life-memories'
// 현물 부품을 묶어 둔 정비 채널. 대상/상처/도구/소모품의 UID를 바꾸어 대체하지 않는다.
import { capacity, coolantLeak, deathCause, hpMax, part, partDamage } from './body'
import { channelTurns } from './action-time'
import { creatureById, log, tileAt, turnOf, type World } from './ctx'
import { hostile } from './diplomacy'
import { cheb } from './geom'
import { hasLos } from './fov'
import { diagonalBlocked } from './path'
import { allItems, findItem, findSpot, itemDef, removeOne } from './items'
import { machineRules } from './machine-state'
import type { Creature, MachineOperation } from './types'

export const MACHINE_OPERATION_LABEL:Record<MachineOperation,string>={patch:'누출 밀봉',coolant:'냉각액 보충',repair:'부품 수리',cell:'전원셀 교환'}
export function machineHaul(w:World,c:Creature,targetId?:number,uid?:number):string|null{
  const m=c.body.machine
  if(!machineRules(w,c)||!m)return '수리 드론의 운반 동작이다'
  if(targetId===undefined){
    if(!c.home||cheb(c.home,c.pos)>1||!hasLos(w,c.pos,c.home)||diagonalBlocked(w,c.pos,c.home.x-c.pos.x,c.home.y-c.pos.y))return '둥지 곁에서 부품을 옮겨야 한다'
    if(uid!==undefined){
      const floor=tileAt(w,c.home).items,it=floor.find(i=>i.uid===uid),spot=it&&findSpot(w,c,itemDef(w,it))
      if(!it||!spot)return '둥지에 부품이 없거나 배낭이 가득하다'
      floor.splice(floor.indexOf(it),1);it.gx=spot[0];it.gy=spot[1];it.rot=spot[2]||undefined;c.bag.push(it);return null
    }
    const index=c.bag.findIndex(it=>m.cargo?.includes(it.uid))
    if(index<0)return '운반 중인 잔해가 없다'
    const [it]=c.bag.splice(index,1);tileAt(w,c.home).items.push({...it,gx:undefined,gy:undefined,rot:undefined});m.cargo=m.cargo?.filter(id=>id!==it.uid)
    return null
  }
  const target=creatureById(w,targetId),it=target?.bag.find(i=>i.uid===uid)
  if(!target||target.alive||!target.body.machine||cheb(c.pos,target.pos)>1||!hasLos(w,c.pos,target.pos)||diagonalBlocked(w,c.pos,target.pos.x-c.pos.x,target.pos.y-c.pos.y)||!it)return '곁에 실제 기계 잔해가 없다'
  const spot=findSpot(w,c,itemDef(w,it))
  if(!spot)return '잔해를 넣을 배낭 공간이 없다'
  target.bag.splice(target.bag.indexOf(it),1);it.gx=spot[0];it.gy=spot[1];it.rot=spot[2]||undefined;c.bag.push(it);(m.cargo??=[]).push(it.uid)
  return null
}
export function machineCareError(w:World,c:Creature,target:Creature,operation:MachineOperation,woundId?:number,partId?:string):string|null{
  const d=machineRules(w,target),m=target.body.machine
  if(!d||!m)return '기계형 대상이 아니다'
  if(!target.alive||deathCause(w,target))return '파괴된 코어는 수리로 되살릴 수 없다'
  if(!c.alive||cheb(c.pos,target.pos)>1||!hasLos(w,c.pos,target.pos)||diagonalBlocked(w,c.pos,target.pos.x-c.pos.x,target.pos.y-c.pos.y))return '수리 대상 곁에 있어야 한다'
  if(hostile(w,c,target)&&!target.unconscious)return '가동 중인 적대 기계는 정비할 수 없다'
  if(capacity(w,c,'manipulation')<0.1)return '부품을 다룰 손을 쓸 수 없다'
  const wd=target.body.wounds.find(x=>x.id===woundId)
  if(operation==='patch'&&(!wd||wd.patched||wd.def!=='Wound.MachinePerforation'||![d.chassis,d.coolingLoop].includes(wd.part)||wd.severity<=wd.healed))return '밀봉할 누출 천공이 없다'
  if(operation==='coolant'&&m.coolant>=d.coolantMl)return '냉각액이 가득하다'
  if(operation==='cell'&&m.power>=100)return '전원이 충분하다'
  if(operation==='repair'&&(!partId||!w.db.body(target.body.def).parts.some(p=>p.id===partId)||partDamage(target,partId)<=0))return '수리할 손상 부위가 없다'
  if(operation==='repair'&&!(machineRules(w,c)&&capacity(w,c,'tool')>=.1)&&!allItems(c).some(it=>itemDef(w,it).toolTags?.includes(d.repair.tool)&&(it.durability??100)>0))return '쓸 수 있는 수리 도구가 필요하다'
  return null
}

export function startMachineCare(w:World,c:Creature,targetId:number,operation:MachineOperation,uid:number,woundId?:number,partId?:string):string|null{
  const target=creatureById(w,targetId)
  if(!target)return '수리 대상이 이곳에 없다'
  const error=machineCareError(w,c,target,operation,woundId,partId)
  if(error)return error
  const d=machineRules(w,target)!,it=c.bag.find(i=>i.uid===uid),rule=d[operation]
  if(!it||it.def!==rule.item||it.count<1)return `${w.db.item(rule.item).label}이(가) 필요하다`
  const turns=channelTurns(w,c,rule.turns)
  if(turns===null)return '몸 상태 때문에 정비할 수 없다'
  const tool=operation==='repair'?allItems(c).find(i=>itemDef(w,i).toolTags?.includes(d.repair.tool)&&(i.durability??100)>0):undefined
  c.activity={kind:'machineCare',machineOperation:operation,machineId:targetId,machinePart:partId,woundId,uid,toolUid:tool?.uid,supplies:[{uid,def:it.def,count:1}],remaining:turns,total:turns,label:`${target.name} ${MACHINE_OPERATION_LABEL[operation]}`}
  return null
}

export function machineCareStep(w:World,c:Creature):boolean{
  const a=c.activity,op=a?.machineOperation,target=creatureById(w,a?.machineId)
  if(!a||!op||!target){c.activity=undefined;return true}
  let error=machineCareError(w,c,target,op,a.woundId,a.machinePart)
  const d=machineRules(w,target),it=c.bag.find(i=>i.uid===a.uid)
  if(!error&&(!d||!it||it.def!==a.supplies?.[0]?.def||it.def!==d[op].item||it.count<1))error='예약한 부품이 없어졌다'
  const tool=a.toolUid===undefined?undefined:findItem(c,a.toolUid)
  if(!error&&op==='repair'&&(a.toolUid===undefined?!(machineRules(w,c)&&capacity(w,c,'tool')>=.1):!tool||!itemDef(w,tool).toolTags?.includes(d!.repair.tool)||(tool.durability??100)<=0))error='예약한 수리 도구가 없어졌다'
  if(error){log(w,'warn',`${a.label} 중단: ${error}.`);c.activity=undefined;return true}
  if(a.remaining>0)return false
  // 모든 검증을 통과한 뒤 정확히 한 부품을 소비한다.
  removeOne(w,c,a.uid!)
  const m=target.body.machine!
  if(op==='patch')target.body.wounds.find(x=>x.id===a.woundId)!.patched=true
  if(op==='coolant')m.coolant=Math.min(d!.coolantMl,m.coolant+d!.coolant.ml)
  if(op==='cell')m.power=Math.min(100,m.power+d!.cell.power)
  if(op==='repair'){
    let remaining=d!.repair.severity,repaired=0
    const organ=Math.min(remaining,target.body.organDamage?.[a.machinePart!]??0)
    if(organ>0){target.body.organDamage![a.machinePart!]-=organ;remaining-=organ;repaired+=organ}
    for(const wd of target.body.wounds){
      if(wd.part!==a.machinePart)continue
      const amount=Math.min(remaining,Math.max(0,wd.severity-wd.healed));wd.healed+=amount;remaining-=amount;repaired+=amount
      if(wd.healed>=wd.severity)wd.fracture=undefined
      if(remaining<=0)break
    }
    target.hp=Math.min(target.hp+repaired,hpMax(w,target))
    if(repaired>0)rememberLifeEvent(w,c,'relicRepair')
  }
  target.unconscious=capacity(w,target,'consciousness')<.3
  target.needs.energy=m.power
  log(w,'info',`${a.label}을(를) 마쳤다.`)
  c.activity=undefined
  return true
}

export function machineStatus(w:World,c:Creature):string[]{
  const d=machineRules(w,c),m=c.body.machine
  if(!d||!m)return []
  return [`냉각액 ${m.coolant.toFixed(1)}/${d.coolantMl} ml · 누출 ${coolantLeak(w,c).toFixed(1)} ml/턴`,`열 ${m.heat.toFixed(1)}/100 · 전원 ${m.power.toFixed(1)}%`,...(m.errorLoop&&m.errorLoop.until>turnOf(w)?['제어 오류 루프: 같은 동작을 반복한다']:[]),...w.db.body(c.body.def).parts.map(p=>`${part(w,c,p.id).label}: ${Math.max(0,(c.body.maxHp[p.id]??0)-partDamage(c,p.id)).toFixed(0)}/${c.body.maxHp[p.id]}`)]
}
