import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { cancelSupply, contractsTick } from '../src/core/contracts'
import { player, tileAt, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { reputation } from '../src/core/diplomacy'
import { marketFor } from '../src/core/economy'
import { invalidateLights, updatePlayerVision } from '../src/core/fov'
import { newGame, playerAct } from '../src/core/game'
import { acceptInvestigation, investigationOffers, investigationReportQuote, investigationSurveyQuote, isInvestigation, reportInvestigation, surveyInvestigation } from '../src/core/investigation'
import { generateDungeon } from '../src/core/mapgen'
import { readNote } from '../src/core/rumors'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { db } from './helpers'
const template=newGame(db,{seed:'investigation-contract',background:'Bg.GuildMerchant',overworld:true})
function setup(){
  const w:World={db,s:structuredClone(template)},s=w.s,p=player(w),m=s.overworld!,site=m.sites.find((s)=>s.kind==='settlement'&&s.faction==='coalition')!
  expect(readNote(w,p,p.bag.find((it)=>it.def==='Item.OldLedger')!)).toBe(true)
  const rumor=s.knowledge.rumors!.find((r)=>r.kind==='room')!
  m.currentRegion=site.id;m.position={...site.cell};s.creatures=[p];s.sources=[];s.storyteller.budget=-1e9;s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20}
  for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
  initializeSettlement(w);const trader=s.creatures.find((c)=>c.traderSite)!,market=marketFor(w,trader)!;market.money=3000;p.money=100;p.pos={x:29,y:18};p.traits=[];p.abilities=[];p.age=undefined;p.background=undefined;p.hp=95;p.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(p.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,fatigue:10,stress:0,bodyTemp:37,wetness:0});for(const c of s.creatures)c.nextAct=c.id===p.id?s.time:1e12
  s.map.lights=[{pos:p.pos,radius:12,kind:'campfire'}];invalidateLights(w)
  const town={map:s.map,creatures:s.creatures}
  const accept=()=>{const offer=investigationOffers(w,p,trader)[0];expect(offer).toBeTruthy();expect(acceptInvestigation(w,p,trader,offer.id,offer.reward)).toBeNull();return m.contracts!.filter(isInvestigation)[0]}
  const field=(explore=false)=>{
    const r=m.contracts!.filter(isInvestigation)[0];s.map=generateDungeon(w,1).map;s.map.lights=[{pos:{x:r.rect.x+1,y:r.rect.y+1},radius:50,kind:'campfire'}];s.creatures=[p];m.currentRegion=r.region;p.pos={x:r.rect.x+1,y:r.rect.y+1};p.mapId=s.map.id;invalidateLights(w)
    if(explore)for(let y=r.rect.y+1;y<r.rect.y+r.rect.h-1;y++)for(let x=r.rect.x+1;x<r.rect.x+r.rect.w-1;x++){const pos={x,y};if(!w.db.terrain(tileAt(w,pos).t).passable)continue;p.pos=pos;updatePlayerVision(w,p)}
    return r
  }
  const home=()=>{s.map=town.map;s.creatures=town.creatures;m.currentRegion=site.id;p.mapId=s.map.id;p.pos={x:29,y:18};invalidateLights(w)}
  return{w,s,p,m,trader,market,site,rumor,accept,field,home}
}
describe('소문 현장 조사와 실제 귀환 보고 계약',()=>{
  it('실제로 읽은 소문의 위치만 게시하고 거리/위협 공식·경로 왕복/여유 기한을 고정한다',()=>{
    const{w,p,trader,rumor}=setup(),hash=stateHash(w.s),offers=investigationOffers(w,p,trader);expect(offers).toHaveLength(1);const o=offers[0];expect(o.mapId).toBe(rumor.mapId);expect(o.rect).toEqual(rumor.rect);expect(o.reward).toBe(20+o.distance*8+20);expect(o.deadlineTurns).toBe(Math.ceil(o.travelHours*1200+3*TURNS_PER_DAY));expect(stateHash(w.s)).toBe(hash);w.s.knowledge.rumors=[];expect(investigationOffers(w,p,trader)).toEqual([])
  })
  it('위치 정보가 빠지거나 소문 지도 밖으로 벗어난 구역은 의뢰하지 않는다',()=>{
    for(const mode of ['missing','outside']){const{w,p,trader,rumor}=setup();if(mode==='missing')rumor.mapW=undefined;else rumor.rect!.x=rumor.mapW!;const hash=stateHash(w.s);expect(investigationOffers(w,p,trader)).toEqual([]);expect(stateHash(w.s)).toBe(hash)}
  })
  it('현금/오래된 보수/이미 진행 중인 계약은 무효 수락을 원자적으로 거부한다',()=>{
    for(const mode of ['cash','reward','active']){const{w,p,trader,market,accept}=setup(),o=investigationOffers(w,p,trader)[0];if(mode==='cash')market.money=o.reward-1;if(mode==='active')accept();const hash=stateHash(w.s);expect(acceptInvestigation(w,p,trader,o.id,mode==='reward'?o.reward+1:o.reward)).toBeTruthy();expect(stateHash(w.s)).toBe(hash)}
  })
  it('수락은 시장 돈만 예치하고 현장 기록 없는 보고는 보수·물품을 바꾸지 않는다',()=>{
    const{w,p,trader,market,accept}=setup(),cash=market.money,bag=structuredClone(p.bag),id=w.s.nextId,r=accept();expect(p.money).toBe(100);expect(market.money).toBe(cash-r.reward);expect(r.escrow).toBe(r.reward);expect(p.bag).toEqual(bag);expect(w.s.nextId).toBe(id);const hash=stateHash(w.s);expect(reportInvestigation(w,p,trader,r.id)).toBeTruthy();expect(investigationSurveyQuote(w,p,r.id).error).toBeTruthy();expect(stateHash(w.s)).toBe(hash)
  })
  it('현장에서 실제 시야로 내부를 살핀 뒤1턴 조사 기록을 남기며 즉시 돈을 주지 않는다',()=>{
    const{w,p,accept,field}=setup(),r=accept();field();expect(investigationSurveyQuote(w,p,r.id).error).toMatch(/아직/);field(true);const hash=stateHash(w.s);expect(investigationSurveyQuote(w,p,r.id).error).toBeNull();expect(stateHash(w.s)).toBe(hash);const id=w.s.nextId;expect(perform(w,p,{type:'investigationSurvey',contract:r.id})).toEqual({ok:true,tu:100});expect(r.proof).toMatchObject({result:'confirmed',observedRoom:r.roomName});expect(p.money).toBe(100);expect(w.s.nextId).toBe(id);const done=stateHash(w.s);expect(surveyInvestigation(w,p,r.id)).toBeTruthy();expect(stateHash(w.s)).toBe(done)
  })
  it('틀린 방 번호의 소문도 현장의 실제 방만 기록하고 다른 미탐색 방 이름을 누출하지 않는다',()=>{
    const{w,p,accept,field}=setup(),r=accept();field(true);const local=r.roomIdx,other=(local+1)%w.s.map.rooms.length;w.s.map.rooms[other].name='원격 비밀 방';r.roomIdx=other;expect(surveyInvestigation(w,p,r.id)).toBeNull();expect(r.proof).toMatchObject({result:'disproved',observedRoom:r.roomName});expect(JSON.stringify(r.proof)).not.toContain('원격 비밀 방')
  })
  it('소문에 적힌 방이 실제로 없으면 불일치를 기록하고 정직한 조사 결과로 보고한다',()=>{
    const{w,p,trader,accept,field,home}=setup(),r=accept();field(true);w.s.map.rooms.splice(r.roomIdx,1);expect(surveyInvestigation(w,p,r.id)).toBeNull();expect(r.proof).toMatchObject({result:'disproved'});expect(r.proof!.observedRoom).toBeUndefined();home();expect(reportInvestigation(w,p,trader,r.id)).toBeNull();expect(r.status).toBe('completed');expect(p.money).toBe(100+r.reward)
  })
  it('다른 지역/층·구역 밖·어둠/수면/손·진행 중 활동은 기록을 만들지 않는다',()=>{
    for(const mode of ['region','map','pos','dark','sleep','hands','activity']){const{w,p,m,accept,field}=setup(),r=accept();field(true);if(mode==='region')m.currentRegion='elsewhere';if(mode==='map')w.s.map.id='crypt3';if(mode==='pos')p.pos={x:0,y:0};if(mode==='dark'){w.s.map.lights=[];w.s.map.ambient=0;invalidateLights(w)}if(mode==='sleep')p.asleep=true;if(mode==='hands')p.body.missing=['LeftUpperArm','RightUpperArm'];if(mode==='activity')p.activity={kind:'rest',remaining:1,total:1,label:'검증 중'};const hash=stateHash(w.s);expect(surveyInvestigation(w,p,r.id)).toBeTruthy();expect(stateHash(w.s)).toBe(hash)}
  })
  it('현장 기록 각인을 복원한 뒤 귀환 보고는 실제1턴·예치 지급/평판을 한 번만 반영한다',()=>{
    const{w,p,trader,market,accept,field,home}=setup(),r=accept();field(true);expect(surveyInvestigation(w,p,r.id)).toBeNull();home();const copy={db,s:deserialize(serialize(w.s))},cp=player(copy),ct=copy.s.creatures.find((c)=>c.id===trader.id)!,before=w.s.time,id=w.s.nextId,cash=market.money
    expect(playerAct(w,{type:'investigationReport',target:trader.id,contract:r.id,expectedReward:r.reward})).toBeNull();expect(playerAct(copy,{type:'investigationReport',target:ct.id,contract:r.id,expectedReward:r.reward})).toBeNull();expect(stateHash(copy.s)).toBe(stateHash(w.s));expect(w.s.time-before).toBe(100);expect(p.money).toBe(100+r.reward);expect(cp.money).toBe(p.money);expect(market.money).toBe(cash);expect(w.s.nextId).toBe(id);expect(reputation(w,'coalition')).toBe(2);expect(r.escrow).toBe(0);expect(investigationOffers(w,p,trader)).toEqual([]);const hash=stateHash(w.s);expect(reportInvestigation(w,p,trader,r.id)).toBeTruthy();expect(stateHash(w.s)).toBe(hash)
  })
  it('보고 전에 바뀐 보수와 안전 정수 범위를 넘는 지갑을 거부한다',()=>{
    const{w,p,trader,accept,field,home}=setup(),r=accept();field(true);expect(surveyInvestigation(w,p,r.id)).toBeNull();home();const hash=stateHash(w.s);expect(reportInvestigation(w,p,trader,r.id,r.reward+1)).toBeTruthy();expect(stateHash(w.s)).toBe(hash);p.money=Number.MAX_SAFE_INTEGER;const full=stateHash(w.s);expect(investigationReportQuote(w,p,trader,r.id).error).toBeTruthy();expect(stateHash(w.s)).toBe(full)
  })
  it('기한 경계와 취소/만료는 두 종류의 계약에 같은 예치 반환 규칙을 쓴다',()=>{
    for(const mode of ['cancel','expiry']){const{w,p,trader,market,accept}=setup(),cash=market.money,r=accept();if(mode==='cancel')expect(cancelSupply(w,p,trader,r.id)).toBeNull();else{w.s.time=r.deadline*100;expect(surveyInvestigation(w,p,r.id)).toBeTruthy();contractsTick(w)}expect(r.status).toBe(mode==='cancel'?'cancelled':'expired');expect(r.escrow).toBe(0);expect(market.money).toBe(cash);expect(p.money).toBe(100);const hash=stateHash(w.s);contractsTick(w);expect(stateHash(w.s)).toBe(hash)}
  })
  it('조달 견적은 조사 계약을 물품 납품으로 오인하지 않는다',()=>{
    const{w,p,trader,accept}=setup(),r=accept(),hash=stateHash(w.s);expect(perform(w,p,{type:'contractDeliver',target:trader.id,contract:r.id,lines:[]}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
  it('v22의 조달 기록·예치와 몸은 v23 이관에서 바뀌지 않는다',()=>{
    const{w,accept}=setup();accept();const old=JSON.parse(serialize(w.s));old.version=22;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:22}).toEqual(old)
  })
})
