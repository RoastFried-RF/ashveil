import {boiledMealFixture} from './boiled-meal-fixture'
export const unheatedMealFixture=(ml=1000)=>boiledMealFixture(ml)

export async function unheatedMealNativeFixture(pending=false){
 const [{syncRegionalWeather},{updatePlayerVision},{playerAct}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov'),import('../src/core/game')])
 const d=unheatedMealFixture();d.s.storyteller.budget=-1e9;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 if(pending){for(const action of[{type:'wait' as const},{type:'prepareUnheatedMeal' as const,id:d.recipe}]){const error=playerAct(d.w,action);if(error)throw Error(error)}const error=playerAct(d.w,{type:'rest',turns:399},1);if(error||!d.s.simulationPending)throw Error('actual pending original boiling mixture')}
 return d
}
