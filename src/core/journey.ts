import {markDormantCultivation,settleDormantCultivation} from './cultivation-dormant'
import {settleAshDeposits,refreshAshExposure}from'./ash-deposits'
import {recordOrderedDeparture} from './social-replies'
import {worldSurveyError} from './world-observations'
import {plantPines} from './pines'
import {packWorldRaids} from './world-raids'
import { packCaravans } from './caravans'
import { boatDeckError } from './marine-state'
import { capacity } from './body'
import { atPortDock, boatSceneKey, makeBoatDeck, portDock, sailingError, seaRoute, seaSegmentTurns, watercraft } from './marine-state'
import { findItem, removeStack } from './items'
import { nearbyWater } from './water'
import { waterSalinity } from './water-state'
import { initializeFieldDevices } from './field-devices'
import { kinshipEntry } from './kinship-state'
import { travellingParty } from './prisoner-escort'
import { generateRegionLayout } from './region-layout'
import { partyMemberTravelError, partyTransitionError, regionPartyTransitionError, placeParty, partyArrivalPositions } from './companions'
import { applySettlementChanges, settlementEntryError, settlementVisit } from './world-simulation'
import { initializeSettlement } from './settlements'
import { initializeClimateMap } from './climate'
import { regionalWeatherAt, syncRegionalWeather } from './environment'
import { totalBleed } from './body'
import { log, player, rng, turnOf, TURNS_PER_HOUR, TU_PER_TURN, type World } from './ctx'
import { canSee, hasLos, invalidateLights, updatePlayerVision } from './fov'
import { eq, type Pos } from './geom'
import { generateSurface, type GenResult } from './mapgen'
import { revealWorld, routeHours, worldGenDef, worldIndex, worldRoute } from './overworld'
import type { Creature, MapState, RegionLayoutDef, RegionScene, RegionSiteDef, WorldSite } from './types'

/** 비활성 지역의 지도도 부패·정수 등 시간성 아이템 정산에 포함한다. */
export function mapWorlds(w: World,resolveWeather=true): World[] {
  if (w.s.overworld&&resolveWeather) syncRegionalWeather(w, true)
  const out: World[] = []
  for (const map of [w.s.map, ...Object.values(w.s.maps)]) {
    const weather = w.s.overworld&&resolveWeather ? regionalWeatherAt(w, map.worldCell ?? w.s.overworld.position, map === w.s.map) : undefined
    out.push({ db: w.db, s: { ...w.s, map, creatures: map === w.s.map ? w.s.creatures : w.s.offCreatures[map.id] ?? [], ...(weather ? { weather: weather.weather, weatherUntil: weather.until, wind: weather.wind } : {}) } })
  }
  for (const scene of Object.values(w.s.overworld?.scenes ?? {})) for (const map of [scene.map, ...Object.values(scene.maps)]) {
    const weather = resolveWeather?regionalWeatherAt(w, map.worldCell ?? w.s.overworld!.position):undefined
    out.push({ db: w.db, s: { ...w.s, map, maps: scene.maps, creatures: map === scene.map ? scene.creatures : scene.offCreatures[map.id] ?? [], offCreatures: scene.offCreatures, sources: scene.sources, storyteller: scene.storyteller, ...(weather?{weather: weather.weather, weatherUntil: weather.until, wind: weather.wind}:{}) } })
  }
  return out
}

function wilderness(w: World, name: string, site?: WorldSite,scriptPreview=false): GenResult {
  const layout=site&&w.db.tryGet<RegionSiteDef>(site.id)?.layout
  if(layout)return generateRegionLayout(w,w.db.get<RegionLayoutDef>(layout),{scriptPreview,regionId:site?.id})
  const m = w.s.overworld!, cell = m.cells[worldIndex(m, m.position)]
  const r = rng(w, `world.region.${site?.id ?? `${m.position.x}.${m.position.y}`}.surface`)
  if (!site) {
    const width = 16, height = 12
    const map: MapState = { id: 'surface', name, kind: 'surface', depth: 0, ambient: 0, worldCell: { ...m.position }, w: width, h: height, tiles: Array.from({ length: width * height }, (_, i) => ({ t: i % width === 0 && (cell.river || cell.lake) ? 'Terrain.ShallowWater' : 'Terrain.Earth', v: r.int(0, 15), roof: false, blood: 0, items: [] })), exits: [], links: [], rooms: [], props: [], lights: [] }
    plantPines(w,map,('world.botany.'+m.position.x+'.'+m.position.y) as Parameters<typeof rng>[1])
    return { map, start: { x: 8, y: 6 }, spawns: [] }
  }
  const width = 64, height = 48
  const map: MapState = { id: 'surface', name, kind: 'surface', depth: 0, ambient: 0, worldCell: { ...m.position }, w: width, h: height, tiles: Array.from({ length: width * height }, () => ({ t: 'Terrain.Earth', v: r.int(0, 15), roof: false, blood: 0, items: [] })), exits: [{ x: 32, y: 47 }], links: [], rooms: [], props: [], lights: [] }
  const at = (x: number, y: number) => map.tiles[y * width + x]
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    if (Math.abs(x - 32) <= 2 || x >= 23 && x <= 41 && y >= 10 && y <= 31) continue
    const tree = cell.resources.wood / 500
    if (r.chance(tree)) at(x, y).t = 'Terrain.Tree'
    else if (r.chance(cell.resources.ore / 1500)) at(x, y).t = 'Terrain.Rock'
    else if (r.chance(cell.resources.herbs / 2500)) at(x, y).t = 'Terrain.Fungus'
  }
  for (let y = 17; y < height; y++) for (let x = 31; x <= 33; x++) at(x, y).t = 'Terrain.Path'
  if (cell.river || cell.lake || site?.kind === 'settlement') for (let y = 4; y <= 35; y++) at(18, y).t = 'Terrain.ShallowWater'
  map.rooms.push({ x: 23, y: 10, w: 19, h: 22, type: site?.kind === 'settlement' ? 'camp-home' : 'ruin', discovered: false, name: site?.label ?? '길가' })
  if (site) {
    for (let y = 12; y <= 22; y++) for (let x = 25; x <= 39; x++) { const edge = y === 12 || y === 22 || x === 25 || x === 39; at(x, y).t = edge ? 'Terrain.RuinWall' : 'Terrain.KtFloor'; at(x, y).roof = !edge && site.kind === 'settlement' }
    at(32, 22).t = 'Terrain.DoorClosed'; at(32, 22).roof = true
    if (site.kind === 'tower') for (const [x, y] of [[30, 15], [32, 15], [34, 15], [32, 16]]) at(x, y).t = 'Terrain.Column'
    if (['ruin', 'mine', 'conduit'].includes(site.kind)) at(28, 19).t = 'Terrain.Remains'
  }
  const def = site && w.db.tryGet<RegionSiteDef>(site.id)
  const spawns: GenResult['spawns'] = []
  for (const guard of def?.guards ?? []) for (let i = 0; i < guard.count; i++) spawns.push({ def: guard.def, pos: { x: 28 + i % 8, y: 25 + Math.floor(i / 8) }, home: { x: 32, y: 26 }, room: 0 })
  plantPines(w,map,('world.botany.'+(site?.id??m.position.x+'.'+m.position.y)) as Parameters<typeof rng>[1])
  return { map, start: { x: 32, y: 46 }, spawns }
}
function saveScene(w: World,party:Creature[]=[]): RegionScene {
  settleAshDeposits(w);refreshAshExposure(w)
  packCaravans(w,party)
  packWorldRaids(w,party)
  const s = w.s, p = player(w)
  if (s.overworld) regionalWeatherAt(w, s.map.worldCell ?? s.overworld.position, true)
  markDormantCultivation(w,s.map)
  s.map.leftAt = turnOf(w)
  return { map: s.map, maps: s.maps, creatures: s.creatures.filter((c) => c.id !== p.id&&!party.includes(c)), offCreatures: s.offCreatures, sources: s.sources ?? [], storyteller: s.storyteller, noiseEvents: s.noiseEvents }
}
function resetTransient(w: World) {
  w.s.loot = undefined; w.s.visible = []; w.s.fx = []; w.s.autoIgnored = undefined; w.s.bot = undefined
  const p = player(w); p.ai.path = undefined; p.activity = undefined
  invalidateLights(w); updatePlayerVision(w, p)
}
const roadKey = (p: Pos) => `@${p.x},${p.y}`
function loadRoad(w: World,party:Creature[]=[]){
  const m = w.s.overworld!, p = player(w), key = roadKey(m.position), stored = m.scenes[key]
  if (stored) {
    w.s.map = stored.map; w.s.maps = stored.maps; w.s.offCreatures = stored.offCreatures; w.s.creatures = [p, ...stored.creatures]; w.s.sources = stored.sources; w.s.storyteller = stored.storyteller; w.s.noiseEvents = stored.noiseEvents
    delete m.scenes[key]
  } else {
    const gen = wilderness(w, '고원 길목')
    w.s.map = gen.map; w.s.maps = {}; w.s.offCreatures = {}; w.s.creatures = [p]; w.s.sources = []
    w.s.storyteller = { budget: 0, lastEventTurn: turnOf(w), history: [] }; w.s.noiseEvents = []
  }
  placeParty(w,party,{x:8,y:6}); p.mapId = w.s.map.id
  syncRegionalWeather(w)
  if(stored&&w.s.map.leftAt!==undefined)settleDormantCultivation(w,w.s.map,w.s.map.leftAt)
  if (!stored) initializeClimateMap(w)
  invalidateLights(w)
}
export function leaveRegion(w: World, mark: (w: World, map: MapState, cs: Creature[]) => void) {
  const error=regionPartyTransitionError(w,'road');if(error)return error
  const m = w.s.overworld!, p = player(w),party=travellingParty(w),from=m.currentRegion
  if (m.currentRegion) { mark(w, w.s.map, w.s.creatures); m.scenes[m.currentRegion] = saveScene(w,party) }
  delete m.currentRegion
  loadRoad(w,party)
  recordOrderedDeparture(w,p,from)
  p.nextAct = w.s.time + TU_PER_TURN
  resetTransient(w)
  log(w, 'info', '지역을 떠났다. 지도(M)에서 갈 곳을 고를 수 있다.')
}

export function enterRegion(w: World, populate: (w: World, gen: GenResult) => Creature[], settle: (w: World, map: MapState, cs: Creature[], left: number) => void): string | null {
  const m = w.s.overworld, p = player(w),party=travellingParty(w)
  if (!m || m.currentRegion) return '이미 지역 안이다'
  if (m.travel && m.travel.segmentRemaining < m.travel.segmentTotal) return '이동 중인 칸을 먼저 지나야 한다'
  const site = m.sites.find((s) => eq(s.cell, m.position))
  if (!site) return '이곳에는 들어갈 지역이 없다'
  const fromBoat=!!w.s.map.vessel,dock=fromBoat?portDock(w):undefined
  if(fromBoat&&!dock)return '이 해안에는 실제로 내릴 부두가 없다'
  if(fromBoat){const deckError=boatDeckError(w);if(deckError)return deckError}
  if(fromBoat){const existing=m.scenes[site.id],probe={db:w.db,s:{...w.s,rng:structuredClone(w.s.rng)}};const map=existing?.map??wilderness(probe,site.label,site,true).map,people=existing?.creatures??[];if(!partyArrivalPositions(w,map,people,{x:dock![0],y:dock![1]},party))return '실제 부두에 동행자가 내릴 공간이 없다'}
  const partyError=regionPartyTransitionError(w,'site');if(partyError)return partyError
  const entryError = settlementEntryError(w, site.id)
  if (entryError) return entryError
  m.scenes[w.s.map.vessel?boatSceneKey(m.position):roadKey(m.position)] = saveScene(w,party)
  const stored = m.scenes[site.id]
  m.currentRegion = site.id; delete m.travel
  if (stored) {
    w.s.map = stored.map; w.s.maps = stored.maps; w.s.creatures = [p, ...stored.creatures]; w.s.offCreatures = stored.offCreatures; w.s.sources = stored.sources; w.s.storyteller = stored.storyteller; w.s.noiseEvents = stored.noiseEvents
    delete m.scenes[site.id]
    // 지역 전체를 각 층의 정지 시각부터 한 번씩 정산한다.
    const activeMap = w.s.map
    const maps = [activeMap, ...Object.values(w.s.maps)].sort((a, b) => a.depth - b.depth)
    for (const map of maps) {
      const cs = map === activeMap ? w.s.creatures.filter((c) => c.id !== p.id) : w.s.offCreatures[map.id] ?? []
      if (map.leftAt !== undefined) { w.s.map = map; settle(w, map, cs, map.leftAt); map.leftAt = turnOf(w) }
      for (const c of cs) c.nextAct = Math.max(c.nextAct, w.s.time)
    }
    w.s.map = activeMap
  } else {
    const gen = site.kind === 'cloister' ? generateSurface(w) : wilderness(w, site.label, site)
    gen.map.worldCell = { ...m.position }
    w.s.map = gen.map; w.s.maps = {}; w.s.offCreatures = {}; w.s.sources = []
    w.s.storyteller = { budget: 0, lastEventTurn: turnOf(w), history: [] }; w.s.noiseEvents = []
    w.s.creatures = [p, ...populate(w, gen)]
  }
  initializeFieldDevices(w)
  applySettlementChanges(w)
  initializeSettlement(w,!stored)
  settleAshDeposits(w);refreshAshExposure(w)
  settlementVisit(w, site.id)
  kinshipEntry(w,site.id)
  const layout=w.s.map.layout&&w.db.get<RegionLayoutDef>(w.s.map.layout)
  placeParty(w,party,fromBoat?{x:dock![0],y:dock![1]}:layout?{x:layout.start[0],y:layout.start[1]}:w.s.map.exits[0]??{x:32,y:46}); p.mapId = w.s.map.id; p.nextAct = w.s.time + TU_PER_TURN
  if (!m.visited.includes(site.id)) m.visited.push(site.id)
  syncRegionalWeather(w)
  if (!stored) initializeClimateMap(w)
  resetTransient(w)
  log(w, 'info', `${site.label}에 들어섰다. ${site.description}`)
  return null
}
export function startTravel(w: World, c: Creature, target: Pos): string | null {
  const m = w.s.overworld
  if (!m || m.currentRegion || c.id !== w.s.playerId) return '지역 출입구를 지나 바깥길로 나가야 한다'
  const partyError=partyTransitionError(w)
  if(partyError)return partyError
  if (totalBleed(w, c) > worldGenDef(w).travelBleedMax) return '출혈을 먼저 멎게 해야 먼 길을 걸을 수 있다'
  const boat=w.s.map.vessel
  if(boat){const error=sailingError(w);if(error)return error;const livingCrew=boat.crew.filter(id=>{const member=w.s.creatures.find(a=>a.id===id);return !member||member.alive});if(livingCrew.length!==travellingParty(w).length+1||![c,...travellingParty(w)].every(person=>livingCrew.includes(person.id)))return '처음 승선한 실제 동행 명단을 확인하자'}
  const previous = m.travel
  if(previous&&((previous.mode==='boat')!==!!boat||previous.mode==='boat'&&previous.vesselUid!==boat?.hull.uid))return '예약한 원래 배의 이동이 아니다'
  if (previous && previous.segmentRemaining < previous.segmentTotal && !eq(previous.destination, target)) return '이동 중인 칸을 마친 뒤 경로를 바꿀 수 있다'
  if (!previous || !eq(previous.destination, target)) {
    const route = boat?seaRoute(w,m.position,target):worldRoute(w, m.position, target)
    if (!route?.cells.length) return boat?'배로 갈 수 있는 실제 바다 경로가 없다':'걸어서 갈 수 있는 경로가 없다'
    const turns = boat?seaSegmentTurns(w,m.position,route.cells[0]):Math.ceil(routeHours(w, m.position, route.cells[0]) * TURNS_PER_HOUR)
    let from = m.position, total = 0
    for (const to of route.cells) { total += boat?seaSegmentTurns(w,from,to):Math.ceil(routeHours(w, from, to) * TURNS_PER_HOUR); from = to }
    m.travel = { ...(boat?{mode:'boat' as const,vesselUid:boat.hull.uid,segmentCosts:route.cells.map((to,i)=>seaSegmentTurns(w,i?route.cells[i-1]:m.position,to))}:{}),destination: { ...target }, route: route.cells, segmentRemaining: turns, segmentTotal: turns, totalRemaining: total }
  }
  if(boat&&m.travel!.segmentRemaining===0){const t=m.travel!,next=seaSegmentTurns(w,m.position,t.route[0]);if(!Number.isFinite(next))return '바람이 잦아들기를 기다리자';const old=t.segmentCosts?.[0]??0;t.totalRemaining+=next-old;t.segmentRemaining=t.segmentTotal=next;if(t.segmentCosts)t.segmentCosts[0]=next}
  const ids=travellingParty(w).map((c)=>c.id)
  m.travel!.party=ids.length?ids:undefined
  c.activity = { kind: 'travel', label: boat?'배 저어 이동':'여행', remaining: m.travel!.totalRemaining, total: m.travel!.totalRemaining }
  return null
}
export function travelStep(w: World, c: Creature): boolean {
  const m = w.s.overworld!, t = m.travel
  if (!t || m.currentRegion) { c.activity = undefined; return true }
  const boat=t.mode==='boat'
  if(boat&&(!w.s.map.vessel||w.s.map.vessel.hull.uid!==t.vesselUid||sailingError(w))){c.activity=undefined;log(w,'warn','배 이동을 멈췄다. 원래 선체와 조종 상태·날씨를 확인하자.');return true}
  const party=(t.party??[]).map((id)=>w.s.creatures.find((c)=>c.id===id))
  for(const member of party){const error=member?partyMemberTravelError(w,member):'동료가 길목에 없다';if(error){c.activity=undefined;log(w,'warn',`동행 여행을 멈췄다: ${member?.name??'동료'} · ${error}.`);return true}}
  for(const member of party)member!.movedTurn=turnOf(w)
  c.movedTurn = turnOf(w)
  if(boat&&turnOf(w)%TURNS_PER_HOUR===0){const d=watercraft(w)!;w.s.map.vessel!.hull.durability=Math.max(0,(w.s.map.vessel!.hull.durability??100)-d.wearPerHour*(d.weather[w.s.weather]??1))}
  t.totalRemaining--; t.segmentRemaining--
  if (t.segmentRemaining <= 0) {
    if(!boat)m.scenes[roadKey(m.position)] = saveScene(w,party as Creature[])
    m.position = t.route.shift()!;if(boat)t.segmentCosts?.shift()
    if(boat){w.s.map.worldCell={...m.position};syncRegionalWeather(w);invalidateLights(w)}else loadRoad(w,party as Creature[])
    revealWorld(m,worldSurveyError(w,true)?undefined:turnOf(w))
    if (!t.route.length) { delete m.travel; c.activity = undefined; log(w, 'info', `${m.sites.find((s) => eq(s.cell, m.position))?.label ?? '길목'}에 도착했다.`); return true }
    const next=boat?seaSegmentTurns(w,m.position,t.route[0]):Math.ceil(routeHours(w, m.position, t.route[0]) * TURNS_PER_HOUR)
    if(!Number.isFinite(next)){t.segmentTotal=t.segmentRemaining=0;c.activity=undefined;log(w,'warn','다음 바다 구간의 바람이 잦아들기를 기다리자.');return true}
    if(boat){const old=t.segmentCosts?.[0]??next;t.totalRemaining+=next-old;if(t.segmentCosts)t.segmentCosts[0]=next;if(c.activity)c.activity.remaining=t.totalRemaining}
    t.segmentTotal=t.segmentRemaining=next
  }
  return false
}

/** Launch/reboard only at a real local dock. Quotes never allocate items or consume RNG. */
export function boatLaunchQuote(w:World,c:Creature,uid?:number){
 const m=w.s.overworld,dock=portDock(w),parked=m?.scenes[boatSceneKey(m.position)],hull=uid===undefined?parked?.map.vessel?.hull:findItem(c,uid),d=hull&&watercraft(w,hull),party=travellingParty(w)
 let error:string|null
 if(!m?.currentRegion||w.s.map.vessel||c.id!==w.s.playerId||!w.s.creatures.includes(c))error='실제 항구 안의 부두로 가야 한다'
 else if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)error='깨어서 배를 다룰 수 있어야 한다'
 else if(!dock||!atPortDock(w)||!canSee(w,c,{x:dock[0],y:dock[1]})||!hasLos(w,c.pos,{x:dock[0],y:dock[1]}))error='보이는 부두 곁으로 직접 가야 한다'
 else if(!hull||!d||hull.count!==1||uid!==undefined&&!c.bag.includes(hull))error='실제 소형 선체를 배낭에 갖고 있어야 한다'
 else if(uid!==undefined&&parked?.map.vessel)error='먼저 이곳에 정박한 원래 배를 타야 한다'
 else if(uid===undefined&&parked?.map.vessel?.owner!==c.id)error='이 정박선은 내 배가 아니다'
 else if(!Number.isFinite(hull.durability??100)||!Number.isFinite(hull.maxDurability??100)||(hull.durability??100)>(hull.maxDurability??100)||(hull.maxDurability??100)<=0)error='선체 상태 기록이 올바르지 않다'
 else if((hull.durability??100)<d.minDurability)error='선체를 수리한 뒤 띄워야 한다'
 else if(party.length+1>d.seats)error=`배의 실제 정원${d.seats}명을 넘었다`
 else if((d.weather[w.s.weather]??1)<=0)error='지금 날씨에는 작은 배를 띄울 수 없다'
 else if(!nearbyWater(w,c)||waterSalinity(nearbyWater(w,c)!.quality)<=0)error='실제 바닷물에 닿는 부두에서만 배를 띄운다'
 else error=partyTransitionError(w)
 return{error,hull,def:d,party,parked,turns:d?.launchTurns??1}
}
export function launchBoat(w:World,c:Creature,uid?:number):string|null{
 const q=boatLaunchQuote(w,c,uid);if(q.error)return q.error
 const m=w.s.overworld!,hull=q.hull!,d=q.def!,anchor={x:d.anchor[0],y:d.anchor[1]},probeMap=q.parked?.map??makeBoatDeck(w,{...hull},[c,...q.party].map(c=>c.id))
 if(!partyArrivalPositions(w,probeMap,q.parked?.creatures??[],anchor,q.party))return '갑판에 동행자가 설 실제 공간이 없다'
 m.scenes[m.currentRegion!]=saveScene(w,q.party)
 if(uid!==undefined)removeStack(c,uid)
 const map=q.parked?.map??makeBoatDeck(w,hull,[c,...q.party].map(c=>c.id))
 w.s.map=map;w.s.maps=q.parked?.maps??{};w.s.offCreatures=q.parked?.offCreatures??{};w.s.creatures=[c,...(q.parked?.creatures??[])];w.s.sources=[];w.s.noiseEvents=[];w.s.storyteller=q.parked?.storyteller??{budget:0,lastEventTurn:turnOf(w),history:[]}
 map.vessel!.crew=[c,...q.party].map(c=>c.id);delete m.scenes[boatSceneKey(m.position)];delete m.currentRegion;delete m.travel
 placeParty(w,q.party,anchor);c.mapId=map.id;syncRegionalWeather(w);resetTransient(w)
 log(w,'info',`같은 선체를 띄웠다. 승선${q.party.length+1}/${d.seats}명. 지도에서 실제 바다 경로를 고르자.`)
 return null
}
