import {cropEvaporationFixture} from './crop-evaporation-fixture'
import {playerAct} from '../src/core/game'
import type {Action} from '../src/core/actions'
import {cultivationStatus} from '../src/core/cultivation'
import {player,turnOf,type World} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export type ContaminationPhase='dry'|'watered'|'nearRipe'|'pending'
export function cropContaminationFixture(phase:ContaminationPhase='dry'){
 const d=cropEvaporationFixture('dry'),clean=makeItem(d.w,'Item.ShadeRoot',2)
 if(addToBag(d.w,d.p,clean))throw Error('declared initial clean roots do not fit')
 d.bottle().water={pathogen:60,ash:20,source:'초기 관수용 오염수'}
 if(phase!=='dry')d.act({type:'waterCrop',pos:d.pos,uid:d.waterUid,ml:1000})
 if(phase==='nearRipe'){d.crop().state.growth=d.crop().total-3;d.crop().state.waterUnits=3072;d.crop().state.lastAt=turnOf(d.w)}
 if(phase==='pending')d.act({type:'rest',turns:20},1)
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=player(w)
 invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,pos:d.pos,seedsUid:d.seedsUid,waterUid:d.waterUid,cleanUid:clean.uid,act:(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},crop:()=>cultivationStatus(w,d.pos)!,proof:{...d.proof,contaminationPhase:phase,declaredInitialContaminatedWater:{pathogen:60,ash:20,ml:1000},declaredInitialCleanRoots:2,cleanUid:clean.uid,noClaimOfActualEarlierCropGrowth:phase==='nearRipe',initialRendererFx:s.fx.splice(0)}}
}
