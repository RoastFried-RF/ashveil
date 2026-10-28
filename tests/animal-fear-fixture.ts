import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {createCreature} from '../src/core/creatures'
import {makeItem,addToBag,equip} from '../src/core/items'
import {tileAt,TURNS_PER_DAY,TURNS_PER_HOUR} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function animalFearFixture(pack=false,initialTurn?:number){
 const d=conditionThoughtsFixture();if(initialTurn!==undefined){d.s.time=initialTurn*100;d.p.nextAct=d.s.time;d.p.needs.nutritionDay=Math.floor(initialTurn/TURNS_PER_DAY)}
 const torch=makeItem(d.w,'Item.Torch');if(addToBag(d.w,d.p,torch))throw Error('initial original torch');const e=equip(d.w,d.p,torch.uid,'main');if(e)throw Error(e)
 for(let y=d.p.pos.y-10;y<=d.p.pos.y+10;y++)for(let x=d.p.pos.x-10;x<=d.p.pos.x+10;x++){const tile=tileAt(d.w,{x,y});if(tile){tile.t='Terrain.Earth';tile.roof=true;tile.items=[]}}
 const wolf=createCreature(d.w,'Creature.AshHound',{x:d.p.pos.x+3,y:d.p.pos.y});wolf.home={x:d.p.pos.x+6,y:d.p.pos.y};wolf.nextAct=d.s.time;wolf.traits=[];wolf.ai.hunger=0;wolf.needs.nutritionDay=Math.floor(d.s.time/100/TURNS_PER_DAY)
 d.s.creatures.push(wolf)
 const mate=pack?createCreature(d.w,'Creature.AshHound',{x:d.p.pos.x+3,y:d.p.pos.y+1}):undefined
 if(mate){mate.home={...wolf.home};mate.nextAct=d.s.time;mate.traits=[];mate.ai.hunger=0;mate.needs.nutritionDay=Math.floor(d.s.time/100/TURNS_PER_DAY);d.s.creatures.push(mate)}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,torch,wolf,mate}
}

import {playerAct} from '../src/core/game'
export type AnimalFearPhase='retreat'|'pack'|'remember'|'wall'|'expired'|'pending'
export function animalFearNativeFixture(phase:AnimalFearPhase){
 const d=animalFearFixture(phase==='pack'||phase==='pending',phase==='expired'?4*TURNS_PER_DAY+12*TURNS_PER_HOUR:undefined),initialTime=d.s.time
 if(phase==='wall')for(let y=d.p.pos.y-4;y<=d.p.pos.y+4;y++)if(tileAt(d.w,{x:d.p.pos.x+1,y}))tileAt(d.w,{x:d.p.pos.x+1,y}).t='Terrain.KtWall'
 if(phase==='expired')d.wolf.animalFear=[{actor:d.p.id,until:d.s.time/100+1}]
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const e=playerAct(d.w,a,budget);if(e)throw Error(e)}
 act(phase==='expired'?{type:'wait'}:{type:'toggleLight',uid:d.torch.uid})
 if(phase==='remember')act({type:'toggleLight',uid:d.torch.uid})
 if(phase==='pending')act({type:'rest',turns:20},2)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,torchUid:d.torch.uid,wolfId:d.wolf.id,mateId:d.mate?.id,actualTurns:(d.s.time-initialTime)/100,pending:phase==='pending',validInitialNearExpiry:phase==='expired'}}
}
