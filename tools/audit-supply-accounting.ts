// 새 장부를 제외한 전체 세계가 이전 검증본의 실제 경제 처리와 같은지 독립 실행으로 비교한다.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve,join,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {loadDb} from './loadContent'
import {newGame,SAVE_VERSION} from '../src/core/game'
import {TURNS_PER_DAY,type World} from '../src/core/ctx'
import {worldSimulationTick,worldSimulationDef} from '../src/core/world-simulation'
import {serialize,stateHash} from '../src/core/save'

const[previousPath,outputPath]=process.argv.slice(2)
if(!previousPath||!outputPath)throw Error('이전 불변본 경로와 새 출력 경로가 필요하다')
const previous=resolve(previousPath),output=resolve(outputPath),source=join(previous,'src/core/world-simulation.ts')
if(existsSync(output))throw Error('기존 결과는 덮어쓰지 않는다')
const baseline=await import(pathToFileURL(source).href) as {worldSimulationTick(w:World):void}
const{db,report}=loadDb();assert.deepEqual(report.errors,[])
const sourceSha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex')
const physical=(w:World)=>{const s=JSON.parse(serialize(w.s));s.version=SAVE_VERSION;for(const stock of Object.values(s.overworld.simulation.settlements) as {lastSupply?:unknown}[])delete stock.lastSupply;return s}
const rows=[]
for(const mode of['empty','fractional','surplus','resident-credit','infected-population','season-boundary']as const){
 const w:World={db,s:newGame(db,{seed:'supply-physical-baseline-'+mode,overworld:true})},m=w.s.overworld!,sim=m.simulation!,site=m.sites.find(s=>s.id==='Region.ShepherdDale')!,stock=sim.settlements[site.id]!,market=m.markets![site.id],d=worldSimulationDef(w)
 stock.production.Food=mode==='surplus'||mode==='season-boundary'?160:0;stock.reserve.Food=mode==='empty'?0:mode==='fractional'?1.25:1000
 market.items=market.items.filter(i=>d.items[i.def]?.commodity!=='Food'||mode==='fractional'&&i.def==='Item.Hardtack')
 if(mode==='fractional')market.items.find(i=>i.def==='Item.Hardtack')!.count=3
 if(mode==='resident-credit')stock.residentConsumption={day:0,units:{Food:.56}}
 if(mode==='infected-population'){stock.population.S-=20;stock.population.I+=20}
 const startDay=mode==='season-boundary'?10:0
 sim.day=startDay;sim.marketDay=startDay
 for(const market of Object.values(m.markets!)){market.day=startDay;market.nextRestock=1e12}
 w.s.time=startDay*TURNS_PER_DAY*100
 // 초기 유한 상태는 같으며, 이전 함수는 자기 불변본의 모듈/계수를 사용한다.
 const old:World={db,s:structuredClone(w.s)},daily=[]
 for(let day=1;day<=3;day++){
  w.s.time=old.s.time=(startDay+day)*TURNS_PER_DAY*100
  baseline.worldSimulationTick(old);worldSimulationTick(w)
  assert.deepEqual(physical(w),physical(old),mode+' day'+day+' whole physical state')
  daily.push({completedDay:startDay+day-1,allPhysicalStateEqualToPrevious:true,ledger:structuredClone(stock.lastSupply)})
 }
 rows.push({mode,days:3,allPhysicalStateEqualToPrevious:true,previousFinalHash:stateHash(old.s),currentFinalHash:stateHash(w.s),daily})
}
const result={status:'PASS',previous,previousWorldSimulationSha256:sourceSha(source),currentWorldSimulationSha256:sourceSha('src/core/world-simulation.ts'),scenarios:rows.length,comparedWholeWorlds:rows.length*3,scope:'Same finite initial worlds run through previous immutable WorldSimulation and current module. ONLY lastSupply metadata excluded; version normalized. All other bodies/items/reserves/market/UID/RNG/time/SIR/maps exact in6scenarios×3days. Not live browser, normal-play history, World30 or long-term famine proof.',rows}
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:result.status,scenarios:result.scenarios,comparedWholeWorlds:result.comparedWholeWorlds,output}))
