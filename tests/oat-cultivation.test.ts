import {describe,it,expect} from 'vitest'
import {oatCultivationFixture as setup} from './oat-cultivation-fixture'
import {cultivationTick,cultivationStatus,cultivationWaterQuote} from '../src/core/cultivation'
import {perform,consumeFor} from '../src/core/actions'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {tileAt,turnOf,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {drinkVolume} from '../src/core/wash-water'
import {canStack,makeItem,addToBag} from '../src/core/items'
import {finishBase} from './base-camp-fixture'
import {unheatedMealFixture} from './unheated-meal-fixture'
import {prepareUnheatedMeal} from '../src/core/unheated-meal'
import {cookingTick,takeCooking} from '../src/core/cooking'
import {displayTile} from '../src/client/map-memory'
import {invalidateLights} from '../src/core/fov'
import {db} from './helpers'

function harvest(d:ReturnType<typeof setup>){for(let i=0;i<3;i++)d.act({type:'wait'});d.act({type:'gather',pos:d.pos});return d.p.bag.find(i=>i.def==='Item.Oats'&&i.uid!==d.cleanUid)!}
function dirtyHarvest(){const d=setup('nearRipe',true),grain=harvest(d);return{...d,grain}}
function tickCooking(w:World,n:number){for(let i=0;i<n;i++){w.s.time+=100;cookingTick(w)}}

describe('실제 귀리의 새 성장과 곡물 관수 오염',()=>{
 it('종자한개를실제1턴에쓰며과거물·성장·고정수확시각은만들지않는다',()=>{
  const d=setup(),at=d.s.time;d.act({type:'place',uid:d.seedsUid,dir:2})
  expect(d.s.time-at).toBe(100);expect(d.seed().count).toBe(2);expect(d.crop()).toMatchObject({valid:true,ready:false,total:144000,progress:0,waterMl:0});expect(d.crop().state.seedUid).toBe(d.seedsUid);expect(tileAt(d.w,d.pos).gatherAt).toBeUndefined()
 })
 it('물없이실제20턴을보내도귀리와가짜수확은늘지않는다',()=>{
  const d=setup('dry');for(let i=0;i<20;i++)d.act({type:'wait'});expect(d.crop().state.growth).toBe(0);expect(d.crop().waterMl).toBe(0);expect(d.p.bag.find(i=>i.uid===d.cleanUid)!.count).toBe(2);expect(perform(d.w,d.p,{type:'gather',pos:d.pos}).ok).toBe(false)
 })
 it('실제관수1턴은원래1000ml만소비하고현재첫성장·증발만정산한다',()=>{
  const d=setup('dry'),next=d.s.nextId,at=d.s.time;d.act({type:'waterCrop',pos:d.pos,uid:d.waterUid,ml:1000})
  expect(d.s.time-at).toBe(100);expect(drinkVolume(d.w,d.water())).toBe(0);expect(d.s.nextId).toBe(next);expect(d.crop().state.growth).toBe(1);expect(d.crop().state.waterUnits).toBe(1000*144000-1000-120)
 })
 it('그늘뿌리보다더많은실제햇빛이필요하고등불은대신하지못한다',()=>{
  const d=setup('watered'),grown=d.crop().state.growth;d.s.map.daylightMult=.2;d.s.map.lights=[{pos:{...d.pos},radius:8,kind:'torch'}];invalidateLights(d.w);d.act({type:'wait'})
  expect(d.crop().light).toBeCloseTo(.144);expect(d.crop().error).toContain('햇빛');expect(d.crop().state.growth).toBe(grown)
 })
 it('밝은지하조명도곡물이자랄햇빛을만들지않는다',()=>{
  const d=setup('watered'),grown=d.crop().state.growth;d.s.map.kind='dungeon';d.s.map.ambient=1;d.act({type:'wait'});expect(d.crop().error).toContain('햇빛');expect(d.crop().state.growth).toBe(grown)
 })
 it('실제영하새벽에는빛·물이충분해도자라지않는다',()=>{
  const d=setup('watered'),grown=d.crop().state.growth;d.s.time=(TURNS_PER_DAY+5*1200)*100;d.p.nextAct=d.s.time;cultivationTick(d.w);expect(d.crop().temp).toBeLessThan(0);expect(d.crop().state.growth).toBe(grown)
 })
 it('5일시각점프를과거유효성장으로소급하지않는다',()=>{
  const d=setup('watered'),grown=d.crop().state.growth;d.s.time+=5*TURNS_PER_DAY*100;cultivationTick(d.w);expect(d.crop().state.growth-grown).toBe(1);expect(d.crop().ready).toBe(false)
 })
 it('같은시각정산과관수견적조회는전체각인을바꾸지않는다',()=>{
  const d=setup('dry'),before=serialize(d.s);cultivationStatus(d.w,d.pos);cultivationWaterQuote(d.w,d.p,d.pos,d.waterUid,1000);cultivationTick(d.w);expect(serialize(d.s)).toBe(before)
 })
 it('별도남은3성장턴초기밭은실제3턴·수확뒤에만귀리5개를준다',()=>{
  const d=setup('nearRipe',true),at=d.s.time,uid=d.crop().state.seedUid;expect(d.crop().ready).toBe(false);const grain=harvest(d)
  expect(grain.count).toBe(5);expect(d.s.time-at).toBe(1500);expect(d.crop().state.growth).toBe(0);expect(d.crop().waterMl).toBe(0);expect(d.crop().state.seedUid).toBe(uid);expect(d.seed().count).toBe(2);expect(d.p.bag.find(i=>i.uid===d.cleanUid)!.count).toBe(2)
 })
 it('직접먹지않는곡물5묶음에도실제관수에서옮은병원체·재를나눠보존한다',()=>{
  const d=dirtyHarvest();expect(db.item('Item.Oats').food).toBeUndefined();expect(d.grain.foodWater).toMatchObject({ml:20,quality:{pathogen:60,ash:0}});expect(d.grain.contaminantAsh).toBeCloseTo(.04,12)
  expect(d.grain.foodWater!.ml*d.grain.count).toBe(100);expect(d.grain.foodWater!.ml*d.grain.foodWater!.quality.pathogen*d.grain.count).toBe(6000);expect(d.grain.contaminantAsh!*d.grain.count).toBeCloseTo(.2,12);expect(d.crop().state.irrigation).toBeUndefined()
 })
 it('오염된새곡물과원래맑은귀리2개를합쳐오염을세탁하지않는다',()=>{
  const d=dirtyHarvest(),clean=d.p.bag.find(i=>i.uid===d.cleanUid)!;expect(canStack(clean,d.grain)).toBe(false);expect(clean.count).toBe(2);expect(clean.foodWater).toBeUndefined();expect(clean.contaminantAsh).toBeUndefined()
 })
 it('맑은관수의귀리수확에는새오염을만들지않는다',()=>{
  const d=setup('nearRipe');harvest(d);for(const i of d.p.bag.filter(i=>i.def==='Item.Oats')){expect(i.foodWater).toBeUndefined();expect(i.contaminantAsh).toBeUndefined()}expect(d.p.bag.filter(i=>i.def==='Item.Oats').reduce((n,i)=>n+i.count,0)).toBe(7)
 })
 it('곡물은조리재료이며바로먹어열량이나물을생성할수없다',()=>{
  const d=dirtyHarvest(),before=stateHash(d.s);expect(consumeFor(d.w,d.p,d.p,d.grain.uid).ok).toBe(false);expect(stateHash(d.s)).toBe(before)
 })
 it('실제수확곡물한개가같은그릇·물220ml와합쳐지고399턴까지병원체가남는다',()=>{
  const source=dirtyHarvest(),d=unheatedMealFixture(220);d.p.bag=d.p.bag.filter(i=>i.uid!==d.oats.uid);const grain=makeItem(d.w,'Item.Oats',source.grain.count);grain.foodWater=structuredClone(source.grain.foodWater);grain.contaminantAsh=source.grain.contaminantAsh;expect(addToBag(d.w,d.p,grain)).toBe(0);d.bottle.water={pathogen:0,ash:0,source:'초기 조리용 담수'}
  expect(prepareUnheatedMeal(d.w,d.p,d.recipe)).toBeNull();const b=d.s.map.cooking![0];expect(grain.count).toBe(4);expect(b.item.uid).toBe(d.bowl.uid);expect(b.item.foodWater!.ml).toBe(240);expect(b.item.foodWater!.quality.pathogen).toBe(5);expect(b.item.contaminantAsh).toBeCloseTo(.04,12);expect(drinkVolume(d.w,d.bottle)).toBe(0)
  tickCooking(d.w,399);expect(b.item.def).toBe('Item.UnheatedOatmealBowl');expect(b.item.foodWater!.quality.pathogen).toBe(5);tickCooking(d.w,1);expect(b.item.def).toBe('Item.OatmealBowl');expect(b.item.foodWater).toBeUndefined();expect(b.item.contaminantAsh).toBeCloseTo(.04,12);expect(takeCooking(d.w,d.p,b.item.uid)).toBeNull();expect(b.item.quality).toBe(3);expect(b.item.durability).toBe(81)
 })
 it('구형202의옛귀리밭은버전만바꾸고수확시각·수량5개를보존한다',()=>{
  const d=setup();tileAt(d.w,d.pos).t='Terrain.OatPlot';tileAt(d.w,d.pos).gatherAt=turnOf(d.w)+144000;const raw=JSON.parse(serialize(d.s));raw.version=202;const restored=deserialize(JSON.stringify(raw));expect(restored).toEqual({...raw,version:SAVE_VERSION});const w:World={db:d.w.db,s:restored},p=w.s.creatures.find(c=>c.id===w.s.playerId)!
  expect(tileAt(w,d.pos).cultivation).toBeUndefined();expect(perform(w,p,{type:'gather',pos:d.pos}).ok).toBe(false);w.s.time=tileAt(w,d.pos).gatherAt!*100;expect(perform(w,p,{type:'gather',pos:d.pos}).ok).toBe(true);finishBase(w,p);expect(p.bag.filter(i=>i.def==='Item.Oats').reduce((n,i)=>n+i.count,0)).toBe(7);expect(tileAt(w,d.pos).cultivation).toBeUndefined()
 })
 it('성장·실제관수오염·미완료휴식의예산별재개가전체저장후동일하다',()=>{
  const d=setup('pending',true),copy:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(copy);expect(serialize(copy.s)).toBe(serialize(d.s));expect(d.crop().state.irrigation!.ml).toBe(100)
 })
 it('숨은밭의현재성장·수분·관수오염은기억화면에노출하지않는다',()=>{
  const d=setup('watered',true),t=tileAt(d.w,d.pos);expect(displayTile(t,t.t,false).cultivation).toBeUndefined();expect(displayTile(t,t.t,true).cultivation).toBe(t.cultivation)
 })
})
