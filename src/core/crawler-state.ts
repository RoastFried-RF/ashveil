/** Definition-bound anatomy and original gland stock. Queries never create state. */
import type {World} from './ctx'
import type {Creature,CrawlerRules} from './types'
const signatures=new WeakMap<CrawlerRules,string>()
export function crawlerSignature(d:CrawlerRules){let s=signatures.get(d);if(!s){s=JSON.stringify([d.segments.map(g=>[g.body,g.ganglion,g.legs]),d.head,d.glands,d.venomItem,d.dosesPerGland,d.venomAttack,d.coilAbility,d.prey,d.foodIds,d.huntBelowKcal,d.eatBelowKcal,d.drinkAboveMl,d.drinkMl,d.smokeKinds,d.smokeRadius,d.ceiling.dropRadius,d.ceiling.inspectRadius,d.ceiling.awarenessTurns,d.ceiling.ambushHit,d.ceiling.reclimbTurns,d.harvest]);signatures.set(d,s)}return s}
export function crawlerRules(w:World,c:Creature){const d=w.db.creature(c.def).crawler;return d&&c.crawlerState?.rule===crawlerSignature(d)?d:undefined}
export function crawlerMotorBlocked(w:World,c:Creature,id:string){
 const d=crawlerRules(w,c),group=d?.segments.find(g=>g.legs.includes(id));if(!group)return false
 return[group.body,group.ganglion].some(p=>c.body.missing.includes(p)||c.body.wounds.filter(x=>x.part===p).reduce((n,x)=>n+x.severity-x.healed,0)+(c.body.organDamage?.[p]??0)>=(c.body.maxHp[p]??0))
}
