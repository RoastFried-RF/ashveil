import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{deserialize,serialize}from'../src/core/save'
export function contentHeaderFixture(kind:'changed'|'legacy'|'removed'){
 const packages=readPackages()
 if(kind==='changed')packages.find(p=>p.manifest.id==='core')!.patches.push({op:'replace',target:'Terrain.KtFloor',path:'/label',value:'이전 구성의 석판'})
 if(kind==='removed')packages.find(p=>p.manifest.id==='core')!.defs.push({defType:'Terrain',id:'Test.RemovedPreview',parent:'Terrain.Floor',label:'이전 구성에만 있는 지형'})
 const{db,report}=loadMods(packages,[])
 if(report.errors.length)throw Error(report.errors.join('\n'))
 const w={db,s:newGame(db,{seed:'declared-content-header-'+kind,overworld:true})};runUntilInput(w)
 const raw=JSON.parse(serialize(w.s)),sourceHash=db.loadHash
 if(kind==='legacy'){raw.version=177;delete raw.loadHash;delete raw.contentDefinitions;delete raw.contentItemShapes;delete raw.gameVersion;delete raw.defSchemaVersion;delete raw.contentMods}
 const text=JSON.stringify(raw),expected=kind==='legacy'?deserialize(text):w.s
 return{raw:text,expected,proof:{kind,sourceHash,rawVersion:raw.version,rawHasHash:Object.hasOwn(raw,'loadHash'),initialCondition:kind==='changed'?'actual source configuration contains one label replacement before real newGame; no prior gameplay claimed':kind==='legacy'?'declared raw177 format before loading; no historical content hash invented':'actual source core contains one additional Terrain before real newGame; no creature/item edits or prior gameplay claimed',originalActors:w.s.creatures.map(c=>c.id),originalPlayerId:w.s.playerId}}
}
