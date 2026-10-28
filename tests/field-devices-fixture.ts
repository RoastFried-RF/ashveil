import { newGame, playerAct } from '../src/core/game'
import { player, type World } from '../src/core/ctx'
import { addToBag, makeItem } from '../src/core/items'
import { studyBook } from '../src/core/skills'
import { updatePlayerVision } from '../src/core/fov'
import { db } from './helpers'
const template=newGame(db,{seed:'field-device-physical',background:'Bg.Hunter',overworld:true})
export function fieldDeviceFixture(learned=true){
 const w:World={db,s:structuredClone(template)},s=w.s,p=player(w),m=s.overworld!,site=m.sites.find(s=>s.id==='Region.ChimneySeven')!
 p.bag=[];p.equip={};p.traits=[];p.effects=[];p.age=undefined;p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.literacy=2;p.literate=true;p.nextAct=s.time;Object.assign(p.needs,{kcal:3000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37,stress:0})
 m.currentRegion=undefined;m.position={...site.cell};s.creatures=[p];s.maps={};s.offCreatures={};s.sources=[];s.map={id:'surface',name:'칠번 굴뚝 앞 길목',kind:'surface',depth:0,ambient:1,w:16,h:12,tiles:Array.from({length:192},()=>({t:'Terrain.Earth',v:0,roof:false,blood:0,items:[]})),exits:[],links:[],rooms:[],props:[],lights:[]};p.pos={x:8,y:6}
 const error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 const cloth=makeItem(w,'Item.Cloth'),water=makeItem(w,'Item.WaterBottle'),hammer=makeItem(w,'Item.IronHammer'),actuator=makeItem(w,'Item.SmallActuator'),cell=makeItem(w,'Item.LowPowerCell'),manual=makeItem(w,'Item.SignalMaintenanceManual')
 for(const it of [cloth,water,hammer,actuator,cell,manual])addToBag(w,p,it)
 if(learned)studyBook(w,p,manual.def,true)
 p.pos={x:30,y:17};p.equip={chest:makeItem(w,'Item.LeatherCoat'),lining:makeItem(w,'Item.WoolShirt'),head:makeItem(w,'Item.Hood'),feet:makeItem(w,'Item.Boots')};updatePlayerVision(w,p)
 const sensor={x:30,y:16},receiver={x:34,y:16}
 return{w,s,p,m,site,cloth,water,hammer,actuator,cell,manual,sensor,receiver,device:s.map.tiles[16*s.map.w+30].device!}
}
