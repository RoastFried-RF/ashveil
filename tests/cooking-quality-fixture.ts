import {cookingFixture} from './campfire-cooking-fixture'
export async function cookingQualityNativeFixture(pending=false){
 const [{syncRegionalWeather},{updatePlayerVision},{playerAct}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov'),import('../src/core/game')])
 const d=cookingFixture(undefined,1,'actual-campfire-cooking-2');d.p.stats.per=20;const cheese=d.add('Item.Cheese'),berry=d.add('Item.AshBerry');d.s.storyteller.budget=-1e9;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 if(pending){const settle=playerAct(d.w,{type:'wait'});if(settle)throw Error(settle);const error=playerAct(d.w,{type:'cook',uid:d.raw.uid},1);if(error||!d.s.simulationPending||d.p.activity?.kind!=='cook')throw Error('actual pending original cooking quality')}
 return{...d,cheese,berry}
}
