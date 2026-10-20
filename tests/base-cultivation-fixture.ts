import {baseFixture} from './base-camp-fixture'
import {tileAt,type World} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {serialize,deserialize} from '../src/core/save'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {cultivationStatus} from '../src/core/cultivation'
import type {Action} from '../src/core/actions'
export function baseCultivationFixture(nearRipe=false,storeWater=false){
 const d=baseFixture(),initial=d.w.s,pos={x:22,y:21}
 // 원래 계약/상자·개인 종자/물과 따뜻한 숲의 낮은 입력 전 초기 조건이다.
 initial.map.daylightMult=.2;d.p.pos={x:21,y:21};d.p.facing=2
 const cell=initial.map.worldCell??initial.overworld!.position;initial.overworld!.cells[cell.y*initial.overworld!.w+cell.x].temperature=20
 for(let y=17;y<=24;y++)for(let x=17;x<=27;x++)tileAt(d.w,{x,y}).roof=false
 const seed=makeItem(d.w,'Item.ShadeSeeds',3),personal=makeItem(d.w,'Item.WaterBottle'),workerBottle=makeItem(d.w,'Item.WaterBucket');workerBottle.uses=7.5;workerBottle.water={pathogen:0,ash:0,source:'원래 작업자 개인 담수'}
 if(addToBag(d.w,d.p,seed)||addToBag(d.w,d.p,personal)||addToBag(d.w,d.worker,workerBottle))throw Error('initial finite crop supplies')
 if(storeWater){d.worker.bag=d.worker.bag.filter(i=>i.uid!==workerBottle.uid);const t=tileAt(d.w,d.store);t.cont??={items:[],opened:true,kind:t.t};workerBottle.gx=0;workerBottle.gy=0;t.cont.items.push(workerBottle)}
 const w:World={db:d.w.db,s:deserialize(serialize(initial))},s=w.s,p=s.creatures.find(c=>c.id===s.playerId)!,worker=s.creatures.find(c=>c.id===d.worker.id)!,act=(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 invalidateLights(w);updatePlayerVision(w,p)
 act({type:'claimBase',pos:d.store});act({type:'place',uid:seed.uid,dir:2})
 const crop=()=>cultivationStatus(w,pos)!,bottle=()=>worker.bag.find(i=>i.uid===workerBottle.uid)??tileAt(w,d.store).cont!.items.find(i=>i.uid===workerBottle.uid)!,stock=()=>tileAt(w,d.store).cont?.items??[]
 // 남은3턴의 초기 밭은 과거 성장 이력을 주장하지 않는다. 실제 관수 전에는 자라지 않는다.
 if(nearRipe)crop().state.growth=crop().total-3
 const assign=()=>act({type:'baseAssign',target:worker.id,kind:'gather',item:'Item.ShadeRoot',batches:2})
 return{w,s,p,worker,pos,store:d.store,seedsUid:seed.uid,personalUid:personal.uid,workerWaterUid:workerBottle.uid,nearRipeIsDeclaredInitialState:nearRipe,crop,bottle,stock,act,assign}
}
export type BaseCultivationPhase='ready'|'assigned'|'delivered'|'pending'
export function baseCultivationNativeFixture(phase:BaseCultivationPhase){const d=baseCultivationFixture(true,true),at=d.s.time;if(phase!=='ready')d.assign();if(phase==='delivered'){for(let i=0;(d.w.s.map.baseCamp!.tasks[d.worker.id]?.remaining??2)>0&&i<100;i++)d.act({type:'wait'})}if(phase==='pending')d.act({type:'rest',turns:40},1);return{...d,proof:{phase,initialTime:at,elapsedTU:d.s.time-at,originalNpcId:d.worker.id,originalSeedUid:d.seedsUid,originalWorkerWaterUid:d.workerWaterUid,nearRipeIsDeclaredInitialState:true}}}
