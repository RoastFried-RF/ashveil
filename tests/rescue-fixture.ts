import { expect } from 'vitest'
import { activityStep } from '../src/core/actions'
import { faint } from '../src/core/body'
import { createCreature } from '../src/core/creatures'
import { addToBag } from '../src/core/items'
import { startPrisonerAction } from '../src/core/prisoners'
import { prisonerFixture } from './prisoner-fixture'
export function rescueFixture(){
 const data=prisonerFixture(),{w,p,rope}=data,captor=data.target,victim=createCreature(w,'Creature.SettlementGuard',{x:22,y:20})
 victim.faction='coalition';victim.pos={x:22,y:20};victim.home={x:25,y:20};victim.age=undefined;victim.traits=[];victim.background=undefined;victim.traumas=[];victim.effects=[];victim.body.wounds=[];victim.body.missing=[];victim.body.blood=victim.body.bloodMax;victim.stats={str:10,agi:10,per:10,vit:10,wil:10};victim.nextAct=w.s.time
 Object.assign(victim.needs,{kcal:1000,waterDeficit:600,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0,protein:100,vitamin:100,ash:0})
 w.s.creatures.push(victim);p.bag=p.bag.filter((i)=>i.uid!==rope.uid);delete rope.gx;delete rope.gy;addToBag(w,captor,rope);captor.ai.mode='guard'
 faint(w,victim,'충격으로')
 return{...data,captor,victim}
}
export function captureVictim(d:ReturnType<typeof rescueFixture>){expect(startPrisonerAction(d.w,d.captor,d.victim,'bind')).toBeNull();while(d.captor.activity)activityStep(d.w,d.captor)}
