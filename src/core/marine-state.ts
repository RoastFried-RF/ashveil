import { channelTurns } from './action-time'
// The boat hull lives once on its actual deck map. Routes never cross intermediate land.
import { capacity } from './body'
import { player, terrainAt, type World } from './ctx'
import { cheb, type Pos } from './geom'
import { itemDef } from './items'
import { worldIndex } from './overworld'
import {RouteHeap} from './route-heap'
import type { ItemInst, MapState, RegionLayoutDef, RegionSiteDef, WatercraftConfig } from './types'
export const boatSceneKey=(p:Pos)=>`@boat.${p.x},${p.y}`
export function portDock(w:World,pos=w.s.overworld?.position){
 const m=w.s.overworld,site=m&&pos&&m.sites.find(s=>s.cell.x===pos.x&&s.cell.y===pos.y),layout=site&&w.db.tryGet<RegionSiteDef>(site.id)?.layout
 return layout?w.db.get<RegionLayoutDef>(layout).dock:undefined
}
export function watercraft(w:World,hull=w.s.map.vessel?.hull):WatercraftConfig|undefined{return hull?itemDef(w,hull).watercraft:undefined}
export function onBoatFrame(w:World,pos:Pos):boolean{const v=w.s.map.vessel,d=watercraft(w),f=d?.sinking;return !!(v&&v.floodedAt!==undefined&&d&&f&&terrainAt(w,pos).id===f.frameTerrain&&f.frames.some(([dx,dy])=>pos.x===d.anchor[0]+dx&&pos.y===d.anchor[1]+dy))}
export function boatDeckError(w:World):string|null{const v=w.s.map.vessel,d=watercraft(w);return v&&d&&v.crew.some(id=>{const member=w.s.creatures.find(a=>a.id===id);return !member||member.alive&&terrainAt(w,member.pos).id!==d.deckTerrain&&!(member.pos.x===d.cargoPos[0]&&member.pos.y===d.cargoPos[1]&&terrainAt(w,member.pos).id===d.cargoTerrain)&&!onBoatFrame(w,member.pos)})?'승선자 모두 실제 갑판이나 선체 뼈대 위로 돌아와야 한다':null}
export function sailingError(w:World):string|null{
 const c=player(w),v=w.s.map.vessel,d=watercraft(w)
 if(!v||!d||v.owner!==c.id||v.hull.count!==1)return '실제 소유한 배에 타고 있어야 한다'
 if(v.floodedAt!==undefined)return '갑판이 잠겼다. 원래 선체를 기워 다시 띄워야 한다'
 const deckError=boatDeckError(w);if(deckError)return deckError
 if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)return '깨어서 노를 다룰 수 있어야 한다'
 const condition=v.hull.durability??100,max=v.hull.maxDurability??100
 if(!Number.isFinite(condition)||!Number.isFinite(max)||condition<0||max<=0||condition>max)return '선체 상태 기록이 올바르지 않다'
 if(condition<d.minDurability)return '선체를 먼저 수리해야 한다'
 if((d.weather[w.s.weather]??1)<=0)return '지금 날씨에는 작은 배를 저을 수 없다'
 return null
}
export function seaRoute(w:World,from:Pos,to:Pos):{cells:Pos[];hours:number}|null{
 const m=w.s.overworld,d=watercraft(w);if(!m||!d||[from,to].some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=m.w||p.y>=m.h))return null
 const start=worldIndex(m,from),goal=worldIndex(m,to);if(start===goal)return{cells:[],hours:0}
 if(!m.cells[start].sea&&!portDock(w,from)||!m.cells[goal].sea&&!portDock(w,to))return null
 const parents=new Int32Array(m.cells.length).fill(-1),costs=new Array<number>(m.cells.length).fill(Infinity),queue=new RouteHeap()
 costs[start]=0;queue.push(start,0)
 while(queue.size){
  const {id:i,cost}=queue.pop();if(cost!==costs[i])continue
  if(i===goal){const cells:Pos[]=[];for(let j=goal;j!==start;j=parents[j])cells.push({x:j%m.w,y:Math.floor(j/m.w)});return{cells:cells.reverse(),hours:cost/1200}}
  const fromCell={x:i%m.w,y:Math.floor(i/m.w)}
  for(const p of [{x:fromCell.x,y:fromCell.y-1},{x:fromCell.x-1,y:fromCell.y},{x:fromCell.x+1,y:fromCell.y},{x:fromCell.x,y:fromCell.y+1}]){
   if(p.x<0||p.y<0||p.x>=m.w||p.y>=m.h)continue;const j=worldIndex(m,p)
   if(!m.cells[j].sea&&j!==goal||!m.cells[i].sea&&!m.cells[j].sea)continue
   const step=seaSegmentTurns(w,fromCell,p),next=cost+step
   if(!Number.isFinite(step)||next>=costs[j])continue
   costs[j]=next;parents[j]=i;queue.push(j,next)
  }
 }
 return null
}
export function seaSegmentTurns(w:World,from:Pos,to:Pos):number{
 const d=watercraft(w);if(!d||Math.abs(from.x-to.x)+Math.abs(from.y-to.y)!==1)return Infinity
 const weather=w.s.overworld?.weatherCells?.[`${from.x},${from.y}`]??{weather:w.s.weather,wind:w.s.wind},mult=d.weather[weather.weather]??1;if(mult<=0)return Infinity
 const against=Math.max(0,-((to.x-from.x)*weather.wind.x+(to.y-from.y)*weather.wind.y))
 return Math.max(1,Math.ceil(d.turnsPerCell*mult*(1+against*.15)))
}
export function makeBoatDeck(w:World,hull:ItemInst,crew:number[]):MapState{
 const d=watercraft(w,hull)!,width=16,height=12,[x,y,bw,bh]=d.deck,[cx,cy]=d.cargoPos
 const map:MapState={id:`boat-${hull.uid}`,name:'작은 배의 갑판',kind:'surface',depth:0,ambient:0,worldCell:{...w.s.overworld!.position},w:width,h:height,tiles:Array.from({length:width*height},()=>({t:d.waterTerrain,v:0,roof:false,blood:0,items:[]})),exits:[],links:[],rooms:[],props:[],lights:[],vessel:{hull,owner:w.s.playerId,crew:[...crew]}}
 for(let yy=y;yy<y+bh;yy++)for(let xx=x;xx<x+bw;xx++)map.tiles[yy*width+xx].t=d.deckTerrain
 Object.assign(map.tiles[cy*width+cx],{t:d.cargoTerrain,cont:{items:[],opened:true,kind:d.cargoTerrain}})
 delete hull.gx;delete hull.gy;delete hull.rot
 return map
}
export function boatRepairQuote(w:World){
 const d=watercraft(w),v=w.s.map.vessel,c=player(w),error=sailingError(w)
 if(!v||!d||v.owner!==c.id)return{error:'원래 소유한 배가 없다',turns:0,need:undefined}
 if(v.floodedAt!==undefined){if(!onBoatFrame(w,c.pos))return{error:'원래 선체의 남은 뼈대 위에서 몸을 지탱해야 한다',turns:0,need:d.repair};if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)return{error:'깨어서 손으로 원래 선체를 기울 수 있어야 한다',turns:0,need:d.repair}}
 else if(error&&error!=='선체를 먼저 수리해야 한다'&&error!=='지금 날씨에는 작은 배를 저을 수 없다')return{error,turns:0,need:undefined}
 if(!Number.isFinite(v.hull.durability??100)||!Number.isFinite(v.hull.maxDurability??100)||(v.hull.durability??100)<0||(v.hull.maxDurability??100)<=0||(v.hull.durability??100)>(v.hull.maxDurability??100))return{error:'선체 상태 기록이 올바르지 않다',turns:0,need:d.repair}
 if((v.hull.durability??100)>=(v.hull.maxDurability??100))return{error:'선체를 더 수리할 필요가 없다',turns:0,need:undefined}
 const available=c.bag.filter(i=>i.def===d.repair.item).reduce((n,i)=>n+i.count,0)
 const turns=channelTurns(w,c,d.repair.turns)
 return{error:turns===null?'몸 상태 때문에 선체를 기울 수 없다':available<d.repair.count?'선체를 기울 재료가 부족하다':null,turns:turns??0,need:d.repair}
}
export function atPortDock(w:World):boolean{const dock=portDock(w);return !!dock&&cheb(player(w).pos,{x:dock[0],y:dock[1]})<=1}
