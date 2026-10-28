import {residentCultivationFixture} from './resident-cultivation-fixture'
import {player,tileAt,turnOf,type World} from '../src/core/ctx'
import {addToBag,makeItem} from '../src/core/items'
import {readyFood} from '../src/core/open-food-state'
import {marketFor} from '../src/core/economy'
import {playerAct} from '../src/core/game'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {Action} from '../src/core/actions'

function prepareResidentCookingFixture(supplied=false){
 const d=residentCultivationFixture(false),c=d.c,w=d.w,s=d.s
 // 유한 초기 장면: 기존 주민/몸/물병을 유지하고 휴대 식량은 같은 현물로 바닥에 둔다.
 const stashed=c.bag.filter(i=>readyFood(w,c,i));c.bag=c.bag.filter(i=>!stashed.includes(i))
 for(const it of stashed){delete it.gx;delete it.gy;delete it.rot}tileAt(w,{x:38,y:20}).items.push(...stashed)
 const oats=makeItem(w,'Item.Oats',3);if(addToBag(w,c,oats))throw Error('declared original oats do not fit')
 const suppliedItems=[]
 if(supplied)for(const id of ['Item.Bowl','Item.CampfireKit','Item.Wood']){const it=makeItem(w,id);if(addToBag(w,c,it))throw Error('declared own cooking supply does not fit');suppliedItems.push({id,uid:it.uid})}
 c.money=100;c.needs.kcal=-20;c.needs.waterDeficit=0;c.needs.fatigue=0;c.needs.bodyTemp=37;c.needs.hygiene=70;c.hands={kind:'washed',at:turnOf(w)}
 for(const other of s.creatures)other.nextAct=other.id===d.p.id||other.id===c.id?s.time:s.time+1e9
 const market=marketFor(w,d.s.creatures.find(o=>o.traderSite===c.residentSite)!)!,originalStock=market.items.map(i=>({id:i.def,uid:i.uid,count:i.count})),initialCash=c.money,bank=market.money
 const copy:World={db:w.db,s:deserialize(serialize(s))},npc=copy.s.creatures.find(o=>o.id===c.id)!,p=player(copy),trader=copy.s.creatures.find(o=>o.traderSite===c.residentSite)!
 invalidateLights(copy);updatePlayerVision(copy,p)
 return{w:copy,s:copy.s,p,c:npc,trader,market:marketFor(copy,trader)!,act:(a:Action,budget?:number)=>{const error=playerAct(copy,a,budget);if(error)throw Error(error)},proof:{...d.proof,declaredInitialOats:{uid:oats.uid,count:3},declaredInitialPersonalCash:initialCash,initialBank:bank,originalStock,suppliedItems,stashedOriginalFood:stashed.map(i=>({uid:i.uid,def:i.def,count:i.count})),declaredHungryHealthyIdleResident:true,onlyOriginalObserverAndResidentScheduled:true,noClaimOfNormalAcquisitionOrEarlierStarvation:true}}
}

const templates=new Map<boolean,{db:World['db'];state:string;proof:ReturnType<typeof prepareResidentCookingFixture>['proof'];residentId:number;traderId:number}>()
export function residentCookingFixture(supplied=false){
 let template=templates.get(supplied)
 if(!template){const initial=prepareResidentCookingFixture(supplied);template={db:initial.w.db,state:serialize(initial.s),proof:structuredClone(initial.proof),residentId:initial.c.id,traderId:initial.trader.id};templates.set(supplied,template)}
 const w:World={db:template.db,s:deserialize(template.state)},s=w.s,p=player(w),c=s.creatures.find(o=>o.id===template.residentId)!,trader=s.creatures.find(o=>o.id===template.traderId)!
 invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,c,trader,market:marketFor(w,trader)!,act:(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},proof:structuredClone(template.proof)}
}
