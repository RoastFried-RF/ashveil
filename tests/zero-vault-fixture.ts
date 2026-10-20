import { newGame, playerAct } from '../src/core/game'
import { player, type World } from '../src/core/ctx'
import { addToBag, makeItem } from '../src/core/items'
import { updatePlayerVision } from '../src/core/fov'
import { db } from './helpers'
const template=newGame(db,{seed:'zero-vault-physical',background:'Bg.GuardArchivist',overworld:true})
export function zeroVaultFixture(quiet=true,enter=true,seed?:string){
 const w:World={db,s:seed?newGame(db,{seed,background:'Bg.GuardArchivist',overworld:true}):structuredClone(template)},s=w.s,p=player(w),m=s.overworld!,site=m.sites.find(s=>s.id==='Region.PostThree')!
 p.bag=[];p.equip={};p.traits=[];p.effects=[];p.age=undefined;p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.literacy=2;p.literate=true;p.nextAct=s.time;p.money=1000;Object.assign(p.needs,{kcal:3000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37,stress:0})
 m.currentRegion=undefined;m.position={...site.cell};s.creatures=[p];s.maps={};s.offCreatures={};s.sources=[];s.map={id:'surface',name:'제3 초소 앞 길목',kind:'surface',depth:0,ambient:1,w:16,h:12,tiles:Array.from({length:192},()=>({t:'Terrain.Earth',v:0,roof:false,blood:0,items:[]})),exits:[],links:[],rooms:[],props:[],lights:[]};p.pos={x:8,y:6}
 const error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 if(enter){p.pos={x:32,y:30};const downstairs=playerAct(w,{type:'stairs'});if(downstairs)throw Error(downstairs)}
 const guard=s.creatures.find(c=>c.def==='Creature.ZeroVaultWarden')
 const actuator=makeItem(w,'Item.SmallActuator'),hammer=makeItem(w,'Item.IronHammer');addToBag(w,p,actuator);addToBag(w,p,hammer)
 p.pos={x:15,y:10};p.equip={chest:makeItem(w,'Item.LeatherCoat'),lining:makeItem(w,'Item.WoolShirt'),head:makeItem(w,'Item.Hood'),feet:makeItem(w,'Item.Boots'),main:makeItem(w,'Item.Torch')};p.equip.main!.lit=true
 if(guard){guard.age=undefined;guard.traits=[];guard.effects=[];guard.nextAct=s.time;guard.asleep=quiet;guard.unconscious=false;if(quiet)guard.needs.fatigue=80}
 updatePlayerVision(w,p)
 const mechanism={x:14,y:10},door={x:16,y:10},chest={x:23,y:8},device=s.map.tiles[10*s.map.w+14].device!
 return{w,s,p,m,site,guard:guard!,actuator,hammer,mechanism,door,chest,device}
}
