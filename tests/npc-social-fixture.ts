import {bountyContractsFixture} from './bounty-contracts-fixture'
import {updatePlayerVision,invalidateLights} from '../src/core/fov'
import {npcConversationQuote} from '../src/core/npc-social'
import {creatureAt,terrainAt} from '../src/core/ctx'
export function npcSocialFixture(hidden=false,clash=false){
 const d=bountyContractsFixture('npc-social-actual'),a=d.trader,b=d.s.creatures.find(c=>c!==a&&c.id!==d.p.id&&c.def==='Creature.CoalitionGuard')??d.s.creatures.find(c=>c!==a&&c.id!==d.p.id&&!c.clinicSite)!
 const positions=[{x:a.pos.x+1,y:a.pos.y},{x:a.pos.x-1,y:a.pos.y},{x:a.pos.x,y:a.pos.y+1},{x:a.pos.x,y:a.pos.y-1}],pos=positions.find(p=>terrainAt(d.w,p).passable&&!creatureAt(d.w,p));if(!pos)throw Error('actual empty neighbor of original merchant unavailable')
 b.pos={...pos};b.home={...pos};a.home={...a.pos}
 for(const c of[a,b]){c.asleep=false;c.unconscious=false;c.needs.kcal=1000;c.needs.waterDeficit=0;c.needs.fatigue=10;c.needs.bodyTemp=37;c.needs.hygiene=100;c.ai.mode='guard';c.ai.target=undefined;c.activity=undefined;c.traits=clash?(c===a?['Trait.ColdBlooded']:['Trait.TenderHearted']):['Trait.Pious']}
 a.nextAct=d.s.time;b.nextAct=d.s.time+100
 d.p.pos=hidden?{x:12,y:30}:{x:a.pos.x-1,y:a.pos.y+2};d.p.nextAct=d.s.time;invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const q=npcConversationQuote(d.w,a,b);if(q.error)throw Error(q.error)
 return{...d,a,b,proof:{declaredInitialNearbyParticipantsAndHomes:true,declaredInitialNeedsAndTraits:true,noClaimOfPastWalkFriendshipOrNaturalConversationFrequency:true,initialPlayerObserverPos:{...d.p.pos},originalActors:d.s.creatures.map(c=>c.id),initialRng:structuredClone(d.s.rng),initialNextId:d.s.nextId,initialRendererFx:d.s.fx.splice(0)}}
}
