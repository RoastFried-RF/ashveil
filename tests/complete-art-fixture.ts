import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {player,tileAt,type World} from '../src/core/ctx'
import {createCreature} from '../src/core/creatures'
import {canSee,invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize} from '../src/core/save'
import {creatureSprite} from '../src/client/render/creature-sprite'
import {initializeFieldDevices} from '../src/core/field-devices'

export const artSceneNames=['domestic','stations','devices','crops','ground','dungeon','props','creatures','inventory'] as const
export type ArtScene=typeof artSceneNames[number]
// Finite initial visual studies, not normal acquisition, growth, discovery or combat claims.
export function completeArtFixture(scene:ArtScene){
 const d=clinicalDiseaseFixture('complete-original-art-302-'+scene,false),{s,p}=d
 p.background=undefined;p.skills={};s.storyteller.budget=-1e9;s.map.kind='dungeon';s.map.ambient=1;s.map.name='원화 실사용 검토 · '+scene
 s.map.tiles=s.map.tiles.map(()=>({t:'Terrain.Earth',v:0,roof:true,blood:0,items:[]}));s.map.props=[];s.map.exits=[];s.map.lights=[]
 const targets:{id:string;x:number;y:number}[]=[],people:unknown[]=[]
 const positions=[{x:15,y:17},{x:18,y:17},{x:22,y:17},{x:25,y:17},{x:15,y:23},{x:18,y:23},{x:22,y:23},{x:25,y:23}]
 const terrains=(ids:string[])=>ids.forEach((id,i)=>{const pos=positions[i]!;tileAt(d.w,pos).t=id;targets.push({id,...pos})})
 if(scene==='domestic')terrains(['Terrain.FieldMat','Terrain.Bedroll','Terrain.StrawBed','Terrain.Bed','Terrain.GoodBed','Terrain.SettlementWell','Terrain.ResidentDepot','Terrain.Altar'])
 if(scene==='stations')terrains(['Terrain.Forge','Terrain.Workbench','Terrain.Loom','Terrain.TanningVat','Terrain.Artisan','Terrain.SaltPan','Terrain.Campfire','Terrain.CoastalBeacon'])
 if(scene==='devices')terrains(['Terrain.TowerSensor','Terrain.ReceiverConduit','Terrain.SpireConsole','Terrain.ZeroVaultSeal','Terrain.LeakingConduit','Terrain.Barricade','Terrain.ConduitCrack','Terrain.ClosedConduitCrack'])
 if(scene==='crops')terrains(['Terrain.ShadePlot','Terrain.CabbagePlot','Terrain.PotatoPlot','Terrain.TurnipPlot','Terrain.WhitecapPlot','Terrain.OatPlot','Terrain.AshBerryBush','Terrain.Fungus'])
 if(scene==='ground'){
  s.map.kind='surface'
  const ids=['Terrain.Path','Terrain.BoatFrame','Terrain.Mud','Terrain.CoastalMud','Terrain.BoatDeck','Terrain.ShallowWater','Terrain.SeaDeep','Terrain.Rock']
  terrains(ids)
  targets.forEach(t=>{if(t.id==='Terrain.BoatFrame')return;for(let y=t.y-1;y<=t.y+1;y++)for(let x=t.x-1;x<=t.x+1;x++)tileAt(d.w,{x,y}).t=t.id})
 }
 if(scene==='dungeon'){
  for(const t of s.map.tiles)t.t='Terrain.KtFloor'
  terrains(['Terrain.KtWall','Terrain.Shelf','Terrain.RustedDoorClosed','Terrain.StairsUp','Terrain.SpireLadderDown','Terrain.Rubble','Terrain.Pot','Terrain.StairsDown'])
 }
 if(scene==='props'){
  for(const t of s.map.tiles)t.t='Terrain.CdFloor'
  terrains(['Terrain.Column','Terrain.Brazier'])
  s.map.props=[{kind:'statue',x:22,y:15,w:2,h:2},{kind:'sarcophagus',x:24,y:22,w:2,h:2},{kind:'chain0',x:14,y:21,w:1,h:3},{kind:'cd_veina1',anim:'cd_veina1',x:17,y:23,w:2,h:2},{kind:'cd_littleeyes',anim:'cd_littleeyes',x:21,y:24,w:2,h:1}]
  s.map.props.forEach(t=>targets.push({id:t.kind,x:t.x,y:t.y}))
 }
 if(scene==='creatures'){
  const ids=['Creature.AshHound','Creature.AshHoundAlpha','Creature.BurrowRat','Creature.MurkLeech','Creature.ReaverChief','Creature.ReaverArcher']
  ids.forEach((id,i)=>{const c=createCreature(d.w,id,positions[i]!);c.met=true;c.nextAct=1e12;c.home=undefined;c.facing=i%2?2:4;s.creatures.push(c);people.push({id:c.id,def:id,storedSprite:c.sprite,display:creatureSprite(d.w,c),priorContactDeclared:true,schedulerPausedUntil:c.nextAct});targets.push({id,...c.pos})})
 }
 if(scene==='inventory')for(const id of ['Item.RagShirt','Item.ScrapHelmet','Item.Painkiller','Item.Tourniquet','Item.AlphabetPrimer','Item.BoneKnife'])d.add(id)
 initializeFieldDevices(d.w)
 s.fx=[];invalidateLights(d.w);updatePlayerVision(d.w,p)
 for(const t of targets)if(!canSee(d.w,p,t))throw Error('Art target initially invisible: '+JSON.stringify(t))
 const w:World={db:d.w.db,s:deserialize(serialize(s))};invalidateLights(w);updatePlayerVision(w,player(w))
 return{w,proof:{scene,targets,people,declaredItems:p.bag.map(i=>({uid:i.uid,def:i.def,count:i.count})),source:'Finite healthy/noon/paused-story initial art study, empty earth or declared floor; ambient1; crops declared initial mature appearance, NPCs declared previously met and paused until1e12. No normal acquisition/growth/discovery/combat claim. Real Title Continue, real face keys, independent Node whole comparisons and actual save restore. No postload state injection.'}}
}
