import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {addWound} from '../src/core/body'
import {tileAt,turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function infectionFixture(progress=0){
 const d=conditionThoughtsFixture(),pos={x:d.p.pos.x+2,y:d.p.pos.y}
 tileAt(d.w,pos).t='Terrain.Campfire';d.s.map.lights=[{pos,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}]
 const wd=addWound(d.w,d.p,{def:'Wound.Cut',part:'RightShin',severity:2,source:'초기 감염 상처'}).wound
 wd.contam=0;wd.infectionChecked=true;wd.infection={progress,immunity:0}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,wd}
}

export type InfectionPhase='inflamed'|'pus'|'fever'|'chill'|'willow'|'pending'
export async function infectionNativeFixture(phase:InfectionPhase){
 const {playerAct}=await import('../src/core/game'),{makeItem,addToBag}=await import('../src/core/items'),{infectionSystemic}=await import('../src/core/infection-state'),{thermalState}=await import('../src/core/thermal'),{drugEffects}=await import('../src/core/drug-state')
 const progress={inflamed:20,pus:40,fever:60,chill:80,willow:80,pending:60}[phase],d=infectionFixture(progress),initialTime=d.s.time
 let itemUid:number|undefined
 if(phase==='willow'){d.p.needs.bodyTemp=39.4;const item=makeItem(d.w,'Item.WillowTea');if(addToBag(d.w,d.p,item)!==0)throw Error('initial willow tea');itemUid=item.uid}
 const initialTemp=d.p.needs.bodyTemp
 const error=playerAct(d.w,phase==='willow'?{type:'consume',uid:itemUid!}:phase==='pending'?{type:'rest',turns:400}:{type:'wait'},phase==='pending'?2:undefined)
 if(error)throw Error(error)
 if(phase==='willow'){const rest=playerAct(d.w,{type:'rest',turns:200});if(rest)throw Error(rest)}
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,initialTemp,progress,itemUid,woundId:d.wd.id,actualTurns:(d.s.time-initialTime)/100,rule:{...infectionSystemic(d.w,d.p)},actualAntipyretic:drugEffects(d.w,d.p).febrileCooling,actualFeverTarget:thermalState(d.w,d.p).fever,pending:phase==='pending'}}
}
