import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {playerAct} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {Action} from '../src/core/actions'

export function originalMaterialsFixture(){
 const d=clinicalDiseaseFixture('actual-original-materials-300',false)
 d.p.background=undefined;d.p.skills={};d.s.storyteller.budget=-1e9;d.s.map.name='생활 재료·원래 수량과 불빛'
 const source=[['Item.Wood',3],['Item.Stone',3],['Item.IronScrap',3],['Item.Leather',2],['Item.Thread',3],['Item.Charcoal',3],['Item.Cloth',4],['Item.Bandage',3],['Item.Torch',1],['Item.CampfireKit',1],['Item.Bowl',1]]as const
 const items=source.map(([id,count])=>d.add(id,count)),original=items.map(i=>({id:i.def,uid:i.uid,count:i.count,lit:i.lit,fuel:i.fuel}))
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=player(w)
 s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,original,uid:(id:string)=>original.find(i=>i.id===id)!.uid,act:(a:Action)=>{const error=playerAct(w,a);if(error)throw Error(error)},proof:{declaredInitialItems:original,source:'Finite original newGame(nooverworld) player, explicithealthy/noon/pausedstory/empty7x7earth/staticlight initialscene and11finite original itemstacks. These materials were declaredinitial, not acquired or crafted in normalplay. RealTitleContinue then actualkeys/mouse/toggle/drop/readonlywindows, independentNodewholeworldcomparison; no postloadworld/time/RNG/item injection.'}}
}
