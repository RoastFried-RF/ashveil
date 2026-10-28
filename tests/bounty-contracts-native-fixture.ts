import {bountyContractsFixture} from './bounty-contracts-fixture'
import {bountyOffers,bountyReportQuote,surveyBounty} from '../src/core/bounty-contracts'
import {killCreature} from '../src/core/combat'
import {creatureAt,terrainAt,turnOf} from '../src/core/ctx'
import {dirIndex} from '../src/core/geom'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {Action} from '../src/core/actions'
export type BountyNativePhase='offer'|'accepted'|'field'|'report'|'corpse'|'otherReport'|'hidden'|'pending'
export function bountyContractsNativeFixture(phase:BountyNativePhase){
  const d=bountyContractsFixture(),scene=d.m.scenes['Region.GreyCloister'],source=scene.sources.find(s=>s.id==='reaverCamp')!,originalRoster=[...source.members!],target=scene.creatures.find(c=>originalRoster.includes(c.id)&&c.def==='Creature.ReaverChief')??scene.creatures.find(c=>c.id===originalRoster[0])!
  // 원래 생성된 몸 하나를 대상으로 한 명시적인 초기 명단/체력이다. 기본 여섯 명은 별도 검사한다.
  source.members=[target.id];source.count=1;target.hp=1;target.asleep=true;target.ai.morale=100
  const offer=bountyOffers(d.w,d.p,d.trader)[0];if(!offer)throw Error('actual prepared bounty offer missing')
  const beforeMoney=d.p.money??0,marketBefore=d.market.money,preparedAt=turnOf(d.w),moves:Action[]=[],initialIds=[...d.s.creatures,...scene.creatures].map(c=>c.id)
  const proof={phase,originalDefaultRoster:originalRoster,declaredInitialTargetRoster:[target.id],targetId:target.id,targetDef:target.def,declaredInitialHp:1,declaredInitialMarketMoney:1000,notClaimingPastIncomeWoundsOrInterregionTravel:true,preparedAt,initialIds,playerMoneyBefore:beforeMoney,marketBefore,reward:offer.reward}
  const finish=()=>({...d,offer,target,proof:{...proof,initialRendererFx:d.s.fx.splice(0)},moves})
  if(phase==='offer')return finish()
  d.act({type:'bountyAccept',target:d.trader.id,offer:offer.id,expectedReward:offer.reward})
  if(phase==='accepted')return finish()
  if(phase==='pending'){d.act({type:'rest',turns:20},1);return finish()}
  d.field();target.nextAct=d.s.time
  const position=[{x:target.pos.x-1,y:target.pos.y},{x:target.pos.x+1,y:target.pos.y},{x:target.pos.x,y:target.pos.y-1},{x:target.pos.x,y:target.pos.y+1}].find(pos=>terrainAt(d.w,pos).passable&&!creatureAt(d.w,pos))
  if(!position)throw Error('actual original target has no neighboring standing tile')
  d.p.pos=position;invalidateLights(d.w);updatePlayerVision(d.w,d.p)
  if(phase==='report'){
    for(let i=0;target.alive&&i<40;i++){const action:Action={type:'move',dir:dirIndex(Math.sign(target.pos.x-d.p.pos.x),Math.sign(target.pos.y-d.p.pos.y))};d.act(action);moves.push(action)}
    if(target.alive)throw Error('actual original bounty target survived prepared combat')
    d.home();const quote=bountyReportQuote(d.w,d.p,d.trader,d.m.contracts!.at(-1)!.id);if(quote.error)throw Error(quote.error)
  }else if(phase==='corpse'||phase==='otherReport'||phase==='hidden'){
    if(phase==='hidden'){d.p.pos={...d.s.map.exits[0]};updatePlayerVision(d.w,d.p)}
    target.hp=0;killCreature(d.w,target,'선언한 초기 시신',phase==='hidden'?{killerId:d.p.id}:{})
    if(phase==='otherReport'){const id=d.m.contracts!.at(-1)!.id,error=surveyBounty(d.w,d.p,id);if(error)throw Error(error);d.home()}
  }
  return finish()
}
