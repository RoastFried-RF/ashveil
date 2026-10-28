import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{player}from'../src/core/ctx'
import{startBreakdown}from'../src/core/psyche'
import{gainTrauma}from'../src/core/trauma'
import{updatePlayerVision}from'../src/core/fov'
import type{BreakDef}from'../src/core/types'
export const oldMentalIds={breakdown:'SampleMigration.Break.OldCry',trauma:'SampleMigration.Trauma.OldDark'}
export const newMentalIds={breakdown:'SampleMigration.Break.RenamedCry',trauma:'SampleMigration.Trauma.RenamedDark'}
export function mentalRenamesFixture(){
 const packages=readPackages(),current=loadMods(packages,['sample-mental-renames']),oldPackages=readPackages(),old=oldPackages.find(x=>x.manifest.id==='sample-mental-renames')!;old.manifest.version='0.9.0';delete old.renames
 for(const kind of Object.keys(newMentalIds)as(keyof typeof newMentalIds)[])old.defs.find(x=>x.id===newMentalIds[kind])!.id=oldMentalIds[kind]
 const loaded=loadMods(oldPackages,['sample-mental-renames']);if(loaded.report.errors.length||current.report.errors.length)throw Error([...loaded.report.errors,...current.report.errors].join('\n'))
 const w={db:loaded.db,s:newGame(loaded.db,{seed:'actual-mental-status-renames',overworld:true})};runUntilInput(w);const p=player(w);startBreakdown(w,p,w.db.get<BreakDef>(oldMentalIds.breakdown));gainTrauma(w,p,oldMentalIds.trauma);updatePlayerVision(w,p);return{w,p,current:current.db,packages,oldPackages}
}
