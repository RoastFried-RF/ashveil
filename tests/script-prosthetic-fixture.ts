import {loadDb} from '../tools/loadContent'
import {attachQuickJSScripts} from '../src/scripting/attach'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {allItems,makeItem,addToBag} from '../src/core/items'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export type ScriptProstheticPhase='before'|'installed'|'removed'|'pendingInstall'|'pendingRemove'
export async function scriptProstheticFixture(phase:ScriptProstheticPhase='before'){
 const loaded=loadDb(['sample-script-prosthetic']);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));await attachQuickJSScripts(loaded.db)
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'actual-map-and-equipment-workers',background:'Bg.Hunter',overworld:true})};runUntilInput(w);w.s=deserialize(serialize(w.s));const s=w.s,p=player(w),originalActors=s.creatures.map(c=>c.id),originalItems=allItems(p).map(i=>i.uid),originalNextId=s.nextId,originalBody=structuredClone(p.body)
 // 원래 인물에 왼발 결손과 유한 의족 하나만 초기 조건으로 둔다. 이전 공격/절단/수술을 실행했다고 주장하지 않는다.
 p.body.missing.push('LeftFoot');const added=makeItem(w,'Item.PegLeg');if(addToBag(w,p,added))throw Error('declared initial physical peg leg does not fit');const limb=p.bag.find(i=>i.uid===added.uid)!
 s.storyteller.budget=-1e9;p.nextAct=s.time;invalidateLights(w);updatePlayerVision(w,p)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},at=s.time
 if(['installed','removed','pendingRemove'].includes(phase))act({type:'prosthetic',operation:'install',part:'LeftFoot',uid:limb.uid})
 if(phase==='removed')act({type:'prosthetic',operation:'remove',part:'LeftFoot'})
 if(phase==='pendingInstall')act({type:'prosthetic',operation:'install',part:'LeftFoot',uid:limb.uid},1)
 if(phase==='pendingRemove')act({type:'prosthetic',operation:'remove',part:'LeftFoot'},1)
 if(originalItems.some(uid=>!allItems(p).some(i=>i.uid===uid)))throw Error('original item disappeared in declared injury/actual prosthetic operation')
 return{w,s,p,limb,act,proof:{phase,modId:'sample-script-prosthetic',sourceHash:loaded.db.scriptModules[0].hash,originalActors,originalItems,originalNextId,originalBody,limbUid:limb.uid,declaredOnlyMissingLeftFootAndOnePegLeg:true,noClaimOfEarlierAttackOrAmputation:true,originalBodiesOtherwiseRetained:true,actualPreparationTU:s.time-at,initialRendererFx:s.fx.splice(0)}}
}
