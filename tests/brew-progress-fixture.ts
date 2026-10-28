import {pineTeaFixture} from './pine-tea-fixture'
export async function brewProgressNativeFixture(kind:'interrupted'|'changed'|'pending'='interrupted'){
 const [{syncRegionalWeather},{updatePlayerVision},{playerAct}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov'),import('../src/core/game')])
 const d=pineTeaFixture(),target=d.add('Item.WaterBottle');target.uses=0;d.s.storyteller.budget=-1e9;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 for(const action of[{type:'wait' as const}]){const error=playerAct(d.w,action);if(error)throw Error(error)}
 let error=playerAct(d.w,{type:'brewTea',uid:d.bottle.uid,leafUid:d.leaves.uid},80);if(error||!d.s.simulationPending)throw Error(error??'original80T brewing pending missing')
 error=playerAct(d.w,{type:'stopActivity'});if(error||d.p.brewJob?.remaining!==120)throw Error(error??'original80T interruption clock')
 if(kind==='changed'){error=playerAct(d.w,{type:'pourWater',uid:d.bottle.uid,targetUid:target.uid,ml:200});if(error)throw Error(error)}
 if(kind==='pending'){error=playerAct(d.w,{type:'brewTea',uid:d.bottle.uid},1);if(error||!d.s.simulationPending)throw Error(error??'actual pending original resume')}
 return{...d,target}
}
