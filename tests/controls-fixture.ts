import {completeArtFixture} from './complete-art-fixture'
import {addToBag,gridAdd,makeItem,player,tileAt,createCreature,updatePlayerVision,invalidateLights,serialize,deserialize,type World} from '../src/core'
export function controlsFixture(kind:'quiet'|'objects'|'combat'|'danger'='quiet'){
 const {w}=completeArtFixture('inventory'),p=player(w),s=w.s
 p.bag.find(i=>i.def==='Item.Painkiller')!.count=4
 s.map.name='조작감 검토 · '+kind;s.map.links=[];s.map.exits=[];p.hotbar=Array(10).fill(null)
 const add=(id:string,count=1,freshness?:number)=>{const it=makeItem(w,id,count);if(freshness!==undefined)it.freshness=freshness;if(addToBag(w,p,it))throw Error('finite input-test bag');return it}
 const wood=add('Item.Wood',4),fresh=add('Item.Jerky',3,80),old=add('Item.Jerky',2,40),bottle=add('Item.WaterBottle'),torch=add('Item.Torch'),floor=makeItem(w,'Item.Stone',3)
 tileAt(w,p.pos).items=[floor]
 const containerPositions=[{x:20,y:19},{x:21,y:20}],corpseIds:number[]=[],enemyIds:number[]=[]
 if(kind==='objects'){
  for(const pos of containerPositions)Object.assign(tileAt(w,pos),{t:'Terrain.Chest',searched:true,locked:false,cont:{items:[Object.assign(makeItem(w,'Item.Wood',2),{gx:0,gy:0,rot:false})],opened:true,kind:'Loot.Chest'}})
  for(const pos of [{x:19,y:21},{x:21,y:21}]){const c=createCreature(w,'Creature.BurrowRat',pos),[bw,bh]=w.db.creature(c.def).bagSize??[4,3];c.alive=false;c.searched=true;c.bag=[];if(gridAdd(w,{items:c.bag,w:bw,h:bh},makeItem(w,'Item.Stone',2)))throw Error('finite corpse bag');s.creatures.push(c);corpseIds.push(c.id)}
  tileAt(w,{x:19,y:20}).t='Terrain.RustedDoorClosed'
 }
 if(kind==='combat'){
  p.equip.main=makeItem(w,'Item.Bow');add('Item.Arrow',8);const stones=add('Item.Stone',3);p.hotbar[0]={kind:'item',def:stones.def}
  for(const pos of [{x:21,y:20},{x:20,y:19}]){const c=createCreature(w,'Creature.Reaver',pos);c.nextAct=1e12;c.home=undefined;c.met=true;c.reactPolicy='none';c.equip.main=makeItem(w,'Item.RustyKnife');s.creatures.push(c);enemyIds.push(c.id)}
  s.rng.combat=[0,0,0,0]
 }
 if(kind==='danger')p.body.blood=3000
 invalidateLights(w);updatePlayerVision(w,p);s.fx=[]
 const result:World={db:w.db,s:deserialize(serialize(s))}
 return{w:result,ids:{wood:p.bag.find(i=>i.def===wood.def)!.uid,fresh:fresh.uid,old:old.uid,bottle:bottle.uid,torch:torch.uid,floor:floor.uid},containerPositions,corpseIds,enemyIds,proof:{kind,declaredItems:p.bag.map(i=>({uid:i.uid,def:i.def,count:i.count,freshness:i.freshness})),floor:{uid:floor.uid,count:floor.count},corpseIds,enemyIds,limits:'Finite initial healthy/healthy-looking (danger initially blood3000) inventory fixtures, two initially searched containers/corpses, combat actors declared previously met and paused until1e12, initial combat RNG0. Does not claim natural acquisition, prior combat or injury. Actual Title Continue; no postload world injection.'}}
}
