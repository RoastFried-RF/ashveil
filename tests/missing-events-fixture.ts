import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{turnOf}from'../src/core/ctx'
export const missingEventId='Test.RecordedRemovedEvent'
/** 정상 세계에 선언된 미실행 예약만 더한다. 과거 사건/인물 출발을 실행했다고 주장하지 않는다. */
export function missingEventsFixture(){
 const packages=readPackages(),core=packages.find(x=>x.manifest.id==='core')!;core.defs.push({defType:'PlaceEvent',id:missingEventId,parent:'Event.ReaverPatrol',label:'이전 장소 사건'})
 const loaded=loadMods(packages,[]),current=loadMods(readPackages(),[]);if(loaded.report.errors.length||current.report.errors.length)throw Error([...loaded.report.errors,...current.report.errors].join('\n'))
 const w={db:loaded.db,s:newGame(loaded.db,{seed:'actual-missing-place-event',overworld:true})};runUntilInput(w);w.s.storyteller.pending={event:missingEventId,atTurn:turnOf(w)+100};return{w,current:current.db,packages}
}
