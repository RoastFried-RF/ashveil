import {initializeNpcIdentity} from './npc-identity'
import {initializeAshDeposits}from'./ash-deposits'
import { initializeResidentPersonality } from './companion-bonds'
import {registerResidentSource} from './population-sources'
import { initializeLegacyResidents } from './legacy-residents'
import { initializeResidentWarmth } from './resident-warmth'
import { initializeTeaching } from './teaching'
import { worldSimulationDef } from './world-simulation'
import { exposeDisease } from './conditions'
import { creatureAt, rng, terrainAt, tileAt } from './ctx'
// 지역에 들어올 때 요약 인구 중 주민을 실체화한다. 재진입·각인 복원 때 중복 생성하지 않는다.
import { ensureSociety, factionDef } from './diplomacy'
import { createMarket, makeMarketItem } from './economy'
import { createCreature } from './creatures'
import { addToBag } from './items'
import type { World } from './ctx'
import type { ClinicDef, RegionLayoutDef, RegionSiteDef, WorldSite } from './types'
import { invalidateLights } from './fov'
import { initializeInn } from './inn'
import { initializeResidentRest } from './resident-rest'
import { initializeResidentProvisions } from './resident-provisions'
import { initializeResidentWater } from './resident-water'
import { initializeResidentPurification } from './resident-purification'
export function initializeSettlement(w: World,freshAsh=false) {
  initializeAshDeposits(w,freshAsh)
  const m = w.s.overworld, site = m?.sites.find((s) => s.id === m.currentRegion)
  if (!site || site.kind !== 'settlement' || !site.faction) return
  const layout=w.db.tryGet<RegionSiteDef>(site.id)?.layout
  const root=layout?w.db.get<RegionLayoutDef>(layout).mapId:'surface'
  if(w.s.map.id!==root)return
  if (w.s.map.settlementInitialized) { initializeClinic(w, site); initializeInn(w); initializeResidentRest(w, site); initializeResidentProvisions(w, site); initializeResidentWater(w, site); initializeResidentPurification(w, site); initializeTeaching(w); initializeResidentWarmth(w,site); initializeLegacyResidents(w,site);return }
  const before=new Set(w.s.creatures.map(c=>c.id))
  const faction = factionDef(w, site.faction)
  if (!faction?.resident || !faction.guard || !faction.trader) return
  ensureSociety(w)
  const market = createMarket(w, site, faction.trader)
  const positions = [{ x: 30, y: 18 }, { x: 35, y: 18 }, { x: 27, y: 20 }, { x: 37, y: 20 }]
  const pop=m!.simulation?.settlements[site.id]?.population,existing=[...w.s.creatures,...(m?.caravans??[]).flatMap(c=>c.actors??[])].filter((c)=>c.id!==w.s.playerId&&c.alive&&c.home&&(c.residentOriginFaction??c.faction)===site.faction&&(!c.residentSite||c.residentSite===site.id)).length
  const available=pop?Math.max(0,pop.S+pop.I+pop.R-existing):positions.length
  for (let i = 0; i < Math.min(positions.length,available); i++) {
    const trader = i === 0, c = createCreature(w, i >= 2 ? faction.guard : trader ? faction.merchant??'Creature.SettlementTrader' : faction.healer??w.db.get<ClinicDef>('Clinic.Hearth').doctor, positions[i], `${site.label} ${trader ? '상인' : i >= 2 ? '경비' : '의사'}`)
    initializeResidentPersonality(w,c)
    c.faction = site.faction; c.home = { ...c.pos }; c.mapId = w.s.map.id; c.room = 0
    if (trader) c.traderSite = market.site
    w.s.creatures.push(c)
    initializeNpcIdentity(w,c,site.id,c.name)
    const pop = m!.simulation?.settlements[site.id]?.population
    if (pop?.I && rng(w, `world.resident-health.${site.id}`).chance(pop.I / pop.total)) exposeDisease(w, c, worldSimulationDef(w).disease.def, 1)
  }
  // 기존 지상 화덕과 같은 열원이다.
  w.s.map.tiles[18 * w.s.map.w + 32].t = 'Terrain.Campfire'
  w.s.map.lights.push({ pos: { x: 32, y: 18 }, radius: 6, kind: 'campfire' })
  w.s.map.settlementInitialized = true
  initializeClinic(w, site)
  initializeInn(w)
  initializeResidentRest(w, site)
  initializeResidentProvisions(w, site)
  initializeResidentWater(w, site)
  initializeResidentPurification(w, site)
  initializeTeaching(w)
  initializeResidentWarmth(w,site)
  initializeLegacyResidents(w,site)
  registerResidentSource(w,site,w.s.creatures.filter(c=>!before.has(c.id)))
  invalidateLights(w)
}

function initializeClinic(w: World, site: WorldSite) {
  if (w.s.map.clinicInitialized) return
  const d = w.db.get<ClinicDef>('Clinic.Hearth')
  const species=factionDef(w,site.faction??'')?.healer??d.doctor
  let doctor = w.s.creatures.find((c) => c.def === species)
  // 구형 지역의 주민은 그대로 두고 의사를 한 번만 추가한다. 사망한 의사는 부활시키지 않는다.
  if(doctor&&!doctor.alive){w.s.map.clinicInitialized=true;return}
  if (!doctor) {
    const pop=w.s.overworld?.simulation?.settlements[site.id]?.population,existing=w.s.creatures.filter((c)=>c.id!==w.s.playerId&&c.alive&&c.home&&(c.residentOriginFaction??c.faction)===site.faction&&(!c.residentSite||c.residentSite===site.id)).length
    if(pop&&pop.S+pop.I+pop.R<=existing)return
    const pos = [{ x: 35, y: 17 }, { x: 34, y: 18 }, { x: 36, y: 18 }, { x: 35, y: 19 }].find((p) => !creatureAt(w, p) && terrainAt(w, p).passable)
    if (!pos) return
    doctor = createCreature(w, species, pos, `${site.label} 의사`)
    initializeResidentPersonality(w,doctor)
    doctor.faction = site.faction!; doctor.home = { ...pos }; doctor.mapId = w.s.map.id; doctor.room = 0
    w.s.creatures.push(doctor)
    initializeNpcIdentity(w,doctor,site.id,doctor.name)
  }
  doctor.clinicSite = site.id
  for (const supply of d.supplies) {
    const idef = w.db.item(supply.item)
    let left = supply.count
    while (left > 0) {
      const count = Math.min(left, idef.stackable ? idef.maxStack ?? 99 : 1)
      const it = makeMarketItem(w, supply.item, count)
      if (supply.appraisal !== undefined) it.appraisal = supply.appraisal
      if (addToBag(w, doctor, it)) tileAt(w, doctor.pos).items.push(it)
      left -= count
    }
  }
  w.s.map.clinicInitialized = true
}
