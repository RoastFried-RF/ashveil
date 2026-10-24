import {expect,it} from 'vitest'
import {activityStep,perform} from '../src/core/actions'
import {killCreature} from '../src/core/combat'
import {createCreature} from '../src/core/creatures'
import {loadMods,type ModPackage} from '../src/core/defs'
import {addToBag,allItems,makeItem,meleeWield} from '../src/core/items'
import {startCraft} from '../src/core/crafting'
import {studyBook} from '../src/core/skills'
import {createMarket,economyTick} from '../src/core/economy'
import {deserialize,serialize,stateHash} from '../src/core/save'
import type {RecipeDef,TraderStockDef} from '../src/core/types'
import {equipmentSpec,equipmentTipReach,heldPose} from '../src/client/render/equipment-motion'
import {medicalGripPosition} from '../src/client/render/medical-motion'
import gripData from '../src/client/render/held-grips.json'
import sprites from '../src/client/sprites.json'
import {readPackages} from '../tools/loadContent'
import {db} from './helpers'
import {prisonerFixture} from './prisoner-fixture'

it('the priest spawns one physical censer; dropping, breakage and death never retain phantom censer damage or clone it',()=>{
 const {w,s,p}=prisonerFixture(),c=createCreature(w,'Creature.WitheredPriest',{x:21,y:20});s.creatures=[p,c]
 const censer=c.equip.main!;expect(censer?.def).toBe('Item.WitheredCenser');expect(allItems(c).filter(i=>i.def===censer.def)).toHaveLength(1)
 expect(meleeWield(w,c)?.item?.uid).toBe(censer.uid);expect(meleeWield(w,c)?.atk.stunD).toBe(4)
 const before=stateHash(s);expect(equipmentSpec(db.item(censer.def),censer.uid)).toMatchObject({grip:[.5,88/1387],axis:Math.PI/2,restAngle:Math.PI/2});expect(stateHash(s)).toBe(before)
 censer.durability=0;expect(meleeWield(w,c)).toMatchObject({atk:{label:'맨손 후려치기',damage:5,family:'unarmed'}});expect(meleeWield(w,c)?.atk.stunD).toBeUndefined();censer.durability=100
 expect(perform(w,c,{type:'drop',uid:censer.uid}).ok).toBe(true);expect(c.equip.main).toBeUndefined();expect(meleeWield(w,c)?.item).toBeUndefined();expect(meleeWield(w,c)?.atk.label).toBe('맨손 후려치기')
 const tile=s.map.tiles[c.pos.y*s.map.w+c.pos.x];expect(tile.items.filter(i=>i.uid===censer.uid)).toHaveLength(1)
 killCreature(w,c,'검사 fixture 종료');expect(tile.items.filter(i=>i.uid===censer.uid)).toHaveLength(1);expect(allItems(c).filter(i=>i.def===censer.def)).toHaveLength(0)
 const restored=deserialize(serialize(s));expect(restored.map.tiles[c.pos.y*s.map.w+c.pos.x].items.filter(i=>i.uid===censer.uid)).toHaveLength(1)
})
it('a hanging source grips the top ring, rests downward, and traces the lower weight through four attack directions',()=>{
 const item=equipmentSpec(db.item('Item.WitheredCenser')),base={item,slot:0 as const,mode:'idle',stride:0,moving:false,crouched:false,phase:0}
 expect(equipmentTipReach(item)).toBeCloseTo(18*(1-88/1387));expect(Math.sin(heldPose({...base,direction:'right'}).angle)).toBeGreaterThan(.95)
 for(const[direction,vector]of[['down',{x:0,y:1}],['up',{x:0,y:-1}],['left',{x:-1,y:0}],['right',{x:1,y:0}]]as const){const action={style:'smash'as const,slot:0 as const,weapon:item,direction,vector},rest=heldPose({...base,direction});for(const phase of[0,1])expect(heldPose({...base,direction,mode:'attack',phase,action})).toEqual(rest);const hit=heldPose({...base,direction,mode:'attack',phase:.47,action});expect(Math.cos(hit.angle)*vector.x+Math.sin(hit.angle)*vector.y).toBeGreaterThan(.8)}
})
it('the actual authored palm stays fixed through impact; mirrored attack has an occluded right hand instead of an invented near hand',()=>{
 const item=equipmentSpec(db.item('Item.WitheredCenser')),key='av322_patient_attack_right4',row=gripData.frames[key],rect=sprites.frames[key],tr=sprites.chars.withered_priest.frameTransforms[key],at=medicalGripPosition(row.main!.point,{width:Number(rect[3]),height:Number(rect[4]),...tr}),base={item,slot:0 as const,direction:'right'as const,mode:'attack',stride:0,moving:false,crouched:false,wrist:[at.x,at.y]as const,sourceGrip:true,action:{style:'smash'as const,slot:0 as const,direction:'right'as const,vector:{x:1,y:0}}}
 for(const phase of[.3,.43,.5,.7]){const pose=heldPose({...base,phase});expect(pose.x).toBe(at.x);expect(pose.y).toBe(at.y)}
 expect(gripData.frames.av322_patient_attack_left4.main).toBeNull();expect(gripData.frames.av322_patient_attack_left4.off!.point).toEqual(row.main!.point);expect(Object.keys(gripData.frames)).toHaveLength(96)
})
it('four previously background-only items have learned recipes, finite new stock and no salvage material gain',()=>{
 for(const[recipe,item,material,min]of[['Recipe.LightCrossbow','Item.LightCrossbow','Item.Wood',4],['Recipe.BoatmanPole','Item.Pole','Item.Wood',4],['Recipe.LeatherApron','Item.LeatherApron','Item.Leather',4],['Recipe.OiledRaincoat','Item.OiledRaincoat','Item.Linen',3]]as const){
  const r=db.get<RecipeDef>(recipe);expect(r.basic).toBe(false);expect(r.output).toEqual({item,count:1});expect(r.inputs.find(i=>i.item===material)!.count).toBeGreaterThanOrEqual(min);expect(db.item('Item.CraftManual').book!.unlocks).toContain(recipe)
  const entries=db.all<TraderStockDef>('TraderStock').flatMap(s=>s.entries).filter(e=>e.item===item);expect(entries.length).toBeGreaterThan(0);for(const e of entries)expect(e).toMatchObject({target:1,dailyProduction:0,dailyConsumption:0})
 }
})
it('each replacement can actually be learned, started, restored mid-job and completed from original finite inputs',()=>{
 for(const id of['Recipe.LightCrossbow','Recipe.BoatmanPole','Recipe.LeatherApron','Recipe.OiledRaincoat']){
  const {w,s,p}=prisonerFixture(),r=db.get<RecipeDef>(id);s.creatures=[p];p.bag=[];p.equip={};p.background=undefined;p.traits=[];p.recipes=[];s.map.tiles[(p.pos.y-1)*s.map.w+p.pos.x].t='Terrain.Workbench'
  expect(startCraft(w,p,id,1)).toContain('모르는');studyBook(w,p,'Item.CraftManual')
  const sources=r.inputs.map(input=>makeItem(w,input.item,input.count));for(const item of[...sources,makeItem(w,'Item.RustyKnife'),makeItem(w,'Item.IronHammer'),makeItem(w,'Item.Needle')])expect(addToBag(w,p,item)).toBe(0)
  expect(startCraft(w,p,id,1)).toBeNull();const bound=structuredClone(p.workJob!.inputs);for(let i=0;i<17;i++)activityStep(w,p)
  for(const source of bound)expect(allItems(p).some(i=>i.uid===source.uid&&i.count===source.count)).toBe(true)
  const restored={db,s:deserialize(serialize(s))}
  for(const run of[w,restored]){const actor=run.s.creatures.find(c=>c.id===p.id)!;for(let i=0;actor.activity&&i<2000;i++)activityStep(run,actor);expect(actor.activity).toBeUndefined();expect(actor.workJob).toBeUndefined();expect([...allItems(actor),...run.s.map.tiles[actor.pos.y*run.s.map.w+actor.pos.x].items].filter(i=>i.def===r.output.item)).toHaveLength(1);for(const source of bound)expect(allItems(actor).some(i=>i.uid===source.uid)).toBe(false)}
  expect(stateHash(restored.s)).toBe(stateHash(s))
 }
})
it('selling out initial replacements does not mint another batch during100days or reopening a market',()=>{
 const {w}=prisonerFixture(),world=w.s.overworld!,site=world.sites[0];world.markets={}
 const limited=new Set(['Item.LightCrossbow','Item.Pole','Item.LeatherApron','Item.OiledRaincoat','Item.CraftManual'])
 for(const stock of['Stock.guard','Stock.guild','Stock.lantern']){const location={...site,id:'finite-'+stock},market=createMarket(w,location,stock),selected=market.items.filter(i=>limited.has(i.def));expect(selected.length).toBeGreaterThan(0);market.items=market.items.filter(i=>!limited.has(i.def));expect(createMarket(w,location,stock)).toBe(market)}
 economyTick(w,100)
 for(const market of Object.values(world.markets))expect(market.items.some(i=>limited.has(i.def))).toBe(false)
})
it('invalid source grips, axes and lengths are loader errors instead of NaN or inverted phantom geometry',()=>{
 for(const value of[{},[],{grip:[-.1,0],axisDegrees:90,length:28},{grip:[.5,.1],axisDegrees:Infinity,length:28},{grip:[.5,.1],axisDegrees:90,length:0},{grip:[.5,.1],axisDegrees:90,length:28,tipFraction:3}]){
  const mod:ModPackage={manifest:{id:'bad.held',name:'bad',version:'1'},defs:[],patches:[{op:'add',target:'Item.RustyKnife',path:'/heldSprite',value}]};const {report}=loadMods([...readPackages(),mod]);expect(report.errors.some(e=>e.includes('heldSprite')),JSON.stringify(value)).toBe(true)
 }
})
