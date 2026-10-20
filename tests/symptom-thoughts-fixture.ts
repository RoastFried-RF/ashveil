import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {addWound} from '../src/core/body'
import {createCreature} from '../src/core/creatures'
import {addToBag,equip,makeItem} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {tileAt,turnOf,TURNS_PER_HOUR} from '../src/core/ctx'
export type SymptomPhase='dizzy'|'festering'|'fever'|'tourniquet'|'frostbite'|'fire'|'rain'|'drug'|'loner'|'neat'
export function symptomNativeFixture(phase:SymptomPhase){
 const d=conditionThoughtsFixture(),initialTime=d.s.time,proof:{phase:SymptomPhase;initialTime:number;itemUid?:number;woundId?:number;neighborId?:number;actualTurns?:number}={phase,initialTime}
 if(phase==='dizzy')d.p.body.blood=4000
 if(phase==='festering'||phase==='fever'){const wd=addWound(d.w,d.p,{def:'Wound.Cut',part:'RightForearm',severity:2,source:'초기 상처'}).wound;wd.infection={progress:phase==='fever'?60:40,immunity:0};proof.woundId=wd.id}
 if(phase==='tourniquet')d.p.body.tourniquets.LeftLeg=turnOf(d.w)-2*TURNS_PER_HOUR
 if(phase==='frostbite')d.p.frostbite={LeftHand:{exposure:2000,grade:1,frozen:true}}
 if(phase==='fire'){const pos={x:d.p.pos.x+2,y:d.p.pos.y};tileAt(d.w,pos).t='Terrain.Campfire';d.s.map.lights=[{pos,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+100}]}
 if(phase==='rain'){d.s.weather='ashrain';tileAt(d.w,d.p.pos).roof=false}
 if(phase==='drug'){const item=makeItem(d.w,'Item.PoppyTincture');if(addToBag(d.w,d.p,item)!==0)throw Error('initial actual drug bottle');proof.itemUid=item.uid}
 if(phase==='neat'){d.p.traits=['Trait.Neat'];const item=makeItem(d.w,'Item.HuntingKnife');item.edge=55;if(addToBag(d.w,d.p,item)!==0||equip(d.w,d.p,item.uid))throw Error('initial equipped knife');proof.itemUid=item.uid}
 if(phase==='loner'){d.p.traits=['Trait.Loner'];const other=createCreature(d.w,'Creature.Reaver',{x:d.p.pos.x+4,y:d.p.pos.y});other.faction='coalition';other.nextAct=1e12;d.s.creatures.push(other);proof.neighborId=other.id}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const error=playerAct(d.w,phase==='drug'?{type:'consume',uid:proof.itemUid!}:phase==='fire'?{type:'rest',turns:20}:phase==='loner'?{type:'move',dir:2}:{type:'wait'},phase==='fire'?2:undefined)
 if(error)throw Error(error)
 proof.actualTurns=(d.s.time-initialTime)/100
 updatePlayerVision(d.w,d.p)
 return {...d,proof}
}
