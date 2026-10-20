import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {createCreature} from '../src/core/creatures'
import {tileAt,turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function npcPsycheFixture(def='Creature.Reaver'){
 const d=conditionThoughtsFixture(),npc=createCreature(d.w,def,{x:d.p.pos.x+1,y:d.p.pos.y})
 npc.nextAct=d.s.time;npc.traits=[];npc.age=undefined;npc.background=undefined;npc.effects=[];npc.thoughts=[];npc.traumas=[];npc.stats={str:10,agi:10,per:10,vit:10,wil:10};npc.needs.stress=0
 d.s.creatures.push(npc)
 const fire={x:d.p.pos.x,y:d.p.pos.y+2};tileAt(d.w,fire).t='Terrain.Campfire';d.s.map.lights=[{pos:fire,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}]
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,npc}
}

import {lifeMemoriesFixture} from './life-memories-fixture'
import {creatureAt,terrainAt} from '../src/core/ctx'
import {DIRS} from '../src/core/geom'
import {addWound} from '../src/core/body'
import {makeItem,addToBag,itemDef} from '../src/core/items'
import {clinicQuote,requestClinic} from '../src/core/clinic'
import {playerAct} from '../src/core/game'
export type NpcPsychePhase='witness'|'fast'|'refuse'|'meal'|'care'|'pending'
export function npcPsycheNativeFixture(phase:NpcPsychePhase){
 const d=lifeMemoriesFixture(),npc=d.keeper,initialTime=d.s.time
 const free=(c:typeof npc)=>DIRS.map(v=>({x:c.pos.x+v.x,y:c.pos.y+v.y})).find(p=>terrainAt(d.w,p).passable&&!creatureAt(d.w,p))!
 const act=(action:Parameters<typeof playerAct>[1],budget?:number)=>{const e=playerAct(d.w,action,budget);if(e)throw Error(e)}
 npc.traits=[];npc.needs.stress=phase==='witness'?30:phase==='fast'||phase==='refuse'?85:20
 let victimId:number|undefined,foodUid:number|undefined,doctorId:number|undefined,medicalUid:number|undefined,medicalUses:number|undefined,fee:number|undefined,payment:{patientBefore:number;patientAfter:number;doctorBefore:number;doctorAfter:number}|undefined,woundId:number|undefined,turns:number|undefined
 if(phase==='witness'||phase==='fast'||phase==='refuse'){
  npc.nextAct=d.s.time+100
  if(phase==='refuse'){const food=makeItem(d.w,'Item.OpenedRationPack');if(addToBag(d.w,npc,food))throw Error('initial finite refused meal');foodUid=food.uid;npc.needs.kcal=-600}
  const victim=createCreature(d.w,'Creature.SettlementGuard',free(npc));victim.faction=npc.faction;victim.unconscious=true;victim.nextAct=1e12;d.s.creatures.push(victim);victimId=victim.id
  const result=addWound(d.w,victim,{def:'Wound.Cut',part:'RightForearm',severity:5,artery:1,source:'초기 실제 동맥 부상'});victim.hp-=result.damage;victim.body.blood=victim.body.bloodMax*.501
  act({type:'wait'});act({type:'wait'});if(phase==='refuse')act({type:'wait'})
 }else if(phase==='meal'){
  // 초기 장면에서 원래 다른 음식은 같은UID로 바닥에 둔다. NPC의 한 실제 식사만 추적한다.
  const foods=npc.bag.filter(i=>!!itemDef(d.w,i).food);npc.bag=npc.bag.filter(i=>!foods.includes(i));for(const food of foods){delete food.gx;delete food.gy;delete food.rot;tileAt(d.w,npc.pos).items.push(food)}
  const food=makeItem(d.w,'Item.OpenedRationPack');if(addToBag(d.w,npc,food))throw Error('initial finite meal');foodUid=food.uid;npc.needs.kcal=-600;npc.nextAct=d.s.time
  act({type:'wait'})
 }else{
  const doctor=d.s.creatures.find(c=>d.w.db.creature(c.def).clinic)!,oldPlayerPos={...d.p.pos};doctorId=doctor.id;doctor.nextAct=d.s.time;npc.pos=free(doctor);d.p.pos=free(npc)
  if(creatureAt(d.w,d.p.pos)?.id!==d.p.id){d.p.pos=oldPlayerPos;throw Error('initial observer placement')}
  npc.money=1000
  const wd=addWound(d.w,npc,{def:'Wound.Cut',part:'RightForearm',severity:2,source:'초기 진료 상처'}).wound;woundId=wd.id
  const q=clinicQuote(d.w,npc,doctor,{kind:'bandage',woundId:wd.id});if(q.error)throw Error(q.error);fee=q.fee;turns=q.turns;medicalUid=q.activity!.uid;medicalUses=doctor.bag.find(i=>i.uid===medicalUid)!.uses
  const patientBefore=npc.money??0,doctorBefore=doctor.money??0
  const e=requestClinic(d.w,npc,doctor,{kind:'bandage',woundId:wd.id},q.fee);if(e)throw Error(e)
  payment={patientBefore,patientAfter:npc.money??0,doctorBefore,doctorAfter:doctor.money??0}
  act({type:'rest',turns:phase==='pending'?20:q.turns},phase==='pending'?2:undefined)
 }
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,npc,proof:{phase,initialTime,initialStress:phase==='witness'?30:phase==='fast'||phase==='refuse'?85:20,actualTurns:(d.s.time-initialTime)/100,victimId,foodUid,doctorId,medicalUid,medicalUses,fee,payment,woundId,careTurns:turns,pending:phase==='pending'}}
}
