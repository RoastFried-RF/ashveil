import {leaveRegion} from '../src/core/journey'
import {ensureSociety} from '../src/core/diplomacy'
import {killCreature} from '../src/core/combat'
import {makeItem} from '../src/core/items'
import {updatePlayerVision} from '../src/core/fov'
import {newGame,playerAct} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {caravanQuote,caravanTick,dispatchCaravan,encounterCaravans} from '../src/core/caravans'
import {planWorldRaid,worldRaidsTick,encounterWorldRaids} from '../src/core/world-raids'
import {db} from './helpers'
const template=newGame(db,{seed:'raid-cargo-12',background:'Bg.Hunter',overworld:true})
export function worldRaidsFixture(){
 const w:World={db,s:structuredClone(template)},s=w.s,p=player(w),m=s.overworld!,home=m.sites.find(s=>s.id==='Region.GreyCloister')!,site=m.sites.find(s=>s.id==='Region.Stillhouse')!,dest=m.sites.find(s=>s.id==='Region.Settlement21')!
 p.age=undefined;p.traits=[];p.effects=[];p.bag=[];p.equip={};p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.nextAct=s.time;Object.assign(p.needs,{kcal:3000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37,stress:0})
 const raiders=s.creatures.filter(a=>a.faction==='reavers');if(raiders.length!==6)throw Error('original camp crew')
 for(const a of raiders){a.asleep=false;a.unconscious=false;a.activity=undefined;a.ai.mode='guard';a.ai.path=undefined;a.ai.route=undefined;Object.assign(a.needs,{bodyTemp:37,kcal:2500,waterDeficit:0,fatigue:10})}
 p.pos={...s.map.exits[0]};let error=playerAct(w,{type:'leave'});if(error)throw Error(error)
 m.position={...site.cell};error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 const merchant=s.creatures.find(a=>a.traderSite===site.id)!,source=m.markets![site.id],bandage=source.items.find(i=>i.def==='Item.Bandage')!;if(!merchant||!bandage)throw Error('real merchant/bandage')
 for(const a of s.creatures.filter(a=>a.residentSite===site.id)){a.asleep=false;a.unconscious=false;a.activity=undefined;a.ai.mode='idle';Object.assign(a.needs,{bodyTemp:37,kcal:2500,waterDeficit:0,fatigue:10})}
 // Independent INITIAL supply/shortage only; every person and all later cargo movements use the real world.
 source.items=[bandage];bandage.count=12;bandage.contaminantAsh=.75;source.money=20000
 for(const [id,v] of Object.entries(m.simulation!.settlements))v.reserve.Medicine=id===dest.id?0:100000
 const destination=m.markets![dest.id];destination.items=destination.items.filter(i=>db.get<import('../src/core/types').WorldSimulationDef>('WorldSimulation.Hearth').items[i.def]?.commodity!=='Medicine');destination.money=20000
 const quote=caravanQuote(w,site.id);if(quote.error||quote.plan!.destination!==dest.id)throw Error(`route: ${quote.error??quote.plan!.destination}`)
 delete m.scenes[`@${site.cell.x},${site.cell.y}`];p.pos={...s.map.exits[0]};error=playerAct(w,{type:'leave'});if(error)throw Error(error)
 if(planWorldRaid(w))throw Error('real patrol');const raid=m.roadRaids![0]
 for(let i=0;i<10&&raid.phase==='outbound';i++){s.time=raid.nextMove*100;worldRaidsTick(w)}
 if(raid.phase!=='patrolling')throw Error(`patrol ${raid.phase}`)
 error=dispatchCaravan(w,site.id);if(error)throw Error(error);const caravan=m.caravans![0],mobile=m.markets![caravan.market]
 for(let i=0;i<50&&(caravan.position.x!==raid.position.x||caravan.position.y!==raid.position.y);i++){s.time=caravan.nextMove*100;caravanTick(w)}
 if(caravan.position.x!==raid.position.x||caravan.position.y!==raid.position.y)throw Error('actual route misses patrol')
 for(const a of s.creatures)a.nextAct=s.time
 return{w,s,p,m,home,site,dest,source,destination,merchant,bandage,raiders,raid,caravan,mobile}
}

/** Independent INITIAL actual road and actual corpses; subsequent browser work uses native input only. */
export function observedRaidFixture(dead=false){
 const d=worldRaidsFixture();d.m.position={...d.raid.position};leaveRegion(d.w,()=>{});ensureSociety(d.w)!.reputation.reavers=0;encounterCaravans(d.w);encounterWorldRaids(d.w);worldRaidsTick(d.w);if(d.raid.phase!=='engaged')throw Error('actual encounter')
 if(dead)for(const id of d.caravan.members){const a=d.s.creatures.find(a=>a.id===id)!;killCreature(d.w,a,'시나리오 시작 전 사망')}
 d.p.pos={x:dead?5:8,y:5};const lamp=makeItem(d.w,'Item.Lantern');lamp.lit=true;d.p.equip.off=lamp;updatePlayerVision(d.w,d.p);return d
}
