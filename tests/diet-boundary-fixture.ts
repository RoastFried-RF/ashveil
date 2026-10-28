import {perform} from '../src/core/actions'
import {dietStatus} from '../src/core/diet-state'
import {syncRegionalWeather} from '../src/core/environment'
import {turnOf,TURNS_PER_DAY} from '../src/core/ctx'
import {updatePlayerVision} from '../src/core/fov'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
function base(){
 const d=clinicalDiseaseFixture('actual-diet-native');d.p.needs.kcal=0
 const meal=(def:string)=>{const it=d.add(def);if(!perform(d.w,d.p,{type:'consume',uid:it.uid}).ok)throw Error('actual original meal');return it}
 return{...d,meal}
}
function align(d:ReturnType<typeof base>,at:number){
 d.s.time=at*100;for(const c of d.s.creatures)c.nextAct=d.s.time
 d.s.weather='clear';d.s.weatherUntil=1e12;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
}
export function dietThresholdFixture(){
 const d=base();d.meal('Item.Hardtack');for(let i=0;i<4;i++)d.meal('Item.Jerky')
 if(dietStatus(d.w,d.p).active)throw Error('actual initial balanced meals')
 const jerky=d.add('Item.Jerky'),bread=d.add('Item.Hardtack');align(d,turnOf(d.w));return{...d,jerky,bread}
}
export function dietExpiryFixture(){
 const d=base(),at=turnOf(d.w);d.meal('Item.Hardtack');d.s.time+=100;d.meal('Item.Jerky')
 align(d,at+3*TURNS_PER_DAY-2);return{...d,at,grainExpires:at+3*TURNS_PER_DAY,meatExpires:at+3*TURNS_PER_DAY+1}
}
