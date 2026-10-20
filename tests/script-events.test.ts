import {beforeAll,describe,it,expect} from 'vitest'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {configureScriptHost,scriptEventTick} from '../src/core/script-hooks'
import {newGame,playerAct} from '../src/core/game'
import {storytellerTick} from '../src/core/storyteller'
import {TURNS_PER_DAY,TURNS_PER_HOUR,player,type World} from '../src/core/ctx'
import {stateHash} from '../src/core/save'
import type {ScriptHost} from '../src/core/script-contracts'
let host:ScriptHost
beforeAll(async()=>{host=await createQuickJSScriptHost()})
describe('실제 공급원에서 출발하고 돌아온 장소 사건의 스크립트 훅',()=>{
 it('원래 순찰대의 실제 출발과 모든 귀환 뒤에만 사건을 한 번씩 전한다',()=>{
  const id='event-hooks',source='export default defineMod({hooks:{onEventFired(ctx,e){ctx.modState.fired=e.event;ctx.modState.members=e.members;return []},onEventResolved(ctx,e){ctx.modState.resolved=e.event;ctx.modState.returned=e.returned;return []}}})',loaded=loadMods([...readPackages(),{manifest:{id,name:'검사',version:'1',scripts:{stage:1,entry:'scripts/main.js'}},defs:[],patches:[{op:'replace',target:'Event.ReaverPatrol',path:'/place/chance',value:1},{op:'replace',target:'Event.ReaverPatrol',path:'/place/waitTurns',value:1}],scripts:[{file:'scripts/main.js',source}]}],[id]);expect(loaded.report.errors).toEqual([]);expect(configureScriptHost(loaded.db,host)).toEqual([])
  const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'actual-script-patrol',overworld:true})},p=player(w),originalActors=w.s.creatures.map(c=>c.id),nextId=w.s.nextId
  // 첫 실제 판정 직전의 초기 시각이다. 하루 여행을 실행했다고 주장하지 않는다.
  w.s.time=(TURNS_PER_DAY+6*TURNS_PER_HOUR)*100;for(const c of w.s.creatures)c.nextAct=w.s.time;p.needs.kcal=1000;p.needs.waterDeficit=0;p.needs.fatigue=10
  storytellerTick(w);expect(w.s.scriptState!.mods[id]).toMatchObject({fired:'Event.ReaverPatrol'});expect(w.s.scriptState!.eventRuns).toHaveLength(1);const run=w.s.scriptState!.eventRuns![0];expect(run.actors.length).toBeGreaterThanOrEqual(2);expect(run.actors.every(id=>w.s.creatures.some(c=>c.id===id&&c.ai.route?.length))).toBe(true)
  scriptEventTick(w);expect(w.s.scriptState!.mods[id]).not.toHaveProperty('resolved')
  for(let n=0;w.s.scriptState!.eventRuns?.length&&n<1800;n++){const error=playerAct(w,{type:'wait'});expect(error).toBeNull()}
  expect(w.s.scriptState!.eventRuns).toEqual([]);expect(w.s.scriptState!.mods[id]).toMatchObject({resolved:'Event.ReaverPatrol',returned:run.actors.length});expect(w.s.creatures.map(c=>c.id)).toEqual(originalActors);expect(w.s.nextId).toBe(nextId)
  const before=stateHash(w.s);scriptEventTick(w);expect(stateHash(w.s)).toBe(before)
 },20000)
})
