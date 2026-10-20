import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {createCreature} from '../src/core/creatures'
import {addToBag,equip,makeItem} from '../src/core/items'
import {addWound,hpMax} from '../src/core/body'
import {tileAt,turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {previewHit} from '../src/core/combat'
import {playerAct} from '../src/core/game'
import {serialize,deserialize} from '../src/core/save'
export function victoryMemoryFixture(weak=false,legacy=false){
 const d=conditionThoughtsFixture(),enemy=createCreature(d.w,'Creature.Reaver',{x:d.p.pos.x+1,y:d.p.pos.y})
 d.p.stats={str:10,agi:20,per:20,vit:10,wil:10};d.p.hp=hpMax(d.w,d.p)
 const knife=makeItem(d.w,'Item.RustyKnife');if(addToBag(d.w,d.p,knife))throw Error('original player knife');const e=equip(d.w,d.p,knife.uid,'main');if(e)throw Error(e)
 enemy.age=undefined;enemy.traits=[];enemy.traumas=[];enemy.effects=[];enemy.hp=hpMax(d.w,enemy);enemy.nextAct=1e12;enemy.needs.stress=0
 // 초기 노출 부상이다. 원래 갑옷/약한 장면의 무기는 같은UID로 바닥에 둔다.
 for(const slot of weak?['chest','main']as const:['chest']as const){const it=enemy.equip[slot];if(it){tileAt(d.w,enemy.pos).items.push(it);delete enemy.equip[slot]}}
 const wound=addWound(d.w,enemy,{def:'Wound.Cut',part:'RightForearm',severity:5,artery:1,source:legacy?'이전 각인의 실제 플레이어 상처':'초기 실제 동맥 부상',...(legacy?{sourceId:d.p.id}:{})}).wound
 enemy.body.blood=enemy.body.bloodMax*(legacy ? .501 : .503);d.s.creatures.push(enemy)
 const fire={x:d.p.pos.x,y:d.p.pos.y+2};tileAt(d.w,fire).t='Terrain.Campfire';d.s.map.lights=[{pos:fire,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}]
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,enemy,knife,wound}
}
export type VictoryMemoryPhase='victory'|'weak'|'preview'|'legacy'|'observed'|'pending'
export function victoryMemoryNativeFixture(phase:VictoryMemoryPhase){
 const d=victoryMemoryFixture(phase==='weak',phase==='legacy'),initialTime=d.s.time
 if(phase==='observed'||phase==='pending')d.enemy.body.blood=d.enemy.body.bloodMax*.54
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const e=playerAct(d.w,a,budget);if(e)throw Error(e)}
 let migrationOnly:boolean|undefined
 if(phase==='legacy'){const old=JSON.parse(serialize(d.s));old.version=103;const restored=deserialize(JSON.stringify(old));migrationOnly=JSON.stringify({...restored,version:103})===JSON.stringify(old);d.w.s=restored;const enemy=restored.creatures.find(c=>c.id===d.enemy.id)!;while(enemy.alive)act({type:'wait'});updatePlayerVision(d.w,restored.creatures.find(c=>c.id===restored.playerId)!);return {...d,s:restored,p:restored.creatures.find(c=>c.id===restored.playerId)!,enemy,proof:{phase,initialTime,actualTurns:(restored.time-initialTime)/100,enemyId:enemy.id,knifeUid:d.knife.uid,ownActualWounds:enemy.body.wounds.filter(w=>w.sourceId===restored.playerId).length,migrationOnly,pending:false}}}
 if(phase==='preview'){previewHit(d.w,d.p,d.enemy);act({type:'wait'})}
 else{
  act({type:'attack',target:d.enemy.id})
  if(!d.enemy.playerEngagement)throw Error('actual visible physical engagement missing')
  if(phase==='pending')act({type:'rest',turns:20},2)
  else if(phase!=='observed'){for(let i=0;d.enemy.alive&&i<12;i++)act({type:'wait'});if(d.enemy.alive)throw Error('actual arterial death not reached')}
 }
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,enemyId:d.enemy.id,knifeUid:d.knife.uid,ownActualWounds:d.enemy.body.wounds.filter(w=>w.sourceId===d.p.id).length,migrationOnly,pending:phase==='pending'}}
}
