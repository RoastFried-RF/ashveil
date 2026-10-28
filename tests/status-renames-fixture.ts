import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{player,turnOf}from'../src/core/ctx'
import{addWound}from'../src/core/body'
import{exposeDisease}from'../src/core/conditions'
import{addThought}from'../src/core/thoughts'
export const oldRenamedStatuses={wound:'SampleMigration.Wound.OldCut',disease:'SampleMigration.Disease.OldFever',thought:'SampleMigration.Thought.OldMemory',trait:'SampleMigration.Trait.OldTrait'}
export const newStatuses={wound:'SampleMigration.Wound.RenamedCut',disease:'SampleMigration.Disease.RenamedFever',thought:'SampleMigration.Thought.RenamedMemory',trait:'SampleMigration.Trait.RenamedTrait'}
export function statusRenamesFixture(){
 const packages=readPackages(),current=loadMods(packages,['sample-status-renames']),oldPackages=readPackages(),old=oldPackages.find(x=>x.manifest.id==='sample-status-renames')!;old.manifest.version='0.9.0';delete old.renames
 for(const kind of Object.keys(newStatuses)as(keyof typeof newStatuses)[])old.defs.find(x=>x.id===newStatuses[kind])!.id=oldRenamedStatuses[kind]
 const loaded=loadMods(oldPackages,['sample-status-renames']);if(loaded.report.errors.length||current.report.errors.length)throw Error([...loaded.report.errors,...current.report.errors].join('\n'))
 const w={db:loaded.db,s:newGame(loaded.db,{seed:'actual-status-renames',overworld:true})};runUntilInput(w);const p=player(w),wound=addWound(w,p,{def:oldRenamedStatuses.wound,part:'LeftForearm',severity:1,source:'선언된 초기 상처',bleedMult:0}).wound
 exposeDisease(w,p,oldRenamedStatuses.disease,1,{kind:'선언된 초기 노출',turn:turnOf(w),wound:wound.id});addThought(w,p,oldRenamedStatuses.thought);if(!p.traits.includes(oldRenamedStatuses.trait))p.traits.push(oldRenamedStatuses.trait)
 return{w,p,wound,current:current.db,packages,oldPackages}
}
