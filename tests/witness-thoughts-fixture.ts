import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {lifeMemoriesFixture} from './life-memories-fixture'
import {createCreature} from '../src/core/creatures'
import {addWound} from '../src/core/body'
import {tileAt,turnOf,creatureAt,terrainAt} from '../src/core/ctx'
import {DIRS} from '../src/core/geom'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {hireCompanion} from '../src/core/companions'
import {playerAct} from '../src/core/game'
export function gardenerSoundFixture(){
 const d=conditionThoughtsFixture(),machine=createCreature(d.w,'Creature.TenderDrone',{x:d.p.pos.x+3,y:d.p.pos.y});machine.nextAct=1e12;machine.home={...machine.pos};d.s.creatures.push(machine)
 const fire={x:d.p.pos.x,y:d.p.pos.y+2};tileAt(d.w,fire).t='Terrain.Campfire';d.s.map.lights=[{pos:fire,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}];invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,machine}
}
export function companionDeathFixture(){
 const d=lifeMemoriesFixture(),companion=d.s.creatures.find(c=>d.w.db.creature(c.def).ai==='guard')!
 const next=DIRS.map(v=>({x:companion.pos.x+v.x,y:companion.pos.y+v.y})).find(p=>terrainAt(d.w,p).passable&&!creatureAt(d.w,p))!
 d.p.pos=next;d.p.money=1000;companion.asleep=false;companion.unconscious=false;companion.activity=undefined;companion.traits=[];companion.traumas=[];companion.effects=[];companion.needs.stress=0;companion.body.wounds=[];companion.body.blood=companion.body.bloodMax;companion.nextAct=1e12
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 // 초기 계약도 실제 고용 규칙/현금 이전을 통과한다. 아직 턴은 진행하지 않았다.
 const money={player:d.p.money,npc:companion.money??0},error=hireCompanion(d.w,companion);if(error)throw Error(error)
 const wd=addWound(d.w,companion,{def:'Wound.Cut',part:'RightForearm',severity:5,artery:1,source:'초기 실제 동료 동맥 부상'}).wound
 companion.body.blood=companion.body.bloodMax*.501;companion.unconscious=true
 return {...d,companion,wd,money}
}
export type WitnessThoughtPhase='sound'|'pious'|'silent'|'death'|'hidden'|'pending'
export function witnessThoughtNativeFixture(phase:WitnessThoughtPhase){
 const act=(w:Parameters<typeof playerAct>[0],a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 if(phase==='sound'||phase==='pious'||phase==='silent'){
  const d=gardenerSoundFixture(),initialTime=d.s.time
  if(phase==='pious')d.p.traits=['Trait.Pious']
  if(phase!=='silent'){d.machine.body.machine!.power=29;d.machine.home={x:d.p.pos.x+6,y:d.p.pos.y};d.machine.nextAct=d.s.time}
  act(d.w,{type:'wait'});invalidateLights(d.w);updatePlayerVision(d.w,d.p)
  return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,machineId:d.machine.id,companionId:undefined,hirePayment:undefined,pending:false}}
 }
 const d=companionDeathFixture(),initialTime=d.s.time
 if(phase==='hidden'){d.p.pos={x:d.companion.pos.x-3,y:d.companion.pos.y};for(let y=d.companion.pos.y-5;y<=d.companion.pos.y+5;y++)if(tileAt(d.w,{x:d.companion.pos.x-1,y}))tileAt(d.w,{x:d.companion.pos.x-1,y}).t='Terrain.RuinWall'}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 act(d.w,phase==='pending'?{type:'rest',turns:20}:{type:'wait'},phase==='pending'?2:undefined)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,machineId:undefined,companionId:d.companion.id,hirePayment:{playerBefore:d.money.player,playerAfter:d.p.money,npcBefore:d.money.npc,npcAfter:d.companion.money},pending:phase==='pending'}}
}
