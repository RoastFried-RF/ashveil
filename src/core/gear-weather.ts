import {ageFirearmPowder} from './firearms'
import {exposeFletching} from './fletching-state'
// 바닥의 실물·멈춘 지역의 장비만 환경을 정산한다. 생명 활동·AI 시각은 진행시키지 않는다.
import { rainAcidity, weatherDef, weatherWetPerTurn } from './climate-state'
import { clamp, turnOf, type World } from './ctx'
import { isRaining } from './environment'
import { hasLos } from './fov'
import { ageBowWeather, corrodeGear, gearTick } from './gear-care'
import { cheb, type Pos } from './geom'
import { allItems, itemDef, storedItems } from './items'
import { mapWorlds } from './journey'
import { primaryMaterial } from './materials'
import { THERMAL_REGIONS, THERMAL_TURNS, wetnessTick } from './thermal'
import type { GearWeatherDef, ItemInst } from './types'
export const gearWeatherDef=(w:World)=>w.db.get<GearWeatherDef>('GearWeather.Hearth')
/** 공간 검사 실패는 원본을 바꾸지 않고, 성공 때 정산한 실제 상태를 옮긴다. */
export function gearForPickup(w:World,it:ItemInst,pos:Pos,sealed=false){const copy=structuredClone(it);for(const item of storedItems([copy]))ageLooseGear(w,item,pos,sealed,item!==copy);return copy}
function warmth(w:World,pos:Pos){const d=gearWeatherDef(w);return w.s.map.lights.some((l)=>!l.off&&l.kind!=='torch'&&cheb(pos,l.pos)<=d.fireRadius&&hasLos(w,pos,l.pos))?15:0}
/** 같은 UID의 마지막 실제 정산 이후만 처리해 집기·내려놓기 경계를 중복 계산하지 않는다. */
export function ageLooseGear(w:World,it:ItemInst,pos:Pos,sealed=false,fletchingProtected=false){
 if(it.missingItem)return
 const d=itemDef(w,it),cfg=gearWeatherDef(w),now=turnOf(w),elapsed=clamp(now-(it.gearAgedAt??now-cfg.intervalTurns),0,cfg.intervalTurns)
 if(d.fletching){const exposed=w.s.map.kind==='surface'&&!w.s.map.tiles[pos.y*w.s.map.w+pos.x].roof;exposeFletching(w,it,!sealed&&!fletchingProtected&&exposed,it.gearAgedAt===undefined?0:elapsed);it.gearAgedAt=now}
 if(d.powder||d.ranged?.firearm){const t=w.s.map.tiles[pos.y*w.s.map.w+pos.x],terr=w.db.terrain(t.t);ageFirearmPowder(w,it,w.s.map.kind==='surface'&&!t.roof,!!terr.water&&(!t.icy||(t.iceHoleUntil??0)>now),warmth(w,pos),it.gearAgedAt===undefined?0:elapsed,sealed||fletchingProtected);if(d.powder)return}
 if(it.durability===undefined&&!d.apparel&&!d.ranged&&!d.book)return
 if(!elapsed)return
 it.gearAgedAt=now
 if(sealed)return
 const tile=w.s.map.tiles[pos.y*w.s.map.w+pos.x],terrain=w.db.terrain(tile.t),exposed=w.s.map.kind==='surface'&&!tile.roof
 const water=terrain.water&&(!tile.icy||(tile.iceHoleUntil??0)>now),heat=warmth(w,pos)
 const wetting=exposed?weatherWetPerTurn(w)*elapsed:0,drying=(heat>=15?cfg.fireDryPerTen:cfg.dryPerTen)*elapsed/THERMAL_TURNS
 if(d.apparel||d.book){
  it.wetness??={}
  const regions=d.book?[{id:'torso' as const,group:''}]:THERMAL_REGIONS.filter((r)=>d.apparel!.groups.includes(r.group))
  for(const r of regions)it.wetness[r.id]=water?100:clamp((it.wetness[r.id]??0)+(wetting>0?wetting:-drying),0,100)
 }
 if(d.ranged&&!d.ranged.firearm)ageBowWeather(w,it,exposed,heat,elapsed)
 const material=primaryMaterial(w,it),exposure=Math.max(0,Math.min(elapsed,now-(it.oiledUntil??-Infinity)+1))
 if(exposed&&isRaining(w)&&material?.category==='Metal'&&it.durability!==undefined)corrodeGear(w,it,exposure*(100-material.corrosionResist)/100*(w.s.overworld?weatherDef(w).corrosionMult*(1+rainAcidity(w)/5):1),cfg.looseBody)
}
export function gearWeatherTick(w:World){
 const cfg=gearWeatherDef(w),now=turnOf(w)
 if(now%cfg.intervalTurns)return
 for(const local of mapWorlds(w)){
  for(let i=0;i<local.s.map.tiles.length;i++){
   const tile=local.s.map.tiles[i],pos={x:i%local.s.map.w,y:Math.floor(i/local.s.map.w)}
   for(const it of storedItems(tile.items))ageLooseGear(local,it,pos,false,!tile.items.includes(it))
   for(const it of storedItems(tile.cont?.items??[]))ageLooseGear(local,it,pos,!tile.cont!.opened,!tile.cont!.items.includes(it))
  }
  if(local.s.map===w.s.map)continue
  for(const c of local.s.creatures){
   // 마지막 실제 활성 턴 이후만. 같은 각인으로 재진입해도 다시 정산하지 않는다.
   const latest=Math.max(now-cfg.intervalTurns,...allItems(c).map((i)=>i.gearAgedAt??now-cfg.intervalTurns)),elapsed=clamp(now-latest,0,cfg.intervalTurns)
   if(!elapsed)continue
   wetnessTick(local,c,undefined,elapsed,true);gearTick(local,c,elapsed)
  }
 }
}
