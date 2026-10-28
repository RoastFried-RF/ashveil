import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{turnOf}from'../src/core/ctx'
export const oldEventId='SampleMigration.Event.OldPatrol',newEventId='SampleMigration.Event.RenamedPatrol'
/** 실제 이전 모듈/정상 세계와 선언된 미실행 미래 예약이다. 과거 출발을 주장하지 않는다. */
export function eventRenamesFixture(){
 const packages=readPackages(),current=loadMods(packages,['sample-event-renames']),oldPackages=readPackages(),old=oldPackages.find(x=>x.manifest.id==='sample-event-renames')!;old.manifest.version='0.9.0';delete old.renames;old.defs.find(x=>x.id===newEventId)!.id=oldEventId
 const loaded=loadMods(oldPackages,['sample-event-renames']);if(loaded.report.errors.length||current.report.errors.length)throw Error([...loaded.report.errors,...current.report.errors].join('\n'));const w={db:loaded.db,s:newGame(loaded.db,{seed:'actual-event-reservation-renames',overworld:true})};runUntilInput(w);w.s.storyteller.pending={event:oldEventId,atTurn:turnOf(w)+100};return{w,current:current.db,packages}
}
