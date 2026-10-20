import { baseFixture, finishBase } from './base-camp-fixture'
import { startClaimBase } from '../src/core/base-camp'
import { createCreature } from '../src/core/creatures'
import { loadMods } from '../src/core/defs'
import { readPackages } from '../tools/loadContent'
export function defenseFixture(chance=1){
 const d=baseFixture(),{w,p,worker}=d;startClaimBase(w,p,d.store);finishBase(w,p)
 // 짧은 사건 시간의 제어 DB다. 배포 기본의 하루/확률은 바꾸지 않는다.
 const changes={chance,firstDelayTurns:10,intervalTurns:100,planningTurns:5,timeoutTurns:1200},loaded=loadMods([...readPackages(),{manifest:{id:'test.defense',name:'방어 검사',version:'1'},defs:[],patches:Object.entries(changes).map(([key,value])=>({op:'replace' as const,target:'BaseDefense.Hearth',path:`/${key}`,value}))}]);if(loaded.report.errors.length)throw new Error(loaded.report.errors.join('\n'));w.db=loaded.db
 p.pos={x:3,y:3};worker.companion!.order='defend';worker.companion!.anchor={...d.store};worker.pos={x:3,y:5};w.s.map.waypoints!.reaverCamp={x:27,y:21}
 const party=[0,1].map((i)=>{const c=createCreature(w,'Creature.Reaver',{x:27,y:20+i*2});c.home={...c.pos};c.bag=[];c.equip={};c.age=undefined;c.traits=[];c.background=undefined;c.effects=[];c.traumas=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.asleep=false;c.unconscious=false;c.activity=undefined;c.ai.mode='guard';c.ai.path=undefined;c.ai.route=undefined;c.ai.task=undefined;c.stats={str:10,agi:10,per:10,vit:10,wil:10};c.hp=95;c.nextAct=w.s.time;Object.assign(c.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0,protein:100,vitamin:100,ash:0});w.s.creatures.push(c);return c})
 return{...d,party}
}
