import {biteRiskTick} from '../src/core/bite-disease'
import {diseaseTick} from '../src/core/conditions'
import {syncRegionalWeather} from '../src/core/environment'
import {updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
import {turnOf,TURNS_PER_DAY} from '../src/core/ctx'
import {completeHealing} from '../src/core/recovery'
import {foamFixture} from './foam-fixture'
function align(d:ReturnType<typeof foamFixture>,at:number){
 d.s.time=at*100;for(const c of d.s.creatures)c.nextAct=d.s.time
 d.wolf.pos={x:40,y:35};d.wolf.home={...d.wolf.pos};d.wolf.asleep=true;d.wolf.deepSleep=true;d.wolf.needs.fatigue=90
 d.s.weather='clear';d.s.weatherUntil=1e12;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
}
export function foamCareBoundaryFixture(){const d=foamFixture();align(d,d.at+1150);return d}
export function foamPendingCareFixture(){
 const d=foamCareBoundaryFixture()
 if(playerAct(d.w,{type:'wait'}))throw Error('actual initial body settling')
 if(playerAct(d.w,{type:'treat',uid:d.wash.uid,woundId:d.wd.id}))throw Error('actual bite wash')
 const begin=d.s.time
 if(playerAct(d.w,{type:'cauterize',woundId:d.wd.id},300000,begin+100))throw Error('actual cautery reservation')
 if(!d.p.activity||!d.s.simulationPending)throw Error('actual pending cautery '+JSON.stringify({activity:d.p.activity,pending:d.s.simulationPending,log:d.s.log.slice(-5)}))
 return d
}
export function foamCommitBoundaryFixture(){const d=foamFixture();align(d,d.at+1199);return d}
export function foamOnsetBoundaryFixture(){
 const d=foamFixture();d.s.time=(d.at+1201)*100;biteRiskTick(d.w,d.p)
 const disease=d.p.diseases![0];if(!disease)throw Error('actual committed default bite')
 d.wd.healed=d.wd.severity;completeHealing(d.w,d.p)
 align(d,disease.incubatesUntil-2)
 const antibiotic=d.add('Item.PurificationAmpoule');return{...d,disease,antibiotic}
}
export function foamFatalBoundaryFixture(){
 const d=foamOnsetBoundaryFixture(),deadline=d.disease.incubatesUntil+7*TURNS_PER_DAY
 align(d,deadline-2);diseaseTick(d.w,d.p,false);return{...d,deadline,atBefore:turnOf(d.w)}
}
