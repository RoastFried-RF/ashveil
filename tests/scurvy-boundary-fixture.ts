import {perform} from '../src/core/actions'
import {syncRegionalWeather} from '../src/core/environment'
import {updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
import {metabolismTick} from '../src/core/nutrition'
import {turnOf,TURNS_PER_DAY} from '../src/core/ctx'
import {thermalState} from '../src/core/thermal'
import {scurvyFixture} from './scurvy-fixture'
function align(d:ReturnType<typeof scurvyFixture>,at:number){
 d.s.time=at*100;for(const c of d.s.creatures)c.nextAct=d.s.time
 d.s.weather='clear';d.s.weatherUntil=1e12;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
}
export function scurvyBoundaryFixture(){
 const d=scurvyFixture();d.p.needs.scurvy=35;d.p.needs.vitamin=0;d.p.needs.nutritionDay=0
 const apple=d.add('Item.DriedApple');align(d,TURNS_PER_DAY-2);return{...d,apple,boundary:TURNS_PER_DAY}
}
function progressed(stage:number){
 const d=scurvyBoundaryFixture()
 if(playerAct(d.w,{type:'wait'})||playerAct(d.w,{type:'wait'}))throw Error('actual scar reopening boundary')
 if(d.p.body.wounds.length!==3)throw Error('all original scars')
 // Independent INITIAL progresses only the actual nutritional clock, not an entire past world.
 while(d.p.needs.scurvy<stage){d.s.time=(Math.floor(turnOf(d.w)/TURNS_PER_DAY)+1)*TURNS_PER_DAY*100;metabolismTick(d.w,d.p,thermalState(d.w,d.p),false)}
 return d
}
export function scurvyRecoveryFixture(){
 const d=progressed(60),healed=d.p.body.wounds.map(wd=>({id:wd.id,healed:wd.healed})),boundary=(Math.floor(turnOf(d.w)/TURNS_PER_DAY)+1)*TURNS_PER_DAY
 align(d,boundary-2);return{...d,healed,boundary}
}
export function scurvyAdvancedFixture(){
 const d=progressed(80);align(d,turnOf(d.w)+123);return d
}
export function scurvyOriginalAppleRecoveryFixture(){
 const d=scurvyRecoveryFixture()
 if(!perform(d.w,d.p,{type:'consume',uid:d.apple.uid}).ok)throw Error('original actual vitamin apple')
 return d
}
