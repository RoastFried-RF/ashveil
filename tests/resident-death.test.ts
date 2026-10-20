import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { killCreature } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { newGame } from '../src/core/game'
import { addToBag, makeItem } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { waterStep } from '../src/core/water'
import { recordResidentDeath, worldSimulationDef, worldSimulationTick } from '../src/core/world-simulation'
import { db } from './helpers'
const template=newGame(db,{seed:'resident-death',overworld:true})
function setup(alive=400){
  const w:World={db,s:structuredClone(template)},p=player(w),m=w.s.overworld!,site=m.sites.find((s)=>s.kind==='settlement'&&s.faction==='coalition')!,stock=m.simulation!.settlements[site.id]!
  m.currentRegion=site.id;m.position={...site.cell};w.s.creatures=[p];w.s.time=12*1200*100;w.s.sources=[];w.s.storyteller.budget=-1e9;p.pos={x:33,y:19};Object.assign(stock.population,{total:400,S:alive,I:0,R:0,deaths:400-alive});stock.residentConsumption=undefined
  for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
  initializeSettlement(w);const doctor=w.s.creatures.find((c)=>c.clinicSite),guard=w.s.creatures.find((c)=>c.def==='Creature.SettlementGuard')
  return{w,p,site,stock,doctor,guard}
}
describe('실제 주민 사망과 공공 인구·소비 원장',()=>{
  it('실제 시민은 붙잡혀 고향 밖에서 죽거나 정치적 소속이 바뀌어도 원래 인구에서 한 번만 공제한다',()=>{for(const reformed of [false,true]){const{w,stock,doctor}=setup();w.s.overworld!.currentRegion='Region.GreyCloister';if(reformed){doctor!.residentOriginFaction=doctor!.faction;doctor!.faction='guardReform';delete doctor!.residentSite}const before=stock.population.deaths;killCreature(w,doctor!,'검증');expect(stock.population.deaths).toBe(before+1);expect(recordResidentDeath(w,doctor!)).toBe(false);expect(stock.population.deaths).toBe(before+1)}})
  it('실제 주민1명의 사망은 S→사망으로 한 번만 옮기며 조사 인구N을 유지한다',()=>{
    const{w,stock,doctor}=setup();killCreature(w,doctor!,'검증');expect(stock.population).toMatchObject({total:400,S:399,I:0,R:0,deaths:1});expect(stock.residentDeaths).toEqual([doctor!.id]);const hash=stateHash(w.s);killCreature(w,doctor!,'다시');expect(recordResidentDeath(w,doctor!)).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
  it('임상 감염/면역은 가능한 I/R에서 옮기고 합계를 보존한다',()=>{
    for(const kind of ['I','R']){const{w,stock,doctor}=setup(),disease=worldSimulationDef(w).disease.def;stock.population.S=398;stock.population.I=1;stock.population.R=1;if(kind==='I')doctor!.diseases=[{def:disease,incubatesUntil:turnOf(w)+1200,progress:0,immunity:0}];else doctor!.immuneDiseases=[disease];killCreature(w,doctor!,'검증');expect(stock.population[kind as 'I'|'R']).toBe(0);expect(stock.population.S+stock.population.I+stock.population.R+stock.population.deaths).toBe(400)}
  })
  it('요약 구획이 임상과 달라도 남은 인원 안에서 옮기며 음수 인구를 만들지 않는다',()=>{
    const{w,stock,doctor}=setup();Object.assign(stock.population,{S:0,I:0,R:400});killCreature(w,doctor!,'검증');expect(stock.population).toMatchObject({total:400,S:0,I:0,R:399,deaths:1})
  })
  it('요약 인구가 이미 전원 사망이면 실제 시체를 다시 사망자로 더하지 않는다',()=>{
    const{w,stock,doctor}=setup();Object.assign(stock.population,{S:0,I:0,R:0,deaths:400});killCreature(w,doctor!,'검증');expect(stock.population).toMatchObject({total:400,S:0,I:0,R:0,deaths:400});expect(stock.residentDeaths).toEqual([doctor!.id])
  })
  it('죽은 사람의 당일 실제 식사/연료 공제만 거둬 다른 주민의 공제를 보존한다',()=>{
    const{w,stock,doctor,guard}=setup(),d=doctor!,g=guard!;for(const c of [d,g])expect(perform(w,c,{type:'consume',uid:c.bag.find((it)=>it.def==='Item.Hardtack')!.uid}).ok).toBe(true)
    d.pos={x:33,y:18};const bottle=d.bag.find((it)=>it.def==='Item.WaterBottle')!;bottle.water={pathogen:10,ash:5};addToBag(w,d,makeItem(w,'Item.Wood'));expect(perform(w,d,{type:'waterTreatment',uid:bottle.uid,method:'boil'}).ok).toBe(true);d.activity!.remaining=0;waterStep(w,d);expect(stock.residentConsumption?.units).toMatchObject({Food:.28,Fuel:.15});killCreature(w,d,'검증');expect(stock.residentConsumption?.units).toMatchObject({Food:.14,Fuel:0});expect(d.residentConsumption?.units).toMatchObject({Food:.14,Fuel:.15});expect(g.residentConsumption?.units.Food).toBe(.14)
  })
  it('자정 소비는 남은 생존 인구와 살아 있는 사람의 공제만 사용한다',()=>{
    const{w,stock,doctor,guard}=setup();for(const c of [doctor!,guard!])perform(w,c,{type:'consume',uid:c.bag.find((it)=>it.def==='Item.Hardtack')!.uid});killCreature(w,doctor!,'검증');stock.production={};stock.reserve.Food=1000;stock.consumptionCarry={};w.s.time=TURNS_PER_DAY*100;worldSimulationTick(w);expect(stock.reserve.Food).toBe(602);expect(stock.consumptionCarry.Food).toBeCloseTo(.86,8);w.s.time=2*TURNS_PER_DAY*100;worldSimulationTick(w);expect(stock.reserve.Food).toBe(203);expect(stock.population.total).toBe(400)
  })
  it('이미 정산한 지난 날짜의 공제는 다음 날 사망으로 다시 빼지 않는다',()=>{
    const{w,stock,doctor,guard}=setup();perform(w,doctor!,{type:'consume',uid:doctor!.bag.find((it)=>it.def==='Item.Hardtack')!.uid});w.s.time=TURNS_PER_DAY*100;worldSimulationTick(w);perform(w,guard!,{type:'consume',uid:guard!.bag.find((it)=>it.def==='Item.Hardtack')!.uid});const credit=structuredClone(stock.residentConsumption);killCreature(w,doctor!,'검증');expect(stock.residentConsumption).toEqual(credit)
  })
  it('첫 방문 실물 주민/의사는 남아 있는 S+I+R 인구보다 많이 생성되지 않는다',()=>{
    for(const n of [0,1,2,3,4]){const{w,p,stock}=setup(n);expect(w.s.creatures.filter((c)=>c.id!==p.id&&c.alive)).toHaveLength(n);expect(stock.population.total).toBe(400);expect(stock.population.deaths).toBe(400-n);const hash=stateHash(w.s);initializeSettlement(w);expect(stateHash(w.s)).toBe(hash)}
  })
  it('구형 지역의 남은 인구가 기존 주민으로 꽉 차면 의사를 추가하지 않는다',()=>{
    const{w,p,site}=setup(2);w.s.creatures=w.s.creatures.filter((c)=>!c.clinicSite);const guard=createCreature(w,'Creature.SettlementGuard',{x:27,y:20});guard.faction=site.faction!;guard.home={...guard.pos};guard.mapId=w.s.map.id;guard.residentSite=site.id;w.s.creatures.push(guard);w.s.map.clinicInitialized=undefined;initializeSettlement(w);expect(w.s.creatures.filter((c)=>c.id!==p.id&&c.alive)).toHaveLength(2);expect(w.s.creatures.some((c)=>c.clinicSite)).toBe(false)
  })
  it('죽은 의사의 구형 초기화 표식이 빠져도 시체에 새 진료 물품을 주지 않는다',()=>{
    const{w,doctor}=setup();killCreature(w,doctor!,'검증');w.s.map.clinicInitialized=undefined;const body=structuredClone(doctor),tiles=structuredClone(w.s.map.tiles),id=w.s.nextId,worldId=w.s.overworld!.simulation!.nextItemId;initializeSettlement(w);expect(doctor).toEqual(body);expect(w.s.map.tiles).toEqual(tiles);expect(w.s.nextId).toBe(id);expect(w.s.overworld!.simulation!.nextItemId).toBe(worldId)
  })
  it('주민 표식이 없던 구형 현지 경비의 사망도 실제 지역의 원장에 반영한다',()=>{
    const{w,stock,guard}=setup();guard!.residentSite=undefined;killCreature(w,guard!,'검증');expect(stock.population.deaths).toBe(1);expect(stock.residentDeaths).toEqual([guard!.id])
  })
  it('외부인/플레이어와 반복 각인은 지역 인구·사망을 추가하지 않는다',()=>{
    const{w,p,stock,doctor}=setup();const outsider=createCreature(w,'Creature.Reaver',{x:20,y:20});w.s.creatures.push(outsider);killCreature(w,outsider,'검증');expect(stock.population.deaths).toBe(0);p.alive=false;p.residentSite=doctor!.residentSite;expect(recordResidentDeath(w,p)).toBe(false);p.alive=true;killCreature(w,doctor!,'검증');const copy={db,s:deserialize(serialize(w.s))},dead=copy.s.creatures.find((c)=>c.id===doctor!.id)!;const hash=stateHash(copy.s);expect(recordResidentDeath(copy,dead)).toBe(false);expect(stateHash(copy.s)).toBe(hash)
  })
})
