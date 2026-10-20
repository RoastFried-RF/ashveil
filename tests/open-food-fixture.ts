import {playerAct} from '../src/core/game'
import {syncRegionalWeather} from '../src/core/environment'
import {updatePlayerVision} from '../src/core/fov'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
export function openFoodFixture(tool=true){
 const d=clinicalDiseaseFixture('actual-open-food-native'),can=d.add('Item.CannedMeat'),knife=tool?d.add('Item.HuntingKnife'):undefined
 d.p.background=undefined;d.p.traits=[];d.p.skills={};d.p.needs.kcal=0;d.p.needs.vitamin=0;d.p.needs.waterDeficit=400;d.s.storyteller.budget=-1e9
 syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p);return{...d,can,knife}
}
export function openFoodPendingMealFixture(){
 const d=openFoodFixture()
 const error=playerAct(d.w,{type:'consume',uid:d.can.uid},1)
 if(error||!d.s.simulationPending||d.p.activity?.kind!=='openFood'||d.p.activity.remaining!==1)throw Error('original real pending can opening')
 return d
}
