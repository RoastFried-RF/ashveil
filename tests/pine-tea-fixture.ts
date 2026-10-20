import {perform} from '../src/core/actions'
import {startFireWork} from '../src/core/campfire'
import {tileAt} from '../src/core/ctx'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {finishBase} from './base-camp-fixture'
export function pineTeaFixture(ml=1000,fire=true,seed='actual-pine-tea'){
 const d=clinicalDiseaseFixture(seed),{w,p,add}=d
 p.background=undefined;p.skills={};p.traits=[];p.needs.vitamin=0;p.needs.kcal=0
 const pos={x:19,y:20}
 if(fire){const kit=add('Item.CampfireKit');if(!perform(w,p,{type:'place',uid:kit.uid,dir:6}).ok)throw Error('actual fire placement');const wood=add('Item.Wood');const error=startFireWork(w,p,pos,wood.uid);if(error)throw Error(error);finishBase(w,p)}
 const bottle=add('Item.DirtyWaterBottle');bottle.uses=ml/200;bottle.water={pathogen:.8,ash:.2,salinity:3};bottle.quality=3;bottle.durability=81
 const leaves=add('Item.PineNeedles',10),pine={x:21,y:20};tileAt(w,pine).t='Terrain.PineTree'
 return{...d,bottle,leaves,pos,pine}
}

export async function pineTeaNativeFixture(pending=false){
 const [{syncRegionalWeather},{updatePlayerVision},{playerAct}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov'),import('../src/core/game')])
 const d=pineTeaFixture();d.s.storyteller.budget=-1e9;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 if(pending){const settle=playerAct(d.w,{type:'wait'});if(settle)throw Error(settle);const error=playerAct(d.w,{type:'brewTea',uid:d.bottle.uid,leafUid:d.leaves.uid},1);if(error||!d.s.simulationPending||d.p.activity?.kind!=='brewTea')throw Error('actual pending tea')}
 return d
}
