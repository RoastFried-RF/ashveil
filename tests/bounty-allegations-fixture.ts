import {bountyContractsFixture} from './bounty-contracts-fixture'
import {bountyOffers,isBounty} from '../src/core/bounty-contracts'
import {creatureAt,terrainAt} from '../src/core/ctx'
import {findPath} from '../src/core/path'
import {cheb,dirIndex} from '../src/core/geom'
export type AllegationPhase='offer'|'accepted'|'question'|'testimony'|'report'|'completed'|'pending'
export function bountyAllegationsFixture(phase:AllegationPhase='question'){
 const d=bountyContractsFixture('bounty-false-actual-3'),source=d.s.sources!.find(s=>s.kind==='residents')!,guard=d.s.creatures.find(c=>source.members!.includes(c.id)&&d.w.db.creature(c.def).ai==='guard'&&!c.traderSite&&!c.clinicSite)!
 const walk=(target:typeof guard)=>{for(let i=0;cheb(d.p.pos,target.pos)>1&&i<150;i++){const options=[{x:target.pos.x-1,y:target.pos.y},{x:target.pos.x+1,y:target.pos.y},{x:target.pos.x,y:target.pos.y-1},{x:target.pos.x,y:target.pos.y+1}].filter(p=>terrainAt(d.w,p).passable&&!creatureAt(d.w,p)).sort((a,b)=>cheb(d.p.pos,a)-cheb(d.p.pos,b));const next=options.map(p=>findPath(d.w,d.p.pos,p,{avoidCreatures:true,selfId:d.p.id})?.[0]).find(Boolean);if(!next)throw Error('actual allegation approach unavailable');d.act({type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)})}if(cheb(d.p.pos,target.pos)>1)throw Error('actual allegation approach incomplete')}
 d.act({type:'talk',target:d.trader.id})
 const offer=bountyOffers(d.w,d.p,d.trader).find(o=>o.template==='shepherdAllegation');if(!offer)throw Error('actual ten-percent allegation publication missing')
 const proof={seed:d.s.seed,initialBank:1000,notClaimingPastIncomeOrInterregionTravel:true,source:source.id,originalActorIds:d.s.creatures.map(c=>c.id),originalRoster:[...source.members!],guard:guard.id,issuer:d.trader.id,claimedFaction:offer.claimedFaction,actualFaction:guard.faction,reward:offer.reward,actualInitialConversationTurns:1}
 const finish=()=>({...d,source,guard,walk,offer,record:d.m.contracts?.filter(isBounty).at(-1),proof:{...proof,initialRendererFx:d.s.fx.splice(0)}})
 if(phase==='offer')return finish()
 d.act({type:'bountyAccept',target:d.trader.id,offer:offer.id,expectedReward:offer.reward})
 if(phase==='accepted')return finish()
 walk(guard);if(phase==='question')return finish()
 const record=d.m.contracts!.filter(isBounty).at(-1)!
 d.act({type:'bountyQuestion',target:guard.id,contract:record.id})
 if(phase==='testimony')return finish()
 if(phase==='pending'){d.act({type:'rest',turns:20},1);return finish()}
 walk(d.trader);if(phase==='report')return finish()
 d.act({type:'bountyReport',target:d.trader.id,contract:record.id,expectedReward:record.reward});return finish()
}
