// 실제 늪 개체만 부착한다. 원래 개체는 숙주의 각인 안에 한 번만 보관한다.
import { prostheticAt } from './prosthetic-state'
import { addWound, capacity, isMissing } from './body'
import { channelTurns } from './action-time'
import { exposeDisease } from './conditions'
import { creatureAt, inBounds, log, rng, terrainAt, turnOf, type World } from './ctx'
import { hasLos } from './fov'
import { cheb, DIRS } from './geom'
import type { Creature, ParasiteAttachment } from './types'

export function attachParasites(w:World,host:Creature){
  if(!host.alive||host.body.machine||!terrainAt(w,host.pos).water)return
  for(const source of [...w.s.creatures].sort((a,b)=>a.id-b.id)){
    const d=w.db.creature(source.def),rule=d.parasite
    if(!rule||source===host||!source.alive||source.unconscious||source.asleep||source.parasiteMealMl&&source.parasiteMealMl>=rule.maxFedMl||cheb(source.pos,host.pos)>1||!terrainAt(w,source.pos).water||!hasLos(w,host.pos,source.pos)||!rule.hostKinds.includes(w.db.body(host.body.def).kind!))continue
    if(d.temperatureLimits&&source.needs.bodyTemp<d.temperatureLimits.dormantBelow)continue
    if((host.parasites?.length??0)>=rule.maxOnHost)continue
    const parts=rule.parts.filter(id=>w.db.body(host.body.def).parts.some(p=>p.id===id&&!p.internal)&&!isMissing(w,host,id)&&!prostheticAt(w,host,id))
    if(!parts.length)continue
    const r=rng(w,`world.parasite.${source.id}`)
    if(!r.chance(rule.attachChance))continue
    const a:ParasiteAttachment={creature:source,part:r.pick(parts),attachedAt:turnOf(w),fedMl:source.parasiteMealMl??0}
    w.s.creatures=w.s.creatures.filter(c=>c!==source)
    ;(host.parasites??=[]).push(a)
    exposeDisease(w,host,rule.disease,rule.diseaseChance)
    if(host.id===w.s.playerId)log(w,'warn',`${source.name}이(가) ${parts.length? w.db.body(host.body.def).parts.find(p=>p.id===a.part)!.label:''}에 달라붙었다.`)
  }
}
function release(w:World,host:Creature,a:ParasiteAttachment,dead=false):boolean{
  const source=a.creature
  const at=[host.pos,...DIRS.map(d=>({x:host.pos.x+d.x,y:host.pos.y+d.y}))].find(p=>inBounds(w,p)&&terrainAt(w,p).passable&&(!source.alive||dead||!creatureAt(w,p)))
  if(!at)return false // 막힌 곳에서 복제하거나 지우지 않고 실제 공간이 생길 때까지 보존한다.
  source.pos={...at};source.parasiteMealMl=a.fedMl;source.nextAct=w.s.time+100
  if(dead){source.alive=false;source.hp=0;source.deathCause='소금으로 제거';source.deathTurn=turnOf(w)}
  host.parasites=host.parasites!.filter(x=>x!==a)
  if(!host.parasites.length)delete host.parasites
  w.s.creatures.push(source)
  return true
}
export function releaseHostParasites(w:World,host:Creature){for(const a of [...host.parasites??[]])release(w,host,a)}
export function parasiteTick(w:World,host:Creature){
  for(const a of [...host.parasites??[]]){
    const d=w.db.creature(a.creature.def).parasite
    if(!d)continue
    if(host.alive&&a.creature.alive){const amount=Math.max(0,Math.min(host.body.blood,d.mlPerTurn,d.maxFedMl-a.fedMl));host.body.blood-=amount;a.fedMl+=amount}
    if(!host.alive||!a.creature.alive||a.fedMl>=d.maxFedMl)release(w,host,a)
  }
}
export function parasiteRemovalQuote(w:World,provider:Creature,parasite:number,method:'salt'|'manual',hostId=provider.id,saltUid?:number){
  const host=w.s.creatures.find(c=>c.id===hostId),a=host?.parasites?.find(a=>a.creature.id===parasite),d=a&&w.db.creature(a.creature.def).parasite
  let error:string|null=null
  if(!host?.alive||!a||!d)error='몸에 붙은 원래 기생 개체가 없다'
  else if(!provider.alive||provider.asleep||provider.unconscious||provider.captivity||capacity(w,provider,'consciousness')<.5||capacity(w,provider,'manipulation')<.25)error='깨어서 손을 쓸 수 있어야 한다'
  else if(cheb(provider.pos,host.pos)>1||!hasLos(w,provider.pos,host.pos))error='환자에게 닿지 않는다'
  const salt=d&&method==='salt'?provider.bag.find(i=>i.def===d.saltItem&&i.count>=d.saltCount&&(saltUid===undefined||i.uid===saltUid)):undefined
  if(!error&&method==='salt'&&!salt)error='실제 소금이 부족하다'
  const turns=d?channelTurns(w,provider,method==='salt'?d.saltTurns:d.manualTurns):null
  if(!error&&turns===null)error='현재 몸으로는 제거 작업을 계속할 수 없다'
  return{error,host,a,d,salt,turns:turns??0}
}
export function startParasiteRemoval(w:World,provider:Creature,parasite:number,method:'salt'|'manual',hostId=provider.id,saltUid?:number):string|null{
  const q=parasiteRemovalQuote(w,provider,parasite,method,hostId,saltUid)
  if(q.error)return q.error
  provider.activity={kind:'parasiteRemoval',remaining:q.turns,total:q.turns,label:method==='salt'?'소금으로 거머리 제거':'거머리 직접 떼기',parasiteRemoval:{host:hostId,parasite,method,saltUid:q.salt?.uid,signature:JSON.stringify(q.d)}}
  return null
}
export function parasiteRemovalStep(w:World,provider:Creature):boolean{
  const act=provider.activity!,r=act.parasiteRemoval
  if(!r){provider.activity=undefined;return true}
  const q=parasiteRemovalQuote(w,provider,r.parasite,r.method,r.host,r.saltUid)
  if(q.error||JSON.stringify(q.d)!==r.signature){provider.activity=undefined;return true}
  if(act.remaining>0)return false
  if(r.method==='salt'){
    // 완료 전 원본 소금과 공간까지 확인한다. 다른 UID로 대신하지 않는다.
    if(!release(w,q.host!,q.a!,true)){provider.activity=undefined;return true}
    q.salt!.count-=q.d!.saltCount;provider.bag=provider.bag.filter(i=>i.count>0)
  }else{
    if(!release(w,q.host!,q.a!)){provider.activity=undefined;return true}
    addWound(w,q.host!,{def:q.d!.wound,part:q.a!.part,severity:q.d!.severity,source:'거머리를 직접 떼어낸 자국',sourceId:provider.id})
  }
  log(w,'info',r.method==='salt'?'실제 소금을 써서 거머리를 떼어냈다.':'거머리를 직접 떼어냈다. 물린 부위에 작은 상처가 남았다.')
  provider.activity=undefined;return true
}
