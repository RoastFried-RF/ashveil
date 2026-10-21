// 개발 하네스용 읽기 전용 화면 요약. 숨은 지형·생물·닫힌 상자 내용물은 읽지 않는다.
import {crouched,knownCreatureName,energyMax,hpMax,player,quickCount,type ItemDef,type World} from '../core'
import {mapAppearance} from './map-memory'

export function gameObservation(w:World|null,screen:'title'|'game'){
 if(screen==='title'||!w)return{mode:'title',coordinates:'타일 좌표: 왼쪽 위(0,0), x는 오른쪽, y는 아래쪽',worldLoaded:!!w}
 const p=player(w),appearance=mapAppearance(w),map=w.s.map
 const tiles=[...appearance.visible].sort((a,b)=>a-b).map(index=>{
  const tile=map.tiles[index],id=appearance.terrain[index]!,terrain=w.db.terrain(id)
  return{x:index%map.w,y:Math.floor(index/map.w),terrain:terrain.label,passable:terrain.passable,...(terrain.door?{door:terrain.door,...(tile.locked!==undefined?{locked:tile.locked}:{})}:{}),...(tile.cont?{container:{opened:tile.cont.opened}}:{}),...(tile.items.length?{items:tile.items.map(i=>({label:w.db.item(i.def).label,count:i.count}))}:{})}
 })
 return{
  mode:w.s.over?'report':'game',coordinates:'타일 좌표: 왼쪽 위(0,0), x는 오른쪽, y는 아래쪽; facing은 북쪽0부터 시계방향8방위',
  contentHash:w.s.loadHash,timeTU:w.s.time,simulationPending:!!w.s.simulationPending,loot:w.s.loot?structuredClone(w.s.loot):null,
  map:{id:map.id,label:map.name,width:map.w,height:map.h,visibleTiles:tiles},
  player:{posture:crouched(w,p)?'crouched':'standing',id:p.id,name:p.name,pos:{...p.pos},facing:p.facing,alive:p.alive,hp:p.hp,hpMax:hpMax(w,p),energy:p.needs.energy,energyMax:energyMax(w,p),temperature:p.needs.bodyTemp,blood:p.body.blood,bloodMax:p.body.bloodMax,activity:p.activity?{label:p.activity.label,remaining:p.activity.remaining,total:p.activity.total}:null,ammoPreference:p.ammoPreference?{...p.ammoPreference}:null,hotbar:p.hotbar.map(ref=>ref?.kind==='item'?{...ref,count:quickCount(p,ref.def,ref.fletchingDamaged,!!w.db.tryGet<ItemDef>(ref.def)?.throwable)}:ref?{...ref}:null)},
  visibleCreatures:w.s.creatures.filter(c=>c.id!==p.id&&appearance.visible.has(c.pos.y*map.w+c.pos.x)&&c.deathCause!=='escaped').map(c=>({id:c.id,posture:crouched(w,c)?'crouched':'standing',label:knownCreatureName(w,c),pos:{...c.pos},alive:c.alive,hpPercent:Math.max(0,Math.min(100,Math.round(c.hp/hpMax(w,c)*100)))})),
 }
}
