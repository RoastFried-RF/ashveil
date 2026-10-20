import{missingItemsFixture,removedItemId}from'./missing-items-fixture'
import{loadMods}from'../src/core/defs'
import type{ItemDef}from'../src/core/types'
export const renamedItemId='Test.RecordedRenamedItem'
export function itemRenamesFixture(){const d=missingItemsFixture(),currentPackages=structuredClone(d.currentPackages),core=currentPackages.find(p=>p.manifest.id==='core')!,original=d.oldPackages.find(p=>p.manifest.id==='core')!.defs.find(p=>p.id===removedItemId)!as ItemDef;core.defs.push({...structuredClone(original),id:renamedItemId,label:'현재 이름의 물품'}as ItemDef);core.renames={[removedItemId]:renamedItemId};const loaded=loadMods(currentPackages,[]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));return{...d,current:loaded.db,currentPackages}}
