import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{player}from'../src/core/ctx'
import{makeItem,addToBag}from'../src/core/items'
import{serialize}from'../src/core/save'
export const oldKnifeId='SampleMigration.Item.OldKnife'
export function itemRenamesNativeFixture(wrongSize=false){
 const packages=readPackages(),mod=packages.find(p=>p.manifest.id==='sample-item-renames')!;delete mod.renames;mod.manifest.version='0.9.0';const oldDef={defType:'Item',id:oldKnifeId,parent:'Item.RustyKnife',label:'이전 버전의 칼',...(wrongSize?{size:[2,2]}:{})};mod.defs.push(oldDef)
 const{db,report}=loadMods(packages,['sample-item-renames']);if(report.errors.length)throw Error(report.errors.join('\n'))
 const w={db,s:newGame(db,{seed:'actual-previous-knife-mod-version',overworld:true})};runUntilInput(w);const p=player(w),item=makeItem(w,oldKnifeId);item.quality=2;item.durability=67;if(addToBag(w,p,item))throw Error('actual original bag space missing');p.hotbar[8]={kind:'item',def:oldKnifeId}
 return{w,s:w.s,p,item,raw:serialize(w.s),proof:{originalActors:w.s.creatures.map(c=>c.id),originalItem:structuredClone(item),oldVersion:mod.manifest.version,declaredOriginalDifferentSize:wrongSize,sourceHash:db.loadHash,declaredInitialCondition:'actual previous version0.9.0 memory package declares one Item.RustyKnife child before real newGame; actualmakeItem/addToBag; declared initialquality2durability67andhotbar8; no actor/body edits or previous play claimed'}}
}
