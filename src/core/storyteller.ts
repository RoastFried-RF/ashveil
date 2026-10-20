import {scriptPlaceEvent} from './script-hooks'
import {runPlaceEventWorker} from './script-workers'
import {placeEventRule,placeEventMembers,placeRoute,scriptedPlaceSource} from './place-event-rules'
import {storyPressureQuote,storyDirectorRule,commitStoryPressure,storyUnitCost} from './story-director'
// 장소 기반 사건 (10 · 14 §10): 적은 맵 가장자리에서 솟아나지 않는다.
// 이미 있는 거점(약탈자 야영지)의 사람들이 정해진 경로를 걸어서 순찰하고, 흔적을 보면 수색대를 꾸린다.

import { daylight } from './environment'
import { canSee } from './fov'
import { cheb, type Pos } from './geom'
import { addToInventory, itemDef } from './items'
import { emitNoise } from './perception'
import { log, player, rng, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import type { CampfireDef, Creature, ItemInst, MapState,PlaceEventDef } from './types'

/** 순찰: 매일 06:00, 야영지 인원 ≥ 4이면 50% → 2~3명 (두목 제외), 경유지마다 30분 대기 */
export const PATROL_HOUR = 6
export const PATROL_CHANCE = 0.5
export const PATROL_MIN_CAMP = 4
export const PATROL_WAIT = TURNS_PER_HOUR / 2


export function storytellerTick(w: World) {
  const st = w.s.storyteller
  const turn = turnOf(w)
  const map = w.s.map
  if (map.kind !== 'surface' || !map.waypoints) return
  traceWatch(w)
  if (st.search && turn >= st.search.at) {
    const pos = st.search.pos
    st.search = undefined
    sendSearchParty(w, w.s.creatures, map, pos, rng(w, 'story'))
  }
  if (turn % TURNS_PER_DAY !== PATROL_HOUR * TURNS_PER_HOUR || st.lastEventTurn === turn) return
  st.lastEventTurn = turn
  sendPatrol(w)
}
function sendPatrol(w:World){
  const st=w.s.storyteller,turn=turnOf(w),map=w.s.map
  if(map.kind!=='surface'||!map.waypoints)return
  const place=placeEventRule(w,'Event.ReaverPatrol'),camp=placeEventMembers(w,w.s.creatures,'Event.ReaverPatrol')
  if(!map.waypoints[place?.origin.waypoint??'reaverCamp'])return
  if (camp.length < (place?.origin.minMembers??PATROL_MIN_CAMP)) return
  if(w.db.event('Event.ReaverPatrol').worker){
    const eligible=camp.filter(c=>!!placeRoute(w,map,'Event.ReaverPatrol',c)&&c.def!==(place?.leader??'Creature.ReaverChief')&&!c.unconscious&&c.ai.mode!=='hunt'&&!c.activity&&!c.captivity&&!c.caravan&&!c.roadRaid&&!c.ai.route?.length)
    if(eligible.length<2||!runPlaceEventWorker(w,'Event.ReaverPatrol','canFire',eligible.map(c=>c.id)))return
  }
  const r = rng(w, 'story'),pressure=storyPressureQuote(w)
  let stronger=false,spendPercent=100
  if(!pressure.reason&&pressure.profile&&pressure.state){const fraction=r.int(...pressure.profile.spendPercent);spendPercent=fraction;stronger=pressure.state.budgetTenths*fraction>=pressure.cost*1000&&r.chance(pressure.chance/100)}
  if (!r.chance((place?.chance??PATROL_CHANCE)+(stronger?(storyDirectorRule(w)?.chanceBoost??0)/100:0))) return
  const pool = camp.filter((c) => !!placeRoute(w,map,'Event.ReaverPatrol',c)&&c.def !== (place?.leader??'Creature.ReaverChief') && !c.unconscious && c.ai.mode !== 'hunt'&&(!pressure.state||!c.activity&&!c.captivity&&!c.caravan&&!c.roadRaid&&!c.ai.route?.length))
  const ordinary = Math.min(pool.length, r.int(...(place?.count??[2,3]as [number,number])));let n=Math.min(pool.length,ordinary+(stronger?1:0))
  if(n===0||pressure.state&&n<2)return
  const roster=r.shuffle([...pool])
  if(stronger){
    const extra=roster[ordinary],unitCost=extra?storyUnitCost(w,extra):pressure.cost
    const canAdd=!!extra&&!!pressure.state&&pressure.state.budgetTenths*spendPercent>=unitCost*1000&&pressure.state.budgetTenths>=unitCost*10
    const cost=canAdd?unitCost:pressure.cost
    if(!canAdd)n=ordinary
    if(!commitStoryPressure(w,cost)){stronger=false;n=ordinary}
    else if(pressure.state)pressure.state.lastPurchase={kind:'patrol',at:turn,mapId:map.id,region:w.s.overworld?.currentRegion,cost,extraId:canAdd?extra!.id:undefined}
  }
  for (const c of roster.slice(0, n)) {
    const route=placeRoute(w,map,'Event.ReaverPatrol',c);if(!route)continue
    c.asleep = false
    c.ai.mode = 'patrol'
    c.ai.route = route
    c.ai.routeIdx = 0
    c.ai.waitUntil = undefined
    c.ai.path = undefined
    c.ai.task = undefined
  }
  st.history.push({ turn, event: 'Event.ReaverPatrol' })
  runPlaceEventWorker(w,'Event.ReaverPatrol','execute',roster.slice(0,n).map(c=>c.id))
  scriptPlaceEvent(w,'Event.ReaverPatrol',roster.slice(0,n).map(c=>c.id))
  log(w, 'flavor', stronger?'약탈자 야영지 쪽에서 여럿의 횃불이 움직인다.':w.db.event('Event.ReaverPatrol').hint ?? '')
}
/** 새 모드 사건도 원래 공급원·현재 인물·귀환 경로를 먼저 확인한다. */
function sendScriptedParty(w:World,id:string,pos:Pos){
 const origin=scriptedPlaceSource(w,id);if(!origin)return
 const {event,rule,source}=origin,turn=turnOf(w),map=w.s.map
 if(Math.floor(turn/TURNS_PER_DAY)<(event.minDay??0))return
 const members=w.s.creatures.filter(c=>source.members!.includes(c.id)&&c.alive&&c.mapId===map.id&&c.faction===rule.origin.faction)
 if(members.length<rule.origin.minMembers)return
 const stash=map.waypoints?.homeStash,near=stash&&cheb(stash,pos)<=12?stash:undefined
 const eligible=members.filter(c=>!c.unconscious&&!c.activity&&!c.captivity&&!c.companion&&!c.caravan&&!c.roadRaid&&!c.ai.route?.length&&!c.ai.task&&!['hunt','flee','surrender','return','patrol'].includes(c.ai.mode)&&!!c.home&&!!placeRoute(w,map,id,c,pos,near))
 if(eligible.length<rule.count[0]||!runPlaceEventWorker(w,id,'canFire',eligible.map(c=>c.id)))return
 const r=rng(w,`world.placeEvent.${id}`);if(!r.chance(rule.chance))return
 const leader=eligible.find(c=>c.def===rule.leader),takeLeader=!!leader&&r.chance(rule.leaderChance),pool=r.shuffle(eligible.filter(c=>c!==leader)),count=Math.min(eligible.length,r.int(...rule.count)),party=pool.slice(0,count-(takeLeader?1:0))
 if(takeLeader)party.push(leader!)
 if(party.length<rule.count[0])return
 for(const c of party){c.asleep=false;c.ai.mode='patrol';c.ai.route=placeRoute(w,map,id,c,pos,near);c.ai.routeIdx=0;c.ai.waitUntil=undefined;c.ai.path=undefined;c.ai.placeEvent=id;c.ai.task=rule.kind==='search'?{kind:'search',pos:{...pos},stash:near}:undefined}
 w.s.storyteller.history.push({turn,event:id});runPlaceEventWorker(w,id,'execute',party.map(c=>c.id));scriptPlaceEvent(w,id,party.map(c=>c.id));if(event.hint)log(w,'flavor',event.hint)
}
/** 예약도 원래 장소 공급원의 실제 편성과 경로를 사용한다. 생성 명령은 없다. */
export function dispatchScriptPlaceEvent(w:World,event:string,pos:Pos){
 const definition=w.db.tryGet<PlaceEventDef>(event);if(definition?.defType!=='PlaceEvent')return
 if(w.s.map.kind!=='surface'||!w.s.map.waypoints)return
 const last=[...w.s.storyteller.history].reverse().find(h=>h.event===event)
 if(last&&turnOf(w)-last.turn<(definition.cooldownTurns??0))return
 if(event==='Event.ReaverPatrol'){w.s.storyteller.lastEventTurn=turnOf(w);sendPatrol(w)}
 else if(event==='Event.ReaverSearch')sendSearchParty(w,w.s.creatures,w.s.map,pos,rng(w,'story'))
 else sendScriptedParty(w,event,pos)
}

// ── 흔적 (10 §3.1) ───────────────────────────────

/** 모닥불 흔적이 이 위치에서 보이는가: 밤 불빛 = 반경 6 × 3 = 18칸, 낮 연기 = 15칸, 바람 아래(±45°)면 × 1.5 */
export function fireVisibleFrom(w: World, map: MapState, at: Pos): Pos | undefined {
  for(const fire of map.lights){
  if(fire.kind!=='campfire'||fire.off)continue
  const tile=map.tiles[fire.pos.y*map.w+fire.pos.x]
  const placed=fire.sourceUid!==undefined&&fire.fuelUntil!==undefined&&fire.fuelUntil>turnOf(w)&&tile?.placed?.item.uid===fire.sourceUid&&tile.placed.owner===w.s.playerId&&tile.t===w.db.tryGet<CampfireDef>('Campfire.Hearth')?.terrain
  if(!placed&&!(fire.sourceUid===undefined&&map.waypoints?.homeFire&&cheb(fire.pos,map.waypoints.homeFire)===0))continue
  const d = cheb(fire.pos, at)
  const night = daylight(w) < 0.3
  if (night){if(d<=fire.radius*3)return fire.pos;continue}
  let range = 15
  const vx = at.x - fire.pos.x, vy = at.y - fire.pos.y
  const dot = vx * w.s.wind.x + vy * w.s.wind.y
  // 바람 아래: 불에서 관찰자 쪽 방향이 바람 방향과 45° 안 (cos² ≥ 1/2, 제곱으로 비교)
  if (dot > 0 && 2 * dot * dot >= (vx * vx + vy * vy) * (w.s.wind.x * w.s.wind.x + w.s.wind.y * w.s.wind.y)) range = 22.5
  if(d<=range)return fire.pos
  }
  return undefined
}

/** 순찰 중인 약탈자가 흔적을 보면 경보: 외치고 야영지로 돌아간다 */
function traceWatch(w: World) {
  const map = w.s.map
  for (const c of w.s.creatures) {
    if (!c.alive || c.faction !== 'reavers' || c.ai.mode !== 'patrol' || c.ai.task) continue
    const trace = findTrace(w, c)
    if (!trace) continue
    c.ai.task = { kind: 'alarm', pos: trace }
    c.ai.route = [c.home ?? map.waypoints!.reaverCamp]
    c.ai.routeIdx = 0
    c.ai.waitUntil = undefined
    emitNoise(w, c.pos, 12, c.id)
    if (cheb(player(w).pos, c.pos) <= 20) log(w, 'warn', '숲 쪽에서 누군가 외치는 소리가 들린다. 무언가를 찾은 모양이다.')
  }
}

function findTrace(w: World, c: Creature): Pos | undefined {
  const map = w.s.map
  const fire = fireVisibleFrom(w, map, c.pos)
  if (fire) return fire
  // 마르지 않은 핏자국: 3칸 안
  for (let y = c.pos.y - 3; y <= c.pos.y + 3; y++) for (let x = c.pos.x - 3; x <= c.pos.x + 3; x++) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue
    if (map.tiles[y * map.w + x].blood > 20) return { x, y }
  }
  // 약탈자 시체: 시야 안
  const body = w.s.creatures.find((o) => !o.alive && o.faction === 'reavers' && canSee(w, c, o.pos))
  return body ? { ...body.pos } : undefined
}

// ── 수색대 (10 §3 #2 · §3.2) ──────────────────────

/** 경보를 가진 순찰이 야영지에 닿으면 1시간 뒤 수색대 */
export function alarmArrived(w: World, c: Creature) {
  const t = c.ai.task
  c.ai.task = undefined
  if (t?.kind !== 'alarm') return
  const st = w.s.storyteller
  st.search ??= { at: turnOf(w) + TURNS_PER_HOUR, pos: t.pos }
}

/** 3~4명(두목 50%)이 흔적 지점으로, 플레이어 야영지가 가까우면 보관함까지 */
function sendSearchParty(w: World, cs: Creature[], map: MapState, pos: Pos, r: ReturnType<typeof rng>): Creature[] {
  const pressure=storyPressureQuote(w),rule=storyDirectorRule(w)?.search,controlled=!!pressure.state&&!!rule&&map===w.s.map
  const stash=map.waypoints?.homeStash,near=stash&&cheb(stash,pos)<=12?stash:undefined
  const place=placeEventRule(w,'Event.ReaverSearch'),camp=placeEventMembers(w,cs,'Event.ReaverSearch').filter((c) => !!placeRoute(w,map,'Event.ReaverSearch',c,pos,near)&&!c.unconscious && c.ai.mode !== 'hunt'&&(!controlled||!c.activity&&!c.captivity&&!c.caravan&&!c.roadRaid&&!c.ai.route?.length&&cheb(c.pos,c.home??map.waypoints![place?.origin.waypoint??'reaverCamp'])<=rule!.sourceRadius))
  if(!map.waypoints?.[place?.origin.waypoint??'reaverCamp']||camp.length<(place?.origin.minMembers??2))return []
  if(map===w.s.map&&!runPlaceEventWorker(w,'Event.ReaverSearch','canFire',camp.map(c=>c.id)))return []
  if(place&&place.chance<1&&!r.chance(place.chance))return []
  const chief = camp.find((c) => c.def === (place?.leader??'Creature.ReaverChief'))
  const others = r.shuffle(camp.filter((c) => c !== chief)),count=r.int(...(place?.count??[3,4]as [number,number])),ordinaryChief=!!chief&&r.chance(place?.leaderChance??.5)
  const party = others.slice(0,controlled?Math.min(count-(ordinaryChief?1:0),rule!.maxMembers-(ordinaryChief?1:0)):count)
  if(ordinaryChief)party.push(chief!)
  if(controlled&&chief&&!ordinaryChief&&!pressure.reason&&pressure.profile&&pressure.state){
    const cost=storyUnitCost(w,chief),fraction=r.int(...pressure.profile.spendPercent)
    if(pressure.state.budgetTenths>=cost*10&&pressure.state.budgetTenths*fraction>=cost*1000&&r.chance(pressure.chance/100)&&party.length>=1&&commitStoryPressure(w,cost)){
      if(party.length>=rule!.maxMembers)party.pop()
      party.push(chief);pressure.state.lastPurchase={kind:'search',at:turnOf(w),mapId:map.id,region:w.s.overworld?.currentRegion,cost,extraId:chief.id}
    }
  }
  if(controlled&&party.length<2)return []
  for (const c of party) {
    c.asleep = false
    c.ai.mode = 'patrol'
    c.ai.route = placeRoute(w,map,'Event.ReaverSearch',c,pos,near)
    c.ai.routeIdx = 0
    c.ai.waitUntil = undefined
    c.ai.path = undefined
    c.ai.task = { kind: 'search', pos, stash: near }
  }
  w.s.storyteller.history.push({ turn: turnOf(w), event: 'Event.ReaverSearch' })
  if(map===w.s.map){runPlaceEventWorker(w,'Event.ReaverSearch','execute',party.map(c=>c.id));scriptPlaceEvent(w,'Event.ReaverSearch',party.map(c=>c.id))}
  if (map === w.s.map) log(w, 'warn', '약탈자 야영지가 소란스럽다. 무리가 무장을 갖추고 나선다.')
  return party
}

/** 보관함 약탈: 가치 내림차순으로 1명당 2개 (10 §3.2) */
export function raidStash(w: World, c: Creature, map: MapState, stash: Pos): ItemInst[] {
  const t = map.tiles[stash.y * map.w + stash.x]
  const items = t.cont?.items ?? []
  const take = [...items].sort((a, b) => (itemDef(w, b).value ?? 0) * b.count - (itemDef(w, a).value ?? 0) * a.count).slice(0, 2)
  for (const it of take) {
    items.splice(items.indexOf(it), 1)
    addToInventory(w, c, { ...it, gx: undefined, gy: undefined })
  }
  if (take.length && map === w.s.map && canSee(w, player(w), c.pos)) log(w, 'danger', `${c.name}이(가) 야영지 보관함을 뒤져 ${take.map((i) => itemDef(w, i).label).join(', ')}을(를) 챙긴다!`)
  return take
}

/**
 * 지상을 비운 동안의 정산 (14 §9.2 6단계 · 10 §3.3 검산 2): 06:00마다 순찰 50%,
 * 켜진 모닥불 연기가 숲 개울에서 보이면(바람 아래) 수색대가 보관함을 턴다.
 */
export function settleSurfaceEvents(w: World, map: MapState, residents: Creature[], boundary: number, r: ReturnType<typeof rng>) {
  if (map.kind !== 'surface' || !map.waypoints) return
  const place=placeEventRule(w,'Event.ReaverPatrol'),camp=placeEventMembers(w,residents,'Event.ReaverPatrol')
  if(camp.length<(place?.origin.minMembers??PATROL_MIN_CAMP)||!r.chance(place?.chance??PATROL_CHANCE))return
  w.s.storyteller.history.push({ turn: boundary, event: 'Event.ReaverPatrol' })
  // 바람은 정산 시점마다 8방위 균등 (09)
  const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]
  const [wx, wy] = dirs[r.int(0, 7)]
  const saved = w.s.wind
  w.s.wind = { x: wx, y: wy }
  const seen = fireVisibleFrom(w, map, map.waypoints.stream)
  w.s.wind = saved
  if (!seen) return
  const party = sendSearchParty(w, residents, map, seen, r)
  const stash = map.waypoints.homeStash
  if (!stash) return
  for (const c of party) {
    c.ai.route = undefined
    c.ai.task = undefined
    c.ai.mode = 'guard'
    raidStash(w, c, map, stash)
  }
  if (party.length) w.s.storyteller.history.push({ turn: boundary, event: 'Event.StashRaided' })
}
