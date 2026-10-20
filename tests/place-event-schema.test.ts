import {describe,it,expect} from 'vitest'
import {loadMods,type PatchOp,type ModPackage} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'

const check=(patches:PatchOp[]=[],defs:unknown[]=[])=>{
  const mod:ModPackage={manifest:{id:'event-contract',name:'사건 계약 검사',version:'1'},defs:defs as never,patches}
  return loadMods([...readPackages(),mod],['event-contract'])
}
const change=(path:string,value:unknown,target='Event.ReaverPatrol'):PatchOp=>({op:'replace',target,path,value})

describe('실제 인원만 쓰는 PlaceEvent 계약',()=>{
  it('네 기존 사건은 원래 출발지·인원·흔적을 가진 새 타입이며 ID를 유지한다',()=>{
    const {db,report}=check();expect(report.errors).toEqual([])
    const events=db.all('PlaceEvent');expect(events).toHaveLength(4);expect(db.all('Event')).toEqual([])
    for(const e of events){expect(e).toMatchObject({composition:{fromPopulation:true}});expect(e).not.toHaveProperty('spawn');expect(e).toHaveProperty('origin');expect(e).toHaveProperty('traces')}
    expect(db.event('Event.StashRaided').origin).toEqual({kind:'party',event:'Event.ReaverSearch'})
    expect(db.event('Event.Reoccupy').origin).toEqual({kind:'population',source:'@roomPopulation'})
  })
  it.each(['Event','EventDef'])('폐지된 %s 타입은 대체 안내와 함께 거절한다',defType=>{
    const {db,report}=check([],[{defType,id:'Event.Deprecated',label:'폐지',cost:1,weight:1,spawn:{creature:'Creature.Reaver'}}])
    expect(report.errors.some(e=>e.includes('Event.Deprecated')&&e.includes('PlaceEvent'))).toBe(true)
    expect(db.tryGet('Event.Deprecated')).toBeUndefined()
  })
  it('새 타입의 spawn도 거절한다',()=>{
    const {report}=check([{op:'add',target:'Event.ReaverPatrol',path:'/spawn',value:{count:99}}])
    expect(report.errors.some(e=>e.includes('spawn')&&e.includes('fromPopulation'))).toBe(true)
  })
  it.each([
    ['/category','FreeSpawn'],['/origin',null],['/origin',[]],['/origin',{}],
    ['/origin',{kind:'edge'}],['/origin',{kind:'camp',faction:'absent',waypoint:'reaverCamp',minMembers:4}],
    ['/origin',{kind:'camp',faction:'reavers',waypoint:'',minMembers:4}],
    ['/origin',{kind:'camp',faction:'reavers',waypoint:'reaverCamp',minMembers:0}],
    ['/composition',null],['/composition',[]],['/composition',{fromPopulation:false}],
    ['/composition',{count:[2,3]}],['/traces',[]],['/traces',['']],['/traces',[1]],
    ['/place/leader',''],['/place/leader','Creature.Absent'],['/composition/count',[4,2]],
  ])('잘못된 %s 설정을 예외 대신 오류로 보고한다', (path,value)=>{
    const {report}=check([change(path as string,value)]);expect(report.errors.length).toBeGreaterThan(0)
  })
  it.each([null,{},[],{kind:'party'},{kind:'party',event:'Event.StashRaided'},{kind:'party',event:'Event.Absent'},{kind:'party',event:'Creature.Reaver'},{kind:'population',source:'edge'}])('후속 사건도 실제 출발 참조를 요구한다 (%j)',origin=>{
    const {report}=check([change('/origin',origin,'Event.StashRaided')]);expect(report.errors.length).toBeGreaterThan(0)
  })
  it('예제 모드도 새 인원 경로를 패치하며 새 사람을 정의하지 않는다',()=>{
    const {db,report}=loadMods(readPackages(),['sample-patrol']);expect(report.errors).toEqual([])
    expect(db.event('Event.ReaverPatrol')).toMatchObject({defType:'PlaceEvent',composition:{fromPopulation:true,count:[2,2]},place:{chance:1,route:['stream','@home'],waitTurns:37}})
    expect(db.all('Creature')).toHaveLength(check().db.all('Creature').length)
  })
})
