/** A finite six-drive guardian: actual targets, tools, net/acid stock and paid counterplay. */
import type {Action,ActResult} from './actions'
import {addWound,capacity,hpMax,partEff} from './body'
import {fx,resolveAttack,wake} from './combat'
import {cullerCooling,cullerRules,limitCullerStock} from './culler-state'
import {creatureById,log,player,rng,turnOf,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {recordGardenBell,reportedGardenAlert} from './garden-alert'
import {cheb,dirIndex,dist2,type Pos} from './geom'
import {allItems,itemDef} from './items'
import {machineAction,machineReady,machineRules} from './machine-state'
import {diagonalBlocked} from './path'
import {emitNoise} from './perception'
import {effectiveStat,hasEffect} from './traits'
import {drinkVolume,spendDrinkVolume} from './wash-water'
import {isWaterVessel} from './water-vessels'
import type {Creature} from './types'
const fail=(msg:string):ActResult=>({ok:false,tu:0,msg})
function ready(w:World,c:Creature){return !!cullerRules(w,c)&&c.alive&&w.s.creatures.includes(c)&&!c.unconscious&&!c.asleep&&!c.activity&&machineReady(w,c)&&capacity(w,c,'consciousness')>=.3}
export function cullerBoundaryDistance(d:NonNullable<ReturnType<typeof cullerRules>>,p:Pos){const[x,y,width,height]=d.protectedRect;return Math.max(0,x-p.x,p.x-(x+width-1),y-p.y,p.y-(y+height-1))}
function toolStock(w:World,c:Creature,kind:'spray'|'net'){
 const d=cullerRules(w,c),rule=d?.[kind];if(!d||!rule||partEff(w,c,rule.part)<.1)return
 const row=c.cullerState!.components.find(r=>r.part===rule.part&&r.def===rule.item),it=c.body.machine?.components?.find(i=>i.uid===row?.uid)
 return row&&it&&(kind==='spray'?(it.uses??0)>0:it.count>0)?{row,it}:undefined
}
function targetError(w:World,c:Creature,t:Creature|undefined,range:number){return!ready(w,c)||cullerCooling(w,c)?'구제기의 전원·냉각 상태를 확인해야 한다':!t?.alive||t.id===c.id||t.crawlerState?.mode==='ceiling'||cheb(c.pos,t.pos)>range||!canSee(w,c,t.pos)||!hasLos(w,c.pos,t.pos)?'실제 보이는 지상의 사거리 안 대상을 골라야 한다':null}
function note(w:World,c:Creature,t:Creature,kind:string){c.cullerState!.lastAttack={at:turnOf(w),kind,target:t.id};c.facing=dirIndex(t.pos.x-c.pos.x,t.pos.y-c.pos.y);emitNoise(w,c.pos,9,c.id);wake(w,t,'구제기의 공격')}
export function cullerNet(w:World,c:Creature,targetId:number):ActResult{
 const d=cullerRules(w,c),t=creatureById(w,targetId),stock=toolStock(w,c,'net'),error=d?targetError(w,c,t,d.net.range):'구제기의 원래 구성이 없다'
 if(error||!d||!t||!stock)return fail(error??'작동하는 발사기와 실제 포획망이 필요하다')
 if(hasEffect(t,'netted',turnOf(w)))return fail('이미 포획망에 걸렸다')
 stock.it.count--;stock.row.spent++;if(!stock.it.count)c.body.machine!.components!.splice(c.body.machine!.components!.indexOf(stock.it),1)
 t.effects.push({kind:'netted',untilTurn:turnOf(w)+d.net.turns+1,magnitude:d.net.strength,sourceUid:stock.it.uid,sourceId:c.id,sourceDef:stock.it.def})
 note(w,c,t,'net');machineAction(w,c,'attack');fx(w,{k:'attack',id:c.id,target:t.id,mode:'cullerNet',ranged:true,turn:turnOf(w)});fx(w,{k:'status',id:t.id,text:'포획망',color:'#b9b49a',turn:turnOf(w)})
 if(canSee(w,player(w),t.pos))log(w,'danger','구제기의 실제 포획망에 걸렸다. 이동하면 힘이나 민첩으로 빠져나오려 한다.')
 return{ok:true,tu:d.net.tu}
}
export function escapeCullerNet(w:World,c:Creature):boolean|null{
 const held=c.effects.find(e=>e.kind==='netted'&&e.untilTurn>turnOf(w));if(!held)return null
 const chance=Math.max(5,Math.min(95,50+(Math.max(effectiveStat(w,c,'str'),effectiveStat(w,c,'agi'))-(held.magnitude??0))*5))
 if(!rng(w,'combat').chance(chance/100)){if(c.id===w.s.playerId)log(w,'warn',`포획망을 벗어나지 못했다. (탈출 ${chance}%)`);return false}
 c.effects.splice(c.effects.indexOf(held),1);if(c.id===w.s.playerId)log(w,'info','포획망을 벗어났다.');return true
}
export function cullerSpray(w:World,c:Creature,targetId:number):ActResult{
 const d=cullerRules(w,c),t=creatureById(w,targetId),stock=toolStock(w,c,'spray'),error=d?targetError(w,c,t,d.spray.radius):'구제기의 원래 구성이 없다'
 if(error||!d||!t||!stock)return fail(error??'작동하는 분사구와 실제 정화액이 필요하다')
 stock.it.uses!--;stock.row.spent++;note(w,c,t,'acid')
 const dx=t.pos.x-c.pos.x,dy=t.pos.y-c.pos.y
 const victims=w.s.creatures.filter(o=>{const x=o.pos.x-c.pos.x,y=o.pos.y-c.pos.y,dot=x*dx+y*dy;return o.alive&&o.id!==c.id&&o.crawlerState?.mode!=='ceiling'&&cheb(c.pos,o.pos)<=d.spray.radius&&dot>0&&Math.abs(x*dy-y*dx)<=dot&&hasLos(w,c.pos,o.pos)}).sort((a,b)=>a.id-b.id)
 for(const victim of victims)resolveAttack(w,c,victim,{ranged:true,paid:true,machinePaid:true,wield:{atk:d.spray.attack,arm:'rarm',twoHanded:false},abilityLabel:'정화액 분무'})
 machineAction(w,c,'attack');fx(w,{k:'attack',id:c.id,target:t.id,mode:'cullerAcid',ranged:true,turn:turnOf(w)})
 if(canSee(w,player(w),c.pos))log(w,'warn','구제기가 탱크의 정화액 한 회분을 써 가까운 부채꼴에 분무했다.')
 return{ok:true,tu:d.spray.tu}
}
export function purifierQuote(w:World,c:Creature,uid:number,targetId:number){
 const it=c.bag.find(i=>i.uid===uid),d=it&&itemDef(w,it).purifier,t=creatureById(w,targetId)
 const error=!c.alive||!w.s.creatures.includes(c)||c.asleep||c.unconscious||c.activity||capacity(w,c,'manipulation')<.2?'깨어서 탱크를 다룰 손이 필요하다':!d||!it||(it.uses??0)<1?'실제 남은 정화액이 없다':!t?.alive||t.id===c.id||cheb(c.pos,t.pos)>d.radius||!canSee(w,c,t.pos)||!hasLos(w,c.pos,t.pos)?'분사 거리의 실제 보이는 대상을 골라야 한다':null
 return{it,d,t,error}
}
export function sprayPurifier(w:World,c:Creature,uid:number,targetId:number):ActResult{
 const q=purifierQuote(w,c,uid,targetId);if(q.error)return fail(q.error)
 const it=q.it!,d=q.d!,t=q.t!,dx=t.pos.x-c.pos.x,dy=t.pos.y-c.pos.y;it.uses!--;c.facing=dirIndex(dx,dy)
 for(const victim of w.s.creatures.filter(o=>{const x=o.pos.x-c.pos.x,y=o.pos.y-c.pos.y,dot=x*dx+y*dy;return o.alive&&o.id!==c.id&&o.crawlerState?.mode!=='ceiling'&&cheb(c.pos,o.pos)<=d.radius&&dot>0&&Math.abs(x*dy-y*dx)<=dot&&hasLos(w,c.pos,o.pos)}).sort((a,b)=>a.id-b.id))resolveAttack(w,c,victim,{ranged:true,paid:true,machinePaid:true,wield:{atk:d.attack,arm:'rarm',twoHanded:false},prop:{uid:it.uid,def:it.def},abilityLabel:'회수한 정화액 분무'})
 emitNoise(w,c.pos,7,c.id);fx(w,{k:'attack',id:c.id,target:t.id,mode:'cullerAcid',ranged:true,prop:{uid:it.uid,def:it.def},turn:turnOf(w)});log(w,'warn','회수한 탱크에서 정화액 한 회분을 분무했다. 앞쪽의 다른 생물도 맞을 수 있다.');return{ok:true,tu:100}
}
export function cullerStatus(w:World,c:Creature){const d=cullerRules(w,c),s=c.cullerState;if(!d||!s)return;return{cooling:Math.max(0,s.coolUntil-turnOf(w)),attacks:s.attacks,returning:s.returning,acid:toolStock(w,c,'spray')?.it.uses??0,nets:toolStock(w,c,'net')?.it.count??0}}
function counterError(w:World,c:Creature,t:Creature|undefined){return!c.alive||!w.s.creatures.includes(c)||c.asleep||c.unconscious||c.activity||capacity(w,c,'manipulation')<.2?'깨어서 도구를 다룰 수 있어야 한다':!t?.alive||!cullerRules(w,t)||cheb(c.pos,t.pos)>1||!canSee(w,c,t.pos)||!hasLos(w,c.pos,t.pos)||diagonalBlocked(w,c.pos,t.pos.x-c.pos.x,t.pos.y-c.pos.y)?'보이는 구제기 곁에 있어야 한다':!cullerCooling(w,t)?'연속 공격 뒤 냉각하는 틈을 기다리자':null}
export function cullerWaterError(w:World,c:Creature,t:Creature|undefined,uid:number){const error=counterError(w,c,t);if(error)return error;const d=cullerRules(w,t!)!,it=c.bag.find(i=>i.uid===uid);return !it||!isWaterVessel(w,it)||it.waterFrozen||itemDef(w,it).drink?.alcohol||drinkVolume(w,it)<d.weaknesses.waterMl?'배낭의 실제 액체 물이 부족하다':null}
export function cullerWater(w:World,c:Creature,targetId:number,uid:number):ActResult{
 const t=creatureById(w,targetId),error=cullerWaterError(w,c,t,uid);if(error||!t)return fail(error??'대상이 없다')
 const d=cullerRules(w,t)!,it=c.bag.find(i=>i.uid===uid)!,amount=spendDrinkVolume(w,it,d.weaknesses.waterMl),shorted=rng(w,'combat').chance(d.weaknesses.shortChance)
 if(shorted){t.body.machine!.shutdownUntil=Math.max(t.body.machine!.shutdownUntil,turnOf(w)+d.weaknesses.shutdownTurns+1);addWound(w,t,{def:'Wound.MachineHeat',part:machineRules(w,t)!.core,severity:2,source:'냉각 중 물 단락',sourceId:c.id})}
 t.cullerState!.lastWater={at:turnOf(w),uid,ml:amount,shorted};emitNoise(w,c.pos,3,c.id);log(w,shorted?'good':'warn',shorted?'냉각 중인 구제기에 물을 끼얹어 동력핵이 단락했다.':'물은 소모됐지만 구제기의 동력핵이 버텼다.');return{ok:true,tu:100}
}
export function cullerFireError(w:World,c:Creature,t:Creature|undefined,uid:number){const error=counterError(w,c,t);if(error)return error;const it=[c.equip.main,c.equip.off].find(i=>i?.uid===uid);return !it?.lit||(it.fuel??0)<=0||!itemDef(w,it).attacks?.some(a=>a.requiresLit&&a.damageType==='burn')?'손에 실제 불붙은 횃불이 필요하다':null}
export function cullerIgnite(w:World,c:Creature,targetId:number,uid:number):ActResult{
 const t=creatureById(w,targetId),error=cullerFireError(w,c,t,uid);if(error||!t)return fail(error??'대상이 없다');const d=cullerRules(w,t)!,it=[c.equip.main,c.equip.off].find(i=>i?.uid===uid)!;it.fuel=Math.max(0,it.fuel!-1);if(!it.fuel)it.lit=false;t.body.machine!.heat=100;t.body.machine!.shutdownUntil=Math.max(t.body.machine!.shutdownUntil,turnOf(w)+d.weaknesses.shutdownTurns+1);emitNoise(w,c.pos,5,c.id);fx(w,{k:'status',id:t.id,text:'과열 정지',color:'#e3a16b',turn:turnOf(w)});log(w,'good','냉각 틈에 댄 횃불이 구제기를 과열시켰다.');return{ok:true,tu:100}
}
export function ringMaintenanceBell(w:World,c:Creature,uid:number):ActResult{
 const it=allItems(c).find(i=>i.uid===uid),d=w.db.all<import('./types').CreatureDef>('Creature').map(d=>d.culler?.weaknesses).find(d=>d?.bellItem===it?.def)
 if(!d||!it||it.count<1||!c.alive||!w.s.creatures.includes(c)||c.unconscious||c.asleep||capacity(w,c,'manipulation')<.2)return fail('손으로 울릴 실제 정비종이 필요하다')
 emitNoise(w,c.pos,d.bellRadius+4,c.id);const repeat=recordGardenBell(w)
 for(const target of w.s.creatures){const mechanical=machineRules(w,target),rule=cullerRules(w,target);if(!mechanical||!target.alive||target.faction!==d.bellFaction||!machineReady(w,target)||capacity(w,target,'hearing')<=0||cheb(c.pos,target.pos)>d.bellRadius||!hasLos(w,c.pos,target.pos))continue;const chance=rule?(cullerCooling(w,target)?rule.weaknesses.coolingBellChance:rule.weaknesses.bellChance):d.machineBellChance;if(rng(w,'combat').chance(chance/(1+repeat))){target.body.machine!.shutdownUntil=Math.max(target.body.machine!.shutdownUntil,turnOf(w)+rng(w,'combat').int(...d.bellTurns)+1);if(canSee(w,player(w),target.pos))fx(w,{k:'status',id:target.id,text:'세 음 정지',color:'#c7bc92',turn:turnOf(w)})}}
 log(w,'info','정비종을 세 번 울렸다. 기계가 반복 신호에 적응한다.');return{ok:true,tu:100}
}
export function decideCuller(w:World,c:Creature,nav:{toward(p:Pos):Action|null}):Action{
 const d=cullerRules(w,c),s=c.cullerState,m=c.body.machine;if(!d||!s||!m||!ready(w,c))return{type:'wait'}
 limitCullerStock(w,c)
 const home=():Action=>{c.ai.mode='return';c.ai.target=undefined;return c.home&&cheb(c.pos,c.home)>0?nav.toward(c.home)??{type:'wait'}:{type:'wait'}}
 const fraction=c.hp/hpMax(w,c),mechanical=machineRules(w,c)!
 if(fraction<=1-d.retreatDamage||m.power<mechanical.retreatPower)s.returning=true
 if(s.returning){if(fraction>.6&&m.power>=mechanical.retreatPower)s.returning=false;else return home()}
 if(cullerBoundaryDistance(d,c.pos)>d.leashTiles)return home()
 if(cullerCooling(w,c))return{type:'wait'}
 const active=reportedGardenAlert(w)>=d.activationAlert
 const targets=w.s.creatures.filter(t=>t.alive&&t.id!==c.id&&t.faction!==c.faction&&w.db.body(t.body.def).kind!=='mechanical'&&(w.db.creature(t.def).weightKg??0)>=d.minimumWeightKg&&cullerBoundaryDistance(d,t.pos)<=d.leashTiles&&canSee(w,c,t.pos)&&(active&&cullerBoundaryDistance(d,t.pos)===0||s.tracked?.id===t.id&&turnOf(w)-s.tracked.at<=d.memoryTurns||c.body.wounds.some(wd=>wd.sourceId===t.id&&wd.severity>wd.healed))).sort((a,b)=>dist2(c.pos,a.pos)-dist2(c.pos,b.pos)||a.id-b.id)
 const target=targets[0];if(!target){c.ai.target=undefined;if(s.tracked&&turnOf(w)-s.tracked.at<=d.memoryTurns&&cheb(c.pos,s.tracked.pos)>0&&cullerBoundaryDistance(d,s.tracked.pos)<=d.leashTiles){c.ai.mode='investigate';return nav.toward(s.tracked.pos)??home()}s.tracked=undefined;if(c.ai.mode==='investigate'&&c.ai.dest&&capacity(w,c,'hearing')>0&&cullerBoundaryDistance(d,c.ai.dest)<=d.leashTiles)return nav.toward(c.ai.dest)??home();return home()}
 s.tracked={id:target.id,pos:{...target.pos},at:turnOf(w)};c.ai.mode='hunt';c.ai.target=target.id;const range=cheb(c.pos,target.pos)
 if(range<=d.net.range&&range>1&&!hasEffect(target,'netted',turnOf(w))&&toolStock(w,c,'net'))return{type:'cullerNet',target:target.id}
 if(range<=d.spray.radius&&(s.attacks===2||!w.db.creature(c.def).naturalAttacks?.some(a=>a.requiresParts?.every(id=>partEff(w,c,id)>=.1)))&&toolStock(w,c,'spray'))return{type:'cullerSpray',target:target.id}
 if(range<=1){const modes=[d.tools.left,d.tools.right],attacks=w.db.creature(c.def).naturalAttacks??[],ordered=s.attacks%2?modes.slice().reverse():modes;const mode=ordered.find(id=>attacks.find(a=>a.id===id)?.requiresParts?.every(part=>partEff(w,c,part)>=.1));return mode?{type:'attack',target:target.id,mode}:{type:'wait'}}
 return nav.toward(target.pos)??{type:'wait'}
}
