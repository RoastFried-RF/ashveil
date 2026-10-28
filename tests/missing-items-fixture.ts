import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{makeItem,addToBag}from'../src/core/items'
import{player}from'../src/core/ctx'
import type{ItemDef}from'../src/core/types'
export const removedItemId='Test.RecordedRemovedItem'
export function missingItemsFixture(){
 const currentPackages=readPackages(),oldPackages=readPackages(),core=oldPackages.find(p=>p.manifest.id==='core')!,jerky=core.defs.find(d=>d.id==='Item.Jerky') as ItemDef
 if(!jerky)throw Error('실제 육포 원형이 필요하다')
 const removed:ItemDef={...structuredClone(jerky),id:removedItemId,label:'기록된 원래 음식',size:[2,3],stackable:true,maxStack:5};core.defs.push(removed)
 const loaded=loadMods(oldPackages,[]),current=loadMods(currentPackages,[])
 if(loaded.report.errors.length||current.report.errors.length)throw Error([...loaded.report.errors,...current.report.errors].join('\n'))
 const w={db:loaded.db,s:newGame(loaded.db,{seed:'actual-missing-item-state',overworld:true})};runUntilInput(w)
 const p=player(w),item=makeItem(w,removedItemId,3);item.quality=2;item.durability=57;item.contaminantAsh=.25;item.foodWater={ml:10,quality:{pathogen:2,ash:0,salinity:0}};item.wetness={torso:17}
 if(addToBag(w,p,item)!==0)throw Error('원래 배낭의 실제 자리가 필요하다')
 return{w,s:w.s,p,item,current:current.db,oldPackages,currentPackages,original:structuredClone(item),originalNextId:w.s.nextId}
}
