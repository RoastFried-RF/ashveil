import {scriptHooksFixture} from './script-hooks-fixture'
import {playerAct} from '../src/core/game'
import {player} from '../src/core/ctx'
export async function scriptItemFixture(phase:'before'|'after'|'pending'='before'){
 const d=await scriptHooksFixture('before','sample-script-item'),p=player(d.w),food=p.bag.find(i=>i.def==='Item.Jerky')!;if(!food)throw Error('original Hunter jerky missing')
 const initialFood=structuredClone(food),originalBag=structuredClone(p.bag),proof={...d.proof,phase,modId:'sample-script-item',foodUid:food.uid,initialFood,originalBag,actualInitialItemFromOriginalBackground:true,noExtraFoodOrItemsCreatedForDemo:true}
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)}
 if(phase!=='before')act({type:'consume',uid:food.uid})
 if(phase==='pending')act({type:'rest',turns:20},1)
 return{...d,s:d.w.s,p:player(d.w),food,act,proof:{...proof,initialRendererFx:d.w.s.fx.splice(0)}}
}
