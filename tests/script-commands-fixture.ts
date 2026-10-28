import {scriptHooksFixture} from './script-hooks-fixture'
import {playerAct} from '../src/core/game'
import {player} from '../src/core/ctx'
export async function scriptCommandsFixture(phase:'before'|'after'|'dispatched'|'pickup'|'pending'='before'){
 const d=await scriptHooksFixture('before','sample-script-commands'),s=d.w.s,p=player(d.w),tile=s.map.tiles[p.pos.y*s.map.w+p.pos.x],originalFloor=tile.items.map(i=>i.uid),uid=s.nextId,originalBody=structuredClone(p.body),originalBag=structuredClone(p.bag)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(d.w,a,budget);if(error)throw Error(error)},proof={...d.proof,phase,modId:'sample-script-commands',declaredSampleExplicitWoundAndOneBandageCreation:true,originalFloor,originalUid:uid,originalBody,originalBag}
 if(phase!=='before')act({type:'wait'})
 if(['dispatched','pickup','pending'].includes(phase))for(let n=0;n<3;n++)act({type:'wait'})
 const generated=tile.items.find(i=>!originalFloor.includes(i.uid))
 if(phase==='pickup'){if(!generated)throw Error('actual script bandage missing');act({type:'pickup',uid:generated.uid});if(!player(d.w).bag.some(i=>i.uid===generated.uid))throw Error('actual script bandage UID lost during pickup')}
 if(phase==='pending')act({type:'rest',turns:20},1)
 return{...d,s:d.w.s,p:player(d.w),act,generated,proof:{...proof,initialRendererFx:d.w.s.fx.splice(0)}}
}
