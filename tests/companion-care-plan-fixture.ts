import {addWound} from '../src/core/body'
import {enlistRecruit} from '../src/core/companions'
import {createCreature} from '../src/core/creatures'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {addToBag,makeItem} from '../src/core/items'
import {baseFixture} from './base-camp-fixture'
export function carePlanFixture(ally=false){
 const d=baseFixture(),{w,s,p,worker}=d
 s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];s.log=[];s.map.name='동료 처치 순서 · 유한 검토실'
 for(const t of s.map.tiles)if(!t.placed)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0})
 worker.skills.medicine=50;worker.body.wounds=[]
 let patient=p
 if(ally){patient=createCreature(w,'Creature.SettlementGuard',{x:19,y:21});Object.assign(patient,{faction:'coalition',bag:[],equip:{},traumas:[],effects:[],asleep:false,unconscious:false,activity:undefined,age:undefined,traits:[],background:undefined});patient.body.wounds=[];patient.body.missing=[];patient.body.blood=patient.body.bloodMax;Object.assign(patient.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,bodyTemp:37});s.creatures.push(patient);enlistRecruit(w,patient,1)}
 const wound=addWound(w,patient,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:10,source:'명시한 초기 외부 상처'}).wound
 const thread=makeItem(w,'Item.Thread',3),needle=makeItem(w,'Item.Needle'),drug=makeItem(w,'Item.BitterMoss',2),bandage=makeItem(w,'Item.Bandage',2)
 for(const i of [thread,needle,drug,bandage])if(addToBag(w,worker,i))throw Error('초기 의료품 공간 부족')
 invalidateLights(w);updatePlayerVision(w,p)
 const requests=[{kind:'diagnose' as const,patient:patient.id},{kind:'dose' as const,patient:patient.id,uid:drug.uid,woundId:wound.id},{kind:'suture' as const,patient:patient.id,woundId:wound.id},{kind:'bandage' as const,patient:patient.id,woundId:wound.id}]
 return{...d,patient,wound,thread,needle,drug,bandage,requests}
}
