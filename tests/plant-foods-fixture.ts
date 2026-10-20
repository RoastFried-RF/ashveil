import {calendar,climateDef,seasons} from '../src/core/climate-state'
import {tileAt,TURNS_PER_DAY} from '../src/core/ctx'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
export function plantFoodsFixture(season='Season.Summer'){
 const d=clinicalDiseaseFixture('actual-plant-foods');d.p.background=undefined;d.p.traits=[];d.p.skills={};d.p.needs.kcal=0;d.p.needs.vitamin=0
 const list=seasons(d.w),year=list.reduce((n,s)=>n+s.lengthDays,0),offset=list.slice(0,list.findIndex(s=>s.id===season)).reduce((n,s)=>n+s.lengthDays,0)
 let elapsed=offset-climateDef(d.w).startDay+1;while(elapsed<0)elapsed+=year
 d.s.time=(elapsed*TURNS_PER_DAY+12*1200)*100;d.p.nextAct=d.s.time;d.p.needs.nutritionDay=Math.floor(d.s.time/(100*TURNS_PER_DAY))
 const bush={x:21,y:20};tileAt(d.w,bush).t='Terrain.AshBerryBush'
 if(calendar(d.w).season.id!==season)throw Error('actual fixture calendar')
 return{...d,bush}
}

export async function plantFoodsNativeFixture(season='Season.Summer',pending=false){
 const[{syncRegionalWeather},{updatePlayerVision},{playerAct}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov'),import('../src/core/game')])
 const d=plantFoodsFixture(season);d.s.storyteller.budget=-1e9;d.p.facing=0;d.p.needs.waterDeficit=1000
 const water=d.add('Item.WaterBottle'),seed=d.add('Item.PotatoSeed'),raw=d.add('Item.RawPotato',2),cheese=d.add('Item.Cheese');raw.freshness=50;raw.contaminantAsh=.4
 syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 if(pending){const settle=playerAct(d.w,{type:'wait'});if(settle)throw Error(settle);const error=playerAct(d.w,{type:'gather',pos:d.bush},1);if(error||!d.s.simulationPending||d.p.activity?.kind!=='gather')throw Error('actual pending summer harvest '+JSON.stringify({error,pending:d.s.simulationPending,activity:d.p.activity,alive:d.p.alive,over:d.s.over,season:calendar(d.w).season.id,logs:d.s.log.slice(-3)}))}
 return{...d,water,seed,raw,cheese}
}
