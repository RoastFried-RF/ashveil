import {pineTeaFixture} from './pine-tea-fixture'
import {readPackages} from '../tools/loadContent'
import {loadMods} from '../src/core/defs'
export function cookingFixture(chance?:number,count=1,seed='actual-campfire-cooking-0'){
 const d=pineTeaFixture(1000,true,seed);d.p.bag=d.p.bag.filter(i=>i.uid!==d.leaves.uid&&i.uid!==d.bottle.uid)
 if(chance!==undefined){const id='actual.cooking.burn';const loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'FoodSafety.Human',path:'/cooking/burnChance',value:chance}]}],[id]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));d.w.db=loaded.db}
 const raw=d.add('Item.RawPotato',count);raw.quality=2;raw.durability=81;raw.freshness=73;raw.contaminantAsh=.4
 return{...d,raw}
}

export async function cookingNativeFixture(pending=false){
 const [{syncRegionalWeather},{updatePlayerVision},{playerAct}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov'),import('../src/core/game')])
 const d=cookingFixture(undefined,1,'actual-campfire-cooking-2');d.s.storyteller.budget=-1e9;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 if(pending){for(const action of[{type:'wait' as const},{type:'stageCooking' as const,uid:d.raw.uid,pos:d.pos}]){const error=playerAct(d.w,action);if(error)throw Error(error)}const error=playerAct(d.w,{type:'rest',turns:199},1);if(error||!d.s.simulationPending)throw Error('actual pending original cooking rest')}
 return d
}
