import {addWound} from '../src/core/body'
import {resolveAttack} from '../src/core/combat'
import {diseaseTick} from '../src/core/conditions'
import {createCreature} from '../src/core/creatures'
import {tileAt,TURNS_PER_HOUR} from '../src/core/ctx'
import {updatePlayerVision} from '../src/core/fov'
import {makeItem,addToBag} from '../src/core/items'
import {startFieldDevice} from '../src/core/field-devices'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {zeroVaultFixture} from './zero-vault-fixture'
import {finishBase} from './base-camp-fixture'
import {perform} from '../src/core/actions'
import {enlistRecruit} from '../src/core/companions'
import {playerAct} from '../src/core/game'
import {clinicQuote} from '../src/core/clinic'
function boundary(d:ReturnType<typeof clinicalDiseaseFixture>,onset:number){
 d.s.time=(onset-2)*100;for(const c of d.s.creatures)c.nextAct=d.s.time
 d.s.weather='clear';d.s.weatherUntil=1e12;d.s.wind={x:0,y:0};updatePlayerVision(d.w,d.p)
}
export function ratFeverBoundaryFixture(){
 const d=clinicalDiseaseFixture('clinical-onset-279'),rat=createCreature(d.w,'Creature.BurrowRat',{x:21,y:20});d.s.creatures.push(rat);d.p.asleep=true
 for(let i=0;i<20&&!d.p.diseases?.some(s=>s.def==='Disease.RatFever');i++)resolveAttack(d.w,rat,d.p)
 const disease=d.p.diseases?.find(s=>s.def==='Disease.RatFever');if(!disease||disease.incubatesUntil%TURNS_PER_HOUR)throw Error('natural actual rat exposure boundary')
 d.p.asleep=false;rat.pos={x:30,y:20};rat.home={...rat.pos}
 const tea=d.add('Item.WillowTea');boundary(d,disease.incubatesUntil)
 return{...d,rat,disease,tea}
}
export function clinicalVaultBoundaryFixture(){
 const d=zeroVaultFixture(true,true,'clinical-natural-26')
 if(startFieldDevice(d.w,d.p,d.mechanism,d.device.uid,'breach'))throw Error('actual sealed door work')
 finishBase(d.w,d.p);d.p.pos={x:22,y:8};d.p.body.wounds=[];d.p.effects=[];d.p.asleep=false;d.p.unconscious=false
 const wound=addWound(d.w,d.p,{def:'Wound.Stab',part:'LeftThigh',severity:10,source:'실제 녹과 흙이 묻은 깊은 찔림',contam:50}).wound;wound.ageTurns=6*TURNS_PER_HOUR
 diseaseTick(d.w,d.p,false);const disease=d.p.diseases?.find(s=>s.def==='Disease.Tetanus');if(!disease)throw Error('default real five percent exposure')
 d.p.needs.bodyTemp=33.9;diseaseTick(d.w,d.p,false);d.p.needs.bodyTemp=37;diseaseTick(d.w,d.p,false)
 if(!d.p.diseases?.some(s=>s.def==='Disease.Pneumonia'))throw Error('actual cold exposure')
 const serum=tileAt(d.w,d.chest).cont!.items.find(i=>i.def==='Item.TetanusSerum')!,food=makeItem(d.w,'Item.RoastedMeat');if(addToBag(d.w,d.p,food))throw Error('real food')
 // Independent INITIAL clinical progression uses the same real disease rules; no claim of a fully simulated past world.
 const pneumonia=d.p.diseases!.find(s=>s.def==='Disease.Pneumonia')!
 for(let at=Math.ceil(pneumonia.incubatesUntil/TURNS_PER_HOUR)*TURNS_PER_HOUR;at<disease.incubatesUntil-2;at+=TURNS_PER_HOUR){d.s.time=at*100;diseaseTick(d.w,d.p,false)}
 // Controlled INITIAL quiet-vault scenario: clinical-only preparation may have emitted historical cough sounds.
 if(d.guard.attackedBy?.includes(d.p.id))throw Error('pre-existing actual hostility')
 d.guard.asleep=true;d.guard.needs.fatigue=80;d.s.noiseEvents=[]
 d.s.time=(disease.incubatesUntil-2)*100;for(const c of d.s.creatures)c.nextAct=d.s.time
 d.s.weatherUntil=1e12;d.s.weather='clear';d.s.wind={x:0,y:0};updatePlayerVision(d.w,d.p)
 return{...d,wound,disease,serum,food}
}
export function clinicalVaultActiveFixture(){
 const d=clinicalVaultBoundaryFixture();d.s.time=(d.disease.incubatesUntil+1)*100;for(const c of d.s.creatures)c.nextAct=d.s.time
 diseaseTick(d.w,d.p,false);updatePlayerVision(d.w,d.p);return d
}

export function clinicalPendingSerumFixture(){
 const d=clinicalVaultActiveFixture()
 if(!perform(d.w,d.p,{type:'search'}).ok)throw Error('real original vault search')
 finishBase(d.w,d.p)
 if(!perform(d.w,d.p,{type:'lootTake',uid:d.serum.uid}).ok)throw Error('real original finite serum recovery')
 const owned=d.p.bag.find(i=>i.uid===d.serum.uid)!;owned.appraisal=2
 const doctor=createCreature(d.w,'Creature.SettlementDoctor',{x:21,y:8});doctor.age=undefined;doctor.asleep=false;doctor.effects=[];doctor.traits=[];doctor.equip={};doctor.bag=[];doctor.nextAct=d.s.time;doctor.money=0;Object.assign(doctor.needs,{bodyTemp:37,fatigue:0,kcal:2500,waterDeficit:0,energy:100});d.s.creatures.push(doctor);enlistRecruit(d.w,doctor,1);doctor.companion!.order='hold'
 if(playerAct(d.w,{type:'giveCompanion',target:doctor.id,uid:owned.uid}))throw Error('actual finite companion medicine transfer')
 const q=clinicQuote(d.w,d.p,doctor,{kind:'dose',uid:owned.uid});if(q.error)throw Error(q.error+' '+JSON.stringify(d.s.creatures.map(c=>({id:c.id,faction:c.faction,pos:c.pos,asleep:c.asleep,attackedBy:c.attackedBy,ai:c.ai.mode}))))
 const begin=d.s.time
 if(playerAct(d.w,{type:'clinic',target:doctor.id,request:{kind:'dose',uid:owned.uid},expectedFee:q.fee},300000,begin))throw Error('actual bound clinic request')
 if(!d.s.simulationPending||!doctor.activity||doctor.activity.remaining<=0)throw Error('real pending serum work')
 return{...d,doctor,quote:q,money:d.p.money,begin}
}
