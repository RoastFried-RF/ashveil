/** Partial consumption of the same original plant; observation never allocates stock. */
import {calendar} from './climate-state'
import {resetCultivation} from './cultivation'
import {terrainAt,tileAt,turnOf,type World} from './ctx'
import {gatherSignature} from './gather-state'
import type {Pos} from './geom'

function seasonWindow(w:World,p:Pos){const def=terrainAt(w,p);if(!def.gather?.seasons?.length)return;const c=calendar(w);return c.year+':'+c.season.id}
function matchingStock(w:World,p:Pos){
 const tile=tileAt(w,p),stock=tile.gatherStock,g=terrainAt(w,p).gather
 if(!stock||!g||stock.signature!==gatherSignature(w,p)||stock.seedUid!==tile.cultivation?.seedUid||stock.season!==seasonWindow(w,p)||!Number.isSafeInteger(stock.remaining)||stock.remaining<0||stock.remaining>g.count)return
 if(stock.regrowAt!==undefined&&stock.regrowAt<=turnOf(w))return
 return stock
}
export function gatherStockCount(w:World,p:Pos){return matchingStock(w,p)?.remaining??terrainAt(w,p).gather?.count??0}
/** Caller has completed the real gather work and validated season/fire/growth. */
export function takeGatherStock(w:World,p:Pos,count:number,regrowTurns:number){
 const tile=tileAt(w,p),available=gatherStockCount(w,p),taken=Math.max(0,Math.min(available,Math.floor(count))),left=available-taken
 if(!taken)return 0
 if(tile.cultivation){
  if(!left){resetCultivation(w,p);delete tile.gatherStock}
  else tile.gatherStock={signature:gatherSignature(w,p),remaining:left,seedUid:tile.cultivation.seedUid,season:seasonWindow(w,p)}
 }else{
  const regrowAt=matchingStock(w,p)?.regrowAt??turnOf(w)+regrowTurns
  if(!left){tile.gatherAt=regrowAt;delete tile.gatherStock}
  else{tile.gatherStock={signature:gatherSignature(w,p),remaining:left,regrowAt,season:seasonWindow(w,p)};delete tile.gatherAt}
 }
 return taken
}
