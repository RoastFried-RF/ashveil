import {describe,it,expect} from 'vitest'
import {loadDb,readPackages} from '../tools/loadContent'
import {loadMods,type PatchOp,type ModPackage} from '../src/core/defs'
import {newGame,SAVE_VERSION} from '../src/core/game'
import {TURNS_PER_DAY,type World} from '../src/core/ctx'
import {calendar,calendarAtDay,seasons} from '../src/core/climate-state'
import {seasonalProductionMultiplier,settlementCommodity,worldSimulationTick,initializeWorldSimulation} from '../src/core/world-simulation'
import {serialize,deserialize} from '../src/core/save'
import {db} from './helpers'
const template=newGame(db,{seed:'seasonal-village-production',overworld:true})
function setup(contentDb=db){const w:World={db:contentDb,s:structuredClone(template)},sim=w.s.overworld!.simulation!,site=w.s.overworld!.sites.find(s=>s.id==='Region.ShepherdDale')!,stock=sim.settlements[site.id]!;return{w,sim,site,stock}}
function ruleDb(value:unknown,remove=false){const pkgs=readPackages(),core=pkgs.find(p=>p.manifest.id==='core')!;core.patches.push({op:remove?'remove':'replace',target:'WorldSimulation.Hearth',path:'/seasonalProduction',...(remove?{}:{value})}as PatchOp);return loadMods(pkgs,[])}
const at=(w:World,day:number)=>{w.s.time=day*TURNS_PER_DAY*100;worldSimulationTick(w)}
describe('실제 완료일의 계절 식량 생산',()=>{
 it.each([[46,'Season.Spring',.8],[66,'Season.Summer',1.4],[81,'Season.Autumn',2.3],[11,'Season.Winter',.2]]as const)('실제 달력의 %i일/%s 계수 %f가 조회만으로 세계를 바꾸지 않는다',(day,season,mult)=>{
  const{w}=setup(),before=serialize(w.s);expect(calendarAtDay(w,day).season.id).toBe(season);expect(seasonalProductionMultiplier(w,'coalition','Food',day)).toBe(mult);expect(serialize(w.s)).toBe(before)
 })
 it('현재 달력과 임의날짜 달력은100일 범위에서 일치하며계절길이를데이터로쓴다',()=>{
  const{w}=setup();for(let day=0;day<=100;day++){w.s.time=day*TURNS_PER_DAY*100;expect(calendar(w)).toEqual(calendarAtDay(w,day))}
  const extra:ModPackage={manifest:{id:'test-season-length',name:'계절길이',version:'1'},defs:[],patches:[{op:'replace',target:'Season.Spring',path:'/lengthDays',value:25}]},d=loadMods(readPackages().concat(extra),[]).db
  // 명시 활성화된 수정 달력은 기존90일을 하드코딩하지 않는다.
  const selected=loadMods(readPackages().concat(extra),['test-season-length']);expect(selected.report.errors).toEqual([]);expect(calendarAtDay({...w,db:selected.db},100).yearDays).toBe(95);expect(d.loadHash).toBe(db.loadHash)
 })
 it('정책/해당세력/물자/계절을 생략하면1이며 생산기초값·연료/소금은그대로다',()=>{
  const{w,stock}=setup();expect(seasonalProductionMultiplier(w,'guild','Food')).toBe(1);expect(seasonalProductionMultiplier(w,undefined,'Food')).toBe(1);expect(seasonalProductionMultiplier(w,'coalition','Fuel')).toBe(1)
  const base=ruleDb(null,true);expect(base.report.errors).toEqual([]);expect(seasonalProductionMultiplier({...w,db:base.db},'coalition','Food')).toBe(1)
  const partial=ruleDb({factions:['coalition'],seasons:{'Season.Winter':{Food:0}}});expect(partial.report.errors).toEqual([]);expect(seasonalProductionMultiplier({...w,db:partial.db},'coalition','Food')).toBe(1);expect(seasonalProductionMultiplier({...w,db:partial.db},'coalition','Food',11)).toBe(0)
  const original=structuredClone(stock.production);at(w,1);expect(stock.production).toEqual(original);expect(settlementCommodity(w,stock,'Food')).toBe(2588);expect(settlementCommodity(w,stock,'Fuel')).toBe(598);expect(settlementCommodity(w,stock,'Salt')).toBe(81)
 })
 it('옵션을 없앤 기존09 검산의2400+160−180=2380이 유지된다',()=>{const d=ruleDb(null,true),{w,stock}=setup(d.db);at(w,1);expect(settlementCommodity(w,stock,'Food')).toBe(2380)})
 it('기본90일의 계절 가중 생산합은 기존90일분과 정확히 같다',()=>{const{w}=setup();const weighted=seasons(w).reduce((sum,s)=>sum+s.lengthDays*(w.db.get<import('../src/core/types').WorldSimulationDef>('WorldSimulation.Hearth').seasonalProduction!.seasons[s.id]!.Food??1),0);expect(weighted).toBe(90)})
 it('계절경계를 넘는3일 일괄정산과 매일 정산은 전체 상태가 같고 완료일을 사용한다',()=>{
  const a=setup(),b=setup();for(const{w,sim}of[a,b]){sim.day=10;sim.marketDay=10;for(const m of Object.values(w.s.overworld!.markets!)){m.day=10;m.nextRestock=Math.max(m.nextRestock,11)}w.s.time=10*TURNS_PER_DAY*100}
  const before=settlementCommodity(a.w,a.stock,'Food');at(a.w,13);for(let day=11;day<=13;day++)at(b.w,day)
  expect(serialize(a.w.s)).toBe(serialize(b.w.s));expect(settlementCommodity(a.w,a.stock,'Food')).toBeCloseTo(before+(368-180)+2*(32-180),8)
 })
 it('유한 충분저장고의90일 생산/소비는연간원래예산을보존하며현재시각계절하나로소급하지않는다',()=>{
  const{w,stock}=setup();stock.reserve.Food=100000;const before=settlementCommodity(w,stock,'Food');at(w,90);expect(settlementCommodity(w,stock,'Food')).toBeCloseTo(before+160*90-180*90,7)
 })
 it('중복 일일정산과초기화는 이미기록한저장고·정산일·난수·UID를바꾸지않는다',()=>{const{w}=setup();at(w,13);const before=serialize(w.s);worldSimulationTick(w);initializeWorldSimulation(w);expect(serialize(w.s)).toBe(before)})
 it('현재198헤더의같은유한원문은현재버전으로만변환하고다음실제정산만진행한다',()=>{
  const{w}=setup();const current=JSON.parse(serialize(w.s)),legacy={...current,version:198},restored=deserialize(JSON.stringify(legacy));expect(restored).toEqual({...current,version:SAVE_VERSION});const other={db,s:restored};at(w,1);at(other,1);expect(serialize(other.s)).toBe(serialize(w.s))
 })
 it.each([null,{},{factions:[],seasons:{}},{factions:['missing'],seasons:{'Season.Winter':{Food:.2}}},{factions:['coalition','coalition'],seasons:{'Season.Winter':{Food:.2}}},{factions:['coalition'],seasons:{'Season.Missing':{Food:.2}}},{factions:['coalition'],seasons:{'Season.Winter':{Food:-.1}}},{factions:['coalition'],seasons:{'Season.Winter':{Food:11}}},{factions:['coalition'],seasons:{'Season.Winter':{Food:NaN}}},{factions:['coalition'],seasons:{'Season.Winter':{Food:'1'}}},{factions:['coalition'],seasons:{'Season.Winter':{Unknown:1}}},{factions:['coalition'],seasons:{'Season.Winter':{}}}])('잘못된 계절 생산 정책을 실제로더가 거절한다 %#',value=>{expect(ruleDb(value).report.errors.length).toBeGreaterThan(0)})
 it('같은저장원문의중간복원은계절경계를넘는일일정산의전체상태를보존한다',()=>{const{w}=setup();at(w,10);const copy:World={db,s:deserialize(serialize(w.s))};at(w,13);at(copy,13);expect(serialize(copy.s)).toBe(serialize(w.s))})
 it('표시/배낭 원본16 PNG 예제는 이생산규칙을추가하거나바꾸지않는다',()=>{const a=loadDb(),b=loadDb(['sample-original-textures']);expect(a.report.errors).toEqual([]);expect(b.report.errors).toEqual([]);expect(b.db.get('WorldSimulation.Hearth')).toEqual(a.db.get('WorldSimulation.Hearth'))})
})
