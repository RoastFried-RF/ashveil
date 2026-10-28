import { loadMods,type ModPackage,type DefinitionSnapshot } from '../src/core/defs'
import { definitionPatchAudit } from '../src/core/definition-audit'

/** 실제 로더와 격리 스크립트 등록 검사. 게임 생성·패키지 쓰기 없이 검사한다. */
export async function validateDefinitionPackages(packages:ModPackage[],enabled:string[]){
  let snapshot:DefinitionSnapshot|undefined
  const{db,report}=loadMods(packages,enabled,{audit:true,provenance:true,capture:s=>{snapshot=s}})
  const scriptValidation={attempted:false,modules:[] as {modId:string;hash:string}[]}
  if(!report.errors.length&&db.scriptSources.length){
    scriptValidation.attempted=true
    try{const{attachQuickJSScripts}=await import('../src/scripting/attach');await attachQuickJSScripts(db);scriptValidation.modules=db.scriptModules.map(m=>({modId:m.modId,hash:m.hash}))}
    catch(error){report.errors.push((error as Error).message)}
  }
  const definitions=Object.values(snapshot!.resolved).filter(d=>!d.abstract)
  const byType:Record<string,number>={}
  for(const d of definitions){const type=String(d.defType);byType[type]=(byType[type]??0)+1}
  return{valid:report.errors.length===0,loadHash:db.loadHash,report,definitions:definitions.length,byType,patchAudit:definitionPatchAudit(snapshot!),scriptValidation}
}
