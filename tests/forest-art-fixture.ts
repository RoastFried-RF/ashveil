import { visionFixture } from './vision-fixture'
import { deserialize, invalidateLights, player, serialize, tileAt, updatePlayerVision, type World } from '../src/core'
import { createCreature } from '../src/core/creatures'
import { makeItem } from '../src/core/items'

export function forestArtFixture(dark=false){
 const d=visionFixture(dark?'dark':'day'),{w}=d,p=player(w)
 w.s.map.name='수목 원화 검토 · '+(dark?'어둠':'낮');w.s.map.lights=[]
 w.s.map.tiles=w.s.map.tiles.map(()=>({t:'Terrain.Earth',v:0,roof:true,blood:0,items:[]}))
 const positions=[{x:14,y:18},{x:17,y:18},{x:21,y:18},{x:24,y:18},{x:26,y:18}]
 for(const pos of positions)tileAt(w,pos).t='Terrain.Tree'
 invalidateLights(w);updatePlayerVision(w,p);w.s.fx=[]
 const result:World={db:w.db,s:deserialize(serialize(w.s))}
 return{w:result,torch:d.torch,proof:{dark,positions,ambient:w.s.map.ambient,torch:d.torch,limits:'Declared finite flat-ground/day or dark initial save, five actual Tree tiles and initially equipped unlit torch. Actual Title Continue and real input; no postload state injection. Not natural forestry/acquisition evidence. Renderer coordinates select four new dead-tree silhouettes on the current all-dead default Tree definition; living species are separate definitions; terrain rules are unchanged.'}}
}

export function forestPrivacyFixture(blind=false){
 const d=forestArtFixture(),{w}=d,p=player(w),hiddenPos={x:26,y:17},cratePos={x:14,y:16}
 const enemy=createCreature(w,'Creature.Reaver',hiddenPos);enemy.nextAct=1e12;w.s.creatures.push(enemy)
 const crate=tileAt(w,cratePos);crate.t='Terrain.Crate';crate.items=[makeItem(w,'Item.Stone')]
 const livingSpecies=[{t:'Terrain.PineTree',pos:{x:19,y:17}},{t:'Terrain.BlackwoodTree',pos:{x:23,y:17}}]
 for(const row of livingSpecies)tileAt(w,row.pos).t=row.t
 if(blind){p.body.missing=['LeftEye','RightEye'];for(const tile of w.s.map.tiles){delete tile.seen;delete tile.observed}}
 invalidateLights(w);updatePlayerVision(w,p);w.s.fx=[]
 return{w:{db:w.db,s:deserialize(serialize(w.s))},proof:{...d.proof,blind,livingSpecies,hiddenEnemy:{id:enemy.id,pos:hiddenPos,nextAct:enemy.nextAct},hiddenCrate:{pos:cratePos,itemUid:crate.items[0].uid},limits:d.proof.limits+' Additional finite initial living Pine/Blackwood species, hidden crate/item and scheduled-inactive enemy; blind scene starts without either eye or terrain memory. No natural encounter/injury claim.'}}
}
