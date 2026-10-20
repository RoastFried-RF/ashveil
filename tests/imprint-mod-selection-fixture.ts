import{readPackages}from'../tools/loadContent'
import{loadMods,type ModPackage}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{makeItem,addToBag}from'../src/core/items'
import{player}from'../src/core/ctx'
import{serialize}from'../src/core/save'
export function imprintModSelectionFixture(){
 const mod:ModPackage={manifest:{id:'absent-browser-item-mod',name:'이전 원정 식량 모드',version:'1',dependencies:['core']},defs:[{defType:'Item',id:'Test.AbsentBrowserFood',parent:'Item.Jerky',label:'이전 모드의 육포'}],patches:[]}
 const{db,report}=loadMods([...readPackages(),mod],[mod.manifest.id]);if(report.errors.length)throw Error(report.errors.join('\n'))
 const w={db,s:newGame(db,{seed:'actual-old-installed-mod-removal',overworld:true})};runUntilInput(w)
 const p=player(w),it=makeItem(w,'Test.AbsentBrowserFood',2);if(addToBag(w,p,it))throw Error('actual original bag space unavailable')
 return{w,s:w.s,p,item:it,raw:serialize(w.s),proof:{sourceMod:mod.manifest,sourceHash:db.loadHash,item:structuredClone(it),originalActors:w.s.creatures.map(c=>c.id),declaredInitialCondition:'actual old-package newGame plus actual makeItem/addToBag of two inherited Jerky; no actor/body edits or prior gameplay claimed'}}
}
