import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {creatureAt,player,terrainAt,turnOf,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {DIRS} from '../src/core/geom'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {makeItem} from '../src/core/items'
import {ensureBestiary} from '../src/core/bestiary-state'
import {marketFor} from '../src/core/economy'
import {boiledMealFixture} from './boiled-meal-fixture'
import {db} from './helpers'

/** Declared arrival beside an original resident, actual regional generation and finite market. */
export function ashCakeSupplyFixture(){
 const w:World={db,s:newGame(db,{seed:'ash-cake-supply-v407',background:'Bg.Deserter',overworld:true,saveMode:'SaveMode.Study'})},s=w.s,p=player(w),m=s.overworld!,site=m.sites.find(s=>s.id==='Region.Stillhouse')!
 p.bag=[];p.hotbar=Array(10).fill(null);p.money=1000;p.nextAct=s.time;Object.assign(p.needs,{bodyTemp:37,kcal:3000,waterDeficit:0,fatigue:10,protein:100,vitamin:100,stress:0})
 m.currentRegion=undefined;m.position={...site.cell};s.creatures=[p];s.maps={};s.offCreatures={};s.sources=[];s.map={id:'surface',name:'침묵원 앞 길목',kind:'surface',depth:0,ambient:1,worldCell:{...site.cell},w:16,h:12,tiles:Array.from({length:192},()=>({t:'Terrain.Earth',v:0,roof:false,blood:0,items:[]})),exits:[],links:[],rooms:[],props:[],lights:[]};p.pos={x:8,y:6}
 const error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 const trader=s.creatures.find(c=>c.traderSite===site.id)!,market=marketFor(w,trader)!
 const at=DIRS.map(d=>({x:trader.pos.x+d.x,y:trader.pos.y+d.y})).find(pos=>pos.x>0&&pos.y>0&&pos.x<s.map.w-1&&pos.y<s.map.h-1&&terrainAt(w,pos).passable&&!creatureAt(w,pos))
 if(!at)throw Error('No declared arrival beside the original pilgrim merchant');p.pos=at;invalidateLights(w);updatePlayerVision(w,p);runUntilInput(w);s.fx=[]
 const ash=market.items.find(i=>i.def==='Item.PilgrimAsh')!,cake=market.items.find(i=>i.def==='Item.AshCake')!;if(!ash||!cake)throw Error('Missing original finite pilgrim stock')
 return{w,s,p,trader,market,ash,cake}
}

/** Finite ingredients/fire and, for the boundary scene, declared prior 29-serving body history. */
export function ashCakeCraftFixture(mature=false){
 const d=boiledMealFixture(),{w,s,p}=d;s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.saveMode='SaveMode.Study';s.achievementsDisabled=true;s.storyteller.budget=-1e9;s.map.kind='dungeon';s.map.depth=1;p.hotbar=Array(10).fill(null)
 Object.assign(p.needs,{kcal:3000,waterDeficit:0,fatigue:0,protein:100,vitamin:100,hygiene:100})
 for(const[slot,id]of[['chest','Item.LeatherCoat'],['lining','Item.WoolShirt'],['feet','Item.Boots'],['head','Item.Hood']]as const)p.equip[slot]=makeItem(w,id)
 const ash=d.add('Item.PilgrimAsh'),cake=mature?d.add('Item.AshCake'):undefined,extra=mature?d.add('Item.AshCake'):undefined
 if(mature){
  const at=31*TURNS_PER_DAY,delta=at-turnOf(w);s.time=at*100
  for(const light of s.map.lights)if(light.fuelUntil!==undefined)light.fuelUntil+=delta
  for(const item of[...p.bag,...Object.values(p.equip).filter(i=>!!i)]){if(item.gearAgedAt!==undefined)item.gearAgedAt=at;if(item.foodAgedAt!==undefined)item.foodAgedAt=at}
  p.body.foodTraining={'Disease.GreyFever':{firstAt:at-30*TURNS_PER_DAY+1,lastAt:at-TURNS_PER_DAY,servings:29,ashPhase:29,lungAsh:9.666667,lastItemUid:d.bowl.uid}}
  p.booksRead=['Item.SettlementMycologyRecords'];p.literacyBooks=[...p.booksRead];ensureBestiary(w,'Creature.BurrowRat').dissected=1
 }
 p.nextAct=s.time;invalidateLights(w);updatePlayerVision(w,p);runUntilInput(w);s.fx=[]
 return{...d,ash,cake,extra,recipe:'Recipe.AshCake'}
}
