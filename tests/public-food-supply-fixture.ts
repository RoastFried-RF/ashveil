import {settlementSupplyNativeFixture} from './settlement-supply-fixture'

/** 원래 생성된 달걀6개/시장UID를 남긴 유한 부족 장면. 시작 현금만 명시한다. */
export function publicFoodSupplyNativeFixture(){
 const d=settlementSupplyNativeFixture(),keeper=d.s.creatures.find(c=>c.traderSite===d.stock.site)!,egg=d.market.items.find(i=>i.def==='Item.Egg')!
 d.p.money=1000
 if(!keeper||!egg||egg.count!==6)throw Error('actual finite trader or eggs missing')
 return{...d,keeper,egg,proof:{...d.proof,declaredPlayerMoney:1000,originalEgg:{uid:egg.uid,count:egg.count},speakerId:keeper.id,source:d.proof.source+' Playerinitialcash1000 declared; originalgeneratedEgg6 kept, no Foodconversion or eggproduction added.'}}
}
