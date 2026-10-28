import {pineTeaFixture} from './pine-tea-fixture'
export function boilProgressFixture(){const d=pineTeaFixture(),wood=d.add('Item.Wood',3);return{...d,wood}}

export async function boilProgressNativeFixture(kind:'interrupted'|'changed'|'pending'='interrupted'){
 const [{syncRegionalWeather},{updatePlayerVision},{playerAct}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov'),import('../src/core/game')])
 const d=boilProgressFixture(),target=d.add('Item.WaterBottle');target.uses=0;d.s.storyteller.budget=-1e9;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 let error=playerAct(d.w,{type:'wait'});if(error)throw Error(error)
 error=playerAct(d.w,{type:'waterTreatment',uid:d.bottle.uid,method:'boil'},80);if(error||!d.s.simulationPending)throw Error(error??'actual boiling80T pending')
 error=playerAct(d.w,{type:'stopActivity'});if(error||d.p.boilJob?.remaining!==120)throw Error(error??'actual boiling80T interruption')
 if(kind==='changed'){error=playerAct(d.w,{type:'pourWater',uid:d.bottle.uid,targetUid:target.uid,ml:200});if(error)throw Error(error)}
 if(kind==='pending'){error=playerAct(d.w,{type:'waterTreatment',uid:d.bottle.uid,method:'boil'},1);if(error||!d.s.simulationPending)throw Error(error??'actual pending boiling120T resume')}
 return{...d,target}
}
