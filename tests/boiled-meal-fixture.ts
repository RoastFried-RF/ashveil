import {pineTeaFixture} from './pine-tea-fixture'
export function boiledMealFixture(ml=1000,fire=true){
 const d=pineTeaFixture(ml,fire);d.p.bag=d.p.bag.filter(i=>i.uid!==d.leaves.uid)
 const oats=d.add('Item.Oats',3),bowl=d.add('Item.Bowl');bowl.quality=3;bowl.durability=81
 return{...d,oats,bowl,recipe:'Recipe.Oatmeal'}
}

export async function boiledMealNativeFixture(pending=false,water=1000){
 const [{syncRegionalWeather},{updatePlayerVision},{playerAct}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov'),import('../src/core/game')])
 const d=boiledMealFixture(water);d.s.storyteller.budget=-1e9;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 if(pending){const settled=playerAct(d.w,{type:'wait'});if(settled)throw Error(settled);const error=playerAct(d.w,{type:'craft',id:d.recipe},1);if(error||!d.s.simulationPending||d.p.activity?.kind!=='craft')throw Error('original actual pending meal')}
 return d
}
