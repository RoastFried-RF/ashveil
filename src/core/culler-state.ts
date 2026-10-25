/** Original mechanical stock and local process clock; queries do not refill old actors. */
import {rng,turnOf,type World} from './ctx'
import type {Creature,CullerRules} from './types'
const signatures=new WeakMap<CullerRules,string>()
export function cullerSignature(d:CullerRules){let signature=signatures.get(d);if(!signature){signature=JSON.stringify(d);signatures.set(d,signature)}return signature}
export function cullerRules(w:World,c:Creature){const d=w.db.creature(c.def).culler;return d&&c.cullerState?.rule===cullerSignature(d)?d:undefined}
export function initializeCuller(w:World,c:Creature){
 const d=w.db.creature(c.def).culler,stock=c.body.machine?.components;if(!d||!stock)return
 const used=new Set<number>(),components=d.components.map(row=>{const it=stock.find(i=>i.def===row.item&&!used.has(i.uid));if(!it)throw Error('구제기의 원래 부품이 없다');used.add(it.uid);const unit=row.item===d.spray.item?'uses' as const:'count' as const;return{uid:it.uid,part:row.part,def:it.def,initial:unit==='uses'?it.uses??0:it.count,spent:0,lost:0,unit}})
 c.cullerState={rule:cullerSignature(d),attacks:0,coolUntil:0,returning:false,components}
}
export function cullerCooling(w:World,c:Creature){return !!cullerRules(w,c)&&c.cullerState!.coolUntil>turnOf(w)}
export function recordCullerAttack(w:World,c:Creature){
 const d=cullerRules(w,c),s=c.cullerState;if(!d||!s)return
 s.attacks++;if(s.attacks>=d.attacksBeforeCooling){s.attacks=0;s.coolUntil=turnOf(w)+rng(w,'combat').int(...d.coolingTurns)+1;w.s.fx.push({k:'status',id:c.id,text:'냉각',color:'#a9c0c2',turn:turnOf(w)});if(w.s.fx.length>80)w.s.fx.splice(0,w.s.fx.length-80)}
}
function physicallyLost(w:World,c:Creature,id:string){
 const body=w.db.body(c.body.def);let p=body.parts.find(p=>p.id===id)
 while(p){if(c.body.missing.includes(p.id))return true;p=p.parent?body.parts.find(parent=>parent.id===p!.parent):undefined}
 return c.body.wounds.filter(w=>w.part===id).reduce((n,w)=>n+Math.max(0,w.severity-w.healed),0)+(c.body.organDamage?.[id]??0)>=(c.body.maxHp[id]??Infinity)
}
export function limitCullerStock(w:World,c:Creature){
 if(!cullerRules(w,c)||!c.cullerState||!c.body.machine?.components)return
 for(const row of c.cullerState.components){const it=c.body.machine.components.find(i=>i.uid===row.uid);if(!it||!physicallyLost(w,c,row.part))continue;const remaining=row.unit==='uses'?it.uses??0:it.count;row.lost+=remaining;if(row.unit==='uses')it.uses=0;else c.body.machine.components.splice(c.body.machine.components.indexOf(it),1)}
}
