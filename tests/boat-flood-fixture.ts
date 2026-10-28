import {addWound,bodyTick} from '../src/core/body'
import {turnOf,TURNS_PER_HOUR} from '../src/core/ctx'
import {updatePlayerVision} from '../src/core/fov'
import {perform} from '../src/core/actions'
import {enlistRecruit} from '../src/core/companions'
import {launchBoat} from '../src/core/journey'
import {playerAct,runUntilInput} from '../src/core/game'
import {addToBag,makeItem} from '../src/core/items'
import {syncRegionalWeather} from '../src/core/environment'
import {watercraftFixture} from './watercraft-fixture'
import {finishBase} from './base-camp-fixture'
export function boatFloodFixture(crewCount=0){
 const d=watercraftFixture(),{w,s,p,m,site,hull,sea}=d
 const residents=s.creatures.filter(c=>c.residentSite===site.id&&c.id!==p.id&&c.traderSite===undefined).slice(0,crewCount)
 if(residents.length!==crewCount)throw Error('actual original crew')
 for(let i=0;i<residents.length;i++){const c=residents[i];c.pos={x:14+i%2,y:20-Math.floor(i/2)};c.asleep=false;c.unconscious=false;c.activity=undefined;c.traits=[];c.effects=[];c.age=undefined;c.ai.mode='idle';Object.assign(c.needs,{bodyTemp:37,kcal:2500,waterDeficit:0,fatigue:10,energy:100});enlistRecruit(w,c,1)}
 if(launchBoat(w,p,hull.uid))throw Error('launch')
 const error=playerAct(w,{type:'travel',target:sea});if(error)throw Error(error);for(let i=0;s.simulationPending&&i<100;i++)runUntilInput(w);if(s.over||m.position.x!==sea.x||m.position.y!==sea.y)throw Error('actual sailing')
 s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};syncRegionalWeather(w,true)
 const cargo=makeItem(w,'Item.Salt',2);cargo.contaminantAsh=.75;addToBag(w,p,cargo);if(!perform(w,p,{type:'search'}).ok)throw Error('actual hold');finishBase(w,p);if(!perform(w,p,{type:'lootPut',uid:cargo.uid}).ok)throw Error('actual cargo');const hold=s.map.tiles[6*s.map.w+7],original=hold.cont!.items.find(i=>i.uid===cargo.uid)!
 for(const a of s.creatures)a.nextAct=Math.max(a.nextAct,s.time)
 return{...d,crew:residents,hold,cargo:original,vessel:s.map.vessel!}
}

/** Independent INITIAL two turns before an actual storm-hour failure, with one real brain-injured passenger. */
export function boatFloodBoundaryFixture(){
 const d=boatFloodFixture(3),patient=d.crew[0]
 for(const c of d.crew.slice(1))for(const slot of Object.keys(c.equip) as (keyof typeof c.equip)[]){const item=c.equip[slot];if(item&&(d.w.db.item(item.def).bulk??0)>0){if(addToBag(d.w,c,item))throw Error('original armor bag');delete c.equip[slot]}}
 const boundary=(Math.floor(turnOf(d.w)/TURNS_PER_HOUR)+1)*TURNS_PER_HOUR;d.s.time=(boundary-2)*100;for(const c of d.s.creatures)c.nextAct=d.s.time
 d.hull.durability=6;d.s.weather='ashgale';d.s.weatherUntil=1e12;d.s.wind={x:0,y:0};syncRegionalWeather(d.w,true)
 patient.needs.energy=0;addWound(d.w,patient,{def:'Wound.Stab',part:'Brain',severity:Math.ceil(patient.body.maxHp.Brain*.8),source:'침수 전 머리 손상',internal:true});bodyTick(d.w,patient,false);if(!patient.unconscious||!patient.alive)throw Error('actual brain injury');updatePlayerVision(d.w,d.p);return{...d,patient,boundary}
}
