import { saltrimFixture } from './saltrim-fixture'
import { worldRoute } from '../src/core/overworld'
import { factionRelation } from '../src/core/diplomacy'
import { caravanQuote } from '../src/core/caravans'
import { playerAct } from '../src/core/game'
export function caravansFixture(local=false){
 const d=saltrimFixture(),{w,p,s,m,site}=d,source=m.markets![site.id],merchant=s.creatures.find(c=>c.traderSite===site.id)!,salt=source.items.find(i=>i.def==='Item.Salt')!
 merchant.asleep=false;merchant.unconscious=false;merchant.activity=undefined;merchant.ai.mode='idle';merchant.needs.bodyTemp=37;merchant.needs.energy=100
 const guards=s.creatures.filter(c=>c.residentSite===site.id&&w.db.creature(c.def).ai==='guard');for(const c of guards){c.asleep=false;c.unconscious=false;c.activity=undefined;c.ai.mode='guard';c.needs.bodyTemp=37}
 // Independent INITIAL actual source stock and actual destination shortage; all subsequent transfers use core APIs.
 source.items=source.items.filter(i=>i.def==='Item.Salt');salt.count=12;salt.contaminantAsh=.75;source.money=20000;m.simulation!.settlements[site.id].reserve.Salt=6000
 const dest=m.sites.filter(t=>t.id!==site.id&&t.faction&&m.markets?.[t.id]&&Math.min(factionRelation(w,site.faction!,t.faction),factionRelation(w,t.faction,site.faction!))>-50).sort((a,b)=>Math.abs(a.cell.x-site.cell.x)+Math.abs(a.cell.y-site.cell.y)-(Math.abs(b.cell.x-site.cell.x)+Math.abs(b.cell.y-site.cell.y))).find(t=>worldRoute(w,site.cell,t.cell))!
 if(!dest)throw Error('destination');const destination=m.markets![dest.id];destination.items=destination.items.filter(i=>i.def!=='Item.Salt');destination.money=20000;m.simulation!.settlements[dest.id].reserve.Salt=0
 p.money=1000
 const q=caravanQuote(w,site.id);if(q.error)throw Error(q.error)
 if(q.plan!.destination!==dest.id)throw Error(`unexpected destination ${q.plan!.destination}, expected ${dest.id}`)
 if(!local){
 // saltrimFixture enters from an independent INITIAL cloister state; discard that unrelated cached road backdrop.
 delete m.scenes[`@${site.cell.x},${site.cell.y}`]
 p.pos={...s.map.exits[0]};const error=playerAct(w,{type:'leave'});if(error)throw Error(error)}
 return{...d,source,merchant,guards,salt,dest,destination,plan:q.plan!}
}
