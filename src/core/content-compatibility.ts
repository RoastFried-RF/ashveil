import{bodyRenamePlan}from'./body-renames'
import{missingCreaturePlan}from'./missing-creatures'
import{creatureRenamePlan}from'./creature-renames'
import{recipeRenamePlan}from'./recipe-renames'
import{eventRenamePlan}from'./event-renames'
import{missingEventPlan}from'./missing-events'
import{statusRenamePlan}from'./status-renames'
import{scriptContentPlan,applyScriptContentChanges}from'./script-content-changes'
import{missingStatusPlan}from'./missing-statuses'
import{DEF_SCHEMA_VERSION}from'./content-version'
import {itemRenamePlan,applyItemRenames}from'./item-renames'
import {missingItemPlan,validRecordedItemShape} from './missing-items'
import type {DefDatabase} from './defs'
import type {GameState} from './types'

/** 기록되지 않은 구형 구성은 추정하지 않는다. 조회는 저장/게임/난수를 바꾸지 않는다. */
export function contentCompatibility(s:Pick<GameState,'loadHash'>,db:Pick<DefDatabase,'loadHash'>){
 return{status:s.loadHash===undefined?'unknown':s.loadHash===db.loadHash?'same':'changed',recorded:s.loadHash,current:db.loadHash}as const
}
export function contentChangeReview(s:GameState,db:DefDatabase){
 const compatibility=contentCompatibility(s,db),recorded=s.contentDefinitions,current=db.definitionManifest()
 const missing=Object.entries(recorded??{}).filter(([id,type])=>!Object.hasOwn(current,id)||current[id]!==type).map(([id,type])=>({id,type}))
 const added=Object.keys(current).filter(id=>!Object.hasOwn(recorded??{},id))
 const hasRecord=!!recorded&&Object.keys(recorded).length>0,scripts=scriptContentPlan(s,db),scriptCandidate=scripts.removed.length&&!scripts.errors.length?structuredClone(s):s;if(scriptCandidate!==s)applyScriptContentChanges({s:scriptCandidate,db})
 const migrations=itemRenamePlan(scriptCandidate,db),candidate=migrations.renamed.length&&!migrations.errors.length?structuredClone(scriptCandidate):scriptCandidate;if(candidate!==scriptCandidate)applyItemRenames(candidate,db)
 const statusRenames=statusRenamePlan(candidate,db),renamedCandidate=!statusRenames.errors.length&&statusRenames.preview?statusRenames.preview:candidate
 const eventRenames=eventRenamePlan(renamedCandidate,db),renamedEvents=!eventRenames.errors.length&&eventRenames.preview?eventRenames.preview:renamedCandidate
 const bodies=bodyRenamePlan(renamedEvents,db),renamedBodies=!bodies.errors.length&&bodies.preview?bodies.preview:renamedEvents
 const creatures=creatureRenamePlan(renamedBodies,db),renamedCreatures=!creatures.errors.length&&creatures.preview?creatures.preview:renamedBodies
 const recipes=recipeRenamePlan(renamedCreatures,db),renamedRecipes=!recipes.errors.length&&recipes.preview?recipes.preview:renamedCreatures
 const missingCreatures=missingCreaturePlan(renamedRecipes,db),creatureCandidate=!missingCreatures.errors.length&&missingCreatures.preview?missingCreatures.preview:renamedRecipes
 const events=missingEventPlan(creatureCandidate,db),eventCandidate=!events.errors.length&&events.preview?events.preview:creatureCandidate
 const states=missingStatusPlan(eventCandidate,db),statusCandidate=!states.errors.length&&states.preview?states.preview:eventCandidate
 const plan=missingItemPlan(statusCandidate,db)
 const recoverable=missing.filter(d=>d.type==='Item'&&!db.has(d.id)&&s.contentItemShapes&&Object.hasOwn(s.contentItemShapes,d.id)&&validRecordedItemShape(s.contentItemShapes[d.id]))
 const ids=new Set(recoverable.map(d=>d.id)),blocked=missing.filter(d=>!ids.has(d.id)&&!recipes.renamed.some(rename=>rename.from===d.id)&&!bodies.renamed.some(rename=>rename.from===d.id)&&!creatures.renamed.some(rename=>rename.from===d.id)&&!missingCreatures.removed.some(row=>row.id===d.id)&&!events.removed.some(event=>event.id===d.id)&&!states.removed.some(state=>state.id===d.id)&&!migrations.renamed.some(rename=>rename.from===d.id))
 const recoveryErrors=[...scripts.errors,...migrations.errors,...statusRenames.errors,...eventRenames.errors,...bodies.errors,...creatures.errors,...recipes.errors,...missingCreatures.errors,...events.errors,...states.errors,...plan.errors]
 const currentMods=db.modManifest(),recordedMods=s.contentMods,changedMods=(recordedMods??[]).flatMap(old=>{const current=currentMods?.find(m=>m.id===old.id);return current&&(old.version!==current.version||old.hash!==current.hash)?[{id:old.id,fromVersion:old.version,toVersion:current.version,fromHash:old.hash,toHash:current.hash}]:[]})
 if(s.defSchemaVersion!==undefined&&s.defSchemaVersion!==DEF_SCHEMA_VERSION)recoveryErrors.push('각인의 정의 스키마 버전 '+s.defSchemaVersion+'은 현재 구현 계약 '+DEF_SCHEMA_VERSION+'로 이행해야 한다')
 if(compatibility.status==='same'&&recordedMods&&currentMods&&(changedMods.length||recordedMods.length!==currentMods.length||recordedMods.some((m,i)=>m.id!==currentMods[i]?.id)))recoveryErrors.push('전체 콘텐츠 해시와 개별 모드 내용 기록이 일치하지 않는다')
 const removedMods=s.mods.filter(id=>id!=='core'&&!db.loadedMods.includes(id)),addedMods=db.loadedMods.filter(id=>id!=='core'&&!s.mods.includes(id))
 return{...compatibility,missing,added,removedMods,addedMods,changedMods,hasModRecord:!!recordedMods,renamedRecipes:recipes.renamed,renameRecipeRecords:recipes.counts,renamedBodies:bodies.renamed,renameBodyRecords:bodies.bodies,renamedCreatures:creatures.renamed,renameCreatureRecords:creatures.counts,removedCreatures:missingCreatures.counts,renamedEvents:eventRenames.renamed,renameEventRecords:eventRenames.counts,removedEvents:events.counts,renamedStatuses:statusRenames.renamed,renameStatusRecords:statusRenames.records,scriptChanges:{removed:scripts.removed,added:scripts.added,...scripts.counts},removedStatuses:states.counts,renamed:migrations.renamed,renameItems:new Set(migrations.moves).size,hasRecord,blocked,recoverable,recoveryErrors,convertItems:[...new Set(plan.convert.map(e=>e.item.uid))].length,restoreItems:[...new Set(plan.restore.map(e=>e.item.uid))].length,canContinue:compatibility.status==='changed'&&hasRecord&&blocked.length===0&&recoveryErrors.length===0}

}
