import {describe,it,expect} from 'vitest'
import {sourceContractsFixture} from './source-contracts-fixture'
import {acceptSourceContract,recordSourceContractWork,reportSourceContract,sourceOffers,sourceReportQuote,sourceSurveyQuote,surveySourceContract} from '../src/core/source-contracts'
import {cancelSupply,contractsTick} from '../src/core/contracts'
import {reputation} from '../src/core/diplomacy'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {tileAt,turnOf,type World} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
const total=(d:ReturnType<typeof sourceContractsFixture>)=>(d.p.money??0)+Object.values(d.m.markets??{}).reduce((n,m)=>n+m.money,0)+(d.m.contracts??[]).reduce((n,r)=>n+r.escrow,0)
describe('실제 관찰한 원래 기구의 새 봉쇄 의뢰',()=>{
 it('직접 관찰한 기구ID/완료상태 사본만 게시하며 조회는 세계/난수를 바꾸지 않는다',()=>{
  const d=sourceContractsFixture(),before=stateHash(d.s);expect(sourceOffers(d.w,d.p,d.trader)[0]).toEqual(d.offer);expect(d.offer.deviceUid).toBe(d.device.uid);expect(d.proof.observation.device).toEqual({uid:d.device.uid,def:d.device.def,completed:[]});expect(stateHash(d.s)).toBe(before)
  const map=d.m.scenes['Region.GreyCloister'].map;delete map.tiles[d.pos.y*map.w+d.pos.x].observed;expect(sourceOffers(d.w,d.p,d.trader)).toEqual([])
 })
 it('숨은 현장에 이미 봉쇄가 있어도 오래된 열린 관찰의 게시를 몰래 바꾸지 않는다',()=>{
  const d=sourceContractsFixture('staleOffer'),before=stateHash(d.s);expect(sourceOffers(d.w,d.p,d.trader)[0]).toEqual(d.offer);expect(d.source.closed).toBeDefined();expect(d.proof.observation.device!.completed).toEqual([]);expect(stateHash(d.s)).toBe(before)
 })
 it('구형 기구 식별 관찰이 없으면 현재 기구를 추정해 게시하지 않는다',()=>{
  const d=sourceContractsFixture(),map=d.m.scenes['Region.GreyCloister'].map;delete map.tiles[d.pos.y*map.w+d.pos.x].observed!.device;expect(sourceOffers(d.w,d.p,d.trader)).toEqual([])
 })
 it('보이지 않은 기구 식별자/완료 상태 변경도 과거 관찰 사본을 바꾸지 않는다',()=>{
  const d=sourceContractsFixture(),map=d.m.scenes['Region.GreyCloister'].map,device=map.tiles[d.pos.y*map.w+d.pos.x].device!;device.uid-=10;device.completed.push('seal');const before=stateHash(d.s);expect(sourceOffers(d.w,d.p,d.trader)[0]).toEqual(d.offer);expect(d.proof.observation.device!.uid).toBe(d.offer.deviceUid);expect(d.proof.observation.device!.completed).toEqual([]);expect(stateHash(d.s)).toBe(before)
 })
 it('자신의 수락 전 봉쇄도 현장 확인 후 이전 공사로만 반환한다',()=>{
  const d=sourceContractsFixture('staleSurvey');d.source.closed!.by=d.p.id;d.act({type:'sourceContractSurvey',contract:d.record!.id});expect(d.record!.proof!.result).toBe('alreadyClosed');d.home();expect(reportSourceContract(d.w,d.p,d.trader,d.record!.id)).toBeNull();expect(d.market.money).toBe(1000);expect(d.p.money??0).toBe(0)
 })
 it('작업 중 기한이 지나면 실제 공사는 남고 장부만 환급하며 완료 보수는 만들지 않는다',()=>{
  const d=sourceContractsFixture('work'),r=d.record!;r.deadline=turnOf(d.w)+200;d.act({type:'deviceWork',pos:d.pos,uid:d.device.uid,operation:'seal'});expect(d.source.closed).toBeDefined();expect(r.status).toBe('expired');expect(r.proof).toBeUndefined();expect(r.escrow).toBe(0);expect(d.market.money).toBe(1000);expect(d.p.money??0).toBe(0)
 })
 it('이전 공사 반환은 가득 찬 개인 지갑과 구별하고 은행 반환 한도는 원자적으로 검사한다',()=>{
  const d=sourceContractsFixture('staleReport');d.market.money=Number.MAX_SAFE_INTEGER;const before=stateHash(d.s);expect(reportSourceContract(d.w,d.p,d.trader,d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before);d.market.money=1000-d.record!.reward;d.p.money=Number.MAX_SAFE_INTEGER;expect(reportSourceContract(d.w,d.p,d.trader,d.record!.id)).toBeNull();expect(d.market.money).toBe(1000);expect(d.p.money).toBe(Number.MAX_SAFE_INTEGER)
 })
 it('장부 부족/보수변경/중복 수락은 전체 상태를 보존한다',()=>{
  const d=sourceContractsFixture(),before=stateHash(d.s);expect(acceptSourceContract(d.w,d.p,d.trader,d.offer.id,d.offer.reward+1)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  d.market.money=d.offer.reward-1;const poor=stateHash(d.s);expect(sourceOffers(d.w,d.p,d.trader)).toEqual([]);expect(acceptSourceContract(d.w,d.p,d.trader,d.offer.id)).toBeTruthy();expect(stateHash(d.s)).toBe(poor)
 })
 it('실제 수락1턴은 기존 장부 보수만 예치하고 작업 증거는 만들지 않는다',()=>{
  const d=sourceContractsFixture(),at=d.s.time,cash=total(d);d.act({type:'sourceContractAccept',target:d.trader.id,offer:d.offer.id,expectedReward:d.offer.reward});const r=d.m.contracts!.at(-1)!
  expect(d.s.time-at).toBe(100);expect(d.market.money).toBe(1000-d.offer.reward);expect(r.escrow).toBe(d.offer.reward);expect(r).not.toHaveProperty('proof');expect(total(d)).toBe(cash);const before=stateHash(d.s);expect(acceptSourceContract(d.w,d.p,d.trader,d.offer.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('단순 조회/허위 완료 호출은 새 작업 기록을 만들지 않는다',()=>{
  const d=sourceContractsFixture('work'),r=d.record!,before=stateHash(d.s);recordSourceContractWork(d.w,d.p,d.pos,d.device.uid,'seal');expect(r.proof).toBeUndefined();expect(sourceSurveyQuote(d.w,d.p,r.id).error).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('수락과 같은 시각의 이전 완료는 새 작업 보수로 소급하지 않는다',()=>{
  const d=sourceContractsFixture('staleSurvey');d.source.closed!.by=d.p.id;d.source.closed!.at=d.record!.accepted;d.act({type:'sourceContractSurvey',contract:d.record!.id});expect(d.record!.proof!.result).toBe('alreadyClosed');d.home();expect(reportSourceContract(d.w,d.p,d.trader,d.record!.id)).toBeNull();expect(d.p.money??0).toBe(0)
 })
 it('수락 뒤 실제400턴 작업만 원래 기구/공급원의 새 봉쇄를 기록한다',()=>{
  const d=sourceContractsFixture('work'),r=d.record!,at=d.s.time;d.act({type:'deviceWork',pos:d.pos,uid:d.device.uid,operation:'seal'});expect(d.s.time-at).toBe(40000);expect(r.proof).toEqual({at:turnOf(d.w)-1,by:d.p.id,deviceUid:d.device.uid,result:'sealed'});expect(d.source.count).toBe(18);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalCryptActorIds);expect(d.s.creatures.every(c=>c.alive)).toBe(true)
  const before=stateHash(d.s);recordSourceContractWork(d.w,structuredClone(d.p),d.pos,d.device.uid,'seal');recordSourceContractWork(d.w,d.p,d.pos,d.device.uid,'seal');expect(stateHash(d.s)).toBe(before)
 })
 it('다른지역/기구/작업ID/다른실제배우는 작업완료로 인정하지 않는다',()=>{
  const d=sourceContractsFixture('report'),r=d.record!;r.proof=undefined;d.field();const before=stateHash(d.s);recordSourceContractWork(d.w,d.p,d.pos,d.device.uid+1,'seal');recordSourceContractWork(d.w,d.p,d.pos,d.device.uid,'other');recordSourceContractWork(d.w,d.s.creatures.find(c=>c.id!==d.p.id)!,d.pos,d.device.uid,'seal');expect(stateHash(d.s)).toBe(before)
 })
 it('실제 보고1턴에 원래 예치금만 지급하며 이중 보고나 같은 기구 새 의뢰로 재지급하지 않는다',()=>{
  const d=sourceContractsFixture('report'),r=d.record!,cash=d.p.money??0,totalBefore=total(d),rep=reputation(d.w,d.trader.faction),at=d.s.time;d.act({type:'sourceContractReport',target:d.trader.id,contract:r.id,expectedReward:r.reward});expect(d.s.time-at).toBe(100);expect(r.status).toBe('completed');expect(r.escrow).toBe(0);expect(d.p.money).toBe(cash+r.reward);expect(reputation(d.w,d.trader.faction)).toBe(rep+5);expect(total(d)).toBe(totalBefore);expect(sourceOffers(d.w,d.p,d.trader)).toEqual([])
  const before=stateHash(d.s);expect(reportSourceContract(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('작업 기록 없이 원격 조회만으로 보고 보수를 받지 못한다',()=>{
  const d=sourceContractsFixture('accepted'),before=stateHash(d.s);expect(sourceReportQuote(d.w,d.p,d.trader,d.record!.id).error).toBeTruthy();expect(sourceSurveyQuote(d.w,d.p,d.record!.id).error).toBeTruthy();expect(reportSourceContract(d.w,d.p,d.trader,d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('이미 끝난 현장은 실제인접 확인1턴 후에만 새 작업과 구별한다',()=>{
  const d=sourceContractsFixture('staleSurvey'),r=d.record!,at=d.s.time;d.act({type:'sourceContractSurvey',contract:r.id});expect(d.s.time-at).toBe(100);expect(r.proof!.result).toBe('alreadyClosed');expect(r.proof!.by).not.toBe(d.p.id);expect(r.proof!.at).toBeLessThan(r.accepted)
 })
 it('이전 봉쇄 반환보고는 플레이어 돈/평판을 보존하고 은행만 환급한다',()=>{
  const d=sourceContractsFixture('staleReport'),r=d.record!,money=d.p.money,rep=reputation(d.w,d.trader.faction),at=d.s.time;d.act({type:'sourceContractReport',target:d.trader.id,contract:r.id});expect(d.s.time-at).toBe(100);expect(r.status).toBe('cancelled');expect(d.market.money).toBe(1000);expect(d.p.money).toBe(money);expect(reputation(d.w,d.trader.faction)).toBe(rep)
 })
 it.each(['far','asleep','dark','wrongUid']as const)('실제로 식별하지 못한 이전 봉쇄는 확인 실패 후 전체 상태를 보존한다 (%s)',mode=>{
  const d=sourceContractsFixture('staleSurvey');if(mode==='far')d.p.pos={x:1,y:1};if(mode==='asleep')d.p.asleep=true;if(mode==='dark'){for(const it of Object.values(d.p.equip))if(it)it.lit=false;d.s.map.lights=[]}if(mode==='wrongUid')tileAt(d.w,d.pos).device!.uid++
  const before=stateHash(d.s);expect(surveySourceContract(d.w,d.p,d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('취소/기한은 원래 장부로만 돌려보내고 미완료 공사를 자동으로 완성하지 않는다',()=>{
  const d=sourceContractsFixture('accepted');expect(cancelSupply(d.w,d.p,d.trader,d.record!.id)).toBeNull();expect(d.market.money).toBe(1000);expect(d.source.closed).toBeUndefined()
  const e=sourceContractsFixture('accepted');e.s.time=e.record!.deadline*100;contractsTick(e.w);expect(e.record!.status).toBe('expired');expect(e.market.money).toBe(1000);expect(e.source.closed).toBeUndefined()
 })
 it('지급 한도와 잘못된 보수는 증거/현금/전체 상태를 바꾸지 않는다',()=>{
  const d=sourceContractsFixture('report'),r=d.record!,before=stateHash(d.s);expect(reportSourceContract(d.w,d.p,d.trader,r.id,r.reward+1)).toBeTruthy();expect(stateHash(d.s)).toBe(before);d.p.money=Number.MAX_SAFE_INTEGER;const full=stateHash(d.s);expect(reportSourceContract(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(full)
 })
 it('140각인에 과거 의뢰나 보이지 않은 기구 관찰을 소급하지 않는다',()=>{
  const d=sourceContractsFixture(),raw=JSON.parse(serialize(d.s));raw.version=140;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:140}).toEqual(raw)
 })
 it('진행중400턴을 복원해도 같은 원래 자재/몸/시공자/예치/작업 기록이 남는다',()=>{
  const d=sourceContractsFixture('pending');expect(d.s.simulationPending).toBe(true);const w:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.record!.proof!.result).toBe('sealed');expect(d.source.count).toBe(18)
 })
 it.each([['/wealthMult',2],['/targets/0/operation','missing'],['/targets/0/source','missing'],['/targets/0/device','FieldDevice.TowerSensor']])('맞지 않는 실제 기구 연결을 시작 전에 거절한다 (%s)',(path,value)=>{
  const {report}=loadMods([...readPackages(),{manifest:{id:'bad-source-contract',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'SourceContract.Hearth',path,value}]}],['bad-source-contract']);expect(report.errors.some(e=>e.includes('SourceContract.Hearth'))).toBe(true)
 })
})
