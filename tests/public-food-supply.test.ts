import {describe,it,expect} from 'vitest'
import {settlementSupplyNativeFixture} from './settlement-supply-fixture'
import {announceFoodSupply} from '../src/core/public-food-supply'
import {worldSimulationTick,worldSimulationDef} from '../src/core/world-simulation'
import {activeTownRumors,hearTownRumors,rumorNetworkTick} from '../src/core/rumor-network'
import {localSettlementSupply} from '../src/core/settlement-supply'
import {playerAct,SAVE_VERSION} from '../src/core/game'
import {TURNS_PER_DAY,turnOf,type World} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {loadMods,type PatchOp} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'

function setup(shortage=true){
 const d=settlementSupplyNativeFixture(shortage),keeper=d.s.creatures.find(c=>c.traderSite===d.stock.site)!
 return{...d,keeper}
}
function at(w:World,day:number){w.s.time=day*TURNS_PER_DAY*100;worldSimulationTick(w)}
const foodNews=(d:ReturnType<typeof setup>)=>(d.m.rumorNetwork?.towns[d.stock.site]??[]).filter(r=>r.id.startsWith('food-supply:'))
function flagDb(value:unknown,remove=false){
 const packages=readPackages(),core=packages.find(p=>p.manifest.id==='core')!
 core.patches.push({op:remove?'remove':'replace',target:'WorldSimulation.Hearth',path:'/rumors/publicFoodSupply',...(remove?{}:{value})}as PatchOp)
 return loadMods(packages,[])
}

describe('실제 새 공동 식량 부족과 충족의 공개 공고',()=>{
 it('실제1턴의완료일부족만공개하고플레이어에게즉시지식을주지않는다',()=>{
  const d=setup(),known=structuredClone(d.s.knowledge.rumors),before=d.s.time
  expect(d.stock.supplyNotice).toBeUndefined();expect(playerAct(d.w,{type:'wait'})).toBeNull()
  expect(d.s.time-before).toBe(100);expect(d.stock.supplyNotice).toEqual({day:0,unmet:true})
  const news=foodNews(d);expect(news).toHaveLength(1)
  expect(news[0]).toMatchObject({id:'food-supply:'+d.stock.site+':0:shortage',kind:'supply',writtenAt:TURNS_PER_DAY,hop:0,source:'양치기 골의 배급 공고'})
  expect(news[0]!.claims!.what).toContain('1일차');expect(news[0]!.claims!.what).toContain('모자랐다')
  expect(d.s.knowledge.rumors).toEqual(known);expect(d.m.rumorNetwork!.pending.every(p=>p.due>TURNS_PER_DAY)).toBe(true)
 })
 it('실제주민과다음1턴대화해야공개된소식을배우고같은이야기를중복학습하지않는다',()=>{
  const d=setup();expect(playerAct(d.w,{type:'wait'})).toBeNull()
  const before=d.s.time,known=structuredClone(d.s.knowledge.rumors??[]);expect(foodNews(d)).toHaveLength(1)
  expect(playerAct(d.w,{type:'talk',target:d.keeper.id})).toBeNull();expect(d.s.time-before).toBe(100)
  const learned=d.s.knowledge.rumors!.filter(r=>r.id.startsWith('food-supply:'));expect(learned).toHaveLength(1);expect(learned[0]!.text).toContain('모자랐다');expect(d.s.knowledge.rumors!.length).toBe(known.length+1)
  const count=d.s.knowledge.rumors!.length;expect(hearTownRumors(d.w,d.p,d.keeper)).toBe(0);expect(d.s.knowledge.rumors).toHaveLength(count)
 })
 it('계속부족하면매일공고와표식을반복해서만들지않는다',()=>{
  const d=setup();at(d.w,1);const original=structuredClone(foodNews(d)[0])
  at(d.w,2);at(d.w,3);expect(foodNews(d)).toEqual([original]);expect(d.stock.supplyNotice).toEqual({day:0,unmet:true})
  const before=serialize(d.s);expect(announceFoodSupply(d.w,d.stock,3*TURNS_PER_DAY)).toBe(false);expect(serialize(d.s)).toBe(before)
 })
 it('다음실제공급이충족되면별도공고를쓰고옛부족소식은당시대로유지한다',()=>{
  const d=setup();at(d.w,1);const original=structuredClone(foodNews(d)[0]);d.stock.reserve.Food=1000
  at(d.w,2);expect(d.stock.supplyNotice).toEqual({day:1,unmet:false});expect(foodNews(d)).toHaveLength(2);expect(foodNews(d)[0]).toEqual(original)
  const recovery=foodNews(d)[1]!;expect(recovery.kind).toBe('supply');expect(recovery.claims!.what).toContain('2일차');expect(recovery.claims!.what).toContain('모두 충당')
  at(d.w,3);expect(foodNews(d)).toHaveLength(2)
 })
 it('충족뒤다시실제로부족해지면새날짜의사건으로기록한다',()=>{
  const d=setup();at(d.w,1);d.stock.reserve.Food=1000;at(d.w,2);d.stock.reserve.Food=0;at(d.w,3)
  expect(foodNews(d).map(r=>r.id)).toEqual([0,1,2].map((day,i)=>'food-supply:'+d.stock.site+':'+day+':'+(i===1?'supplied':'shortage')))
 })
 it('처음부터정상인마을의과거충족공고를만들지않는다',()=>{
  const d=setup(false);at(d.w,3);expect(d.stock.lastSupply!.commodities.Food!.unmet).toBe(0);expect(foodNews(d)).toEqual([]);expect(d.stock.supplyNotice).toBeUndefined()
 })
 it('원격공고는실제경로지연뒤도착하기전현지대화로배우지않는다',()=>{
  const d=setup(false),remote=d.m.sites.find(s=>s.kind==='settlement'&&s.id!==d.stock.site&&d.m.simulation!.settlements[s.id])!,stock=d.m.simulation!.settlements[remote.id]!,market=d.m.markets![remote.id],rules=worldSimulationDef(d.w)
  stock.reserve.Food=0;stock.production.Food=0;market.items=market.items.filter(i=>rules.items[i.def]?.commodity!=='Food')
  at(d.w,1);expect(d.m.rumorNetwork!.towns[remote.id]!.some(r=>r.id.startsWith('food-supply:'))).toBe(true)
  expect(foodNews(d)).toEqual([]);const before=serialize(d.s);expect(hearTownRumors(d.w,d.p,d.keeper)).toBe(0);expect(serialize(d.s)).toBe(before)
  expect(d.m.rumorNetwork!.pending.every(p=>p.due>turnOf(d.w))).toBe(true)
 })
 it('인구·실제부족수량·개인감염수나기근종료보장을공개내용에넣지않는다',()=>{
  const d=setup();at(d.w,1);const r=foodNews(d)[0]!
  expect(Object.keys(r.claims!).sort()).toEqual(['place','what','when']);expect(r.outbreak).toBeUndefined()
  expect(r.claims!.what).not.toMatch(/177\.33|179|180|기근.*끝|건강|감염/)
  expect(r.claims!.place!.cell).toEqual(d.m.sites.find(s=>s.id===d.stock.site)!.cell)
 })
 it('꺼진기능의물리세계와같고추가되는것은공고·표식·소문전파스트림뿐이다',()=>{
  const a=setup(),b=setup(),loaded=flagDb(false);expect(loaded.report.errors).toEqual([]);b.w.db=loaded.db
  at(a.w,1);at(b.w,1);expect(b.stock.lastSupply!.commodities.Food!.unmet).toBe(177.33);expect(b.stock.supplyNotice).toBeUndefined();expect(b.m.rumorNetwork).toBeUndefined()
  const clean=(w:World)=>{
   const state=JSON.parse(serialize(w.s));delete state.overworld.rumorNetwork
   for(const s of Object.values(state.overworld.simulation.settlements)as {supplyNotice?:unknown}[])delete s.supplyNotice
   for(const key of Object.keys(state.rng))if(key.startsWith('world.rumors.'))delete state.rng[key]
   return state
  }
  expect(clean(a.w)).toEqual(clean(b.w));expect(Object.keys(a.s.rng).filter(k=>k.startsWith('world.rumors.')).length).toBeGreaterThan(0)
 })
 it('설정을생략해도기존경제만정산하고과거공지·전파를추가하지않는다',()=>{
  const d=setup(),loaded=flagDb(undefined,true);expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;at(d.w,1);expect(d.stock.supplyNotice).toBeUndefined();expect(foodNews(d)).toEqual([])
 })
 it('201헤더의같은유한옛장부는버전만변환하고다음새완료일만게시한다',()=>{
  const d=setup();d.s.time=TURNS_PER_DAY*100;d.m.simulation!.day=d.m.simulation!.marketDay=1
  for(const market of Object.values(d.m.markets!)){market.day=1;market.nextRestock=Math.max(market.nextRestock,2)}
  d.stock.lastSupply={day:0,population:180,commodities:{Food:{produced:0,requested:179,supplied:1.67,unmet:177.33,residentUsed:.56}}}
  const raw=JSON.parse(serialize(d.s));raw.version=201;const restored=deserialize(JSON.stringify(raw));expect(restored).toEqual({...raw,version:SAVE_VERSION})
  const w:World={db:d.w.db,s:restored},stock=w.s.overworld!.simulation!.settlements[d.stock.site]!
  localSettlementSupply(w);rumorNetworkTick(w);expect(stock.supplyNotice).toBeUndefined();expect(w.s.overworld!.rumorNetwork).toBeUndefined()
  at(w,2);expect(stock.supplyNotice).toEqual({day:1,unmet:true});expect(w.s.overworld!.rumorNetwork!.towns[d.stock.site]!.map(r=>r.id)).toEqual(['food-supply:'+d.stock.site+':1:shortage'])
 })
 it('표식·대기중소문·전파난수와다음충족정산을전체각인으로보존한다',()=>{
  const d=setup();at(d.w,1);const copy:World={db:d.w.db,s:deserialize(serialize(d.s))}
  expect(serialize(copy.s)).toBe(serialize(d.s))
  d.stock.reserve.Food=copy.s.overworld!.simulation!.settlements[d.stock.site]!.reserve.Food=1000
  at(d.w,2);at(copy,2);expect(serialize(copy.s)).toBe(serialize(d.s))
 })
 it('한번에3일과하루씩정산한공고·표식·세계·난수가같다',()=>{
  const a=setup(),b=setup();at(a.w,3);for(let day=1;day<=3;day++)at(b.w,day);expect(serialize(a.s)).toBe(serialize(b.s))
 })
 it('장부조회와기존공고조회는새공고나난수를만들지않는다',()=>{
  const d=setup();at(d.w,1);const before=serialize(d.s);localSettlementSupply(d.w);activeTownRumors(d.w,d.stock.site);expect(serialize(d.s)).toBe(before)
 })
 it.each([null,1,'true',[],{}])('잘못된공개식량공고설정을거절한다 %#',value=>{expect(flagDb(value).report.errors.length).toBeGreaterThan(0)})
 it.each(['future','offBoundary','oldDay','noLedger','negative','dead','noDemand']as const)('실제새정산이아닌입력은공고/표식/난수를쓰지않는다 %s',mode=>{
  const d=setup();d.s.time=TURNS_PER_DAY*100
  d.stock.lastSupply={day:0,population:180,commodities:{Food:{produced:0,requested:180,supplied:0,unmet:180,residentUsed:0}}}
  let time=TURNS_PER_DAY
  if(mode==='future')time*=2;if(mode==='offBoundary')time--
  if(mode==='oldDay')d.stock.lastSupply.day=-1
  if(mode==='noLedger')delete d.stock.lastSupply
  if(mode==='negative')d.stock.lastSupply!.commodities.Food!.unmet=-1
  if(mode==='dead'){d.stock.population.S=d.stock.population.I=d.stock.population.R=0;d.stock.population.deaths=d.stock.population.total}
  if(mode==='noDemand')Object.assign(d.stock.lastSupply!.commodities.Food!,{requested:0,supplied:0,unmet:0,residentUsed:0})
  const before=serialize(d.s);expect(announceFoodSupply(d.w,d.stock,time)).toBe(false);expect(serialize(d.s)).toBe(before)
 })
})
