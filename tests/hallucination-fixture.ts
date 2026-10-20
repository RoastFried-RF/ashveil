import {Rng,seedState} from '../src/core/rng'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
export function hallucinationSeed(id=1){
 for(let i=0;i<1000;i++){const seed='private-sleep-debt-'+i,r=new Rng(seedState(seed,'body.hallucination.'+id));if(r.float()<.05)return seed}
 throw Error('실제 환청 시드 없음')
}
export function hallucinationFixture(){
 const d=clinicalDiseaseFixture(hallucinationSeed());d.p.needs.sleepDebt=24;d.p.needs.fatigue=100
 return d
}
