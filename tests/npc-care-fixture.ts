import {bountyContractsFixture} from './bounty-contracts-fixture'
import {addWound} from '../src/core/body'
import {npcCareQuote} from '../src/core/npc-care'
import {creatureAt,terrainAt} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {itemDef} from '../src/core/items'
export function npcCareFixture(phase:'ready'|'started'|'done'|'pending'='ready',hidden=false){
 const d=bountyContractsFixture('npc-care-actual'),a=d.s.creatures.find(c=>c.clinicSite)!,b=d.s.creatures.find(c=>c.def==='Creature.SettlementGuard')!
 if(!a||!b)throw Error('original settlement healer and neighbor missing')
 const pos=[{x:a.pos.x-1,y:a.pos.y},{x:a.pos.x+1,y:a.pos.y},{x:a.pos.x,y:a.pos.y+1},{x:a.pos.x,y:a.pos.y-1}].find(p=>terrainAt(d.w,p).passable&&!creatureAt(d.w,p));if(!pos)throw Error('actual empty position next to original doctor unavailable')
 b.pos={...pos};b.home={...pos};a.home={...a.pos}
 for(const c of[a,b]){c.asleep=false;c.unconscious=false;c.needs.kcal=1000;c.needs.waterDeficit=0;c.needs.fatigue=10;c.needs.bodyTemp=37;c.needs.hygiene=100;c.needs.stress=0;c.ai.mode='guard';c.ai.target=undefined;c.activity=undefined;c.traits=['Trait.Pious']}
 a.nextAct=d.s.time;b.nextAct=d.s.time+100;d.p.pos={x:a.pos.x-1,y:a.pos.y+2};d.p.nextAct=d.s.time;invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 d.act({type:'wait'});if(!a.npcTies?.[b.id]||!b.npcTies?.[a.id])throw Error('original neighbors did not actually converse first')
 // 별도로 선언한 초기 외부 상처다. 보이지 않은 전투/여행을 실행했다고 주장하지 않는다.
 const wound=addWound(d.w,b,{def:'Wound.Cut',part:'LeftForearm',severity:3,source:'돌봄 검증의 초기 상처',contam:0}).wound
 if(hidden){d.p.pos={x:12,y:30};updatePlayerVision(d.w,d.p)}
 const quote=npcCareQuote(d.w,a,b);if(quote.error)throw Error(quote.error)
 const material=a.bag.find(i=>i.uid===quote.activity!.uid)!,initialMaterialUses=material.uses,initialMaterialCount=material.count,initialNpcMoney=a.money,initialBank=d.market.money,originalActors=d.s.creatures.map(c=>c.id),originalNextId=d.s.nextId,initialBleed=d.w.db.wound(wound.def).bleedPerSeverity,initialMaterialDef=itemDef(d.w,material).label
 const finish=()=>({...d,a,b,wound,material,quote,proof:{phase,hidden,declaredInitialNeighborPositionsHomesNeedsTraitsAndWound:true,actualFirstHandGreetingTurns:1,noClaimOfEarlierBattleOrNaturalCareFrequency:true,initialMaterialUses,initialMaterialCount,initialNpcMoney,initialBank,originalActors,originalNextId,initialBleed,initialMaterialDef,initialRendererFx:d.s.fx.splice(0)}})
 if(phase==='ready')return finish()
 d.act({type:'wait'});if(!a.activity?.npcCare)throw Error('original healer did not choose own actual care turn')
 if(phase==='started')return finish()
 if(phase==='pending'){d.act({type:'rest',turns:20},1);return finish()}
 for(let n=0;a.activity&&n<30;n++)d.act({type:'wait'})
 if(!wound.bandage||!b.npcCareHistory?.length)throw Error('original healer actual bandage work incomplete')
 return finish()
}
