import{readPackages}from'../tools/loadContent'
import{loadMods,GAME_VERSION,DEF_SCHEMA_VERSION}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{serialize,deserialize}from'../src/core/save'
export function contentMetadataFixture(kind:'known'|'unknown'|'changed'){
 const packages=readPackages();if(kind==='changed'){const core=packages.find(p=>p.manifest.id==='core')!;core.manifest.version='0.0.9';core.patches.push({op:'replace',target:'Terrain.KtFloor',path:'/label',value:'이전 버전의 석판'})}
 const{db,report}=loadMods(packages,[]);if(report.errors.length)throw Error(report.errors.join('\n'))
 const w={db,s:newGame(db,{seed:'actual-content-metadata-'+kind,overworld:true})};runUntilInput(w);const raw=JSON.parse(serialize(w.s))
 if(kind!=='changed'){raw.version=180;delete raw.gameVersion;delete raw.defSchemaVersion;delete raw.contentMods;if(kind==='unknown')delete raw.loadHash}
 const text=JSON.stringify(raw),expected=deserialize(text)
 if(kind==='known'){expected.gameVersion=GAME_VERSION;expected.defSchemaVersion=DEF_SCHEMA_VERSION;expected.contentMods=db.modManifest()}
 return{raw:text,expected,proof:{kind,rawVersion:raw.version,rawHasGameVersion:Object.hasOwn(raw,'gameVersion'),rawHasSchema:Object.hasOwn(raw,'defSchemaVersion'),rawHasIndividualMods:Object.hasOwn(raw,'contentMods'),sourceHash:db.loadHash,sourceModRecords:kind==='changed'?db.modManifest():undefined,declaredInitialCondition:kind==='changed'?'actual old core content version0.0.9 andlabel replacement before real newGame under current game engine; no actor/body/item edits or previous play claimed':'declared raw180 format without future individual headers before deserialize; historical headers not invented',originalActors:w.s.creatures.map(c=>c.id)}}
}
