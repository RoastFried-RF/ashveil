import {describe,expect,it} from 'vitest'
import {newGame,SAVE_VERSION} from '../src/core/game'
import {player,tileAt,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {bodyDef} from '../src/core/body'
import {makeMarketItem} from '../src/core/economy'
import {localSettlementSupply} from '../src/core/settlement-supply'
import {worldSimulationTick,initializeWorldSimulation,settlementCommodity} from '../src/core/world-simulation'
import {serialize,deserialize} from '../src/core/save'
import {db} from './helpers'

const template=newGame(db,{seed:'actual-settlement-supply',overworld:true})
function setup(){
 const w:World={db,s:structuredClone(template)},m=w.s.overworld!,site=m.sites.find(s=>s.id==='Region.ShepherdDale')!,sim=m.simulation!,stock=sim.settlements[site.id]!,market=m.markets![site.id]!,p=player(w)
 // 유한한 현재 장면이며 과거의 식사나 부족 이력을 주장하지 않는다.
 stock.production={};stock.reserve.Food=0;stock.residentConsumption=undefined;stock.consumptionCarry={};market.items=[];market.nextRestock=1e12
 return{w,m,site,sim,stock,market,p}
}
function at(w:World,day:number){w.s.time=day*TURNS_PER_DAY*100;worldSimulationTick(w)}
function depot(d:ReturnType<typeof setup>){
 const {w,m,site,p}=d,terrain=db.get<import('../src/core/types').ResidentProvisionDef>('ResidentProvision.Hearth').terrain,pos={x:20,y:19}
 m.currentRegion=site.id;w.s.map.residentDepot={site:site.id,terrain,pos};tileAt(w,pos).t=terrain;p.pos={x:20,y:20};p.alive=true;p.asleep=false;p.unconscious=false
 return pos
}
describe('정착지 실제 완료일 수급 장부',()=>{
 it('창고1.25와원래건빵3개0.42만공급하고180요청의178.33부족을기록한다',()=>{
  const d=setup(),{w,stock,market}=d;stock.reserve.Food=1.25;const item=makeMarketItem(w,'Item.Hardtack',3);market.items=[item];const localId=w.s.nextId,population=structuredClone(stock.population)
  at(w,1);expect(stock.lastSupply).toMatchObject({day:0,population:180,commodities:{Food:{produced:0,requested:180,supplied:1.67,unmet:178.33,residentUsed:0}}});expect(settlementCommodity(w,stock,'Food')).toBe(0);expect(market.items.some(i=>i.uid===item.uid)).toBe(false);expect(market.items.some(i=>db.item(i.def).food)).toBe(false);expect(stock.population).toEqual(population);expect(w.s.nextId).toBe(localId)
 })
 it('상점한물품의초과소비는원래공동창고잔량으로돌려보내며공급량을부풀리지않는다',()=>{
  const{w,stock,market}=setup();stock.reserve.Food=179.95;market.items=[makeMarketItem(w,'Item.Hardtack',1)];at(w,1)
  expect(stock.lastSupply!.commodities.Food).toEqual({produced:0,requested:180,supplied:180,unmet:0,residentUsed:0});expect(stock.reserve.Food).toBe(.09);expect(market.items.some(i=>i.def==='Item.Hardtack')).toBe(false);expect(market.items.some(i=>db.item(i.def).food)).toBe(false)
 })
 it('빈창고와없는시장은부족분을기록하고새물품·현금·추가사망을만들지않는다',()=>{
  const{w,m,stock,site}=setup();delete m.markets![site.id];const before=structuredClone(stock.population),money=player(w).money,uid=w.s.nextId;at(w,1)
  expect(stock.lastSupply!.commodities.Food).toMatchObject({requested:180,supplied:0,unmet:180});expect(stock.population).toEqual(before);expect(player(w).money).toBe(money);expect(w.s.nextId).toBe(uid)
 })
 it('계절완료일의실제생산을기록하고미리겨울계수로소급하지않는다',()=>{
  const{w,stock}=setup();stock.production.Food=160;at(w,1);expect(stock.lastSupply!.commodities.Food).toEqual({produced:368,requested:180,supplied:180,unmet:0,residentUsed:0});expect(stock.reserve.Food).toBe(188)
  at(w,12);expect(stock.lastSupply!.day).toBe(11);expect(stock.lastSupply!.commodities.Food!.produced).toBe(32)
 })
 it('소수이월과주민직접소비0.56은기존179공동요청과별도로한번만기록한다',()=>{
  const{w,stock}=setup();stock.reserve.Food=1000;stock.residentConsumption={day:0,units:{Food:.56}};at(w,1)
  expect(stock.lastSupply!.commodities.Food).toEqual({produced:0,requested:179,supplied:179,unmet:0,residentUsed:.56});expect(stock.consumptionCarry.Food).toBe(.44);expect(stock.reserve.Food).toBe(821);expect(stock.residentConsumption).toBeUndefined()
  at(w,2);expect(stock.lastSupply!.commodities.Food!.residentUsed).toBe(0);expect(stock.lastSupply!.commodities.Food!.requested).toBe(180);expect(stock.consumptionCarry.Food).toBe(.44)
 })
 it('죽은인구는요청하지않으며같은날SIR사망과중복하지않는다',()=>{
  const{w,stock}=setup();stock.population.S-=3;stock.population.deaths+=3;at(w,1);expect(stock.lastSupply!.population).toBe(177);expect(stock.lastSupply!.commodities.Food!.requested).toBe(177);expect(stock.population.S+stock.population.I+stock.population.R+stock.population.deaths).toBe(stock.population.total)
 })
 it('3일일괄정산과매일정산의시장·잔고·부족·UID·난수전체가같다',()=>{
  const a=setup(),b=setup();a.stock.reserve.Food=b.stock.reserve.Food=300;at(a.w,3);for(let i=1;i<=3;i++)at(b.w,i);expect(serialize(a.w.s)).toBe(serialize(b.w.s));expect(a.stock.lastSupply!.day).toBe(2);expect(a.stock.lastSupply!.commodities.Food!.unmet).toBe(180)
 })
 it('중복정산과초기화는이미기록한장부와시간·난수를바꾸지않는다',()=>{const{w}=setup();at(w,2);const before=serialize(w.s);worldSimulationTick(w);initializeWorldSimulation(w);expect(serialize(w.s)).toBe(before)})
 it('완료일전각인200은현재형식으로만복원하고과거기록을소급하지않는다',()=>{
  const{w,stock}=setup();expect(stock.lastSupply).toBeUndefined();const raw=JSON.parse(serialize(w.s));raw.version=200;const restored=deserialize(JSON.stringify(raw));expect(restored).toEqual({...raw,version:SAVE_VERSION});expect(restored.overworld!.simulation!.settlements[stock.site]!.lastSupply).toBeUndefined()
 })
 it('실제장부는전체각인복원과다음날정산에도정확히보존된다',()=>{
  const{w}=setup();at(w,1);const other:World={db,s:deserialize(serialize(w.s))};expect(serialize(other.s)).toBe(serialize(w.s));at(w,2);at(other,2);expect(serialize(other.s)).toBe(serialize(w.s))
 })
 it('현재창고만공개하고인·일분과주민하루분및시장식량을구분한다',()=>{
  const d=setup();depot(d);d.stock.reserve.Food=90;d.market.items=[makeMarketItem(d.w,'Item.Hardtack',10)];const before=serialize(d.w.s)
  expect(localSettlementSupply(d.w)).toMatchObject({population:180,food:90,foodPersonDays:90,foodSettlementDays:.5,marketRationFood:1.4,status:'low',lastSupply:undefined});expect(serialize(d.w.s)).toBe(before)
  d.stock.reserve.Food=180;expect(localSettlementSupply(d.w)!.status).toBe('full');d.stock.reserve.Food=0;expect(localSettlementSupply(d.w)!.status).toBe('empty')
 })
 it('마을배급으로환산하지않는달걀은별도먹거리이며집계0을상점음식전체0으로해석하지않는다',()=>{
  const d=setup();depot(d);const eggs=makeMarketItem(d.w,'Item.Egg',2);d.market.items=[eggs];const before=serialize(d.w.s)
  expect(localSettlementSupply(d.w)!.marketRationFood).toBe(0);expect(d.market.items).toEqual([eggs]);expect(serialize(d.w.s)).toBe(before)
 })
 it.each(['far','region','removed','asleep','unconscious','dead','blind','missing','outOfBounds']as const)('원격·보이지않는·없는창고는공개하지않는다 %s',mode=>{
  const d=setup(),pos=depot(d);if(mode==='far')d.p.pos.x+=3;if(mode==='region')d.m.currentRegion='Region.Other';if(mode==='removed')tileAt(d.w,pos).t='Terrain.Earth';if(mode==='asleep')d.p.asleep=true;if(mode==='unconscious')d.p.unconscious=true;if(mode==='dead')d.p.alive=false;if(mode==='blind'){d.p.body.missing.push(...bodyDef(d.w,d.p).parts.filter(part=>part.capacities?.sight).map(part=>part.id))}if(mode==='missing')delete d.w.s.map.residentDepot;if(mode==='outOfBounds')d.w.s.map.residentDepot!.pos={x:-1,y:0};const before=serialize(d.w.s);expect(localSettlementSupply(d.w)).toBeNull();expect(serialize(d.w.s)).toBe(before)
 })
 it('공개장부의반환값을고쳐도원래기록이나시장/창고는변하지않는다',()=>{
  const d=setup();depot(d);at(d.w,1);const before=serialize(d.w.s),view=localSettlementSupply(d.w)!;view.lastSupply!.commodities.Food!.unmet=0;view.lastSupply!.population=999;expect(serialize(d.w.s)).toBe(before);expect(localSettlementSupply(d.w)!.lastSupply!.commodities.Food!.unmet).toBe(180)
 })
})
