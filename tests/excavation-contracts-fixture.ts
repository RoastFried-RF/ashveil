import {recoveryContractsFixture} from './recovery-contracts-fixture'
import {excavationOffers,isExcavation} from '../src/core/excavation-contracts'
import {makeItem,addToBag} from '../src/core/items'
import {runUntilInput} from '../src/core/game'
export type ExcavationPhase='inspect'|'offer'|'accepted'|'field'|'worked'|'pickup'|'deliver'|'completed'|'pending'|'partial'|'substitute'
export function excavationContractsFixture(phase:ExcavationPhase='offer'){
 const d=recoveryContractsFixture('inspect'),tool=makeItem(d.w,'Item.StoneHammer');if(addToBag(d.w,d.p,tool))throw Error('declared original excavation hammer does not fit')
 const originalActors=d.s.creatures.map(c=>c.id),originalNextId=d.s.nextId,originalItems=d.source.cont!.items.map(i=>({uid:i.uid,def:i.def,count:i.count})),initialMoney=d.p.money,initialBank=d.market.money
 const finish=()=>({...d,tool,offer:excavationOffers(d.w,d.p,d.trader)[0],record:d.m.contracts?.filter(isExcavation).at(-1),proof:{...d.proof,phase,originalActors,originalNextId,originalItems,initialMoney,initialBank,declaredInitialOwnedStoneHammer:true,initialRendererFx:d.s.fx.splice(0)}})
 if(phase==='inspect')return finish()
 d.home();const offer=excavationOffers(d.w,d.p,d.trader)[0];if(!offer)throw Error('actual observed closed original vault excavation offer missing')
 if(phase==='offer')return finish()
 d.act({type:'excavationAccept',target:d.trader.id,offer:offer.id,expectedReward:offer.reward})
 if(phase==='accepted')return finish()
 if(phase==='pending'){d.act({type:'rest',turns:20},1);return finish()}
 d.field();if(phase==='field')return finish()
 if(phase==='partial'){d.act({type:'excavationWork',contract:d.m.contracts!.filter(isExcavation).at(-1)!.id},1);runUntilInput(d.w,8);return finish()}
 d.act({type:'excavationWork',contract:d.m.contracts!.filter(isExcavation).at(-1)!.id})
 if(!d.source.cont!.opened)throw Error('actual twenty-turn original vault work incomplete')
 if(phase==='worked')return finish()
 if(phase==='substitute'){d.act({type:'lootClose'});const other=makeItem(d.w,d.book.def);if(addToBag(d.w,d.p,other))throw Error('declared initial substitute does not fit');d.home();return finish()}
 if(phase==='pickup')return finish()
 d.act({type:'lootTake',uid:d.book.uid});d.act({type:'lootClose'});d.home()
 if(phase==='deliver')return finish()
 d.act({type:'excavationDeliver',target:d.trader.id,contract:d.m.contracts!.filter(isExcavation).at(-1)!.id,expectedReward:offer.reward});return finish()
}
