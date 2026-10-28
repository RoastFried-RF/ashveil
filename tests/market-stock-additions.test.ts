import {describe,it,expect} from 'vitest'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {newGame} from '../src/core/game'
import {adoptMarketStockAdditions,economyTick} from '../src/core/economy'
import {initializeWorldSimulation} from '../src/core/world-simulation'
import {serialize,deserialize} from '../src/core/save'
import {db} from './helpers'
import {specimenFixture,buySpecimenBook} from './research-specimens-fixture'
import type {World} from '../src/core/ctx'
const books=new Set(['Item.SettlementMycologyRecords','Item.LivestockAdaptationRecords'])
function legacy(){
 const loaded=loadMods([...readPackages(),{manifest:{id:'old-stock-fixture',name:'Declared pre-addition stock',version:'1'},defs:[],patches:[{op:'remove',target:'Stock.shadefolk',path:'/initialAdditions'}]}],['old-stock-fixture']);expect(loaded.report.errors).toEqual([])
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'market-addition-conservation',background:'Bg.Hunter',overworld:true})};return w
}
describe('explicit once-only market stock additions preserve existing saved property',()=>{
 it('adds only the declared documents/marker/stock UID counter and preserves every other saved World field',()=>{
  const w=legacy(),before=JSON.parse(serialize(w.s));w.db=db;initializeWorldSimulation(w);const after=JSON.parse(serialize(w.s));let added=0,markets=0
  for(const[id,market]of Object.entries(w.s.overworld!.markets!)){
   const original=before.overworld.markets[id]
   if(market.stockDef!=='Stock.shadefolk'){expect(after.overworld.markets[id]).toEqual(original);continue}
   markets++;const newItems=market.items.filter(i=>books.has(i.def));expect(newItems.map(i=>i.def).sort()).toEqual([...books].sort());expect(newItems.every(i=>i.count===1)).toBe(true);expect(market.adoptedStockAdditions).toEqual(['Stock.shadefolk/specimen-archive-v398']);added+=newItems.length
   const oldUIDs=new Set(original.items.map((i:{uid:number})=>i.uid));expect(newItems.every(i=>!oldUIDs.has(i.uid))).toBe(true)
   after.overworld.markets[id].items=after.overworld.markets[id].items.filter((i:{def:string})=>!books.has(i.def));delete after.overworld.markets[id].adoptedStockAdditions
  }
  expect(markets).toBeGreaterThan(0);expect(w.s.overworld!.simulation!.nextItemId).toBe(before.overworld.simulation.nextItemId+added);after.overworld.simulation.nextItemId=before.overworld.simulation.nextItemId;expect(after).toEqual(before)
  const once=serialize(w.s);initializeWorldSimulation(w);expect(serialize(w.s)).toBe(once)
 })
 it('buying the original single document, restocking and full save restoration never duplicate it',()=>{
  const d=specimenFixture(),uid=d.book.uid;buySpecimenBook(d);const once=serialize(d.s);initializeWorldSimulation(d.w);expect(serialize(d.s)).toBe(once)
  economyTick(d.w,d.market.day+7);expect(d.market.items.some(i=>i.def===d.book.def)).toBe(false);expect(d.p.bag.filter(i=>i.uid===uid)).toHaveLength(1)
  const copy:World={db:d.w.db,s:deserialize(serialize(d.s))},saved=serialize(copy.s);initializeWorldSimulation(copy);expect(serialize(copy.s)).toBe(saved)
 })
 it('does not give stationary archive grants to a mobile trader using the same stock rules',()=>{
  const d=specimenFixture();d.m.markets!['mobile-fixture']={site:'mobile-fixture',stockDef:'Stock.shadefolk',mobile:true,items:[],money:10,day:d.market.day,nextRestock:d.market.nextRestock};const before=serialize(d.s);adoptMarketStockAdditions(d.w);expect(serialize(d.s)).toBe(before)
 })
})
