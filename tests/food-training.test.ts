import {afterEach,describe,expect,it} from 'vitest'
import {perform,consumeFor} from '../src/core/actions'
import {airLines,ashLungCap,inhaledAsh,lungAshBurden} from '../src/core/air-state'
import {foodTrainingLungAsh,foodTrainingReady,foodTrainingRisk} from '../src/core/food-training'
import {exposeDisease} from '../src/core/conditions'
import {player,turnOf,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {adoptMarketStockAdditions,economyTick} from '../src/core/economy'
import {startCraft} from '../src/core/crafting'
import {serialize,deserialize} from '../src/core/save'
import {Rng,seedState} from '../src/core/rng'
import {SAVE_VERSION} from '../src/core/game'
import {foodTrainingTip,displayAirLines} from '../src/client/locales/food-training'
import {preferences} from '../src/client/preferences'
import {ensureBestiary} from '../src/core/bestiary-state'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {boiledMealFixture} from './boiled-meal-fixture'
import {finishBase} from './base-camp-fixture'
import {drinkVolume} from '../src/core/wash-water'
import type {DiseaseDef} from '../src/core/types'

afterEach(()=>{preferences.language='ko'})
const disease=(w:World)=>w.db.get<DiseaseDef>('Disease.GreyFever')
function setup(){const d=clinicalDiseaseFixture('ash-cake-body');d.p.immuneDiseases=[];return{...d,start:turnOf(d.w)}}
function eat(d:ReturnType<typeof setup>,day=0){d.s.time=(d.start+day*TURNS_PER_DAY)*100;const cake=d.add('Item.AshCake');expect(perform(d.w,d.p,{type:'consume',uid:cake.uid}).ok).toBe(true);expect(cake.def).toBe('Item.Bowl');return cake}
function course(d:ReturnType<typeof setup>){for(let day=0;day<30;day++)eat(d,day)}
function mature(d:ReturnType<typeof setup>){course(d);d.s.time=(d.start+30*TURNS_PER_DAY)*100}

describe('actual ashcake food, spaced monthly exposure and the same injured body',()=>{
 it('consumes original grain/ash/water at actual fire completion and reuses the same bowl UID',()=>{
  const d=boiledMealFixture(),ash=d.add('Item.PilgrimAsh'),uid=d.bowl.uid,water=drinkVolume(d.w,d.bottle),next=d.s.nextId
  expect(startCraft(d.w,d.p,'Recipe.AshCake',1)).toBeNull();expect(d.bowl.def).toBe('Item.Bowl');expect(ash.count).toBe(1);finishBase(d.w,d.p)
  const cooked=d.p.bag.find(i=>i.uid===uid)!;expect(cooked.def).toBe('Item.AshCake');expect(cooked.uid).toBe(uid);expect(d.p.bag.some(i=>i.uid===ash.uid)).toBe(false);expect(d.oats.count).toBe(2);expect(drinkVolume(d.w,d.bottle)).toBe(water-220);expect(d.s.nextId).toBe(next)
  expect(perform(d.w,d.p,{type:'consume',uid}).ok).toBe(true);expect(cooked.def).toBe('Item.Bowl');expect(cooked.uid).toBe(uid);expect(foodTrainingLungAsh(d.p)).toBe(.333333)
 })
 it('requires both 30 spaced servings and a full 30 days, charges exactly 10 lung burden, and grants no knowledge',()=>{
  const d=setup(),knowledge=JSON.stringify(d.s.knowledge);course(d)
  expect(foodTrainingReady(d.w,d.p,disease(d.w))).toBe(false);expect(foodTrainingLungAsh(d.p)).toBe(10);expect(inhaledAsh(d.p)).toBe(0);expect(d.p.needs.ash??0).toBe(0)
  d.s.time=(d.start+30*TURNS_PER_DAY)*100;expect(foodTrainingRisk(d.w,d.p,disease(d.w))).toBe(.7);expect(d.p.immuneDiseases).toEqual([]);expect(JSON.stringify(d.s.knowledge)).toBe(knowledge)
  const before=serialize(d.s);foodTrainingRisk(d.w,d.p,disease(d.w));foodTrainingTip(d.w,d.p,'Item.AshCake');expect(serialize(d.s)).toBe(before)
 })
 it('extra same-day servings do not shorten the course and still charge the full physical cost',()=>{const d=setup();for(let i=0;i<30;i++)eat(d);expect(d.p.body.foodTraining!['Disease.GreyFever'].servings).toBe(1);expect(foodTrainingLungAsh(d.p)).toBe(10);d.s.time+=30*TURNS_PER_DAY*100;expect(foodTrainingRisk(d.w,d.p,disease(d.w))).toBe(1)})
 it('an unfinished gap over 48 hours restarts progress without removing past lung injury',()=>{const d=setup();eat(d);eat(d,1);eat(d,3);expect(d.p.body.foodTraining!['Disease.GreyFever'].servings).toBe(3);eat(d,5+1/TURNS_PER_DAY);expect(d.p.body.foodTraining!['Disease.GreyFever'].servings).toBe(1);expect(foodTrainingLungAsh(d.p)).toBe(1.333333)})
 it('completed resistance persists while further actual servings still injure the same lungs',()=>{const d=setup();mature(d);eat(d,300);expect(foodTrainingRisk(d.w,d.p,disease(d.w))).toBe(.7);expect(foodTrainingLungAsh(d.p)).toBe(10.333333);d.p.body.inhaledAsh=110;expect(lungAshBurden(d.p)).toBe(120.333333);expect(ashLungCap(d.w,d.p)).toBe(.95);expect(inhaledAsh(d.p)).toBe(110)})
 it('only changes new Grey fever exposure thresholds; other diseases and current infections are unchanged',()=>{
  const d=setup();mature(d);let seed=0,state=seedState('food-threshold-'+seed,'body')
  while(new Rng([...state] as typeof state).float()<.7)state=seedState('food-threshold-'+(++seed),'body')
  d.s.rng.body=[...state] as typeof state;const other:World={db:d.w.db,s:deserialize(serialize(d.s))};delete player(other).body.foodTraining
  expect(exposeDisease(d.w,d.p,'Disease.GreyFever',1)).toBe(false);expect(exposeDisease(other,player(other),'Disease.GreyFever',1)).toBe(true)
  expect(exposeDisease(d.w,d.p,'Disease.Dysentery',1)).toBe(true)
  d.p.diseases!.push({def:'Disease.GreyFever',incubatesUntil:turnOf(d.w)+100,progress:25,immunity:10});const existing=structuredClone(d.p.diseases);eat(d,301);expect(d.p.diseases).toEqual(existing)
 })
 it('refused/empty food, normal food and complete books create no dietary resistance or injury',()=>{const d=setup(),cake=d.add('Item.AshCake');cake.uses=0;expect(perform(d.w,d.p,{type:'consume',uid:cake.uid}).ok).toBe(false);const food=d.add('Item.Hardtack');expect(perform(d.w,d.p,{type:'consume',uid:food.uid}).ok).toBe(true);d.p.booksRead=['Item.SettlementMycologyRecords'];d.p.literacyBooks=[...d.p.booksRead];expect(d.p.body.foodTraining).toBeUndefined();expect(foodTrainingRisk(d.w,d.p,disease(d.w))).toBe(1)})
 it('actual feeding updates only the recipient body and leaves the provider with the original bowl',()=>{const d=setup(),target=d.doctor(),cake=d.add('Item.AshCake');expect(consumeFor(d.w,d.p,target,cake.uid).ok).toBe(true);expect(target.body.foodTraining!['Disease.GreyFever'].lastItemUid).toBe(cake.uid);expect(d.p.body.foodTraining).toBeUndefined();expect(cake.def).toBe('Item.Bowl')})
 it('protects physiological claims behind the actor’s own book and successful specimen evidence',()=>{
  const d=setup();mature(d);preferences.language='en';expect(foodTrainingTip(d.w,d.p,'Item.AshCake').join('\n')).not.toMatch(/0\.70|Grey fever|30 days|Resistance formed/)
  d.p.booksRead=['Item.SettlementMycologyRecords'];d.p.literacyBooks=[...d.p.booksRead];expect(foodTrainingTip(d.w,d.p,'Item.AshCake').join('\n')).not.toContain('0.70')
  ensureBestiary(d.w,'Creature.BurrowRat').dissected=1;const known=foodTrainingTip(d.w,d.p,'Item.AshCake').join('\n');expect(known).toMatch(/Grey fever exposure risk ×0.70/);expect(known).toContain('Resistance formed');expect(known).not.toMatch(/[가-힣]/)
  const npc=d.doctor();expect(foodTrainingTip(d.w,npc,'Item.AshCake').join('\n')).not.toContain('0.70');preferences.language='ko';expect(displayAirLines(d.w,d.p)).toEqual(airLines(d.w,d.p))
 })
 it('retains exact course/phase/body/UID state over save and rejects invalid current or dormant records',()=>{
  const d=setup();course(d);const raw=serialize(d.s),copy={db:d.w.db,s:deserialize(raw)};expect(serialize(copy.s)).toBe(raw)
  for(const patch of [{servings:1.5},{lastAt:turnOf(d.w)+1},{firstAt:-1},{lungAsh:Infinity},{ashPhase:365},{lastItemUid:0}]){const state=JSON.parse(raw);Object.assign(state.creatures.find((c:{id:number})=>c.id===d.p.id).body.foodTraining['Disease.GreyFever'],patch);expect(()=>deserialize(JSON.stringify(state))).toThrow(/식이 노출/)}
  const old=JSON.parse(raw);old.version=219;delete old.creatures.find((c:{id:number})=>c.id===d.p.id).body.foodTraining;const migrated=deserialize(JSON.stringify(old));expect(migrated.version).toBe(SAVE_VERSION);expect(player({db:d.w.db,s:migrated}).body.foodTraining).toBeUndefined()
  const actor=d.doctor();actor.body.foodTraining=structuredClone(d.p.body.foodTraining);d.s.creatures=d.s.creatures.filter(c=>c.id!==actor.id);d.s.offCreatures.hidden=[actor];actor.body.foodTraining!['Disease.GreyFever'].lastAt=turnOf(d.w)+1;expect(()=>deserialize(serialize(d.s))).toThrow(/식이 노출/)
 })
 it('validates decoded JSON keys in both current and dormant dietary records',()=>{
  for(const dormant of [false,true]){
   const d=setup();eat(d);const raw=serialize(d.s),encode=(text:string)=>text.replaceAll('"foodTraining"','"\\u0066oodTraining"')
   expect(serialize(deserialize(encode(raw)))).toBe(raw)
   const actor=dormant?d.doctor():d.p;actor.body.foodTraining=structuredClone(d.p.body.foodTraining)
   if(dormant){delete d.p.body.foodTraining;d.s.creatures=d.s.creatures.filter(c=>c.id!==actor.id);d.s.offCreatures.hidden=[actor]}
   actor.body.foodTraining!['Disease.GreyFever'].lungAsh=-1;const encoded=encode(serialize(d.s))
   expect(encoded).not.toContain('"foodTraining"');expect(()=>deserialize(encoded)).toThrow(/식이 노출/)
  }
 })
 it('adds one finite market batch exactly once, including after save, and daily economy cannot respawn it',()=>{
  const d=setup();const market=Object.values(d.s.overworld!.markets!).find(m=>m.stockDef==='Stock.pilgrims')!;expect(market).toBeTruthy()
  const count=()=>market.items.filter(i=>i.def==='Item.PilgrimAsh').reduce((n,i)=>n+i.count,0);expect(count()).toBe(30);const uids=market.items.filter(i=>i.def==='Item.PilgrimAsh').map(i=>i.uid);adoptMarketStockAdditions(d.w);expect(count()).toBe(30);expect(market.items.filter(i=>i.def==='Item.PilgrimAsh').map(i=>i.uid)).toEqual(uids)
  market.items=market.items.filter(i=>i.def!=='Item.PilgrimAsh');adoptMarketStockAdditions(d.w);economyTick(d.w,30);expect(count()).toBe(0);const copy={db:d.w.db,s:deserialize(serialize(d.s))};adoptMarketStockAdditions(copy);expect(copy.s.overworld!.markets![market.site].items.some(i=>i.def==='Item.PilgrimAsh')).toBe(false)
 })
})
