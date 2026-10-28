import {createCreature,energyMax,hpMax,invalidateLights,newGame,player,serialize,updatePlayerVision,type World} from '../src/core'
import {loadDb} from '../tools/loadContent'

/** 유한 초기 장면이다. 자연 만남이나15칸 탐험의 결과로 주장하지 않는다. */
export function resonanceFixture(tower=false){
 const {db,report}=loadDb();if(report.errors.length)throw Error(report.errors.join('\n'))
 const w:World={db,s:newGame(db,{seed:'resonance-v311',background:'Bg.Excommunicate',overworld:tower})},p=player(w)
 const generatedIds=w.s.creatures.map(c=>c.id)
 p.pos={x:20,y:20};p.traits=['Trait.ResonantHearing'];p.age=undefined;p.abilities=[];p.equip={};p.bag=[];p.hotbar=[];p.thoughts=[];p.hp=hpMax(w,p);p.needs.energy=Math.min(p.needs.energy,energyMax(w,p));p.nextAct=w.s.time;p.facing=2
 w.s.map.name='정비음 검토';w.s.map.lights=[];w.s.map.props=[];w.s.map.rooms=[];w.s.map.ambient=18
 for(const tile of w.s.map.tiles){tile.t='Terrain.Earth';tile.roof=false;tile.items=[];tile.blood=0;delete tile.cont;delete tile.device;delete tile.seen;delete tile.observed}
 w.s.weather='clear';w.s.weatherUntil=1e12;w.s.time=12*1200*100;p.nextAct=w.s.time
 w.s.log=[{turn:w.s.time/100,kind:'info',text:`당신은 ${p.name}, ${db.background(p.background!).label}. 특성: ${p.traits.map(id=>db.trait(id).label).join(', ')}.`}]
 const machine=createCreature(w,'Creature.TenderDrone',{x:35,y:20});machine.nextAct=1e12;machine.mapId=w.s.map.id
 w.s.creatures=[p,machine]
 if(tower){const t=w.s.overworld!.towers.find(t=>t.output>0)!;w.s.map.worldCell={...t.cell};w.s.overworld!.position={...t.cell}}
 invalidateLights(w);updatePlayerVision(w,p)
 const initial=serialize(w.s),proof={seed:w.s.seed,declaredInitial:true,generatedIds,activeIds:w.s.creatures.map(c=>c.id),trait:p.traits,playerHp:p.hp,playerHpMax:hpMax(w,p),machine:{id:machine.id,pos:machine.pos,power:machine.body.machine!.power,nextAct:machine.nextAct},playerPos:p.pos,tower,initialBytes:initial.length,limits:'Finite initial plain map, full-health player under the declared trait, empty bag/equipment/hotbar, coherent initial creation log and one generated drone with inactive AI; no postload state/time/body/RNG injection. No natural meeting or normal-game tower access claimed.'}
 return{w,p,machine,proof}
}
