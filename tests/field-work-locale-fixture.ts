import assert from'node:assert/strict'
import{prisonerFixture}from'./prisoner-fixture'
import{fieldDeviceFixture}from'./field-devices-fixture'
import{watercraftFixture}from'./watercraft-fixture'
import{aquaticFixture}from'./aquatic-fixture'
import{beaconsFixture}from'./beacons-fixture'
import{playerAct}from'../src/core/game'
import{addToBag,allItems,makeItem}from'../src/core/items'
import{aquaticTick,waterRescueQuote}from'../src/core/aquatic'
import{tileAt,type World}from'../src/core/ctx'
import{rumorSignalKey}from'../src/core/beacons'
import{updatePlayerVision}from'../src/core/fov'
import type{Pos}from'../src/core/geom'

export const fieldWorkScenes=['lock-pry','lock-pick','device-resume','device-cancel','marine','aquatic','beacon']as const
export type FieldWorkScene=typeof fieldWorkScenes[number]
export type FieldWorkPrepared={w:World;pos?:Pos;uid?:number;target?:number;proof:object}
export function fieldWorkLocaleFixture(scene:FieldWorkScene):FieldWorkPrepared{
 if(scene==='lock-pry'||scene==='lock-pick'){
  const d=prisonerFixture(),{w,s,p}=d;s.creatures=[p];s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.map.kind='dungeon';s.map.depth=3;p.bag=[]
  const pos={x:21,y:20};Object.assign(tileAt(w,pos),{t:scene==='lock-pick'?'Terrain.RustedDoorClosed':'Terrain.GuardChest',locked:true,searched:false,items:[],cont:undefined})
  const knife=makeItem(w,'Item.RustyKnife'),pick=makeItem(w,'Item.Lockpick');assert.equal(addToBag(w,p,knife),0);assert.equal(addToBag(w,p,pick),0);updatePlayerVision(w,p)
  return{w,pos,uid:scene==='lock-pick'?pick.uid:knife.uid,proof:{fixture:'prisonerFixture',declaredOnlyObserverScheduled:true,declaredLockedTerrain:tileAt(w,pos).t,declaredNoPriorSearchOrContents:true,finiteOriginalTools:[knife,pick].map(i=>({uid:i.uid,def:i.def,count:i.count,durability:i.durability})),rngUnmodified:true}}
 }
 if(scene==='device-resume'||scene==='device-cancel'){
  const d=fieldDeviceFixture(),start=d.s.time
  assert.equal(playerAct(d.w,{type:'deviceWork',pos:d.sensor,uid:d.device.uid,operation:'clean'},300000,start+900),null);assert.equal(d.device.work?.progress,10);assert.equal(playerAct(d.w,{type:'stopActivity'}),null);assert.equal(d.s.time-start,1000)
  return{w:d.w,pos:d.sensor,uid:d.device.uid,proof:{fixture:'fieldDeviceFixture(true)',declaredPriorBookKnowledge:true,noEarlierFullReadingOrAcquisitionClaim:true,actualEarlierCoreWorkTurns:10,earlierWorkIsNotBrowserInput:true,originalCloth:d.cloth.uid,originalWater:d.water.uid,originalDevice:d.device.uid}}
 }
 if(scene==='marine'){
  const d=watercraftFixture(),cfg=d.w.db.item(d.hull.def).watercraft!,initial=d.hull.durability;d.hull.durability=60
  assert.ok(d.p.bag.filter(i=>i.def===cfg.repair.item).reduce((n,i)=>n+i.count,0)>=cfg.repair.count,'Original finite fixture must already contain repair material')
  return{w:d.w,uid:d.hull.uid,proof:{fixture:'watercraftFixture',originalHull:d.hull.uid,originalDurability:initial,declaredInitialDurability:60,noNaturalEarlierWearClaim:true,initialRepairMaterials:d.p.bag.filter(i=>i.def===cfg.repair.item).map(i=>({uid:i.uid,count:i.count})),originalCargoPosition:cfg.cargoPos}}
 }
 if(scene==='aquatic'){
  const d=aquaticFixture(),target=d.s.creatures.find(c=>c.id!==d.p.id&&c.alive&&d.w.db.body(c.body.def).kind==='humanoid')!;assert.ok(target)
  const original={pos:{...target.pos},energy:target.needs.energy,nextAct:target.nextAct,equipment:allItems(target).map(i=>({uid:i.uid,def:i.def}))}
  target.pos={...d.deep};target.needs.energy=0;target.nextAct=d.s.time+1e9;target.activity=undefined;target.asleep=false;target.unconscious=false;aquaticTick(d.w,target);updatePlayerVision(d.w,d.p)
  const q=waterRescueQuote(d.w,d.p,target.id);assert.equal(q.error,null)
  return{w:d.w,target:target.id,pos:q.to,proof:{fixture:'aquaticFixture',originalTarget:target.id,original,declaredInitialDeepPosition:d.deep,declaredInitialTargetEnergy:0,declaredTargetAiUnscheduled:true,initialSubmersionThroughCoreTick:true,noEarlierNaturalDrowningClaim:true,originalEquipmentPreserved:true,actualFreeLanding:q.to}}
 }
 const d=beaconsFixture(),inbound={...d.rumor,id:'field-work-prior-receipt',text:'봉화로 받은 원래 해안 장부 사본.',source:'선언한 원래 해안 장부',hop:1,writtenAt:18000,foundAt:19000}
 // One explicitly declared pre-existing receipt; normal player reading must learn this separate record.
 d.from.state.inbox.push({key:rumorSignalKey(inbound),rumor:inbound,from:d.to.label,receivedAt:d.s.time/100-1});updatePlayerVision(d.w,d.p)
 return{w:d.w,pos:d.from.address.pos,uid:d.from.address.uid,proof:{fixture:'beaconsFixture',declaredEarlierVisitedPostsAndFiniteLighting:true,noNaturalEarlierTravelOrTransmissionClaim:true,declaredOneInitialReceipt:inbound,outgoingOriginalRumor:structuredClone(d.rumor),originalFrom:d.from.address,originalTo:d.to.address,originalWood:d.wood.uid}}
}
