import {playerAct,type Action} from '../src/core'
import {turnOf,tileAt} from '../src/core/ctx'
import {makeItem,equip} from '../src/core/items'
import {syncRegionalWeather} from '../src/core/environment'
import {updatePlayerVision} from '../src/core/fov'
import {fermentationFixture} from './fermentation-fixture'
/** INITIAL supplies are finite original items. Every later meal, drink, rest and sleep is an ordinary action. */
export function fermentationBoundaryFixture(){
 const d=fermentationFixture(),{w,p,batch}=d;w.s.hygieneEnabled=false
 const coat=d.add('Item.WolfCoat');const clothing=equip(w,p,coat.uid);if(clothing)throw Error(clothing)
 const stash=tileAt(w,p.pos).items
 for(let i=0;i<24;i++)stash.push(makeItem(w,'Item.Hardtack',5))
 for(let i=0;i<70;i++)stash.push(makeItem(w,'Item.WaterBottle'))
 const supplyUids=stash.map(i=>i.uid),target=batch.processing!.total-2,targetTU=(turnOf(w)+target)*100
 syncRegionalWeather(w,true)
 let actions=0
 while(batch.processing!.progress<target&&actions++<10000){
  let a:Action
  const remaining=target-batch.processing!.progress
  if(p.needs.waterDeficit>200){
   const bottle=p.bag.find(i=>i.def==='Item.WaterBottle'&&(i.uses??0)>0)
   if(bottle)a={type:'consume',uid:bottle.uid}
   else{
    const empty=p.bag.find(i=>i.def==='Item.WaterBottle'&&(i.uses??0)===0)
    const full=tileAt(w,p.pos).items.find(i=>i.def==='Item.WaterBottle'&&(i.uses??0)>0)
    if(empty)a=p.freeActTurn===turnOf(w)?{type:'wait'}:{type:'drop',uid:empty.uid}
    else if(full)a={type:'pickup',uid:full.uid}
    else throw Error('finite original water exhausted')
   }
  }else if(p.needs.kcal<1500){
   const food=p.bag.find(i=>i.def==='Item.Hardtack'),floor=tileAt(w,p.pos).items.find(i=>i.def==='Item.Hardtack')
   if(food)a={type:'consume',uid:food.uid};else if(floor)a={type:'pickup',uid:floor.uid};else throw Error('finite original food exhausted')
  }else if(p.needs.fatigue>=50&&remaining>10000)a={type:'sleep'}
  else a={type:'rest',turns:Math.min(200,remaining)}
  const before=w.s.time,until=a.type==='sleep'?Math.min(targetTU,before+6*1200*100):targetTU
  const error=playerAct(w,a,undefined,until)
  if(error)throw Error('actual fourteen day action: '+error)
  if(w.s.simulationPending){const error=playerAct(w,{type:'stopActivity'},undefined,targetTU);if(error)throw Error(error)}
  if(!p.alive||w.s.over)throw Error('original fourteen day survivor died')
 }
 if(batch.processing!.progress!==target)throw Error('actual fourteen day boundary: '+batch.processing!.progress)
 updatePlayerVision(w,p)
 return{...d,supplyUids,actions}
}
