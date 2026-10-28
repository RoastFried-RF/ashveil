import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{player}from'../src/core/ctx'
import{startBreakdown}from'../src/core/psyche'
import{gainTrauma}from'../src/core/trauma'
import type{BreakDef,TraumaDef}from'../src/core/types'
export const missingMentalIds={breakdown:'Test.RecordedRemovedBreak',trauma:'Test.RecordedRemovedTrauma'}
/** 실제 이전 정의로 정상 초기 붕괴/공포를 시작한다. 경과한 과거 플레이를 주장하지 않는다. */
export function missingMentalFixture(){
 const current=loadMods(readPackages(),[]).db,packages=readPackages(),core=packages.find(x=>x.manifest.id==='core')!,cry=current.all<BreakDef>('Break').find(x=>x.kind==='cry')!,fear=current.all<TraumaDef>('Trauma').find(x=>x.kind==='dark')!
 if(!cry||!fear)throw Error('실제 울음/어둠 공포 원형이 필요하다');core.defs.push({defType:'Break',id:missingMentalIds.breakdown,parent:cry.id,label:'이전 울음 붕괴'},{defType:'Trauma',id:missingMentalIds.trauma,parent:fear.id,label:'이전 어둠 공포'})
 const loaded=loadMods(packages,[]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));const w={db:loaded.db,s:newGame(loaded.db,{seed:'actual-missing-mental-status',overworld:true})};runUntilInput(w);const p=player(w);startBreakdown(w,p,w.db.get<BreakDef>(missingMentalIds.breakdown));gainTrauma(w,p,missingMentalIds.trauma);return{w,p,current,packages}
}
