// 월드 일 단위 인구·저장고·SIR. 지역의 실제 NPC/타일은 진입/06시 장소 변화에서만 바꾼다.
import { log, player, rng, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { factionDef } from './diplomacy'
import { createMarket, economyTick } from './economy'
import { exposeDisease } from './conditions'
import { towerSoilFertility } from './tower-consequences'
import { climateDef,calendarAtDay } from './climate-state'
import {announceOutbreakChange} from './public-outbreak-news'
import type { Commodity, Creature, DiseaseDef, PopulationRates, PopulationState, WorldSettlement, WorldSimulationDef } from './types'
type ResolvedSimulation = Omit<WorldSimulationDef, 'disease'> & { disease: WorldSimulationDef['disease'] & PopulationRates }
const defCache = new WeakMap<World['db'], ResolvedSimulation>()
export function worldSimulationDef(w: World): ResolvedSimulation {
  let d = defCache.get(w.db)
  if (!d) { const raw = w.db.get<WorldSimulationDef>('WorldSimulation.Hearth'), rates = w.db.get<DiseaseDef>(raw.disease.def).population; if (!rates) throw new Error(`${raw.disease.def}: 월드 인구 전파 계수가 없다`); d = { ...raw, disease: { ...raw.disease, ...rates } }; defCache.set(w.db, d) }
  return d
}
const dayOf = (w: World) => Math.floor(turnOf(w) / TURNS_PER_DAY)
const quantize = (v: number) => Math.round(v * 1e9) / 1e9
/** 달력·선택한 공개 세력의 생산 정책만 조회한다. 저장고·날씨·난수를 읽거나 바꾸지 않는다. */
export function seasonalProductionMultiplier(w:World,faction:string|undefined,commodity:Commodity,elapsedDay=dayOf(w)):number{
  const rule=worldSimulationDef(w).seasonalProduction
  if(!rule||!faction||!rule.factions.includes(faction))return 1
  return rule.seasons[calendarAtDay(w,elapsedDay).season.id]?.[commodity]??1
}
export function initializeWorldSimulation(w: World) {
  const m = w.s.overworld
  if (!m) return
  const def = worldSimulationDef(w), settlements: Record<string, WorldSettlement> = m.simulation?.settlements??{}
  m.simulation ??= { day: dayOf(w), marketDay: dayOf(w), settlements }
  for (const site of m.sites.filter((s) => s.kind === 'settlement' && factionDef(w, s.faction ?? '')?.trader)) {
    if(settlements[site.id])continue
    const population = site.population ?? def.defaultPopulation[site.faction!] ?? def.referencePopulation, scale = population / def.referencePopulation
    site.population = population
    const scaled = (values: Partial<Record<Commodity, number>>) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, quantize(v * scale)]))
    const stock = { ...def.stock, ...def.factionStock?.[site.faction!] }, production = { ...def.production, ...def.factionProduction?.[site.faction!] }
    const settlement: WorldSettlement = { site: site.id, population: { total: population, S: population, I: 0, R: 0, deaths: 0, infectionCarry: 0, recoveryCarry: 0, deathCarry: 0 }, reserve: scaled(stock), target: scaled({ ...def.stockTarget, ...def.factionStock?.[site.faction!] }), production: scaled(production), consumptionCarry: {}, quarantined: false, changes: [] }
    settlements[site.id] = settlement
    // 이미 방문한 구형 시장은 재고를 보존하고 그만큼만 저장고에서 뺀다.
    const existing = m.markets?.[site.id]
    if (existing) for (const it of existing.items) { const unit = def.items[it.def]; if (unit) settlement.reserve[unit.commodity] = Math.max(0, quantize((settlement.reserve[unit.commodity] ?? 0) - it.count * unit.units)) }
    createMarket(w, site, factionDef(w, site.faction!)!.trader!)
  }
}
/** 09 검산4의 N은 최초 인구(사망을 포함한 조사 인구)다. S+I+R+사망=N을 보존한다. */
export function sirDay(p: PopulationState, d: PopulationRates) {
  if (p.total <= 0) return { infected: 0, recovered: 0, died: 0 }
  const infection = Math.floor(d.beta * p.S * p.I * 1000 / p.total) + p.infectionCarry
  const recovery = d.gamma * p.I + p.recoveryCarry, death = d.mu * p.I + p.deathCarry
  const infected = Math.min(p.S, Math.floor(infection / 1e6)), recovered = Math.min(p.I, Math.floor(recovery / 1000)), died = Math.min(p.I - recovered, Math.floor(death / 1000))
  p.infectionCarry = infection % 1e6; p.recoveryCarry = recovery % 1000; p.deathCarry = death % 1000
  p.S -= infected; p.I += infected - recovered - died; p.R += recovered; p.deaths += died
  return { infected, recovered, died }
}
export function settlementCommodity(w: World, s: WorldSettlement, commodity: Commodity): number {
  const d = worldSimulationDef(w), market = w.s.overworld?.markets?.[s.site]
  return quantize((s.reserve[commodity] ?? 0) + (market?.items ?? []).reduce((n, it) => { const unit = d.items[it.def]; return n + (unit?.commodity === commodity ? unit.units * it.count : 0) }, 0))
}
function consumeReserve(w: World, s: WorldSettlement, commodity: Commodity, amount: number) {
  const fromReserve = Math.min(s.reserve[commodity] ?? 0, amount)
  s.reserve[commodity] = quantize((s.reserve[commodity] ?? 0) - fromReserve)
  let left = quantize(amount - fromReserve)
  if (left <= 0) return
  const market = w.s.overworld!.markets?.[s.site], d = worldSimulationDef(w)
  if (!market) return
  for (const it of market.items) {
    const unit = d.items[it.def]
    if (unit?.commodity !== commodity || left <= 0) continue
    const count = Math.min(it.count, Math.ceil(left / unit.units)), consumed = count * unit.units
    it.count -= count
    if (consumed > left) s.reserve[commodity] = quantize((s.reserve[commodity] ?? 0) + consumed - left)
    left = Math.max(0, quantize(left - consumed))
  }
  market.items = market.items.filter((it) => it.count > 0)
}
/** 실제 주민이 소비한 물품은 같은 날의 요약 인구 소비에서 한 번만 뺀다. 개인별 기본 배급량까지만 인정한다. */
export function recordResidentUse(w: World, c: Creature, item: string, count: number) {
  const site = c.residentSite, settlement = site && w.s.overworld?.simulation?.settlements[site]
  if (!settlement || !c.alive || c.id === w.s.playerId || site !== w.s.overworld?.currentRegion&&!c.companion&&!c.captivity || !Number.isSafeInteger(count) || count <= 0) return
  const d = worldSimulationDef(w), unit = d.items[item]
  if (!unit) return
  const cap = d.consumption[unit.commodity] ?? 0, day = dayOf(w), prior = c.residentConsumption?.day === day ? c.residentConsumption.units : {}, old = prior[unit.commodity] ?? 0
  const next = Math.min(cap, quantize(old + unit.units * count)), delta = quantize(next - old)
  if (delta <= 0) return
  c.residentConsumption = { day, units: { ...prior, [unit.commodity]: next } }
  const used = settlement.residentConsumption?.day === day ? settlement.residentConsumption.units : {}
  settlement.residentConsumption = { day, units: { ...used, [unit.commodity]: quantize((used[unit.commodity] ?? 0) + delta) } }
}
/** 실제 주민의 사망을 조사 인구 안에서 한 번만 옮긴다. N은 사망을 포함하므로 줄이지 않는다. */
export function recordResidentDeath(w:World,c:Creature):boolean{
  const m=w.s.overworld,current=m?.sites.find((s)=>s.id===m.currentRegion),legacyGuard=current?.kind==='settlement'&&w.s.map.settlementInitialized&&c.home&&c.mapId===w.s.map.id&&c.def===factionDef(w,current.faction??'')?.guard
  const site=c.residentSite??c.traderSite??c.clinicSite??(legacyGuard?current?.id:undefined),stock=site&&m?.simulation?.settlements[site]
  const civicFaction=c.residentOriginFaction??c.faction,origin=m?.sites.find((s)=>s.id===site),nativeAway=origin?.kind==='settlement'&&civicFaction===origin.faction&&(c.residentSite===origin.id||c.traderSite===origin.id||c.clinicSite===origin.id||c.companion?.originSite===origin.id)
  if(!m||!stock||c.alive||c.id===w.s.playerId||!nativeAway&&(site!==m.currentRegion||current?.kind!=='settlement'||civicFaction!==current.faction)||stock.residentDeaths?.includes(c.id))return false
  const deaths=stock.residentDeaths??=[];deaths.push(c.id)
  const disease=worldSimulationDef(w).disease.def,p=stock.population,immune=c.immuneDiseases?.includes(disease)||w.db.creature(c.def).diseaseImmune?.includes(disease),infected=c.diseases?.some((d)=>d.def===disease)
  const preferred=immune?'R':infected?'I':'S',bands=[preferred,...(['S','I','R'] as const).filter((b)=>b!==preferred)] as ('S'|'I'|'R')[],band=bands.find((b)=>p[b]>0)
  if(band){p[band]--;p.deaths++}
  // 오늘의 요약 소비는 이미 사망자를 제외한다. 그 사람의 당일 실제 소비까지 다른 주민 몫에서 빼지 않는다.
  const day=dayOf(w),used=c.residentConsumption
  if(used?.day===day&&stock.residentConsumption?.day===day){
    for(const [key,value] of Object.entries(used.units) as [Commodity,number][])stock.residentConsumption.units[key]=quantize(Math.max(0,(stock.residentConsumption.units[key]??0)-value))
  }
  updateQuarantine(w,stock,day,turnOf(w))
  return !!band
}
function updateQuarantine(w: World, s: WorldSettlement, day: number,at=day*TURNS_PER_DAY) {
  const p = s.population, flag = p.total > 0 && p.I / p.total >= worldSimulationDef(w).disease.quarantineAt
  if (flag !== s.quarantined) { s.quarantined = flag;const change={day,kind:flag?'quarantine' as const:'reopen' as const,applied:false,publicAnnounced:false};s.changes.push(change);if(s.site!==w.s.overworld?.currentRegion){announceOutbreakChange(w,s,flag,at,day);change.publicAnnounced=true} }
}
export function introduceInfection(w: World, site: string, count = 1, atDay?:number): number {
  const s = w.s.overworld?.simulation?.settlements[site]
  if (!s || !Number.isSafeInteger(count) || count <= 0) return 0
  const n = Math.min(count, s.population.S); s.population.S -= n; s.population.I += n
  updateQuarantine(w, s, atDay??dayOf(w),atDay===undefined?turnOf(w):atDay*TURNS_PER_DAY); return n
}
/** 이동량×I/N×0.5. 양쪽의 전날 상태로 판정해 같은 날 연쇄가 순서에 따라 달라지지 않는다. */
export function infectionSeedChance(w: World, source: WorldSettlement, destination: WorldSettlement): number {
  const d = worldSimulationDef(w).disease
  return Math.min(1, d.contacts * (source.quarantined ? d.travelMult : 1) * (destination.quarantined ? d.travelMult : 1) * source.population.I / Math.max(1, source.population.total) * d.transmission)
}
export function worldSimulationTick(w: World) {
  const m = w.s.overworld, sim = m?.simulation
  if (!m || !sim) return
  const today = dayOf(w), d = worldSimulationDef(w)
  while (sim.day < today) {
    sim.day++
    const previous = structuredClone(sim.settlements)
    for (const s of Object.values(sim.settlements)) {
      const p = s.population, alive = p.S + p.I + p.R
      for (const key of new Set([...Object.keys(s.production), ...Object.keys(d.consumption)] as Commodity[])) {
        const site=m.sites.find(site=>site.id===s.site),fertility=site&&climateDef(w).towerStop?.soilCommodities.includes(key)?towerSoilFertility(w,site.cell,sim.day*TURNS_PER_DAY):1
        // sim.day는 끝난 날의 다음 날짜다. 장기간 이동도 각 완료 날짜를 따로 계산한다.
        s.reserve[key] = quantize((s.reserve[key] ?? 0) + (s.production[key] ?? 0)*fertility*seasonalProductionMultiplier(w,site?.faction,key,sim.day-1))
        const actual = s.residentConsumption?.day === sim.day - 1 ? s.residentConsumption.units[key] ?? 0 : 0
        const amount = Math.max(0, alive * (d.consumption[key] ?? 0) - actual) + (s.consumptionCarry[key] ?? 0), whole = Math.floor(amount + 1e-9)
        s.consumptionCarry[key] = quantize(amount - whole)
        consumeReserve(w, s, key, whole)
      }
      if (s.residentConsumption && s.residentConsumption.day < sim.day) s.residentConsumption = undefined
      sirDay(p, d.disease)
    }
    // 가까운 세 정착지 사이의 일상 왕래. 캐러밴 화물/개체 이동은 별도로 처리한다.
    for (const source of Object.values(previous)) {
      if (!source.population.I) continue
      const from = m.sites.find((s) => s.id === source.site)!
      const destinations = Object.values(previous).filter((s) => s.site !== source.site).map((s) => { const to = m.sites.find((t) => t.id === s.site)!; return { s, distance: Math.abs(from.cell.x - to.cell.x) + Math.abs(from.cell.y - to.cell.y) } }).sort((a, b) => a.distance - b.distance || (a.s.site < b.s.site ? -1 : a.s.site > b.s.site ? 1 : 0)).slice(0, 3)
      for (const { s: destination } of destinations) if (destination.population.S && rng(w, `world.epidemic.${source.site}.${destination.site}`).chance(infectionSeedChance(w, source, destination))) introduceInfection(w, destination.site, 1, sim.day)
    }
    for (const s of Object.values(sim.settlements)) updateQuarantine(w, s, sim.day)
    economyTick(w, sim.day)
  }
}
export function settlementEntryError(w: World, site: string): string | null {
  return w.s.overworld?.simulation?.settlements[site]?.quarantined ? '회색열 때문에 출입구가 봉쇄되어 있다' : null
}
export function applySettlementChanges(w: World) {
  const m = w.s.overworld, s = m?.simulation?.settlements[m.currentRegion ?? '']
  if (!s) return
  for (const change of s.changes) if (!change.applied && change.day <= dayOf(w)) { w.s.map.quarantine = change.kind === 'quarantine'; change.applied = true;if(change.publicAnnounced===false){announceOutbreakChange(w,s,change.kind==='quarantine',turnOf(w),change.day);change.publicAnnounced=true} log(w, change.kind === 'quarantine' ? 'warn' : 'good', change.kind === 'quarantine' ? '회색열 때문에 정착지의 외부 출입을 막기 시작했다.' : '회색열 봉쇄가 풀렸다.') }
}
export function settlementVisit(w: World, site: string) {
  const settlement = w.s.overworld?.simulation?.settlements[site]
  if (!settlement || settlement.playerEntryDay === dayOf(w)) return
  settlement.playerEntryDay = dayOf(w)
  const p = player(w), d = worldSimulationDef(w).disease, r = rng(w, `world.visits.${site}`)
  const infectious = p.diseases?.some((x) => x.def === d.def && turnOf(w) >= x.incubatesUntil)
  if (infectious && r.chance(d.transmission)) introduceInfection(w, site)
  if (!infectious && settlement.population.I && r.chance(settlement.population.I / Math.max(1, settlement.population.total) * d.transmission)) exposeDisease(w, p, d.def, 1)
}
/** 재입고는 실제 저장고→시장 이동이다. 동전·비분류 장비는 공급표가 관리한다. */
export function withdrawForMarket(w: World, site: string, item: string, wanted: number): number {
  const s = w.s.overworld?.simulation?.settlements[site], unit = worldSimulationDef(w).items[item]
  if (!s || !unit) return wanted
  const count = Math.max(0, Math.min(wanted, Math.floor(((s.reserve[unit.commodity] ?? 0) + 1e-9) / unit.units)))
  s.reserve[unit.commodity] = quantize((s.reserve[unit.commodity] ?? 0) - count * unit.units)
  return count
}
export function settlementPriceFactor(w: World, site: string, item: string): number | undefined {
  const s = w.s.overworld?.simulation?.settlements[site], unit = worldSimulationDef(w).items[item]
  if (!s || !unit) return undefined
  const target = (s.target[unit.commodity] ?? 0) * (unit.commodity === 'Medicine' && s.quarantined ? worldSimulationDef(w).disease.medicineMult : 1)
  if (target <= 0) return undefined
  return Math.sqrt(target / Math.max(1, settlementCommodity(w, s, unit.commodity)))
}
