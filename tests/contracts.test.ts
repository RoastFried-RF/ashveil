import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { killCreature } from '../src/core/combat'
import { acceptSupply, cancelSupply, contractAccess, contractsTick, deliverSupply, supplyDelivery, supplyOffers, supplyQuote } from '../src/core/contracts'
import { player, tileAt, turnOf, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { createCreature } from '../src/core/creatures'
import { ensureSociety, reputation } from '../src/core/diplomacy'
import { economyTick, exchange, marketFor, stockCount } from '../src/core/economy'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct } from '../src/core/game'
import { makeItem } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { db } from './helpers'
import type { SupplyContract } from '../src/core/types'
const template=newGame(db,{seed:'supply-contract',background:'Bg.Hunter',overworld:true})
function setup(){
  const w:World={db,s:structuredClone(template)},p=player(w),s=w.s,m=s.overworld!,site=m.sites.find((s)=>s.kind==='settlement'&&s.faction==='coalition')!
  s.creatures=[p];s.sources=[];s.storyteller.budget=-1e9;s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};m.currentRegion=site.id;m.position={...site.cell};p.pos={x:20,y:20}
  for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
  initializeSettlement(w);const trader=s.creatures.find((c)=>c.traderSite)!,market=marketFor(w,trader)!;p.pos={x:29,y:18};p.bag=[];p.money=1000;p.traits=[];p.abilities=[];p.age=undefined;p.background=undefined;p.hp=95;p.stats={str:10,agi:10,per:10,vit:10,wil:10}
  Object.assign(p.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,fatigue:10,stress:0,bodyTemp:37,wetness:0})
  for(const c of s.creatures)c.nextAct=c.id===p.id?s.time:1e12
  s.map.lights=[{pos:p.pos,radius:12,kind:'campfire'}];invalidateLights(w)
  const buy=(def='Item.Wood',count=4)=>{const it=market.items.find((it)=>it.def===def)!;expect(it).toBeTruthy();expect(exchange(w,p,trader,[{uid:it.uid,count}],[])).toBeNull();return p.bag.find((it)=>it.def===def)!}
  const accept=(key='fuel')=>{const offer=supplyOffers(w,p,trader).find((o)=>o.template===key)!;expect(offer).toBeTruthy();expect(acceptSupply(w,p,trader,offer.id,offer.reward)).toBeNull();return m.contracts!.at(-1)! as SupplyContract}
  return{w,p,s,m,site,trader,market,buy,accept}
}
const totalMoney=(w:World)=>player(w).money!+Object.values(w.s.overworld!.markets??{}).reduce((n,m)=>n+m.money,0)+(w.s.overworld!.contracts??[]).reduce((n,r)=>n+r.escrow,0)
describe('실제 시장 부족분과 예치 보수의 조달 계약',()=>{
  it('가득 찬 시장은 게시하지 않고 실제 구매의 부족분만 읽기 전용으로 게시한다',()=>{
    const{w,p,trader,buy}=setup();expect(supplyOffers(w,p,trader)).toEqual([]);buy();const before=stateHash(w.s),offers=supplyOffers(w,p,trader);expect(offers.map((o)=>o.template)).toEqual(['fuel']);expect(offers[0]).toMatchObject({count:4,reward:20,deadlineTurns:3*TURNS_PER_DAY});supplyOffers(w,p,trader);expect(stateHash(w.s)).toBe(before)
  })
  it('실제 구매→수락→납품은 물품/지갑/예치·평판을 보존하며 새 UID 없이 한 번만 완료한다',()=>{
    const{w,p,m,trader,market,buy,accept}=setup(),wood=buy(),pieces=p.bag.map((it)=>({uid:it.uid,count:it.count})),money=totalMoney(w),id=w.s.nextId,count=stockCount(market,'Item.Wood'),cash=market.money,paid=p.money!,r=accept();expect(totalMoney(w)).toBe(money);expect(market.money).toBe(cash-20);expect(p.money).toBe(paid);expect(r.escrow).toBe(20)
    const lines=supplyDelivery(w,p,r),hash=stateHash(w.s);expect(supplyQuote(w,p,trader,r.id,lines).error).toBeNull();expect(stateHash(w.s)).toBe(hash);expect(deliverSupply(w,p,trader,r.id,lines,20)).toBeNull();expect(totalMoney(w)).toBe(money);expect(p.money).toBe(paid+20);expect(stockCount(market,'Item.Wood')).toBe(count+4);for(const piece of pieces)expect(market.items.find((it)=>it.uid===piece.uid)).toMatchObject(piece);expect(market.items.some((it)=>it.uid===wood.uid)).toBe(true);expect(w.s.nextId).toBe(id);expect(reputation(w,'coalition')).toBe(1);expect(r).toMatchObject({status:'completed',escrow:0});expect(m.contracts).toHaveLength(1)
    const done=stateHash(w.s);expect(deliverSupply(w,p,trader,r.id,lines)).toBeTruthy();expect(acceptSupply(w,p,trader,r.id)).toBeTruthy();expect(stateHash(w.s)).toBe(done);expect(supplyOffers(w,p,trader)).toEqual([])
  })
  it('모든 계약 입력은 실제 스케줄러에서 각각1턴만 쓴다',()=>{
    const{w,p,trader,buy,m}=setup();buy();const offer=supplyOffers(w,p,trader)[0],before=w.s.time;expect(playerAct(w,{type:'contractAccept',target:trader.id,offer:offer.id,expectedReward:20})).toBeNull();expect(w.s.time-before).toBe(100);const r=m.contracts![0] as SupplyContract;expect(playerAct(w,{type:'contractDeliver',target:trader.id,contract:r.id,lines:supplyDelivery(w,p,r),expectedReward:20})).toBeNull();expect(w.s.time-before).toBe(200)
  })
  it('부분 더미 납품은 남은 물품 상태를 보존하고 옮긴 부분에만 UID 하나를 쓴다',()=>{
    const{w,p,trader,market,buy,accept}=setup(),wood=buy('Item.Bandage',5);wood.quality=3;wood.durability=73;const r=accept('bandages'),before=w.s.nextId;expect(deliverSupply(w,p,trader,r.id,[{uid:wood.uid,count:4}])).toBeNull();expect(wood).toMatchObject({count:1,quality:3,durability:73});expect(market.items.find((it)=>it.uid===before)).toMatchObject({count:4,quality:3,durability:73});expect(w.s.nextId).toBe(before+1)
  })
  it('납품 수량·UID 중복/원격·오래된 보수 오류는 현금과 물품/원장을 바꾸지 않는다',()=>{
    const{w,p,trader,buy,accept}=setup(),wood=buy(),r=accept();for(const lines of [[{uid:wood.uid,count:3}],[{uid:wood.uid,count:5}],[{uid:wood.uid,count:2},{uid:wood.uid,count:2}],[{uid:999999,count:4}],[{uid:wood.uid,count:NaN}]]){const before=stateHash(w.s);expect(deliverSupply(w,p,trader,r.id,lines)).toBeTruthy();expect(stateHash(w.s)).toBe(before)}
    const before=stateHash(w.s);expect(deliverSupply(w,p,trader,r.id,supplyDelivery(w,p,r),21)).toBeTruthy();expect(stateHash(w.s)).toBe(before);p.pos={x:40,y:30};const remote=stateHash(w.s);expect(deliverSupply(w,p,trader,r.id,supplyDelivery(w,p,r))).toBeTruthy();expect(supplyOffers(w,p,trader)).toEqual([]);expect(stateHash(w.s)).toBe(remote)
  })
  it('수락 전에 실제 수요/현금/보수가 달라지면 빈 계약이나 마이너스 지갑을 만들지 않는다',()=>{
    for(const change of ['cash','stock','reward']){const{w,p,trader,market,buy}=setup();buy();const offer=supplyOffers(w,p,trader)[0];if(change==='cash')market.money=19;if(change==='stock')market.items.push(makeItem(w,'Item.Wood',4));const before=stateHash(w.s);expect(acceptSupply(w,p,trader,offer.id,change==='reward'?21:20)).toBeTruthy();expect(stateHash(w.s)).toBe(before)}
  })
  it('음식은 실제 남은 신선도를 검사하고 납품 뒤에도 같은 값과 UID를 유지한다',()=>{
    const{w,p,trader,market,buy,accept}=setup(),food=buy('Item.Hardtack',5),r=accept('food');food.freshness=59;const before=stateHash(w.s);expect(supplyDelivery(w,p,r)).toEqual([]);expect(deliverSupply(w,p,trader,r.id,[{uid:food.uid,count:5}])).toBeTruthy();expect(stateHash(w.s)).toBe(before);food.freshness=60;expect(deliverSupply(w,p,trader,r.id,supplyDelivery(w,p,r))).toBeNull();expect(market.items.find((it)=>it.uid===food.uid)?.freshness).toBe(60)
  })
  it('기준 미달 내구/남은 음식·빈약한 손/잠/위협/모서리 너머로 계약하지 않는다',()=>{
    const{w,p,trader,buy,accept}=setup(),wood=buy(),r=accept();for(const it of p.bag)it.durability=29;expect(supplyDelivery(w,p,r)).toEqual([]);for(const it of p.bag){it.durability=100;it.foodLeftover=true}expect(supplyDelivery(w,p,r)).toEqual([]);for(const it of p.bag)it.foodLeftover=undefined;expect(wood.durability).toBe(100)
    p.asleep=true;expect(contractAccess(w,p,trader)).toBeTruthy();p.asleep=false;p.unconscious=true;expect(contractAccess(w,p,trader)).toBeTruthy();p.unconscious=false;p.body.missing=['LeftHand','RightHand'];expect(contractAccess(w,p,trader)).toBeTruthy();p.body.missing=[]
    const enemy=createCreature(w,'Creature.Reaver',{x:28,y:18});enemy.ai.mode='hunt';enemy.ai.target=p.id;w.s.creatures.push(enemy);expect(contractAccess(w,p,trader)).toBeTruthy();enemy.alive=false
    p.pos={x:29,y:17};tileAt(w,{x:30,y:17}).t='Terrain.RuinWall';tileAt(w,{x:29,y:18}).t='Terrain.RuinWall';expect(contractAccess(w,p,trader)).toBeTruthy()
  })
  it('각인 복원 후 취소는 같은 시장에 예치를 한 번 돌려주고 물품과 평판은 그대로 둔다',()=>{
    const{w,p,trader,buy,accept}=setup();const wood=buy(),r=accept(),money=totalMoney(w),bag=structuredClone(p.bag);w.s=deserialize(serialize(w.s));const cp=player(w),ct=w.s.creatures.find((c)=>c.id===trader.id)!,market=marketFor(w,ct)!;expect(cancelSupply(w,cp,ct,r.id)).toBeNull();expect(totalMoney(w)).toBe(money);expect(cp.bag).toEqual(bag);expect(cp.bag[0].uid).toBe(wood.uid);expect(reputation(w,'coalition')).toBe(0);const hash=stateHash(w.s);expect(cancelSupply(w,cp,ct,r.id)).toBeTruthy();contractsTick(w);expect(stateHash(w.s)).toBe(hash);expect(market.money).toBeGreaterThan(0)
  })
  it('정확한 기한 전에만 납품하며 여행 중에도 기한 만료 예치는 한 번 반환한다',()=>{
    const{w,p,trader,buy,accept,market}=setup();buy();const r=accept(),money=totalMoney(w);w.s.time=r.deadline*100-1;expect(supplyQuote(w,p,trader,r.id,supplyDelivery(w,p,r)).error).toBeNull();w.s.time++;const before=stateHash(w.s);expect(deliverSupply(w,p,trader,r.id,supplyDelivery(w,p,r))).toBeTruthy();expect(stateHash(w.s)).toBe(before);w.s.overworld!.currentRegion=undefined;contractsTick(w);expect(r.status).toBe('expired');expect(totalMoney(w)).toBe(money);const hash=stateHash(w.s);contractsTick(w);expect(stateHash(w.s)).toBe(hash);expect(market.money).toBeGreaterThan(0)
  })
  it('시장 재입고의 현금 바닥은 예치 보수를 포함하고 추가 보수를 중복 생성하지 않는다',()=>{
    const{w,market,buy,accept}=setup();buy();const r=accept();market.money=0;w.s.time=market.nextRestock*TURNS_PER_DAY*100;const day=market.nextRestock;economyTick(w,day);const floor=db.get<import('../src/core/types').TraderStockDef>(market.stockDef).money;expect(market.money+r.escrow).toBe(floor);w.s.time=r.deadline*100;contractsTick(w);expect(market.money).toBe(floor);expect(r.escrow).toBe(0)
  })
  it('같은 게시 기간의 취소/완료를 다시 수락하지 않고 새 기간의 실제 부족만 게시한다',()=>{
    const{w,p,trader,buy,accept}=setup();buy();const r=accept();expect(cancelSupply(w,p,trader,r.id)).toBeNull();expect(supplyOffers(w,p,trader)).toEqual([]);w.s.time+=3*TURNS_PER_DAY*100;expect(supplyOffers(w,p,trader).map((o)=>o.id)).not.toContain(r.id);expect(supplyOffers(w,p,trader)).toHaveLength(1)
  })
  it('의뢰 상인 사망은 물품을 소비하거나 보수를 시체에 복제하지 않고 계약은 저장된다',()=>{
    const{w,p,trader,buy,accept}=setup();buy();const r=accept(),money=totalMoney(w),bag=structuredClone(p.bag);killCreature(w,trader,'검증');expect(deliverSupply(w,p,trader,r.id,supplyDelivery(w,p,r))).toBeTruthy();expect(p.bag).toEqual(bag);expect(totalMoney(w)).toBe(money);expect(trader.money??0).toBe(0);const copy=deserialize(serialize(w.s));expect(copy.overworld!.contracts![0]).toEqual(r)
  })
  it('플레이어가 실제 사망하면 남은 예치가 시장으로 돌아가며 시체 지갑은 늘지 않는다',()=>{
    const{w,p,market,buy,accept}=setup();buy();const r=accept(),cash=p.money!,marketCash=market.money;killCreature(w,p,'검증');expect(r.status).toBe('cancelled');expect(r.escrow).toBe(0);expect(market.money).toBe(marketCash+20);expect(p.money).toBe(cash)
  })
  it('다른 사람/다른 정착지·적대 평판은 계약 장부를 조작하지 못한다',()=>{
    const{w,p,trader,buy,accept}=setup();buy();const r=accept(),lines=supplyDelivery(w,p,r);const before=stateHash(w.s);expect(deliverSupply(w,trader,trader,r.id,lines)).toBeTruthy();expect(stateHash(w.s)).toBe(before);ensureSociety(w)!.reputation.coalition=-60;expect(contractAccess(w,p,trader)).toBeTruthy();ensureSociety(w)!.reputation.coalition=0;w.s.overworld!.currentRegion='elsewhere';expect(contractAccess(w,p,trader)).toBeTruthy()
  })
  it('진행 중 계약이 있으면 다른 물품 계약을 중복 수락하지 않는다',()=>{
    const{w,p,trader,buy}=setup();buy();buy('Item.Hardtack',5);const offers=supplyOffers(w,p,trader);expect(offers).toHaveLength(2);expect(acceptSupply(w,p,trader,offers[0].id)).toBeNull();const before=stateHash(w.s);expect(perform(w,p,{type:'contractAccept',target:trader.id,offer:offers[1].id}).ok).toBe(false);expect(stateHash(w.s)).toBe(before)
  })
  it('v21 각인은 새로운 계약이나 돈을 추가하지 않고 v22로 옮긴다',()=>{
    const{w}=setup(),old=JSON.parse(serialize(w.s));old.version=21;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:21}).toEqual(old);expect(turnOf({db,s:copy})).toBe(turnOf(w))
  })
})
