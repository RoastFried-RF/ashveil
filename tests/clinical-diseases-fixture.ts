import {hpMax} from '../src/core/body'
import {player,tileAt,TURNS_PER_HOUR,type World} from '../src/core/ctx'
import {createCreature} from '../src/core/creatures'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {makeItem,addToBag} from '../src/core/items'
import {db} from './helpers'
import {newGame} from '../src/core/game'
export function clinicalDiseaseFixture(seed='clinical-bite-0',overworld=true,contentDb=db){
 const w:World={db:contentDb,s:newGame(contentDb,{seed,overworld})},s=w.s,p=player(w)
 p.pos={x:20,y:20};p.traits=[];p.abilities=[];p.effects=[];p.thoughts=[];p.equip={};p.bag=[];p.body.wounds=[];p.age=undefined;p.stats={str:10,agi:10,vit:10,per:10,wil:10};p.skills={medicine:50};p.money=1000
 Object.assign(p.needs,{bodyTemp:37,energy:100,fatigue:0,kcal:2500,waterDeficit:0,protein:100,vitamin:100,hygiene:100})
 s.creatures=[p];s.time=12*TURNS_PER_HOUR*100;p.nextAct=s.time;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0}
 // 유효 초기 낮 장면이다. 생성 시각의 더 늦은 관찰이나 바뀐 능력치의 초과HP를 과거 사실로 두지 않는다.
 for(const t of s.map.tiles)if(t.observed&&t.observed.at>s.time/100)delete t.observed
 p.hp=hpMax(w,p)
 for(let y=17;y<=23;y++)for(let x=17;x<=23;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
 s.map.lights=[{pos:{...p.pos},kind:'campfire',radius:8}];invalidateLights(w);updatePlayerVision(w,p)
 const add=(id:string,count=1)=>{const it=makeItem(w,id,count);if(addToBag(w,p,it))throw Error('actual fixture bag');return it}
 const doctor=()=>{const c=createCreature(w,'Creature.SettlementDoctor',{x:21,y:20});c.asleep=false;c.traits=[];c.equip={};c.bag=[];c.needs.bodyTemp=37;c.nextAct=s.time;s.creatures.push(c);return c}
 return{w,s,p,add,doctor}
}
