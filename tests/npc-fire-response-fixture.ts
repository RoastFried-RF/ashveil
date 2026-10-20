import {fireAvoidanceFixture} from './fire-avoidance-fixture'
import {makeItem,addToBag} from '../src/core/items'
import {tileAt} from '../src/core/ctx'
import {updatePlayerVision} from '../src/core/fov'
export function npcFireResponseFixture(ml=1000){
 const d=fireAvoidanceFixture(),bottle=makeItem(d.w,'Item.WaterBottle');bottle.uses=ml/200
 if(addToBag(d.w,d.npc,bottle))throw Error('원래 NPC 물병')
 return{...d,npcBottle:bottle,initialNpcWaterMl:ml}
}
export type NpcFireResponsePhase='before'|'quenched'|'pending'
export function npcFireResponseNativeFixture(phase:NpcFireResponsePhase){
 const d=npcFireResponseFixture(),initialTime=d.s.time,initialPlayerWaterMl=1000
 d.ignite();for(let i=0;i<139;i++)d.act({type:'wait'})
 if(d.tree.terrainFire)throw Error('기본 불씨 시작 전')
 if(phase!=='before'){d.act({type:'wait'});d.act({type:'wait'})}
 if(phase==='pending')d.act({type:'rest',turns:20},2)
 updatePlayerVision(d.w,d.p)
 const fire=tileAt(d.w,d.treePos).terrainFire
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,npcId:d.npc.id,npcBottleUid:d.npcBottle.uid,playerBottleUid:d.bottle.uid,initialNpcPos:d.initialNpcPos,initialNpcWaterMl:d.initialNpcWaterMl,initialPlayerWaterMl,fireId:fire?.id,partialMaterial:d.tree.combustionRemaining,defaultSparkChance:.02,pending:phase==='pending'}}
}
