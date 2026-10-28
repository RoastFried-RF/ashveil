import {createCreature} from '../src/core/creatures'
import {rng,turnOf} from '../src/core/ctx'
import {hallucinationTick} from '../src/core/hallucinations'
import {syncRegionalWeather} from '../src/core/environment'
import {updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
import {Rng,seedState} from '../src/core/rng'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
function seed(){
 for(let i=0;i<1000;i++){const s='sleep-native-'+i,r=new Rng(seedState(s,'body.hallucination.1'));if(r.float()>=.05)continue;r.int(0,7);if(r.float()<.05)continue;const d=clinicalDiseaseFixture(s),body=new Rng([...rng(d.w,'body').s]);if(body.float()>=.05&&body.float()>=.05)return s}
 throw Error('actual natural private-sound seed')
}
export function hallucinationBoundaryFixture(){
 const d=clinicalDiseaseFixture(seed()),guard=createCreature(d.w,'Creature.SettlementGuard',{x:21,y:20});guard.asleep=true;guard.deepSleep=false;guard.needs.fatigue=0;guard.needs.kcal=2500;guard.needs.waterDeficit=0;d.s.creatures.push(guard)
 const boundary=(Math.floor(turnOf(d.w)/200)+1)*200;d.s.time=(boundary-2)*100;for(const c of d.s.creatures)c.nextAct=d.s.time
 d.p.needs.sleepDebt=24-.001;d.p.needs.fatigue=100
 d.s.weather='clear';d.s.weatherUntil=1e12;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 return{...d,guard,boundary}
}
export function hallucinationPendingRestFixture(){
 const d=hallucinationBoundaryFixture(),begin=d.s.time
 if(playerAct(d.w,{type:'rest',turns:200},300000,begin+100))throw Error('actual pending rest before private sound')
 if(!d.s.simulationPending||d.p.activity?.kind!=='rest')throw Error('original pending rest')
 return d
}
export function hallucinationSleepFixture(){
 const d=hallucinationBoundaryFixture();d.s.creatures=[d.p];d.s.time=d.boundary*100;d.p.nextAct=d.s.time;d.p.needs.sleepDebt=24+1/4800;d.p.needs.fatigue=0
 hallucinationTick(d.w,d.p);if(!d.p.phantomSound)throw Error('actual initial private perception')
 updatePlayerVision(d.w,d.p);return d
}
