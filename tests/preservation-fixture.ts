import {perform} from '../src/core/actions'
import {syncRegionalWeather} from '../src/core/environment'
import {updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
import {startCraft} from '../src/core/crafting'
import {startFireWork} from '../src/core/campfire'
import {tileAt} from '../src/core/ctx'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {finishBase} from './base-camp-fixture'
export function preservationFixture(method:'smoke'|'dry'='smoke'){
 const d=clinicalDiseaseFixture('actual-preservation'),{w,p,add}=d
 p.background=undefined;p.skills={};p.recipes=[];p.traits=[];w.s.storyteller.budget=-1e9
 const kit=add('Item.CampfireKit');if(!perform(w,p,{type:'place',uid:kit.uid,dir:6}).ok)throw Error('actual campfire placement')
 const pos={x:19,y:20},wood=add('Item.Wood',3)
 const fireError=startFireWork(w,p,pos,wood.uid);if(fireError)throw Error('actual wood fire: '+fireError)
 finishBase(w,p)
 const raw=add('Item.RawMeat');raw.freshness=73;raw.contaminantAsh=.5
 const recipe=method==='smoke'?'Recipe.SmokeMeat':'Recipe.DryMeat'
 if(startCraft(w,p,recipe,1))throw Error('actual food preparation')
 finishBase(w,p)
 const batch=w.s.map.batches!.at(-1)!
 tileAt(w,batch.pos).roof=true
 return{...d,kit,pos,wood,raw,batch,recipe}
}

/** The nearly finished INITIAL batch has actually spent these hours in the ordinary scheduler. */
export function preservationBoundaryFixture(remaining=2){
 const d=preservationFixture(),{w,p,wood,pos,batch}=d
 syncRegionalWeather(w,true)
 for(let i=0;i<2;i++)if(playerAct(w,{type:'fireWork',pos,uid:wood.uid}))throw Error('actual reserve fuel')
 const target=batch.processing!.total-remaining
 for(let i=0;batch.processing!.progress<target&&i<300;i++){
  const before=batch.processing!.progress
  if(playerAct(w,{type:'rest',turns:Math.min(200,target-before)}))throw Error('actual six hour wait')
  if(!p.alive||w.s.over)throw Error('original body did not survive preparation')
 }
 if(batch.processing!.progress!==target)throw Error('actual six hour boundary')
 updatePlayerVision(w,p)
 return d
}
export function preservationPausedFixture(){
 const d=preservationFixture(),{w,batch}=d;syncRegionalWeather(w,true)
 for(let i=0;batch.processing!.progress<2400&&i<100;i++)if(playerAct(w,{type:'rest',turns:Math.min(200,2400-batch.processing!.progress)}))throw Error('actual two hour wait')
 if(batch.processing!.progress!==2400)throw Error('actual original fuel exhausted')
 updatePlayerVision(w,d.p)
 return d
}
export function preservationRainFixture(){
 const d=preservationFixture('dry');tileAt(d.w,d.batch.pos).roof=false;d.w.s.wind={x:2,y:0};d.w.s.weather='ashrain';d.w.s.weatherUntil=1e12;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p);return d
}
