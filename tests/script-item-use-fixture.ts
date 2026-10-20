import {loadDb} from '../tools/loadContent'
import {attachQuickJSScripts} from '../src/scripting/attach'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {addWound} from '../src/core/body'
import {makeItem,addToBag,allItems} from '../src/core/items'
import {deserialize,serialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export async function scriptItemUseFixture(phase:'before'|'treated'|'crafted'|'pendingMedical'|'pendingCraft'='before'){
 const loaded=loadDb(['sample-script-item-use']);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));await attachQuickJSScripts(loaded.db)
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'actual-map-and-equipment-workers',background:'Bg.Hunter',overworld:true})};runUntilInput(w);w.s=deserialize(serialize(w.s));const s=w.s,p=player(w),originalActors=s.creatures.map(c=>c.id),originalNextId=s.nextId,originalItems=allItems(p).map(it=>it.uid)
 // 원래 세계의 초기 상처/붕대 준비만 선언한다. 실제 공격을 겪었다고 주장하지 않는다.
 const wound=addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:3,source:'초기 검사 상처'}).wound,kit=makeItem(w,'Item.Bandage',2);if(addToBag(w,p,kit))throw Error('declared initial bandage kit does not fit')
 const addedCloth=makeItem(w,'Item.Cloth',2);if(addToBag(w,p,addedCloth))throw Error('declared initial cloth supplement does not fit')
 const bandage=p.bag.find(it=>it.def==='Item.Bandage')!,cloth=p.bag.find(it=>it.def==='Item.Cloth'&&it.count>=2)!;if(!bandage||!cloth)throw Error('original source bandage/cloth missing')
 p.nextAct=s.time;p.needs.kcal=2500;p.needs.waterDeficit=0;p.needs.fatigue=10;p.needs.bodyTemp=37;s.storyteller.budget=-1e9;invalidateLights(w);updatePlayerVision(w,p)
 if(originalItems.some(uid=>!allItems(p).some(i=>i.uid===uid)))throw Error('original equipment lost in declared initial injury/kit setup')
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},at=s.time
 if(phase==='pendingMedical')act({type:'treat',uid:bandage.uid,woundId:wound.id},1)
 if(['treated','crafted','pendingCraft'].includes(phase))act({type:'treat',uid:bandage.uid,woundId:wound.id})
 if(phase==='crafted')act({type:'craft',id:'Recipe.Bandage'})
 if(phase==='pendingCraft')act({type:'craft',id:'Recipe.Bandage'},1)
 return{w,s,p,wound,bandage,cloth,act,proof:{phase,modId:'sample-script-item-use',sourceHash:loaded.db.scriptModules[0].hash,originalActors,originalNextId,originalItems,originalClothUid:cloth.uid,bandageUid:bandage.uid,woundId:wound.id,declaredInitialInjuryAndBandageKitOnly:true,declaredClothSupplement:2,noClaimOfActualEarlierAttackOrEarlierPlayerUi:true,actualCorePreparationTU:s.time-at,initialRendererFx:s.fx.splice(0)}}
}
