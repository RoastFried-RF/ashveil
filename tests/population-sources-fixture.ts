import {storyFameNativeFixture} from './story-fame-fixture'
import {turnOf} from '../src/core/ctx'
import {newGame} from '../src/core/game'
export function populationSourcesNativeFixture(kind:'foreign'|'own',phase:'before'|'pending'='before'){
  const d=storyFameNativeFixture('before'),source=d.s.sources!.find(s=>s.id==='reaverCamp')!
  // 임상 준비 도우미가 비운 원래 여섯 몸을 같은 시드의 실제 초기 생성본에서 복원한다.
  // 현재 세계의 새 ID/난수를 쓰지 않으며, 현재 시각에 행동 가능한 유효 초기 장면이다.
  const original=newGame(d.w.db,{seed:d.s.seed})
  for(const c of original.creatures.filter(c=>c.faction==='reavers')){
    if(d.s.creatures.some(person=>person.id===c.id))throw Error('original source actor ID collision')
    c.nextAct=d.s.time;d.s.creatures.push(c)
  }
  if(kind==='foreign')source.members=d.s.creatures.filter(c=>c.id!==d.target.id&&c.faction==='reavers').map(c=>c.id)
  source.count=source.members!.length
  const initialRoster=[...source.members!],initialCount=source.count,initialIds=d.s.creatures.map(c=>c.id),initialNext=d.s.nextId,initialAt=turnOf(d.w)
  let attacks=0
  if(phase==='pending'){
    while(d.target.alive&&attacks<10){d.act({type:'move',dir:2});attacks++}
    if(d.target.alive)throw Error('initial public attack sequence did not defeat the target')
    d.act({type:'rest',turns:20},1)
  }
  return{...d,source,proof:{kind,phase,initialRoster,initialCount,initialIds,initialNext,initialAt,targetUid:d.target.id,declaredInitialHp:1,declaredRosterBeforeAnyInput:true,actualHeadlessAttackInputs:attacks,notClaimingHistoricalMembershipOrWounds:true}}
}
