import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{player,turnOf}from'../src/core/ctx'
import{addWound}from'../src/core/body'
import{exposeDisease}from'../src/core/conditions'
import{addThought}from'../src/core/thoughts'
export const oldStatuses={wound:'Test.RemovedWound',disease:'Test.RemovedDisease',thought:'Test.RemovedThought',trait:'Test.RemovedTrait'}
/** 이전 콘텐츠가 실제 로드된 뒤 정상 생성한 세계와 명시적인 초기 상태다. 과거 플레이를 주장하지 않는다. */
export function missingStatusesFixture(){
 const oldPackages=readPackages(),core=oldPackages.find(p=>p.manifest.id==='core')!,current=loadMods(readPackages(),[]).db
 for(const[kind,id]of Object.entries(oldStatuses)){const defType=kind[0].toUpperCase()+kind.slice(1),parent=core.defs.find(x=>x.defType===defType&&!x.abstract);if(!parent)throw Error('실제 '+defType+' 원형이 필요하다');core.defs.push({defType,id,parent:parent.id,label:'이전 '+defType} as typeof parent)}
 const loaded=loadMods(oldPackages,[]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'))
 const w={db:loaded.db,s:newGame(loaded.db,{seed:'actual-missing-statuses',overworld:true})};runUntilInput(w);const p=player(w)
 const part=Object.keys(p.body.maxHp).find(x=>/Hand|Arm/.test(x))??Object.keys(p.body.maxHp)[0]
 const wound=addWound(w,p,{def:oldStatuses.wound,part,severity:1,source:'선언된 초기 상처',bleedMult:0}).wound
 exposeDisease(w,p,oldStatuses.disease,1,{kind:'선언된 초기 노출',turn:turnOf(w),wound:wound.id})
 addThought(w,p,oldStatuses.thought);p.traits.push(oldStatuses.trait)
 return{w,p,wound,current,oldPackages}
}
