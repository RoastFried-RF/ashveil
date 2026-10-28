import { player, type World } from '../src/core/ctx'
import { newGame, playerAct } from '../src/core/game'
import { addToBag, makeItem } from '../src/core/items'
import { updatePlayerVision } from '../src/core/fov'
import { db } from './helpers'
const template=newGame(db,{seed:'saltrim-physical',background:'Bg.Hunter',overworld:true})
export function saltrimFixture(){
 const w:World={db,s:structuredClone(template)},s=w.s,p=player(w),m=s.overworld!,site=m.sites.find(s=>s.id==='Region.SaltrimHarbor')!
 p.bag=[];p.equip={};p.traits=[];p.effects=[];p.age=undefined;p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.literacy=2;p.literate=true;p.nextAct=s.time;Object.assign(p.needs,{kcal:3000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37,stress:0})
 m.currentRegion=undefined;m.position={...site.cell};s.creatures=[p];s.maps={};s.offCreatures={};s.sources=[];p.pos={x:8,y:6};const error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 const add=(id:string,count=1)=>{const i=makeItem(w,id,count);if(addToBag(w,p,i))throw Error('bag');return i}
 p.pos={x:16,y:21};p.recipes=['Recipe.EvaporateSeaSalt'];const water=add('Item.WaterBottle'),fuel=add('Item.Wood',3);water.water={pathogen:35,ash:15,salinity:35,source:'바닷물'}
 p.equip={chest:makeItem(w,'Item.LeatherCoat'),lining:makeItem(w,'Item.WoolShirt'),head:makeItem(w,'Item.Hood'),feet:makeItem(w,'Item.Boots')};updatePlayerVision(w,p)
 return{w,s,p,m,site,water,fuel,add}
}
