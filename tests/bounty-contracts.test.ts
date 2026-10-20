import {describe,it,expect} from 'vitest'
import {bountyContractsFixture} from './bounty-contracts-fixture'
import {bountyContractsNativeFixture} from './bounty-contracts-native-fixture'
import {acceptBounty,bountyOffers,bountyEvidenceQuote,bountyReportQuote,recordBountyVictory,reportBounty,surveyBounty} from '../src/core/bounty-contracts'
import {killCreature} from '../src/core/combat'
import {cancelSupply,contractsTick,supplyQuote} from '../src/core/contracts'
import {reputation} from '../src/core/diplomacy'
import {turnOf,type World} from '../src/core/ctx'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {playerAct,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {updatePlayerVision,invalidateLights} from '../src/core/fov'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import type {Creature} from '../src/core/types'
const total=(d:ReturnType<typeof bountyContractsFixture>)=>(d.p.money??0)+Object.values(d.m.markets??{}).reduce((n,m)=>n+m.money,0)+(d.m.contracts??[]).reduce((n,r)=>n+r.escrow,0)
const observe=(d:ReturnType<typeof bountyContractsFixture>,c:Creature)=>{d.p.pos={x:c.pos.x-1,y:c.pos.y};d.s.map.lights=[{pos:{...d.p.pos},radius:5,kind:'campfire'}];invalidateLights(d.w);updatePlayerVision(d.w,d.p)}

describe('원래 명단의 실제 처치와 유한 예치 보수',()=>{
  it('실제 수락/전투로 준비한 보고 입력1턴이 원래 예치금만 지급한다',()=>{
    const d=bountyContractsNativeFixture('report'),r=d.m.contracts!.at(-1)!,at=d.s.time
    d.act({type:'bountyReport',target:d.trader.id,contract:r.id,expectedReward:r.reward})
    expect(d.s.time-at).toBe(100);expect(r.status).toBe('completed');expect(r.escrow).toBe(0);expect(d.p.money).toBe(d.proof.playerMoneyBefore+332);expect(d.market.money).toBe(668)
  })
  it('현장 시신 확인 입력1턴은 다른 이의 처치 증거를 기록한다',()=>{
    const d=bountyContractsNativeFixture('corpse'),r=d.m.contracts!.at(-1)!,at=d.s.time
    d.act({type:'bountySurvey',contract:r.id});expect(d.s.time-at).toBe(100)
    expect(r.kind).toBe('eliminate');if(r.kind!=='eliminate')throw Error('kind');expect(r.evidence).toMatchObject([{kind:'foundDead',observed:true}])
  })
  it('시장 환급은 플레이어 지갑이 가득 차도 지급으로 오인하지 않는다',()=>{
    const d=bountyContractsNativeFixture('otherReport'),r=d.m.contracts!.at(-1)!;d.p.money=Number.MAX_SAFE_INTEGER
    d.act({type:'bountyReport',target:d.trader.id,contract:r.id});expect(r.status).toBe('cancelled');expect(d.market.money).toBe(1000);expect(d.p.money).toBe(Number.MAX_SAFE_INTEGER)
  })
  it('실제 보수를 더할 공간이 없는 지갑은 실패 후 전체 상태를 보존한다',()=>{
    const d=bountyContractsNativeFixture('report'),r=d.m.contracts!.at(-1)!;d.p.money=Number.MAX_SAFE_INTEGER;const before=stateHash(d.s)
    expect(reportBounty(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  })
  it('보이지 않은 사망의 미확인 표시는 전체 각인 복원으로도 공개되지 않는다',()=>{
    const d=bountyContractsNativeFixture('hidden'),copy=deserialize(serialize(d.s)),r=copy.overworld!.contracts!.at(-1)!
    expect(r.kind).toBe('eliminate');if(r.kind!=='eliminate')throw Error('kind');expect(r.evidence).toMatchObject([{kind:'kill',observed:false}]);expect(JSON.parse(serialize(copy))).toEqual(JSON.parse(serialize(d.s)))
  })
  it('보이지 않은 자기 처치는 확인 전까지 보고에 쓰지 않고 현장 확인 뒤 구별한다',()=>{
    const d=bountyContractsFixture(),r=d.accept(),targets=d.field();d.p.pos={x:8,y:6};updatePlayerVision(d.w,d.p)
    for(const c of targets)killCreature(d.w,c,'보이지 않은 실제 처치',{killerId:d.p.id})
    expect(r.evidence).toHaveLength(6);expect(r.evidence.every(e=>e.kind==='kill'&&e.observed===false)).toBe(true)
    d.home();expect(bountyReportQuote(d.w,d.p,d.trader,r.id).error).toBeTruthy();d.field()
    for(const c of targets)if(r.evidence.find(e=>e.id===c.id)!.observed===false){observe(d,c);expect(surveyBounty(d.w,d.p,r.id)).toBeNull()}
    expect(r.evidence.every(e=>e.kind==='kill'&&e.observed)).toBe(true);d.home();expect(reportBounty(d.w,d.p,d.trader,r.id)).toBeNull();expect(r.outcome).toBe('killed')
  })
  it.each([['/wealthMult',2],['/refreshDays',0],['/targets',null],['/targets',[null]],['/targets',[]]])('잘못된 계약 설정을 실행 전에 거절한다 (%s)',(path,value)=>{
    const {report}=loadMods([...readPackages(),{manifest:{id:'bad-bounty',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'BountyContract.Hearth',path:path as string,value}]}],['bad-bounty'])
    expect(report.errors.some(e=>e.includes('bounty'))).toBe(true)
  })
  it('직접 관찰한 원래 장소만 읽기 전용으로 게시하며 거리/위협 공식을 따른다',()=>{
    const d=bountyContractsFixture(),before=stateHash(d.s),o=bountyOffers(d.w,d.p,d.trader)[0]
    expect(o.reward).toBe(20+o.distance*8+150*.8);expect(o.targets).toHaveLength(6);expect(stateHash(d.s)).toBe(before)
    const scene=d.m.scenes['Region.GreyCloister'],pos=scene.map.waypoints!.reaverCamp;delete scene.map.tiles[pos.y*scene.map.w+pos.x].observed
    expect(bountyOffers(d.w,d.p,d.trader)).toEqual([])
  })
  it('옛 명단 없는 공급원은 과거 인원을 추정해 계약을 만들지 않는다',()=>{
    const d=bountyContractsFixture();delete d.m.scenes['Region.GreyCloister'].sources[0].members
    expect(bountyOffers(d.w,d.p,d.trader)).toEqual([])
  })
  it('실제 장부에 보수가 부족하면 게시하지 않는다',()=>{
    const d=bountyContractsFixture(),o=bountyOffers(d.w,d.p,d.trader)[0];d.market.money=o.reward-1;const before=stateHash(d.s)
    expect(bountyOffers(d.w,d.p,d.trader)).toEqual([]);expect(acceptBounty(d.w,d.p,d.trader,o.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  })
  it('잘못된 보수/거절한 입력은 세계와 돈을 바꾸지 않는다',()=>{
    const d=bountyContractsFixture(),o=bountyOffers(d.w,d.p,d.trader)[0],before=stateHash(d.s)
    expect(acceptBounty(d.w,d.p,d.trader,o.id,o.reward+1)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  })
  it('실제 수락1턴에 보수를 예치하고 원래 명단의 사본을 고정한다',()=>{
    const d=bountyContractsFixture(),o=bountyOffers(d.w,d.p,d.trader)[0],cash=d.market.money,money=total(d),at=d.s.time
    d.act({type:'bountyAccept',target:d.trader.id,offer:o.id,expectedReward:o.reward})
    expect(d.s.time-at).toBe(100);expect(d.market.money).toBe(cash-o.reward);expect(d.m.contracts!.at(-1)!.escrow).toBe(o.reward);expect(total(d)).toBe(money)
    expect(bountyOffers(d.w,d.p,d.trader)).toEqual([])
  })
  it('원래 대상의 새 실제 처치만 기록하고 같은 사망을 중복 계산하지 않는다',()=>{
    const d=bountyContractsFixture(),r=d.accept(),targets=d.field(),c=targets[0]
    observe(d,c)
    killCreature(d.w,c,'실제 토벌',{killerId:d.p.id});expect(r.evidence).toEqual([{id:c.id,at:turnOf(d.w),kind:'kill',observed:true,mapId:d.s.map.id,region:'Region.GreyCloister'}])
    const before=stateHash(d.s);recordBountyVictory(d.w,c,true);killCreature(d.w,c,'같은 사망',{killerId:d.p.id});expect(stateHash(d.s)).toBe(before)
  })
  it('다른 이의 처치나 살아 있는 대상은 자신의 처치로 추정하지 않는다',()=>{
    const d=bountyContractsFixture(),r=d.accept(),targets=d.field(),c=targets[0]
    recordBountyVictory(d.w,c,true);expect(r.evidence).toEqual([]);killCreature(d.w,c,'다른 원인');expect(r.evidence).toEqual([])
  })
  it('자기 이름과 비슷한 사망 표기만으로는 처치를 인정하지 않는다',()=>{
    const d=bountyContractsFixture(),r=d.accept(),c=d.field()[0];c.lastAttacker=d.p.name+'과 동명이인';killCreature(d.w,c,'이름 표기')
    expect(r.evidence).toEqual([])
  })
  it('전원 직접 처치 뒤 귀환 보고만 지급하며 같은 보고로 두 번 받지 않는다',()=>{
    const d=bountyContractsFixture(),money=total(d),r=d.accept(),cash=d.p.money??0,rep=reputation(d.w,d.trader.faction)
    for(const c of d.field()){observe(d,c);killCreature(d.w,c,'실제 토벌',{killerId:d.p.id})}d.home()
    expect(reportBounty(d.w,d.p,d.trader,r.id,r.reward)).toBeNull();expect(r.status).toBe('completed');expect(r.outcome).toBe('killed');expect(d.p.money).toBe(cash+r.reward);expect(r.escrow).toBe(0);expect(total(d)).toBe(money);expect(reputation(d.w,d.trader.faction)).toBe(rep+5)
    const before=stateHash(d.s);expect(reportBounty(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  })
  it('일부 처치만 있으면 보수·평판·원래 장부를 보존한다',()=>{
    const d=bountyContractsFixture(),r=d.accept();killCreature(d.w,d.field()[0],'일부 토벌',{killerId:d.p.id});d.home();const before=stateHash(d.s)
    expect(reportBounty(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  })
  it('남의 사망은 보이는 인접 시신을 직접 확인한 뒤 별도 증거로 남긴다',()=>{
    const d=bountyContractsFixture(),r=d.accept(),targets=d.field(),c=targets[0];killCreature(d.w,c,'다른 원인')
    for(const other of targets.slice(1))killCreature(d.w,other,'실제 토벌',{killerId:d.p.id})
    const adjacent=[{x:c.pos.x-1,y:c.pos.y},{x:c.pos.x+1,y:c.pos.y}][0];d.p.pos=adjacent;d.s.map.lights=[{pos:{...d.p.pos},radius:5,kind:'campfire'}];invalidateLights(d.w);updatePlayerVision(d.w,d.p)
    expect(bountyEvidenceQuote(d.w,d.p,r.id).dead).toContain(c.id);expect(surveyBounty(d.w,d.p,r.id)).toBeNull();expect(r.evidence.find(e=>e.id===c.id)!.kind).toBe('foundDead')
    const before=stateHash(d.s);expect(surveyBounty(d.w,d.p,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  })
  it('멀거나 보이지 않는 시신을 조회해 증거를 만들지 않는다',()=>{
    const d=bountyContractsFixture(),r=d.accept(),c=d.field()[0];killCreature(d.w,c,'다른 원인');d.p.pos={x:8,y:6};updatePlayerVision(d.w,d.p);const before=stateHash(d.s)
    expect(surveyBounty(d.w,d.p,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  })
  it('이미 다른 이가 처치한 대상은 현장 확인 뒤 보수를 시장으로 반환한다',()=>{
    const d=bountyContractsFixture(),money=total(d),cash=d.market.money,r=d.accept(),wallet=d.p.money,rep=reputation(d.w,d.trader.faction)
    for(const c of d.field()){
      killCreature(d.w,c,'다른 원인');d.p.pos={x:c.pos.x-1,y:c.pos.y};d.s.map.lights=[{pos:{...d.p.pos},radius:5,kind:'campfire'}];invalidateLights(d.w);updatePlayerVision(d.w,d.p)
      expect(surveyBounty(d.w,d.p,r.id)).toBeNull()
    }
    d.home();expect(reportBounty(d.w,d.p,d.trader,r.id)).toBeNull();expect(r.status).toBe('cancelled');expect(r.outcome).toBe('alreadyDead');expect(d.market.money).toBe(cash);expect(d.p.money).toBe(wallet);expect(total(d)).toBe(money);expect(reputation(d.w,d.trader.faction)).toBe(rep)
  })
  it('취소/기한 만료도 같은 유한 장부로 예치를 돌려놓는다',()=>{
    for(const mode of ['cancel','expired']){const d=bountyContractsFixture(),cash=d.market.money,r=d.accept();if(mode==='cancel')expect(cancelSupply(d.w,d.p,d.trader,r.id)).toBeNull();else{d.s.time=r.deadline*100;contractsTick(d.w)}expect(r.status).toBe(mode==='cancel'?'cancelled':'expired');expect(r.escrow).toBe(0);expect(d.market.money).toBe(cash)}
  })
  it('조달 납품이나 다른 정착지 보고로 보수를 꺼낼 수 없다',()=>{
    const d=bountyContractsFixture(),r=d.accept(),before=stateHash(d.s);expect(supplyQuote(d.w,d.p,d.trader,r.id,[]).error).toBeTruthy();d.trader.traderSite='elsewhere';expect(bountyReportQuote(d.w,d.p,d.trader,r.id).error).toBeTruthy();d.trader.traderSite=d.town.region;expect(stateHash(d.s)).toBe(before)
  })
  it('136 각인의 옛 처치나 계약에 새 증거를 소급하지 않는다',()=>{
    const d=bountyContractsFixture(),raw=JSON.parse(serialize(d.s));raw.version=136;const copy=deserialize(JSON.stringify(raw));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:136}).toEqual(raw);expect(copy.overworld!.contracts).toBeUndefined()
  })
  it('수락 뒤 미완료20턴의 원래 명단/예치/모든 상태가 복원된다',()=>{
    const d=bountyContractsFixture();d.accept();expect(playerAct(d.w,{type:'rest',turns:20},1)).toBeNull();expect(d.s.simulationPending).toBe(true);const copy:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(copy);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)))
  })
})
