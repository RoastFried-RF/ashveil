import {describe,it,expect}from'vitest'
import {pilgrimFieldsFixture,pilgrimHarvestFixture}from'./pilgrim-fields-fixture'
import {residentCropSupplyDecision,residentCropSupplyQuote,obtainResidentCropSupply}from'../src/core/resident-crop-supplies'
import {adoptMarketStockAdditions,economyTick}from'../src/core/economy'
import {serialize,deserialize}from'../src/core/save'
import {turnOf,tileAt,type World}from'../src/core/ctx'
import {cultivationStatus}from'../src/core/cultivation'
import {loadMods,type PatchOp}from'../src/core/defs'
import {readPackages}from'../tools/loadContent'
import {playerAct}from'../src/core/game'
import {makeItem,addToBag}from'../src/core/items'
import {residentProduceQuote,residentProduceDecision,offerResidentProduce}from'../src/core/resident-produce'
import {placementQuote}from'../src/core/placement'
import {perform}from'../src/core/actions'
import {dirIndex}from'../src/core/geom'
import {settleAshDeposits}from'../src/core/ash-deposits'
import {residentCultivationDecision}from'../src/core/resident-cultivation'

const units=(items:{def:string;count:number}[])=>items.reduce((n,i)=>n+(i.def==='Item.OatSeed'?i.count:0),0)
function policy(value:unknown,path='/seedSupply/communal'){
 const id='pilgrim-fields-policy',patches:PatchOp[]=[{op:'replace',target:'ResidentCultivation.Hearth',path,value}]
 return loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches}],[id])
}
describe('finite pilgrim seed allocation and actual original guard cultivation',()=>{
 it('plans and quotes without changing the complete world or an undefined original wallet',()=>{
  const d=pilgrimFieldsFixture(),before=serialize(d.s);expect(d.c.money).toBeUndefined();expect(units(d.market.items)).toBe(4)
  expect(residentCropSupplyDecision(d.w,d.c)?.action).toEqual({type:'residentCropSupply',target:d.trader.id})
  expect(residentCropSupplyQuote(d.w,d.c,d.trader)).toMatchObject({error:null,checked:true,price:0});expect(serialize(d.s)).toBe(before)
 })
 it('moves one actual seed from the same faction market without creating cash or duplicating the original stack',()=>{
  const d=pilgrimFieldsFixture(),original=d.market.items.find(i=>i.def==='Item.OatSeed')!,uid=original.uid,next=d.s.nextId,bank=d.market.money
  expect(obtainResidentCropSupply(d.w,d.c,d.trader)).toBeNull();expect(units(d.market.items)).toBe(3);expect(original.uid).toBe(uid)
  expect(d.c.bag.find(i=>i.def==='Item.OatSeed')).toMatchObject({uid:next,count:1});expect(d.s.nextId).toBe(next+1);expect(d.market.money).toBe(bank);expect(d.c.money).toBeUndefined()
  const before=serialize(d.s);expect(obtainResidentCropSupply(d.w,d.c,d.trader)).not.toBeNull();expect(serialize(d.s)).toBe(before)
 })
 it('original AI obtains, walks, plants and waters the same seed without a player gift',()=>{
  const d=pilgrimFieldsFixture();let seedUid:number|undefined
  for(let i=0;i<150;i++){d.act({type:'wait'});seedUid??=d.c.bag.find(i=>i.def==='Item.OatSeed')?.uid;if(d.c.residentPlot&&cultivationStatus(d.w,d.c.residentPlot.pos)!.waterMl>300)break}
  expect(d.c.residentPlot).toBeDefined();expect(d.c.residentPlot!.seedUid).toBe(seedUid);expect(d.c.home).toEqual(d.proof.originalHome)
  const depot=d.s.map.residentDepot!;expect(tileAt(d.w,depot.pos).t).toBe(depot.terrain);expect(d.c.residentPlot!.pos).not.toEqual(depot.pos)
  const crop=cultivationStatus(d.w,d.c.residentPlot!.pos)!;expect(crop.state.ownerId).toBe(d.c.id);expect(crop.waterMl).toBeGreaterThan(300);expect(units(d.market.items)).toBe(3);expect(d.c.bag.some(i=>i.def==='Item.OatSeed')).toBe(false)
 },30000)
 for(const terrain of ['Terrain.ResidentDepot','Terrain.SettlementWell'])for(const item of ['Item.OatSeed','Item.CampfireKit'])for(const actor of ['resident','player'])it(`preserves the actual public facility ${terrain} against ${actor} ${item} placement`,()=>{
  const d=pilgrimFieldsFixture(),c=actor==='resident'?d.c:d.p,pos={x:c.pos.x,y:c.pos.y+1};tileAt(d.w,pos).t=terrain;tileAt(d.w,pos).items=[];delete tileAt(d.w,pos).placed
  d.s.creatures=d.s.creatures.filter(other=>other.id===c.id||other.pos.x!==pos.x||other.pos.y!==pos.y)
  const seed=makeItem(d.w,item);expect(addToBag(d.w,c,seed)).toBe(0);settleAshDeposits(d.w);const before=serialize(d.s),dir=dirIndex(0,1)
  expect(placementQuote(d.w,c,seed.uid,dir).error).toBe('비어 있는 땅에 설치해야 한다');expect(serialize(d.s)).toBe(before)
  expect(perform(d.w,c,{type:'place',uid:seed.uid,dir}).ok).toBe(false);expect(serialize(d.s)).toBe(before)
 })
 it('inspects the familiar outdoor garden without reading its unseen current ground or contents',()=>{
  const d=pilgrimFieldsFixture();expect(obtainResidentCropSupply(d.w,d.c,d.trader)).toBeNull();const goal={goal:{x:30,y:25}}
  expect(residentCultivationDecision(d.w,d.c)).toEqual(goal);const tile=tileAt(d.w,goal.goal);tile.t='Terrain.KtWall';tile.items=[makeItem(d.w,'Item.Oats',5)]
  const before=serialize(d.s);expect(residentCultivationDecision(d.w,d.c)).toEqual(goal);expect(serialize(d.s)).toBe(before)
 })
 it('does not recreate exhausted initial seed stock on date changes, adoption or restored continuation',()=>{
  const d=pilgrimFieldsFixture();d.market.items=d.market.items.filter(i=>i.def!=='Item.OatSeed');adoptMarketStockAdditions(d.w);economyTick(d.w,30)
  const copy:World={db:d.w.db,s:deserialize(serialize(d.s))};adoptMarketStockAdditions(copy);expect(units(copy.s.overworld!.markets![d.market.site].items)).toBe(0)
 })
 it('the actual non-edible grain harvest keeps its original farmer/seed/plot provenance through save restoration',()=>{
  const d=pilgrimHarvestFixture(),seed=d.c.residentPlot!.seedUid
  for(let i=0;i<100&&!d.c.bag.some(item=>item.def==='Item.Oats');i++)d.act({type:'wait'})
  const grain=d.c.bag.find(item=>item.def==='Item.Oats')!;expect(grain).toBeDefined();expect(grain.cropHarvest).toMatchObject({owner:d.c.id,seedUid:seed,def:'Item.Oats',terrain:'Terrain.OatPlot',map:d.s.map.id,region:d.c.residentSite})
  expect(grain.cropHarvest!.at).toBeLessThanOrEqual(turnOf(d.w));expect(JSON.parse(serialize(deserialize(serialize(d.s))))).toEqual(JSON.parse(serialize(d.s)))
 },30000)
 it('records only the bounded retry when stock is absent at the actual counter',()=>{
  const d=pilgrimFieldsFixture();d.market.items=d.market.items.filter(i=>i.def!=='Item.OatSeed');const before=structuredClone(d.s)
  expect(obtainResidentCropSupply(d.w,d.c,d.trader)).not.toBeNull();const expected=structuredClone(before);expected.creatures.find(c=>c.id===d.c.id)!.residentCultivationSupplyAfter=turnOf(d.w)+1200;expect(d.s).toEqual(expected)
 })
 it('a remote plan does not inspect stock or money and does not record a remote failure',()=>{
  const d=pilgrimFieldsFixture();d.c.pos={x:40,y:20};const plan=residentCropSupplyDecision(d.w,d.c);expect(plan?.goal).toBeDefined();d.market.items=[];d.market.money=0;expect(residentCropSupplyDecision(d.w,d.c)).toEqual(plan)
  const before=serialize(d.s);expect(obtainResidentCropSupply(d.w,d.c,d.trader)).not.toBeNull();expect(serialize(d.s)).toBe(before)
 })
 it('retains the paid route and requires real money and the remaining living reserve',()=>{
  const d=pilgrimFieldsFixture(),loaded=policy(false);expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db
  expect(residentCropSupplyDecision(d.w,d.c)).toBeNull();d.c.money=100;const bank=d.market.money,q=residentCropSupplyQuote(d.w,d.c,d.trader);expect(q.error).toBeNull();expect(q.price).toBeGreaterThan(0)
  expect(obtainResidentCropSupply(d.w,d.c,d.trader)).toBeNull();expect(d.c.money).toBe(100-q.price);expect(d.market.money).toBe(bank+q.price)
 })
 for(const mode of ['otherFaction','merchant','noWater','hasSeed','sleep','noHands']as const)it('does not allocate to '+mode,()=>{
  const d=pilgrimFieldsFixture();if(mode==='otherFaction')d.c.faction='coalition';if(mode==='noWater')for(const i of d.c.bag)if(d.w.db.item(i.def).drink)i.uses=0;if(mode==='hasSeed')expect(addToBag(d.w,d.c,makeItem(d.w,'Item.OatSeed'))).toBe(0);if(mode==='sleep')d.c.asleep=true;if(mode==='noHands')d.c.body.missing.push('LeftHand','RightHand')
  const c=mode==='merchant'?d.trader:d.c,before=serialize(d.s);expect(residentCropSupplyDecision(d.w,c)).toBeNull();expect(obtainResidentCropSupply(d.w,c,d.trader)).not.toBeNull();expect(serialize(d.s)).toBe(before)
 })
 it('cannot allocate through a different faction merchant or turn unavailable cash into a seed purchase',()=>{
  const d=pilgrimFieldsFixture();d.trader.faction='coalition';const before=serialize(d.s);expect(residentCropSupplyDecision(d.w,d.c)).toBeNull();expect(obtainResidentCropSupply(d.w,d.c,d.trader)).not.toBeNull();expect(serialize(d.s)).toBe(before)
 })
 it('continues an actually allocated seed and planting with exact whole-state save equality',()=>{
  const d=pilgrimFieldsFixture();d.act({type:'wait'});const copy:World={db:d.w.db,s:deserialize(serialize(d.s))}
  for(let i=0;i<80;i++){d.act({type:'wait'});expect(playerAct(copy,{type:'wait'})).toBeNull()}expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.c.residentPlot).toBeDefined()
 },30000)
 it('sells only marked actual crop grain and preserves one raw cooking unit without counting it as edible food',()=>{
  const d=pilgrimFieldsFixture(),grain=makeItem(d.w,'Item.Oats',5)
  // Declared prior harvest for this transaction unit test; the five-day growth is not claimed here.
  grain.cropHarvest={owner:d.c.id,seedUid:123,def:grain.def,terrain:'Terrain.OatPlot',map:d.s.map.id,region:d.c.residentSite!,at:turnOf(d.w)}
  expect(addToBag(d.w,d.c,grain)).toBe(0);const bank=d.market.money,uid=grain.uid,q=residentProduceQuote(d.w,d.c,d.trader);expect(q).toMatchObject({error:null,count:2});expect(q.price).toBeGreaterThan(0)
  expect(offerResidentProduce(d.w,d.c,d.trader)).toBeNull();expect(d.c.bag.find(i=>i.uid===uid)!.count).toBe(3);expect(d.c.money).toBe(q.price);expect(d.market.money).toBe(bank-q.price)
  delete d.c.residentProduceAfter;expect(offerResidentProduce(d.w,d.c,d.trader)).toBeNull();expect(d.c.bag.find(i=>i.uid===uid)!.count).toBe(1)
  delete d.c.residentProduceAfter;const before=serialize(d.s);expect(residentProduceDecision(d.w,d.c)).toBeNull();expect(serialize(d.s)).toBe(before)
 })
 for(const mode of ['unmarked','foreign','future','unknownTerrain']as const)it('does not create grain supply provenance from '+mode,()=>{
  const d=pilgrimFieldsFixture(),grain=makeItem(d.w,'Item.Oats',5);grain.cropHarvest={owner:d.c.id,seedUid:123,def:grain.def,terrain:'Terrain.OatPlot',map:d.s.map.id,region:d.c.residentSite!,at:turnOf(d.w)}
  if(mode==='unmarked')delete grain.cropHarvest;if(mode==='foreign')grain.cropHarvest!.owner=d.p.id;if(mode==='future')grain.cropHarvest!.at++;if(mode==='unknownTerrain')grain.cropHarvest!.terrain='Terrain.Earth';expect(addToBag(d.w,d.c,grain)).toBe(0)
  const before=serialize(d.s);expect(residentProduceDecision(d.w,d.c)).toBeNull();expect(serialize(d.s)).toBe(before)
 })
 it('does not spend unavailable market cash for physical grain',()=>{
  const d=pilgrimFieldsFixture(),grain=makeItem(d.w,'Item.Oats',5);grain.cropHarvest={owner:d.c.id,seedUid:123,def:grain.def,terrain:'Terrain.OatPlot',map:d.s.map.id,region:d.c.residentSite!,at:turnOf(d.w)};expect(addToBag(d.w,d.c,grain)).toBe(0);d.market.money=0;const before=structuredClone(d.s)
  expect(offerResidentProduce(d.w,d.c,d.trader)).not.toBeNull();const expected=structuredClone(before);expected.creatures.find(c=>c.id===d.c.id)!.residentProduceAfter=turnOf(d.w)+1200;expect(d.s).toEqual(expected)
 })
 for(const value of [[],[{item:'Item.Bowl',reserveUnits:1}],[{item:'Item.Oats',reserveUnits:-1}],[{item:'Item.Oats',reserveUnits:1},{item:'Item.Oats',reserveUnits:2}]]as const)it('rejects invalid non-edible surplus '+JSON.stringify(value),()=>{expect(policy(value,'/surplus/materials').report.errors.length).toBeGreaterThan(0)})
 for(const[path,value]of [['communal',null],['roles',[]],['roles',['guard','guard']],['roles',['beast']],['factions',['unknown']],['item','Item.Bowl'],['retryTurns',0],['maxUnitPrice',0]]as const)it('rejects invalid seed supply '+path,()=>{expect(policy(value,'/seedSupply/'+path).report.errors.length).toBeGreaterThan(0)})
})
