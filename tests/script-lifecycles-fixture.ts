import {loadDb} from '../tools/loadContent'
import {attachQuickJSScripts} from '../src/scripting/attach'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {deserialize,serialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export async function scriptLifecyclesFixture(phase:'surface'|'stairs'|'pending'='surface'){
 const loaded=loadDb(['sample-script-map-stages','sample-script-item-life']);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));await attachQuickJSScripts(loaded.db)
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'actual-map-and-equipment-workers',background:'Bg.Hunter',overworld:true})};runUntilInput(w);w.s=deserialize(serialize(w.s));const s=w.s,p=player(w),originalActors=s.creatures.map(c=>c.id),originalNextId=s.nextId,originalItems=[...p.bag,...Object.values(p.equip)].flatMap(it=>it?[it.uid]:[])
 const add=(def:string,count=1)=>{const it=makeItem(w,def,count);if(addToBag(w,p,it))throw Error('declared initial test kit does not fit');return it},coat=add('Item.LeatherCoat'),torch=add('Item.Torch'),cloth=add('Item.Cloth',2)
 p.nextAct=s.time;p.needs.kcal=2500;p.needs.waterDeficit=0;p.needs.fatigue=10;p.needs.bodyTemp=37;s.storyteller.budget=-1e9
 if(phase==='stairs'){const link=s.map.links.find(l=>l.to==='crypt1');if(!link)throw Error('original monastery stairs missing');p.pos={...link.pos}}
 invalidateLights(w);updatePlayerVision(w,p)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 if(phase==='pending')act({type:'rest',turns:20},1)
 const current=[...p.bag,...Object.values(p.equip)].flatMap(it=>it?[it.uid]:[]);if(originalItems.some(uid=>!current.includes(uid)))throw Error('original equipment missing in declared test kit')
 return{w,s,p,coat,torch,cloth,act,proof:{phase,selectedMods:loaded.db.loadedMods,sourceHashes:loaded.db.scriptModules.map(m=>m.hash),originalActors,originalNextId,originalItems,preparedKit:[coat,torch,cloth].map(it=>({uid:it.uid,def:it.def,count:it.count})),declaredOriginalStairsPositionOnly:phase==='stairs',noClaimOfActualPreviousMonasteryTravel:true,initialRendererFx:s.fx.splice(0)}}
}
