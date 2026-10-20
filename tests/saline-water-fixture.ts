import { player, tileAt } from '../src/core/ctx'
import { invalidateLights, updatePlayerVision } from '../src/core/fov'
import { addToBag, makeItem } from '../src/core/items'
import { makeWorld } from './helpers'
export function salineFixture() {
  const w=makeWorld('saline-water','Bg.Excommunicate'),p=player(w)
  p.traits=[];p.effects=[];p.thoughts=[];p.background=undefined;p.age=undefined;p.equip={};p.bag=[];p.skills={};p.pos={x:20,y:20};p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.body.wounds=[];p.body.blood=p.body.bloodMax;p.hp=100
  Object.assign(p.needs,{kcal:3000,waterDeficit:0,fatigue:10,bodyTemp:37,protein:100,vitamin:100,hygiene:100,stress:0})
  w.s.creatures=[p];w.s.time=14400*100;p.nextAct=w.s.time;w.s.weather='clear';w.s.weatherUntil=1e12;w.s.noiseEvents=[]
  for(let y=17;y<=23;y++)for(let x=17;x<=23;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
  w.s.map.lights=[{pos:{x:20,y:21},kind:'campfire',radius:6}];tileAt(w,{x:20,y:21}).t='Terrain.Campfire';tileAt(w,{x:21,y:20}).t='Terrain.SeaShallow'
  const add=(id:string,count=1)=>{const it=makeItem(w,id,count);if(addToBag(w,p,it))throw Error('fixture bag');return it}
  const source=add('Item.WaterBottle');source.uses=0
  const fresh=add('Item.WaterBottle');fresh.uses=2.5;fresh.water={pathogen:0,ash:0,source:'깨끗한 물'}
  const fuel=add('Item.Wood',2),filter=add('Item.ClothFilter'),pill=add('Item.WaterPill')
  invalidateLights(w);updatePlayerVision(w,p)
  return{w,p,source,fresh,fuel,filter,pill,add}
}
