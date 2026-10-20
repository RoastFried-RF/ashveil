import {terrainFireFixture} from './terrain-fire-fixture'
import {createCreature} from '../src/core/creatures'
import {hpMax} from '../src/core/body'
import {cheb} from '../src/core/geom'
import {updatePlayerVision} from '../src/core/fov'
import {tileAt} from '../src/core/ctx'
export function fireAvoidanceFixture(def='Creature.Settler'){
 const d=terrainFireFixture(null,'terrain-fire-proof-1'),npc=createCreature(d.w,def,{x:d.treePos.x+1,y:d.treePos.y-1})
 npc.home={...npc.pos};npc.nextAct=d.s.time;npc.traits=[];npc.background=undefined;npc.age=undefined;npc.bag=[];npc.equip={};npc.body.wounds=[];npc.body.missing=[];npc.body.blood=npc.body.bloodMax;npc.effects=[];npc.traumas=[];npc.asleep=false;npc.unconscious=false;npc.faction='player';npc.stats={str:10,agi:10,vit:10,per:10,wil:10};npc.hp=hpMax(d.w,npc)
 Object.assign(npc.needs,{kcal:1000,waterDeficit:0,fatigue:20,sleepDebt:0,stress:0,bodyTemp:37,wetness:0,hygiene:100,vitamin:100,protein:100})
 d.s.creatures.push(npc)
 return{...d,npc,initialNpcPos:{...npc.pos}}
}
export type FireAvoidancePhase='before'|'escaped'|'pending'
export function fireAvoidanceNativeFixture(phase:FireAvoidancePhase){
 const d=fireAvoidanceFixture(),initialTime=d.s.time
 d.ignite();for(let i=0;i<139;i++)d.act({type:'wait'})
 if(d.tree.terrainFire)throw Error('기본 초기 불씨 시점이 달라졌다')
 if(phase!=='before')for(let i=0;i<10&&(!d.tree.terrainFire||cheb(d.npc.pos,d.treePos)<=1);i++)d.act({type:'wait'})
 if(phase!=='before'&&cheb(d.npc.pos,d.treePos)<=1)throw Error('실제 NPC가 불에서 걸어 나가지 않았다')
 if(phase==='pending')d.act({type:'rest',turns:20},2)
 updatePlayerVision(d.w,d.p)
 const fire=tileAt(d.w,d.treePos).terrainFire
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,npcId:d.npc.id,initialNpcPos:d.initialNpcPos,firstFireId:fire?.id,firstFireAt:fire?.startedAt,defaultSparkChance:.02,pending:phase==='pending'}}
}
