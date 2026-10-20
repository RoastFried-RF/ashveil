import {startCraft} from '../src/core/crafting'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {finishBase} from './base-camp-fixture'
export function fermentationFixture(){
 const d=clinicalDiseaseFixture('actual-fermentation'),{w,p,add}=d;p.background=undefined;p.traits=[];p.skills={};w.s.storyteller.budget=-1e9
 const jar=add('Item.CeramicJar');jar.quality=2;jar.durability=71;Array.from({length:5},()=>add('Item.Cabbage'));const salt=add('Item.Salt')
 const food=p.bag.filter(i=>i.def==='Item.Cabbage');food[0].freshness=66;food[0].contaminantAsh=.5/food[0].count
 const originalUid=jar.uid,initial=structuredClone(p.bag),nextId=w.s.nextId
 const error=startCraft(w,p,'Recipe.FermentCabbage',1);if(error)throw Error(error);finishBase(w,p)
 const batch=w.s.map.batches!.at(-1)!
 return{...d,jar,cabbage:food,salt,originalUid,initial,nextId,batch}
}
