import {resolveAttack} from '../src/core/combat'
import {createCreature} from '../src/core/creatures'
import {Rng,seedState} from '../src/core/rng'
import {turnOf} from '../src/core/ctx'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
export function foamSeed(lo=.05,hi=.1){
 for(let i=0;i<10000;i++){const seed='foam-physical-'+i,r=new Rng(seedState(seed,'body.disease.bite.pending.1'));const roll=r.float();if(roll>=lo&&roll<hi)return seed}
 throw Error('물림 시드 없음')
}
export function foamFixture(seed=foamSeed()){
 const d=clinicalDiseaseFixture(seed),wolf=createCreature(d.w,'Creature.AshHound',{x:21,y:20});d.s.creatures.push(wolf)
 // 실제 물림 한 번이 생길 때까지 실제 명중/회피를 판정한다.
 d.p.asleep=true
 for(let i=0;i<20&&!d.p.body.wounds.some(wd=>wd.def==='Wound.Bite');i++)resolveAttack(d.w,wolf,d.p)
 d.p.asleep=false
 const wd=d.p.body.wounds.find(wd=>wd.def==='Wound.Bite')
 if(!wd)throw Error('실제 물림 없음')
 const knife=d.add('Item.HuntingKnife'),wash=d.add('Item.Moonshine')
 return{...d,wolf,wd,knife,wash,at:turnOf(d.w)}
}
