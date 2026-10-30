import {describe,it,expect}from'vitest'
import {ashWorkshopFixture}from'./ash-workshop-fixture'
import {residentWorkshopDecision,performResidentWorkshop}from'../src/core/resident-workshop'
import {residentWorkshopProduct,residentWorkshopRules,residentWorkshopClothing,workshopReserveKcal}from'../src/core/resident-workshop-state'
import {makeItem,addToBag}from'../src/core/items'
import {residentFoodKcal}from'../src/core/resident-provisions'
import {serialize,deserialize}from'../src/core/save'
import {turnOf,type World}from'../src/core/ctx'
import {playerAct}from'../src/core/game'
import {drinkVolume}from'../src/core/wash-water'
import {perform}from'../src/core/actions'
import {finishBase}from'./base-camp-fixture'
import {adoptMarketStockAdditions,economyTick}from'../src/core/economy'
import {loadMods,type PatchOp}from'../src/core/defs'
import {readPackages}from'../tools/loadContent'
import type{ResidentProvisionDef}from'../src/core/types'

function setup(){const d=ashWorkshopFixture();expect(residentFoodKcal(d.w,d.c)).toBeGreaterThanOrEqual(600);return d}
const units=(items:{def:string;count:number}[],id:string)=>items.reduce((n,i)=>n+(i.def===id?i.count:0),0)

describe('pilgrim resident workshop uses real ash, materials, water, fuel, labour and owned market',()=>{
 it('compares a cold worksite without mutation and actually swaps its original coat and shirt with the same UIDs',()=>{
  const d=setup();d.c.pos={x:30,y:25};const coat=d.c.bag.find(i=>i.def==='Item.LeatherCoat')!,shirt=d.c.equip.chest!,before=serialize(d.s),next=d.s.nextId
  const action=residentWorkshopClothing(d.w,d.c,{x:30,y:24},'work');expect(action).toEqual({type:'equip',uid:coat.uid,slot:'chest'});expect(serialize(d.s)).toBe(before)
  expect(perform(d.w,d.c,action!).ok).toBe(true);finishBase(d.w,d.c);expect(d.c.equip.chest!.uid).toBe(coat.uid);expect(d.c.bag.some(i=>i.uid===shirt.uid)).toBe(true);expect(d.s.nextId).toBe(next)
 })
 it('does not create clothing or interrupt an original job to change clothes',()=>{
  const d=setup();d.c.bag=d.c.bag.filter(i=>i.def!=='Item.LeatherCoat');expect(residentWorkshopClothing(d.w,d.c,{x:30,y:24},'work')).toBeUndefined()
  d.c.activity={kind:'gather',target:{x:30,y:24},remaining:100,label:'원래 재 채집'};expect(residentWorkshopClothing(d.w,d.c,{x:30,y:24},'work')).toBeUndefined()
 })
 it('actually gathers, buys no remote goods, cooks at its own finite fire and supplies the same bowl UID',()=>{
  const d=setup(),initial=JSON.parse(serialize(d.s)),tower=d.s.overworld!.towers.find(t=>t.id==='Region.ChimneySeven')!,ashBefore=Object.values(tower.ashDeposits!).reduce((n,p)=>n+p.taken,0),oats=units(d.market.items,'Item.Oats'),bowls=d.market.items.filter(i=>i.def==='Item.Bowl').map(i=>i.uid),cash={worker:d.c.money,market:d.market.money},stock=d.market.items.length
  let gathered=false,working=false,atCraftWater=0,craftBottle=0,craftBowl=0,crafted=false,restored:World|undefined
  for(let i=0;i<1800&&!d.market.items.some(i=>i.workshopMade?.worker===d.c.id);i++){
   d.act({type:'wait'})
   gathered ||= Object.values(tower.ashDeposits!).some(p=>p.taken>0)
   if(d.c.workJob?.residentWorkshop&&!working){working=true;atCraftWater=d.c.bag.reduce((n,i)=>n+drinkVolume(d.w,i),0);craftBottle=d.c.workJob.mealPlan!.bottleUid;craftBowl=d.c.workJob.mealPlan!.vesselUid;restored={db:d.w.db,s:deserialize(serialize(d.s))}}
   else if(restored){expect(playerAct(restored,{type:'wait'})).toBeNull();if(i%137===0)expect(JSON.parse(serialize(restored.s))).toEqual(JSON.parse(serialize(d.s)))}
   if(residentWorkshopProduct(d.w,d.c))crafted=true
  }
  const output=d.market.items.find(i=>i.workshopMade?.worker===d.c.id)
  expect({gathered,working,crafted,output:!!output,last:d.s.log.slice(-5).map(l=>l.text)}).toMatchObject({gathered:true,working:true,crafted:true,output:true})
  expect(output!.uid).toBe(craftBowl);expect(bowls).toContain(craftBowl);expect(output!.def).toBe('Item.AshCake');expect(output!.workshopMade).toMatchObject({worker:d.c.id,site:d.c.residentSite,recipe:'Recipe.AshCake',def:'Item.AshCake'})
  expect(units(d.market.items,'Item.Oats')).toBe(oats-1);expect(Object.values(tower.ashDeposits!).reduce((n,p)=>n+p.taken,0)).toBe(ashBefore+1)
  expect(d.c.bag.find(i=>i.uid===craftBottle)).toBeDefined();expect(d.c.bag.reduce((n,i)=>n+drinkVolume(d.w,i),0)).toBeLessThanOrEqual(atCraftWater-220)
  expect({worker:d.c.money,market:d.market.money}).toEqual(cash);expect(d.market.items.length).toBeLessThan(stock+1)
  expect(d.s.map.tiles.some(t=>t.placed?.owner===d.c.id&&t.placed.item.def==='Item.CampfireKit')).toBe(true)
  expect(initial.overworld.towers).not.toEqual(JSON.parse(serialize(d.s)).overworld.towers)
  expect(restored).toBeDefined();expect(JSON.parse(serialize(restored!.s))).toEqual(JSON.parse(serialize(d.s)))
 },90000)
 it('planning and repeated decisions are read-only and an away worker cannot withdraw or supply remotely',()=>{
  const d=setup();d.c.pos={x:30,y:25};const before=serialize(d.s);for(let i=0;i<10;i++)residentWorkshopDecision(d.w,d.c)
  expect(serialize(d.s)).toBe(before);expect(performResidentWorkshop(d.w,d.c,'supply')).not.toBeNull();expect(performResidentWorkshop(d.w,d.c,'offer')).not.toBeNull();expect(serialize(d.s)).toBe(before)
 })
 it('does not turn existing stock or an arbitrary food bowl into this worker’s production',()=>{
  const d=setup(),original=d.market.items.find(i=>i.def==='Item.AshCake')!;d.market.items=d.market.items.filter(i=>i!==original);d.c.bag.push(original);const before=serialize(d.s)
  expect(residentWorkshopProduct(d.w,d.c)).toBeUndefined();expect(performResidentWorkshop(d.w,d.c,'offer')).not.toBeNull();expect(serialize(d.s)).toBe(before)
 })
 it('does not plan production when hungry, exhausted or a different faction',()=>{
  const d=setup();delete d.c.residentWorkshopOrder;d.c.needs.kcal=0;expect(residentWorkshopDecision(d.w,d.c)?.action?.type).toBe('consume');d.c.needs.kcal=3000;d.c.needs.fatigue=80;expect(residentWorkshopDecision(d.w,d.c)).toBeNull();d.c.needs.fatigue=0;d.c.faction='coalition';expect(residentWorkshopDecision(d.w,d.c)).toBeNull()
 })
 it('a full shop does not start another production order',()=>{
  const d=setup();delete d.c.residentWorkshopOrder;const cake=d.market.items.find(i=>i.def==='Item.AshCake')!;cake.count=residentWorkshopRules(d.w)!.targetStock
  const before=serialize(d.s);expect(residentWorkshopDecision(d.w,d.c)).toBeNull();expect(performResidentWorkshop(d.w,d.c,'plan')).not.toBeNull();expect(serialize(d.s)).toBe(before)
 })
 it('spoiled shop bowls do not satisfy a fresh meal quota or a worker’s reserved food',()=>{
  const d=setup();delete d.c.residentWorkshopOrder;const cake=d.market.items.find(i=>i.def==='Item.AshCake')!;cake.count=3;cake.freshness=0
  expect(residentWorkshopDecision(d.w,d.c)?.action).toEqual({type:'residentWorkshop',operation:'plan'})
  for(const it of d.c.bag)if(d.w.db.item(it.def).food)it.freshness=0
  expect(residentWorkshopDecision(d.w,d.c)?.action).toEqual({type:'residentWorkshop',operation:'provision'})
 })
 it('does not count raw recipe grain twice as personal food and withdraws only an actual owned ration',()=>{
  const d=setup();delete d.c.residentWorkshopOrder;const ration=d.c.bag.find(i=>i.def==='Item.Hardtack')!;ration.count=1;expect(addToBag(d.w,d.c,makeItem(d.w,'Item.Oats'))).toBe(0)
  expect(workshopReserveKcal(d.w,d.c)).toBe(350);const before=units(d.market.items,'Item.Hardtack'),cash=d.market.money
  expect(residentWorkshopDecision(d.w,d.c)?.action).toEqual({type:'residentWorkshop',operation:'provision'});expect(performResidentWorkshop(d.w,d.c,'provision')).toBeNull();expect(workshopReserveKcal(d.w,d.c)).toBe(700);expect(units(d.market.items,'Item.Hardtack')).toBe(before-1);expect(d.market.money).toBe(cash)
  const saved=serialize(d.s);expect(performResidentWorkshop(d.w,d.c,'provision')).not.toBeNull();expect(serialize(d.s)).toBe(saved)
 })
 it('uses the original private bed before the work fatigue limit instead of waiting idly for a later crisis',()=>{
  const d=setup();d.c.needs.fatigue=65;const bed=d.s.map.residentBeds!.find(b=>b.owner===d.c.id)!
  expect(residentWorkshopDecision(d.w,d.c)?.goal).toEqual(bed.pos);d.c.pos={...bed.pos};expect(residentWorkshopDecision(d.w,d.c)?.action).toEqual({type:'sleep'})
  expect(perform(d.w,d.c,{type:'sleep'}).ok).toBe(true);expect(d.c.activity?.kind).toBe('sleep');expect(d.c.activity?.wakeFatigue).toBe(20)
 })
 it('an absent actual grain stock consumes neither ash nor cash and saves a bounded retry',()=>{
  const d=setup();delete d.c.residentWorkshopOrder;expect(performResidentWorkshop(d.w,d.c,'plan')).toBeNull();d.market.items=d.market.items.filter(i=>i.def!=='Item.Oats');const before={next:d.s.nextId,cash:d.market.money,bag:structuredClone(d.c.bag)}
  expect(performResidentWorkshop(d.w,d.c,'supply')).not.toBeNull();expect({next:d.s.nextId,cash:d.market.money,bag:d.c.bag}).toEqual(before);expect(d.c.residentWorkshopAfter).toBe(turnOf(d.w)+1200)
 })
 it('finite workshop startup goods are not recreated on date changes, adoption or save continuation',()=>{
  const d=setup();expect(units(d.market.items,'Item.Oats')).toBe(8);d.market.items=d.market.items.filter(i=>!['Item.Oats','Item.Bowl','Item.Wood','Item.CampfireKit'].includes(i.def))
  adoptMarketStockAdditions(d.w);economyTick(d.w,30)
  const copy:World={db:d.w.db,s:deserialize(serialize(d.s))};adoptMarketStockAdditions(copy)
  expect(copy.s.overworld!.markets![d.market.site].items.some(i=>['Item.Oats','Item.Bowl','Item.Wood','Item.CampfireKit'].includes(i.def))).toBe(false)
 })
 it.each(['residentWorkshopOrder','residentWorkshopAfter']as const)('rejects malformed %s in saved active and dormant workers',field=>{
  const d=setup();(d.c as unknown as Record<string,unknown>)[field]=null;expect(()=>deserialize(serialize(d.s))).toThrow(/작업장/)
 })
 it.each([{targetStock:0},{reserveKcal:-1},{recipe:'Recipe.CampfireKit'},{gather:'AshDeposit.Missing'},{faction:'unknown'}])('rejects invalid workshop contracts %j',value=>{
  const d=setup(),workshop={...d.w.db.get<ResidentProvisionDef>('ResidentProvision.Hearth').workshop,...value},patches:PatchOp[]=[{op:'replace',target:'ResidentProvision.Hearth',path:'/workshop',value:workshop}],m=loadMods([...readPackages(),{manifest:{id:'workshop-test',name:'검사',version:'1'},defs:[],patches}],['workshop-test']);expect(m.report.errors.some(e=>e.includes('workshop')||e.includes('AshDeposit.Missing'))).toBe(true)
 })
})
