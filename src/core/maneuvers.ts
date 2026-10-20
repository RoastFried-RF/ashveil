// 07 §7.3의 기본 넘어뜨리기/무장해제. 미리보기는 난수와 세계를 바꾸지 않는다.
import {handCapacity,isMissing,regionState} from './body'
import {knownCreatureName} from './bestiary-state'
import {fx,knockDown,wake} from './combat'
import {noteBestiaryFight} from './bestiary'
import {traumaEngage} from './trauma'
import {emitNoise} from './perception'
import {recordCombatEngagement} from './combat-engagement'
import {companionBetrayal} from './companion-bonds'
import {clamp,creatureById,inBounds,log,rng,tileAt,turnOf,type World} from './ctx'
import {witnessAttack} from './diplomacy'
import {canSee,hasLos} from './fov'
import {cheb,dirIndex} from './geom'
import {itemDef,meleeWield,type Wield} from './items'
import {strainProjectiles} from './medical'
import {diagonalBlocked} from './path'
import {breakMercy} from './prisoners'
import {prostheticGrip} from './prosthetic-state'
import {equipmentSnapshot,runEquipmentWorkers} from './script-item'
import {strainStitches} from './surgery'
import {effectiveStat,hasEffect,traitMul} from './traits'
import type {Creature,ItemInst,ManeuverDef} from './types'

export type ManeuverKind=ManeuverDef['kind']
export interface ManeuverQuote {error:string|null;chance?:number;cost?:number;rule?:ManeuverDef;target?:Creature;wield?:Wield;weapon?:ItemInst;slot?:'main'|'off';lines?:string[]}
export function maneuverQuote(w:World,c:Creature,kind:ManeuverKind,targetId:number):ManeuverQuote {
 const fail=(error:string):ManeuverQuote=>({error}),turn=turnOf(w)
 const valid=(p:Creature['pos'])=>Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y)&&inBounds(w,p)
 const rule=w.db.tryGet<ManeuverDef>(kind==='trip'?'Maneuver.Trip':'Maneuver.Disarm')
 if(!rule||rule.kind!==kind)return fail('이 전투 행동의 정의가 없다')
 if(!w.s.creatures.includes(c)||!c.alive||c.asleep||c.unconscious||c.captivity||c.breakdown?.kind==='catatonia'||hasEffect(c,'stunned',turn)||hasEffect(c,'knockedDown',turn))return fail('지금은 전투 행동을 할 수 없다')
 if(w.db.body(c.body.def).kind!=='humanoid')return fail('손으로 조작할 수 있는 몸이 필요하다')
 const target=creatureById(w,targetId)
 if(!target||target===c||!target.alive||!valid(c.pos)||!valid(target.pos)||cheb(c.pos,target.pos)!==1)return fail('바로 곁의 상대를 골라야 한다')
 if(!canSee(w,c,target.pos)||c.id===w.s.playerId&&!w.s.visible.includes(target.pos.y*w.s.map.w+target.pos.x))return fail('대상이 보이지 않는다')
 if(!hasLos(w,c.pos,target.pos)||diagonalBlocked(w,c.pos,target.pos.x-c.pos.x,target.pos.y-c.pos.y))return fail('사이가 막혀 있다')
 if(c.needs.energy<rule.energy)return fail('기력이 부족하다')
 const source=meleeWield(w,c),side=source?.arm==='larm'?'Left':'Right'
 if(!source||source.item?.half||handCapacity(w,c,side)<.5||!prostheticGrip(w,c,side)||source.twoHanded&&(handCapacity(w,c,'Left')<.5||!prostheticGrip(w,c,'Left')))return fail('손 상태 때문에 전투 행동을 할 수 없다')
 const own=effectiveStat(w,c,'agi'),other=effectiveStat(w,target,'agi'),bonus=(rule.weaponBonus[source.atk.family??'']??0)+(source.atk.shortBlade?rule.shortBladeBonus:0)
 let chance:number,weapon:ItemInst|undefined,slot:'main'|'off'|undefined,lines:string[]
 if(kind==='trip'){
  if(regionState(w,c,'lleg')>=4&&regionState(w,c,'rleg')>=4)return fail('버틸 다리가 없다')
  const legs=w.db.body(target.body.def).parts.filter(p=>!p.internal&&(p.region==='lleg'||p.region==='rleg'))
  if(!legs.length||legs.every(p=>isMissing(w,target,p.id))||hasEffect(target,'knockedDown',turn))return fail('걸어 넘어뜨릴 다리가 없다')
  const attack=own+Math.floor(c.level/2)+bonus,balance=other+Math.floor((w.db.creature(target.def).weightKg??70)*traitMul(w,target,'bodySizeMult')/10)+(w.db.body(target.body.def).kind==='quadruped'?rule.quadrupedBalance:0)
  chance=clamp(rule.base+(attack-balance)*rule.differenceMultiplier,rule.min,rule.max)
  lines=[`걸기치 ${attack} − 균형 ${balance}`,`${rule.base} + 차이 × ${rule.differenceMultiplier} → ${chance}%`]
 }else{
  slot=target.equip.main&&!target.equip.main.half&&itemDef(w,target.equip.main).attacks?.length?'main':target.equip.off&&!target.equip.off.half&&itemDef(w,target.equip.off).attacks?.length?'off':undefined
  weapon=slot?target.equip[slot]:undefined
  if(!weapon||weapon.missingItem)return fail('상대가 든 무기가 없다')
  const grip=itemDef(w,weapon).twoHanded?rule.twoHandedBonus:0
  chance=clamp(rule.base+(own-other)*rule.differenceMultiplier+bonus+grip,rule.min,rule.max)
  lines=[`민첩 ${own} − ${other}, 무기 보정 ${bonus}, 상대 양손 ${grip}`,`${rule.base} + 차이 × ${rule.differenceMultiplier} + 보정 → ${chance}%`]
 }
 return{error:null,chance,cost:rule.energy,rule,target,wield:source,weapon,slot,lines}
}

export function combatManeuver(w:World,c:Creature,kind:ManeuverKind,targetId:number):{error:string|null;tu?:number;arm?:'rarm'|'larm';twoHanded?:boolean}{
 const q=maneuverQuote(w,c,kind,targetId);if(q.error)return{error:q.error}
 const target=q.target!,rule=q.rule!,turn=turnOf(w),isPlayer=c.id===w.s.playerId||target.id===w.s.playerId
 c.needs.energy-=rule.energy;c.exerted=true;c.facing=dirIndex(target.pos.x-c.pos.x,target.pos.y-c.pos.y)
 breakMercy(w,c,target);companionBetrayal(w,c,target);witnessAttack(w,c,target);recordCombatEngagement(w,c,target)
 if(target.id===w.s.playerId)w.s.autoIgnored=w.s.autoIgnored?.filter(id=>id!==c.id)
 if(!target.attackedBy?.includes(c.id))(target.attackedBy??=[]).push(c.id)
 target.ai.alertTurn=turn
 const other=c.id===w.s.playerId?target:target.id===w.s.playerId?c:undefined
 if(other){traumaEngage(w,c.id===w.s.playerId?c:target,other);noteBestiaryFight(w,other)}
 fx(w,{k:'attack',id:c.id,target:target.id,turn});emitNoise(w,c.pos,rule.noise,c.id)
 wake(w,target,rule.label)
 strainStitches(w,c);strainProjectiles(w,c)
 const roll=rng(w,'combat').int(0,99),success=roll<q.chance!
 const name=target.id===w.s.playerId?'당신':knownCreatureName(w,target)
 if(success){
  if(kind==='trip')knockDown(w,target,isPlayer,name)
  else{
   const before=equipmentSnapshot(target),weapon=q.weapon!
   delete target.equip[q.slot!];weapon.gx=undefined;weapon.gy=undefined
   tileAt(w,target.pos).items.push(weapon)
   runEquipmentWorkers(w,target,before)
   fx(w,{k:'status',id:target.id,text:'무장해제',color:'#e0c070',turn})
  }
 }else fx(w,{k:'status',id:target.id,text:'버팀',color:'#a8ada6',turn})
 if(isPlayer)log(w,'combat',`${c.id===w.s.playerId?'당신':knownCreatureName(w,c)}의 ${rule.label} → ${name}: ${success?'성공':'실패'}.`,[...(q.lines??[]),`${q.chance}% (roll ${roll})`])
 return{error:null,tu:rule.turns*100,arm:q.wield!.arm,twoHanded:q.wield!.twoHanded}
}
