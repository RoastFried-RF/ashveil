// 실제 선체가 망가지면 같은 지도/몸/화물을 남긴 채 갑판이 잠긴다.
import {capacity} from './body'
import {stopActivity} from './game'
import {deepWaterAt,inDeepWater} from './aquatic-state'
import {creatureAt,inBounds,log,player,terrainAt,turnOf,TURNS_PER_HOUR,type World} from './ctx'
import {invalidateLights,hasLos} from './fov'
import {type Pos} from './geom'
import {watercraft} from './marine-state'
import {findPath} from './path'
import type {Creature} from './types'
function deckCells(w:World){const d=watercraft(w);if(!d)return[];const [x,y,width,height]=d.deck,out:Pos[]=[];for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+width;xx++)out.push({x:xx,y:yy});return out}
export function floodBoat(w:World):boolean{
 const map=w.s.map,v=map.vessel,d=watercraft(w),rule=d?.sinking;if(!v||!d||!rule||v.hull.count!==1||v.floodedAt!==undefined||!Number.isFinite(v.hull.durability??100)||!Number.isFinite(v.hull.maxDurability??100)||(v.hull.maxDurability??100)<=0||(v.hull.durability??100)!==0)return false
 const cells=deckCells(w),keys=new Set(cells.map(p=>p.y*map.w+p.x))
 for(const p of cells){const tile=map.tiles[p.y*map.w+p.x];if(tile.placed){const it=tile.placed.item;delete it.gx;delete it.gy;delete it.rot;tile.items.push(it);delete tile.placed}if(tile.cont){for(const it of tile.cont.items){delete it.gx;delete it.gy;delete it.rot;tile.items.push(it)}tile.cont.items=[]}tile.t=d.waterTerrain}
 for(const light of map.lights)if(keys.has(light.pos.y*map.w+light.pos.x))light.off=true
 for(const [dx,dy] of rule.frames)map.tiles[(d.anchor[1]+dy)*map.w+d.anchor[0]+dx].t=rule.frameTerrain
 v.floodedAt=turnOf(w);map.name='침수된 작은 배';const travel=w.s.overworld?.travel
 if(travel?.mode==='boat'&&travel.vesselUid===v.hull.uid){delete w.s.overworld!.travel;}
 if(player(w).activity)stopActivity(w,player(w))
 invalidateLights(w);log(w,'danger','같은 선체가 무너져 갑판이 잠겼다. 원래 몸과 화물이 물에 남았다. 남은 뼈대에서 구조하거나 실제 재료로 기워야 한다.');return true
}
export function refloatBoat(w:World):boolean{
 const map=w.s.map,v=map.vessel,d=watercraft(w);if(!v||!d||v.hull.count!==1||v.floodedAt===undefined||!Number.isFinite(v.hull.durability??0)||!Number.isFinite(v.hull.maxDurability??100)||(v.hull.maxDurability??100)<=0||(v.hull.durability??0)>(v.hull.maxDurability??100)||(v.hull.durability??0)<d.minDurability)return false
 for(const p of deckCells(w)){const tile=map.tiles[p.y*map.w+p.x];if(tile.t===d.waterTerrain||tile.t===d.sinking?.frameTerrain)tile.t=d.deckTerrain}
 const tile=map.tiles[d.cargoPos[1]*map.w+d.cargoPos[0]];tile.t=d.cargoTerrain;tile.cont??={items:[],opened:true,kind:d.cargoTerrain};delete v.floodedAt;v.refloatedAt=turnOf(w);map.name='작은 배의 갑판';invalidateLights(w);log(w,'good','원래 선체가 다시 떠올랐다. 물에 빠진 몸의 부상과 호흡은 따로 회복해야 한다.');return true
}
export function boatFloodTick(w:World){
 const v=w.s.map.vessel,d=watercraft(w),rule=d?.sinking,m=w.s.overworld;if(!v||!d||!rule||!m||v.hull.count!==1||!Number.isFinite(v.hull.durability??100)||!Number.isFinite(v.hull.maxDurability??100)||(v.hull.maxDurability??100)<=0||(v.hull.durability??100)<0||(v.hull.durability??100)>(v.hull.maxDurability??100))return
 if(v.floodedAt!==undefined){refloatBoat(w);return}
 if(turnOf(w)%TURNS_PER_HOUR===0&&m.cells[m.position.y*m.w+m.position.x].sea){const wear=(rule.stormWear[w.s.weather]??0)+((v.hull.durability??100)<d.minDurability?rule.leakWear:0);if(wear)v.hull.durability=Math.max(0,(v.hull.durability??100)-wear)}
 floodBoat(w)
}
/** 잠긴 실제 주민은 보이는 빈 뼈대까지 실제 경로를 걷는다. 포박/의식 상실은 그대로 적용한다. */
export function urgentWaterLanding(w:World,c:Creature):Pos|undefined{
 if(w.s.map.vessel?.floodedAt===undefined||c.id===w.s.playerId||!c.alive||c.asleep||c.unconscious||c.captivity&&!c.captivity.anklesFree||capacity(w,c,'moving')<.3||capacity(w,c,'consciousness')<.3||!inDeepWater(w,c)||!c.aquatic?.submerged&&c.needs.energy>=25)return
 const d=watercraft(w);if(!d?.sinking)return
 const candidates=d.sinking.frames.map(([dx,dy])=>({x:d.anchor[0]+dx,y:d.anchor[1]+dy})).filter(p=>inBounds(w,p)&&terrainAt(w,p).passable&&!deepWaterAt(w,p)&&!creatureAt(w,p)&&hasLos(w,c.pos,p))
 return candidates.map(p=>({p,path:findPath(w,c.pos,p,{avoidCreatures:true,selfId:c.id,maxNodes:200})})).filter(e=>e.path?.length&&!creatureAt(w,e.path[0])).sort((a,b)=>a.path!.length-b.path!.length)[0]?.p
}
