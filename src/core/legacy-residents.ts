// 같은 시드의 은퇴 기록은 정보만 남긴다. 몸/물품/능력치/돈을 이전하지 않는다.
import {capacity} from './body'
import {exposeDisease} from './conditions'
import {initializeAge} from './growth'
import {worldSimulationDef} from './world-simulation'
import {createCreature} from './creatures'
import {creatureAt,inBounds,log,rng,terrainAt,turnOf,type World} from './ctx'
import {hasLos} from './fov'
import {cheb} from './geom'
import {retirementDef} from './retirement'
import {initializeResidentRest} from './resident-rest'
import type {Creature,LegacyResident,WorldSite} from './types'
export function installLegacyResidents(w:World,records:readonly LegacyResident[]|undefined){
 if(!w.s.overworld||!records?.length)return
 const rule=retirementDef(w),seen=new Set<string>(),valid:LegacyResident[]=[]
 for(const source of records){
  if(!source||source.seed!==w.s.seed||typeof source.key!=='string'||!source.key||seen.has(source.key)||typeof source.name!=='string'||!source.name.trim()||!Number.isSafeInteger(source.age)||source.age<10||source.age>120||!Array.isArray(source.tales))continue
  const key=source.key.slice(0,160);if(seen.has(key))continue
  const site=w.s.overworld.sites.find(site=>site.id===source.site);if(site?.kind!=='settlement'||!site.faction)continue
  const tales=source.tales.filter((text):text is string=>typeof text==='string'&&!!text.trim()).slice(0,6).map(text=>text.slice(0,600));if(!tales.length)continue
  seen.add(key);valid.push({key,seed:w.s.seed,site:site.id,name:source.name.trim().slice(0,80),age:source.age,tales});if(valid.length>=rule.maxLegacy)break
 }
 if(valid.length)w.s.overworld.legacyResidents=valid
}
export function initializeLegacyResidents(w:World,site:WorldSite){
 const m=w.s.overworld,rows=m?.legacyResidents?.filter(row=>row.site===site.id&&row.id===undefined)
 if(!m||!rows?.length)return
 const population=m.simulation?.settlements[site.id]?.population;if(!population||!site.faction)return
 const residents=new Set([...w.s.creatures,...Object.values(w.s.offCreatures).flat(),...(m.caravans??[]).flatMap(c=>c.actors??[])].filter(c=>c.alive&&c.residentSite===site.id).map(c=>c.id))
 for(const row of rows){
  if(residents.size>=population.S+population.I+population.R)break
  const center=w.s.creatures.find(c=>c.traderSite===site.id)?.home??{x:32,y:18}
  let pos:Creature['pos']|undefined
  for(let radius=1;radius<=6&&!pos;radius++)for(let y=center.y-radius;y<=center.y+radius&&!pos;y++)for(let x=center.x-radius;x<=center.x+radius&&!pos;x++){
   const candidate={x,y};if(cheb(center,candidate)!==radius||!inBounds(w,candidate)||creatureAt(w,candidate))continue
   const tile=terrainAt(w,candidate);if(tile.passable&&!tile.water&&!tile.stairs&&!tile.bedding&&!tile.container&&!tile.station)pos=candidate
  }
  if(!pos)continue
  const c=createCreature(w,retirementDef(w).resident,pos,row.name)
  c.faction=site.faction;c.mapId=w.s.map.id;c.home={...pos};c.residentSite=site.id;c.money=0;initializeAge(w,c,row.age);c.nextAct=w.s.time
  if(population.I&&rng(w,`world.resident-health.${site.id}`).chance(population.I/population.total))exposeDisease(w,c,worldSimulationDef(w).disease.def,1)
  w.s.creatures.push(c);row.id=c.id;residents.add(c.id)
  // 새 시민의 침대 한 칸만 추가한다. 이미 배정한 주민의 침대는 helper가 그대로 둔다.
  w.s.map.residentRestInitialized=false;initializeResidentRest(w,site)
 }
}
export function hearLegacyResident(w:World,speaker:Creature,listener:Creature){
 const record=w.s.overworld?.legacyResidents?.find(row=>row.id===speaker.id)
 if(!record||record.heard||listener.id!==w.s.playerId||!speaker.alive||!listener.alive||speaker.asleep||listener.asleep||speaker.unconscious||listener.unconscious||capacity(w,speaker,'consciousness')<.5||capacity(w,listener,'consciousness')<.5||capacity(w,listener,'hearing')<=0||cheb(speaker.pos,listener.pos)>1||!hasLos(w,speaker.pos,listener.pos))return false
 const now=turnOf(w),id=`retired:${record.key}`;record.heard=true
 const rumors=w.s.knowledge.rumors??=[]
 if(!rumors.some(rumor=>rumor.id===id))rumors.push({id,kind:'supply',regionId:record.site,text:record.tales.join(' '),source:`정착한 ${speaker.name}의 이야기`,hop:0,writtenAt:now,foundAt:now})
 log(w,'good',`${speaker.name}: ${record.tales.join(' ')}`)
 return true
}
