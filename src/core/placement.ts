/** Shared read-only quote used by real placement and machine planning. */
import {capacity} from './body'
import {cropPlantingError} from './cultivation'
import {creatureAt,inBounds,terrainAt,tileAt,type World} from './ctx'
import {hasLos} from './fov'
import {DIRS} from './geom'
import {findItem,itemDef} from './items'
import {diagonalBlocked} from './path'
import {towerSoilFertility} from './tower-consequences'
import type {Creature} from './types'
export function placementQuote(w:World,c:Creature,uid:number,direction:number){
 const it=findItem(c,uid),def=it&&itemDef(w,it),dir=DIRS[direction]
 const p=dir?{x:c.pos.x+dir.x,y:c.pos.y+dir.y}:undefined,destination=def?.place?w.db.terrain(def.place):undefined,planted=destination?.gather
 let error:string|null=null
 if(capacity(w,c,'manipulation')<.2)error='설치할 손을 쓸 수 없다'
 else if(!it||!def?.place||!dir)error='설치할 물건이 없다'
 else if(!p||!inBounds(w,p)||!hasLos(w,c.pos,p)||diagonalBlocked(w,c.pos,dir.x,dir.y)||!terrainAt(w,p).passable||terrainAt(w,p).water||terrainAt(w,p).stairs||terrainAt(w,p).container||terrainAt(w,p).station||terrainAt(w,p).bedding||terrainAt(w,p).residentDepot||terrainAt(w,p).residentWell||tileAt(w,p).placed||creatureAt(w,p)||tileAt(w,p).items.length)error='비어 있는 땅에 설치해야 한다'
 else if(planted&&(destination!.cultivation?.needsSoil!==false&&!terrainAt(w,p).soil||terrainAt(w,p).gather))error='비어 있는 흙에 심어야 한다'
 else if(destination?.cultivation)error=cropPlantingError(w,p,it)
 const fertility=planted?.soilDependent?towerSoilFertility(w):1
 if(!error&&fertility<=0)error='탑의 살포가 멈춘 뒤 토양이 고갈되어 종자가 자랄 수 없다'
 return{error,it,def,p,destination,planted,fertility}
}
