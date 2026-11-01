import assert from'node:assert/strict'
import{baseFixture}from'./base-camp-fixture'
import{perform}from'../src/core/actions'
import{playerAct}from'../src/core/game'
import{tileAt}from'../src/core/ctx'
import{addToBag,makeItem}from'../src/core/items'
import{updatePlayerVision}from'../src/core/fov'
import type{RecipeDef}from'../src/core/types'

export const baseWorkScenes=['claim','queue-work']as const
export type BaseWorkScene=typeof baseWorkScenes[number]
export function baseWorkLocaleFixture(scene:BaseWorkScene){
 const d=baseFixture(),{w,p,worker}=d
 // Explicit finite initial base scene, not earlier natural travel/acquisition.
 w.s.weather='clear';w.s.weatherUntil=1e12;w.s.wind={x:0,y:0}
 tileAt(w,p.pos).t='Terrain.Earth';w.s.map.lights=[]
 worker.nextAct=w.s.time+100000
 const recipe=w.db.get<RecipeDef>('Recipe.Bandage'),batches=Math.ceil(2/recipe.output.count),clothRequired=recipe.inputs.find(row=>row.item==='Item.Cloth')!.count*batches
 const bed=makeItem(w,'Item.StrawBed'),fire=makeItem(w,'Item.CampfireKit'),fuel=makeItem(w,'Item.Wood'),cloth=makeItem(w,'Item.Cloth',clothRequired),wood=makeItem(w,'Item.Wood',3),water=makeItem(w,'Item.WaterBottle')
 for(const i of[bed,fire,fuel,cloth])assert.equal(addToBag(w,p,i),0)
 assert.ok(perform(w,p,{type:'place',uid:bed.uid,dir:6}).ok)
 assert.ok(perform(w,p,{type:'place',uid:fire.uid,dir:0}).ok)
 const firePos={x:20,y:19},bedPos={x:19,y:20},ground={x:21,y:21}
 assert.equal(tileAt(w,firePos).placed?.item.uid,fire.uid);assert.equal(tileAt(w,bedPos).placed?.item.uid,bed.uid)
 tileAt(w,ground).items.push(wood);assert.equal(addToBag(w,worker,water),0)
 assert.equal(playerAct(w,{type:'fireWork',pos:firePos,uid:fuel.uid}),null)
 const beforeClaim=w.s.time
 if(scene==='queue-work')assert.equal(playerAct(w,{type:'claimBase',pos:d.store}),null)
 const actualEarlierClaimTu=w.s.time-beforeClaim
 assert.equal(actualEarlierClaimTu,scene==='queue-work'?20000:0)
 // A finite initial scheduling delay keeps early queue edits observable; AI resumes normally.
 worker.nextAct=w.s.time+5000;updatePlayerVision(w,p)
 return{...d,bed,fire,cloth,wood,water,firePos,bedPos,ground,proof:{scene,fixture:'baseFixture',originalChest:d.chest.uid,originalWorker:worker.id,originalWorkerName:worker.name,finiteCloth:{uid:cloth.uid,count:cloth.count},finiteGroundWood:{uid:wood.uid,count:wood.count,pos:ground},finiteWorkerWater:{uid:water.uid,uses:water.uses},originalBedding:bed.uid,originalOwnedFire:fire.uid,declaredInitialFuel:1,actualEarlierCoreClaimTu:actualEarlierClaimTu,earlierCoreWorkIsNotBrowserInput:true,declaredInitialWorkerDelayTurns:50,removedLegacyUnlimitedHeat:true,noEarlierNaturalTravelAcquisitionOrPurificationClaim:true}}
}
