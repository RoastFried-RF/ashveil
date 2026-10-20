import { activityStep, perform } from '../src/core/actions'
import { enlistRecruit } from '../src/core/companions'
import { createCreature } from '../src/core/creatures'
import { addToBag, makeItem } from '../src/core/items'
import { prisonerFixture } from './prisoner-fixture'
export function baseFixture(){
 const d=prisonerFixture(),{w,p}=d;w.s.creatures=[p]
 const chest=makeItem(w,'Item.StorageChest');addToBag(w,p,chest);const placed=perform(w,p,{type:'place',uid:chest.uid,dir:2});if(!placed.ok)throw new Error(placed.msg)
 const worker=createCreature(w,'Creature.SettlementGuard',{x:20,y:21});worker.faction='coalition';worker.bag=[];worker.equip={};worker.age=undefined;worker.traits=[];worker.background=undefined;worker.effects=[];worker.traumas=[];worker.body.wounds=[];worker.body.missing=[];worker.body.blood=worker.body.bloodMax;worker.asleep=false;worker.unconscious=false;worker.stats={str:10,agi:10,per:10,vit:10,wil:10};worker.nextAct=w.s.time;Object.assign(worker.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0,protein:100,vitamin:100,ash:0});w.s.creatures.push(worker);enlistRecruit(w,worker,1)
 return{...d,chest,worker,store:{x:21,y:20}}
}
export function finishBase(w:ReturnType<typeof baseFixture>['w'],c:ReturnType<typeof baseFixture>['p']){for(let i=0;c.activity&&i<10000;i++)activityStep(w,c);if(c.activity)throw new Error('작업이 끝나지 않음')}
