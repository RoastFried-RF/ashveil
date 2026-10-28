import {playerAct,runUntilInput} from '../src/core/game'
import {createCreature} from '../src/core/creatures'
import {turnOf} from '../src/core/ctx'
import {syncRegionalWeather} from '../src/core/environment'
import {updatePlayerVision} from '../src/core/fov'
import {airFixture} from './air-fixture'
export function airBoundaryFixture(){
 const d=airFixture(),cloth=d.add('Item.Cloth',2),charcoal=d.add('Item.Charcoal'),firstFilter=d.add('Item.ClothFilter'),secondFilter=d.add('Item.ClothFilter')
 d.p.body.inhaledAsh=119.98;updatePlayerVision(d.w,d.p)
 return{...d,cloth,charcoal,firstFilter,secondFilter}
}
export function airCraftedFixture(){
 const d=airFixture(),cloth=d.add('Item.Cloth',2),charcoal=d.add('Item.Charcoal'),firstFilter=d.add('Item.ClothFilter'),secondFilter=d.add('Item.ClothFilter')
 if(playerAct(d.w,{type:'craft',id:'Recipe.AshMask'}))throw Error('actual original material mask crafting')
 for(let i=0;d.s.simulationPending&&i<100;i++)runUntilInput(d.w)
 const mask=d.p.bag.find(i=>i.def==='Item.AshMask');if(!mask)throw Error('actual crafted mask')
 if(playerAct(d.w,{type:'equip',uid:mask.uid,slot:'neck'}))throw Error('actual original mask wear')
 for(let i=0;d.s.simulationPending&&i<100;i++)runUntilInput(d.w)
 if(d.p.equip.neck?.uid!==mask.uid)throw Error('same physically worn original mask')
 return{...d,mask,cloth,charcoal,firstFilter,secondFilter}
}
export function airLastFilterFixture(){
 const d=airCraftedFixture();d.mask.uses=2;d.p.body.inhaledAsh=180;updatePlayerVision(d.w,d.p);return d
}
export function airPendingFilterFixture(){
 const d=airCraftedFixture();d.mask.uses=0;d.p.body.inhaledAsh=180;const begin=d.s.time
 if(playerAct(d.w,{type:'refillMask',uid:d.mask.uid,filterUid:d.firstFilter.uid},300000,begin+100))throw Error('actual bound filter work')
 if(!d.s.simulationPending||d.p.activity?.kind!=='respirator'||d.p.activity.remaining<=0)throw Error('actual pending filter reservation')
 return{...d,begin}
}
export function airCoughBoundaryFixture(){
 const d=airFixture(),guard=createCreature(d.w,'Creature.SettlementGuard',{x:21,y:20});guard.asleep=true;guard.deepSleep=false;guard.traits=[];guard.unconscious=false;Object.assign(guard.needs,{fatigue:0,kcal:2500,waterDeficit:0,bodyTemp:37});d.s.creatures.push(guard)
 const boundary=(Math.floor(turnOf(d.w)/200)+1)*200;d.s.time=(boundary-2)*100;for(const c of d.s.creatures)c.nextAct=d.s.time
 d.s.weather='clear';d.s.weatherUntil=1e12;syncRegionalWeather(d.w,true);d.p.body.inhaledAsh=120;updatePlayerVision(d.w,d.p)
 return{...d,guard,boundary}
}
