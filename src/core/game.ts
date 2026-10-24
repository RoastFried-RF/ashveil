import {calendar} from './climate-state'
import {seasonalActionTU} from './bear-state'
import {urgentCompanionAid} from './companion-aid'
import {wildlifeTick} from './wildlife'
import {flightTick} from './flight'
import{GAME_VERSION,DEF_SCHEMA_VERSION}from'./content-version'
import { IMPRINT_MODE, saveModeDef } from './save-modes'
import {markDormantCultivation,settleDormantCultivation} from './cultivation-dormant'
import {initializeScriptState,scriptDayTick} from './script-hooks'
import {cancelRansom} from './ransom'
import {initializeStoryDirector,storyDirectorTick} from './story-director'
import {sourceDefinitionsAvailable,sourceLivingCount} from './population-sources'
import {cultivationTick} from './cultivation'
import {observeNpcWorld} from './world-scouting'
import {terrainFireTick} from './terrain-fire'
import {observeBleeding} from './blood-observation'
import {rememberLifeEvent} from './life-memories'
import {npcPsycheTick,resolveNpcStress} from './npc-psyche'
import {cookingTick} from './cooking'
import {preservationTick} from './preservation'
import {inhalationTick} from './air'
import {boatFloodTick} from './boat-flood'
import {worldRaidsTick,packWorldRaids,encounterWorldRaids} from './world-raids'
import { caravanTick, encounterCaravans, convoyStoredPeople, packCaravans } from './caravans'
import { aquaticTick } from './aquatic'
import { beaconTick } from './beacons'
import { parasiteTick, releaseHostParasites } from './parasites'
import { initializeFieldDevices } from './field-devices'
import { kinshipTick } from './kinship'
import { cancelGearSwap } from './gear-swap'
import { machineRules } from './machine-state'
import { generateRegionLayout, layoutForMap } from './region-layout'
import { gearWeatherTick } from './gear-weather'
import { wetnessTick } from './thermal'
import { clothingBaseTurns, clothingPairPresent, markClothingProgress } from './lining-state'
import { expireCampfires } from './campfire'
import { baseDefenseTick, leaveBaseRaid } from './base-defense'
import { escortTick, travellingParty } from './prisoner-escort'
import { cancelRecruitment } from './recruitment'
import { companionBondTick } from './companion-bonds'
import { companionTick, partyTransitionError, placeParty } from './companions'
import { coldConfusionAction, coldConfusionTick } from './cold-confusion'
import { contractsTick } from './contracts'
import { delayResidentBedding } from './bedding-move'
import { cancelLesson } from './teaching'
import { knownCreatureName } from './bestiary-state'
import { delayResidentRest, initializeResidentRest, residentBedError } from './resident-rest'
import { wakeAfterSleep as wakeUp } from './sleep-state'
import { innSleepError } from './inn'
import { observeBestiary } from './bestiary'
import { drugEffects } from './drug-state'
import { pharmacologyTick } from './pharmacology'
import { applySettlementChanges, initializeWorldSimulation, worldSimulationDef, worldSimulationTick } from './world-simulation'
import {rumorNetworkTick} from './rumor-network'
import { diplomacyTick } from './diplomacy'
import { climateTick, initializeClimate } from './climate'
import { enterRegion, leaveRegion } from './journey'
import { enableOverworld } from './overworld'
import { prostheticTick } from './prosthetics'
import { waterTick } from './water'
// 게임 루프: TU 스케줄러 + 턴 단위 전역 처리 + 지도 전환(지상 ↔ 던전 층)

import { activityStep, interruptTreat, perform, type Action, hostile } from './actions'
import { aiDecide } from './ai'
import {observeNpcMap} from './npc-map-memory'
import {npcFireResponse} from './fire-avoidance'
import { capacity, bloodLoss, bodyTick, deathCause, healFracture, effectiveBleed, hpCap, painStage, painTotal, totalBleed } from './body'
import { killCreature } from './combat'
import { log, player, rng, START_TURN, turnOf, TU_PER_TURN, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import { createCreature, createPlayer } from './creatures'
import type { DefDatabase } from './defs'
import { nextWeatherBlock, weatherTick } from './environment'
import { canSee, invalidateLights, updatePlayerVision } from './fov'
import { cheb, eq, type Pos } from './geom'
import { addToInventory, allItems, equip, makeItem } from './items'
import { generateDungeon, generateSurface, sleepChance, type GenResult, type RoomType } from './mapgen'
import { needsTick, psycheTick } from './needs'
import { gearTick } from './gear-care'
import { campingTick } from './camping'
import {beddingFireTick} from './bedding-fire'
import {beddingLiceTick} from './bedding-lice'
import { diseaseTick, exposeDisease, frostbiteTick } from './conditions'
import { breakdownAction } from './psyche'
import { awardCrisis, gainXp } from './progression'
import { buildReport } from './report'
import { emitNoise, scentTick, sleepCycleDeep } from './perception'
import { RNG_STREAMS, Rng, seedState } from './rng'
import { autoSnap, autoStop } from './autostop'
import { nextActor } from './scheduler'
import { settleSurfaceEvents, storytellerTick } from './storyteller'
import { foodTick } from './food-safety'
import { completeHealing } from './recovery'
import { growthTick, regenerationPeriod } from './growth'
import { hungerStage, thirstStage } from './nutrition-state'
import { installLegacyResidents } from './legacy-residents'
import { hasEffect } from './traits'
import type { Activity, Creature, GameState, MapState, PillEffectDef, PopSource } from './types'

export const SAVE_VERSION = 212
export { START_TURN } from './ctx'

export interface NewGameOptions { saveMode?:string;scriptPreview?:boolean;seed: string; background?: string; mods?: string[]; characterRoll?: 0 | 1; storyteller?:string; overworld?: boolean;legacyResidents?:readonly import('./types').LegacyResident[] }

function emptyMap(): MapState {
  return { id: '', name: '', kind: 'surface', depth: 0, ambient: 0, w: 1, h: 1, tiles: [], exits: [], links: [], rooms: [], props: [], lights: [] }
}

function populate(w: World, gen: GenResult): Creature[] {
  const out: Creature[] = []
  for (const sp of gen.spawns) {
    const site=sp.settlementResident?w.s.overworld?.sites.find(s=>s.id===w.s.overworld?.currentRegion):undefined,pop=site&&w.s.overworld?.simulation?.settlements[site.id]?.population
    if(sp.settlementResident){
      if(!site||site.kind!=='settlement'||!pop||w.db.creature(sp.def).faction!==site.faction)continue
      const residents=new Set([...w.s.creatures,...Object.values(w.s.offCreatures).flat(),...convoyStoredPeople(w),...out].filter(c=>c.alive&&c.residentSite===site.id).map(c=>c.id))
      if(residents.size>=pop.S+pop.I+pop.R)continue
    }
    const c = createCreature(w, sp.def, sp.pos)
    c.asleep = !!sp.asleep
    if (sp.asleep && sp.deep) c.deepSleep = true
    c.home = sp.home ? { ...sp.home } : { ...sp.pos }
    c.mapId = gen.map.id
    if(site&&pop&&sp.settlementResident){c.residentSite=site.id;if(pop.I&&rng(w,`world.resident-health.${site.id}`).chance(pop.I/pop.total))exposeDisease(w,c,worldSimulationDef(w).disease.def,1)}
    if (sp.room !== undefined) {
      c.room = sp.room
      const R = gen.map.rooms[sp.room]
      if (R) (R.residents ??= []).push(sp.def)
    }
    out.push(c)
  }
  return out
}

export function newGame(db: DefDatabase, opts: NewGameOptions): GameState {
  const mode = saveModeDef(db, opts.saveMode)
  const records=db.modManifest()
  const rngState: GameState['rng'] = {}
  for (const s of RNG_STREAMS) rngState[s] = seedState(opts.seed, s)
  const s: GameState = {
    version: SAVE_VERSION,
    ...(mode.id !== IMPRINT_MODE ? { saveMode: mode.id } : {}),
    ...(!mode.achievements ? { achievementsDisabled: true } : {}),
    gameVersion:GAME_VERSION,
    defSchemaVersion:DEF_SCHEMA_VERSION,
    ...(records?{contentMods:records}:{}),
    loadHash:db.loadHash,
    contentDefinitions:db.definitionManifest(),
    contentItemShapes:db.itemShapeManifest(),
    contentRecipeContracts:db.recipeContractManifest(),
    seed: opts.seed,
    mods: [...(opts.mods ?? db.loadedMods)],
    time: START_TURN * TU_PER_TURN,
    rng: rngState,
    map: emptyMap(),
    maps: {},
    offCreatures: {},
    creatures: [],
    playerId: -1,
    nextId: 1,
    log: [],
    weather: 'overcast',
    weatherUntil: nextWeatherBlock(START_TURN),
    wind: { x: 1, y: 0 },
    storyteller: { budget: 0, lastEventTurn: START_TURN, history: [] },
    sources: initialSources(),
    knowledge: { pillMap: {}, pillKnown: {}, bestiary: {} },
    visible: [],
    noiseEvents: [],
    fx: [],
  }
  const w: World = { db, s }
  const gen = generateSurface(w,{scriptPreview:opts.scriptPreview})
  s.map = gen.map
  const pills = db.all('Item').filter((d) => (d as { unidentified?: string }).unidentified === 'pill').map((d) => d.id).sort()
  const effects = db.all<PillEffectDef>('PillEffect').map((e) => e.id).sort()
  const shuffled = new Rng(seedState(opts.seed, 'pills')).shuffle([...effects])
  pills.forEach((p, i) => { s.knowledge.pillMap[p] = shuffled[i % shuffled.length] })

  const pl = createPlayer(w, gen.start, opts.background, opts.characterRoll)
  pl.mapId = gen.map.id
  s.playerId = pl.id
  s.creatures.push(pl, ...populate(w, gen))
  const camp=s.sources!.find(source=>source.id==='reaverCamp')!
  camp.members=s.creatures.filter(c=>c.faction===db.creature(camp.species).faction).map(c=>c.id)
  camp.count=sourceLivingCount(w,camp,s.creatures)
  initializeFieldDevices(w)
  if (opts.overworld) { enableOverworld(w); initializeClimate(w); initializeWorldSimulation(w) }
  installLegacyResidents(w,opts.legacyResidents)
  updatePlayerVision(w, pl)
  observeBestiary(w,false)
  initializeStoryDirector(w,opts.storyteller)
  log(w, 'flavor', '잿빛 수도원 앞뜰. 해가 지고 있다. 장막 너머로 붉은 빛이 꺼져 간다.')
  log(w, 'info', `당신은 ${pl.name}, ${db.background(pl.background!).label}. 특성: ${pl.traits.map((t) => db.trait(t).label).join(', ')}.`)
  log(w, 'info', '북쪽 무너진 수도원 아래 납골당. 그 바닥에 무엇이 있는지 아무도 돌아와 말해주지 않았다. (? 키: 조작법)')
  if(!opts.scriptPreview)initializeScriptState(w)
  return s
}

/** 지도 전환: 현재 지도·생물은 정지 보관, 대상 지도를 (없으면 생성해) 불러온다 */
export function changeMap(w: World, toId: string) {
  const s = w.s
  const pl = player(w)
  const fromId = s.map.id
  const party=travellingParty(w)
  markCleared(w, s.map, s.creatures)
  // 따라오기 (14 §8): 플레이어를 추적 중이고 인접한 적. 사기 ≥ 40 (사기 없는 종은 항상).
  // 그늘 사람은 지상으로 나오지 않고, 융합체는 대성소를 떠나지 않는다
  const followers = s.creatures.filter((c) => {
    if (!c.alive || c.id === pl.id || c.asleep || c.unconscious || !hostile(w, c, pl)) return false
    if (c.ai.mode !== 'hunt' || c.ai.target !== pl.id || cheb(c.pos, pl.pos) > 1) return false
    if (c.def === 'Creature.Amalgam') return false
    if (toId === 'surface' && (c.def === 'Creature.Shade' || c.def === 'Creature.ShadeChief')) return false
    const noMorale = c.def === 'Creature.Withered' || c.def === 'Creature.WitheredPriest' || c.def === 'Creature.SporeMan'
    return noMorale || c.ai.morale >= 40
  })
  const partyError=partyTransitionError(w,toId,followers);if(partyError)return partyError
  packCaravans(w,party)
  packWorldRaids(w,party)
  for(const c of followers)leaveBaseRaid(w,c)
  // 시체는 남는다 (증거·뼈, 14 §9.2) — 지우지 않는다
  s.offCreatures[fromId] = s.creatures.filter((c) => c.id !== pl.id && !followers.includes(c)&&!party.includes(c))
  s.maps[fromId] = s.map
  markDormantCultivation(w,s.map)
  ;(s.map as MapState & { leftAt?: number }).leftAt = turnOf(w)
  let target = s.maps[toId]
  let firstVisit = false
  if (!target) {
    const layout=layoutForMap(w,toId)
    const gen = layout?generateRegionLayout(w,layout):toId === 'surface' ? generateSurface(w) : generateDungeon(w, Number(toId.replace('crypt', '')))
    target = gen.map
    s.offCreatures[toId] = populate(w, gen)
    firstVisit = true
  }
  delete s.maps[toId]
  s.map = target
  initializeFieldDevices(w)
  if (s.overworld) target.worldCell = { ...s.overworld.position }
  invalidateLights(w)
  const arrival = target.links.find((l) => l.to === fromId)?.pos ?? { x: 1, y: 1 }
  const others = s.offCreatures[toId] ?? []
  delete s.offCreatures[toId]
  // 재진입 정산 (14 §9.2): 일 단위 과정만 — 공급원 회복, 정리된 방 재점거
  const leftAt = (target as MapState & { leftAt?: number }).leftAt
  if (!firstVisit && leftAt !== undefined) settleReentry(w, target, others, leftAt)
  s.creatures = [pl, ...others]
  for (const c of others) c.nextAct = Math.max(c.nextAct, s.time)
  pl.pos = freeNear(w, arrival)
  pl.mapId = toId
  pl.nextAct = s.time + TU_PER_TURN // 계단 1턴
  const layoutRest=target.layout&&w.db.get<import('./types').RegionLayoutDef>(target.layout).residentRest,local=layoutRest?s.overworld?.sites.find(site=>site.id===s.overworld?.currentRegion):undefined
  if(local?.kind==='settlement')initializeResidentRest(w,local)
  if(party.length)placeParty(w,[...party,...followers],pl.pos)
  else{
  for (const f of followers) {
    s.creatures.push(f)
    f.pos = freeNear(w, pl.pos, true)
    f.mapId = toId
    f.room = undefined
    f.home = undefined
    f.ai.path = undefined
    f.nextAct = s.time + TU_PER_TURN
  }
  }
  const goingUp = target.depth < (s.maps[fromId]?.depth ?? 0)
  if (followers.length) log(w, 'danger', `${followers.map((f) => knownCreatureName(w,f)).join(', ')}이(가) 계단을 따라 ${goingUp ? '올라왔다' : '내려왔다'}!`)
  s.loot = undefined
  s.visible = []
  updatePlayerVision(w, pl)
  observeBestiary(w,false)
  log(w, 'info', `${target.name}${target.kind === 'dungeon' ? ' — 축축한 냉기와 썩은 향 냄새.' : '. 바깥 공기다.'}`)
  // 골절을 안고 층을 빠져나감 20 (15 §3)
  if (pl.body.wounds.some((wd) => wd.fracture)) awardCrisis(w, pl, 'fracture', 20, '부러진 뼈를 안고 층을 빠져나왔다')
  // 층 첫 진입 25 · 50 · 100 (15 §3)
  if (firstVisit && target.kind === 'dungeon') gainXp(w, pl, [0, 25, 50, 100][target.depth] ?? 100, target.name)
}

function freeNear(w: World, p: Pos, avoidPlayer = false): Pos {
  for (let r = 0; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const q = { x: p.x + dx, y: p.y + dy }
    if (q.x < 0 || q.y < 0 || q.x >= w.s.map.w || q.y >= w.s.map.h) continue
    if (!w.db.terrain(w.s.map.tiles[q.y * w.s.map.w + q.x].t).passable) continue
    if (w.s.creatures.some((c) => c.alive && eq(c.pos, q) && (avoidPlayer || c.id !== w.s.playerId))) continue
    return q
  }
  return p
}

/** 잠드는 때의 영양 단계. 단계가 나빠지면 강제로 깬다. */
function sleepStart(w: World, c: Creature) {
  return { fatigue: c.needs.fatigue, debt: c.needs.sleepDebt ?? 0, hunger: hungerStage(w, c), thirst: thirstStage(w, c), wet: c.needs.wetness }
}

function isSleeping(c: Creature) {
  return c.activity?.kind === 'sleep'
}

/** 새 방 발견: 방 내부 칸의 50% 이상을 처음 본 순간 경험치 5 (15 §3 · 14 §11) */
function discoverRoom(w: World, pl: Creature) {
  const m = w.s.map
  for (const R of m.rooms) {
    if (R.discovered) continue
    let seen = 0
    for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) if (m.tiles[y * m.w + x].seen) seen++
    if (seen * 2 < R.w * R.h) continue
    R.discovered = true
    if (R.type === 'entry') continue
    if(!pl.asleep&&!pl.unconscious&&capacity(w,pl,'sight')>0&&w.s.visible.some(i=>{const x=i%m.w,y=Math.floor(i/m.w);return x>=R.x&&x<R.x+R.w&&y>=R.y&&y<R.y+R.h}))rememberLifeEvent(w,pl,'discovery',{roomType:R.type})
    log(w, 'info', `${R.name}을(를) 찾았다.`)
    gainXp(w, pl, 5, R.name)
  }
}

/** 턴 경계마다 1회: 모든 생물의 신체·생존, 날씨, 사건 */
function globalTurnTick(w: World) {
  const turn = turnOf(w)
  const m = w.s.map
  scriptDayTick(w)
  cookingTick(w)
  preservationTick(w)
  expireCampfires(w)
  if (m.sporesExpire !== undefined && turn >= m.sporesExpire) {
    m.sporesExpire = undefined
    for (const t of m.tiles) if (t.spores) {
      if (t.spores.until <= turn) t.spores = undefined
      else m.sporesExpire = Math.min(m.sporesExpire ?? t.spores.until, t.spores.until)
    }
    invalidateLights(w)
  }
  kinshipTick(w)
  diplomacyTick(w)
  worldSimulationTick(w)
  rumorNetworkTick(w)
  contractsTick(w)
  if (turn % TURNS_PER_DAY === 6 * TURNS_PER_HOUR) applySettlementChanges(w)
  weatherTick(w)
  boatFloodTick(w)
  caravanTick(w)
  worldRaidsTick(w)
  beaconTick(w)
  climateTick(w)
  cultivationTick(w)
  storyDirectorTick(w)
  gearWeatherTick(w)
  foodTick(w)
  waterTick(w)
  if (turn % 200 === 0) campingTick(w)
  beddingFireTick(w)
  terrainFireTick(w)
  const sources = (w.s.sources ??= initialSources())
  if ((!w.s.overworld || w.s.overworld.currentRegion === 'Region.GreyCloister') && !sources.some((s) => s.id === 'reaverCamp')) sources.push(initialSources()[0])
  const all = [...w.s.creatures, ...Object.values(w.s.offCreatures).flat(),...convoyStoredPeople(w)]
  for (const source of sources) if (source.deployed) source.count = sourceLivingCount(w,source,all)
  for (const c of w.s.creatures) {
    if (!c.alive) { flightTick(w,c);releaseHostParasites(w,c); wetnessTick(w,c,false); gearTick(w, c); if(!machineRules(w,c))scentTick(w, c, 0); continue }
    const sleeping = isSleeping(c) || !!c.asleep
    if(machineRules(w,c)){gearTick(w,c);bodyTick(w,c,false)}else{
    prostheticTick(w, c)
    growthTick(w, c)
    needsTick(w, c, sleeping)
    wildlifeTick(w,c)
    flightTick(w,c)
    diseaseTick(w, c, sleeping)
    aquaticTick(w,c)
    inhalationTick(w,c)
    parasiteTick(w,c)
    observeBleeding(w,c)
    bodyTick(w, c, sleeping)
    if(!c.alive)releaseHostParasites(w,c)
    pharmacologyTick(w, c)
    frostbiteTick(w, c)
    coldConfusionTick(w,c)
    companionTick(w,c)
    companionBondTick(w,c)
    if(c.faction!=='player'&&npcPsycheTick(w,c))stopActivity(w,c)
    if (c.faction === 'player') {
      const wasBreaking = c.breakdown
      psycheTick(w, c)
      if (!wasBreaking && c.breakdown) stopActivity(w, c)
      crisisTick(w, c)
    }
    }
    for (const it of allItems(c)) {
      if (it.lit && it.fuel !== undefined) {
        it.fuel--
        if (it.fuel <= 0) {
          it.lit = false
          if (c.faction === 'player') log(w, 'warn', '등불의 기름이 다 떨어졌다. 어둠이 덮친다.')
        }
      }
    }
    // 포자 구름 칸: 머문 턴당 기력 −2, 기침(소음 4) — 포자 인간·융합체는 영향 없음 (07 §11)
    const sp = w.s.map.tiles[c.pos.y * w.s.map.w + c.pos.x].spores
    if (sp && sp.until > turn && !machineRules(w,c) && !c.def.startsWith('Creature.SporeMan') && c.def !== 'Creature.Amalgam') {
      c.needs.energy = Math.max(0, c.needs.energy - 2)
      emitNoise(w, c.pos, 4, c.id)
      if (c.faction === 'player' && turn % 5 === 0) log(w, 'warn', '포자 구름 속이다. 기침이 멎지 않고 숨이 가쁘다.')
    }
    const micro = c.effects.some((e) => e.kind === 'microsleep')
    c.effects = c.effects.filter((e) => e.untilTurn > turn)
    if (micro && !hasEffect(c, 'microsleep', turn)) { c.asleep = false; c.drowsyUntil = turn + 10; c.lastWokeAt = turn }
    const cause = deathCause(w, c)
    if (cause) {
      if (c.faction === 'player') c.history.push({ turn, kind: 'death', text: `사망: ${cause}` })
      killCreature(w, c, cause)
    }
    c.exerted = false
  }
  beddingLiceTick(w)
  if (turn % 600 === 0) {
    // 오래된 시체는 치운다. 남은 소지품은 그 자리 바닥으로
    w.s.creatures = w.s.creatures.filter((c) => {
      if (c.alive || c.parasites?.length || c.body.machine || c.id === w.s.playerId || turn - (c.deathTurn ?? turn) < CORPSE_DAYS * TURNS_PER_DAY) return true
      const t = w.s.map.tiles[c.pos.y * w.s.map.w + c.pos.x]
      for (const it of allItems(c)) t.items.push({ ...it, gx: undefined, gy: undefined, rot: undefined })
      if(!machineRules(w,c)&&w.db.body(c.body.def).kind!=='invertebrate')t.items.push(makeItem(w, 'Item.Bones'))
      return false
    })
  }
  if (turn % TURNS_PER_HOUR === 0) for (const t of w.s.map.tiles) if (t.blood) t.blood = t.blood * BLOOD_DRY_PER_HOUR < 1 ? 0 : t.blood * BLOOD_DRY_PER_HOUR
  baseDefenseTick(w)
  storytellerTick(w)
  observeBestiary(w)
  w.s.noiseEvents = w.s.noiseEvents.filter((n) => turn - n.turn < 2)
}

function advanceTo(w: World, targetTU: number) {
  while (Math.floor(targetTU / TU_PER_TURN) > Math.floor(w.s.time / TU_PER_TURN)) {
    w.s.time = (Math.floor(w.s.time / TU_PER_TURN) + 1) * TU_PER_TURN
    globalTurnTick(w)
    if (w.s.over) return
    const pl = player(w)
    if (!pl.alive) { finish(w, 'death', pl.deathCause ?? '알 수 없음'); return }
  }
  w.s.time = Math.max(w.s.time, targetTU)
}

function finish(w: World, kind: 'death' | 'escape', cause: string) {
  const pl = player(w)
  w.s.over = { kind, turn: turnOf(w), report: buildReport(w, pl, kind, cause) }
  if (kind === 'death') log(w, 'danger', `당신은 죽었다. (${cause})`)
}

function visibleHostileIds(w: World, pl: Creature): Set<number> {
  return new Set(w.s.creatures.filter((o) => o.alive && !o.asleep && hostile(w, pl, o) && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos)).map((o) => o.id))
}

function interrupted(w: World, pl: Creature): string | null {
  const act = pl.activity
  if (!act) return null
  if (act.kind === 'sleep') {
    if (!act.drugSleep && residentBedError(w, pl)) return '이 침대를 사용할 수 없다.'
    if (!act.drugSleep && innSleepError(w, pl)) return '침대 대여 시간이 끝났다.'
    // 수면 주기 (01 §8): 눈을 감고 있으니 적을 '보고' 깨지는 않는다. 소리(각성 임계)·피해·몸 신호로만 깬다
    const s0 = (act.sleep0 ??= sleepStart(w, pl))
    pl.deepSleep = sleepCycleDeep(w, act.elapsed ?? 0, s0.fatigue, s0.debt ?? pl.needs.sleepDebt ?? 0) || undefined
    if (pl.body.wounds.length > (act.woundCount ?? pl.body.wounds.length)) return '공격받았다!'
    if (act.wokeBy) return act.wokeBy
    if ((act.elapsed ?? 0) > 0) {
      if(act.seasonalSleep&&calendar(w).season.id!==act.seasonalSleep.season)return '겨울잠의 계절이 끝났다.'
      if (!act.drugSleep && !act.seasonalSleep && pl.needs.fatigue <= (act.wakeFatigue ?? 2) && (pl.needs.sleepDebt ?? 0) === 0) return '개운하게 깼다.'
      if (pl.needs.bodyTemp < 35) return '추위에 잠이 깼다.'
      if (pl.needs.bodyTemp > 40.5) return '열기에 잠이 깼다.'
      if (painStage(painTotal(w, pl)) >= 5) return '통증에 잠이 깼다.'
      if (pl.needs.wetness >= s0.wet + 20) return '몸이 젖어 잠이 깼다.'
      const now = sleepStart(w, pl)
      if (now.hunger > s0.hunger) return '배가 고파 잠이 깼다.'
      if (now.thirst > s0.thirst) return '목이 말라 잠이 깼다.'
    }
    return null
  }
  // 휴식·채널 행동은 자동 모드: T1~T6 (01 §6.2). 처치·압박 중에는 신체 변화로 끊지 않는다
  if (!act.snap) return null
  const why = autoStop(w, act.snap, { skipBody: act.kind === 'careWait' || act.kind === 'treat' || act.kind === 'press' || act.kind === 'medicate' })
  if (why) w.s.autoStopTurn = turnOf(w)
  return why && (why.endsWith('다') ? why + '!' : why)
}

/** 플레이어 입력이 필요할 때까지 시뮬레이션 진행 */
export function runUntilInput(w: World, maxSteps = 300000, untilTU?: number) {
  if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new Error('진행 예산은 양의 정수여야 한다')
  for (let i = 0; i < maxSteps; i++) {
    if (w.s.over) { w.s.simulationPending = undefined; return }
    const actor = nextActor(w)
    if (!actor) { w.s.simulationPending = undefined; return }
    if (untilTU !== undefined && actor.nextAct > untilTU) {
      advanceTo(w, Math.max(w.s.time, untilTU))
      w.s.simulationPending = w.s.over ? undefined : true
      return
    }
    advanceTo(w, actor.nextAct)
    if (w.s.over) { w.s.simulationPending = undefined; return }
    if (!actor.alive||!w.s.creatures.includes(actor)) continue
    const turn = turnOf(w)
    escortTick(w,actor)
    if (actor.unconscious || hasEffect(actor, 'microsleep', turn) || hasEffect(actor, 'panic', turn) || hasEffect(actor, 'stunned', turn) || hasEffect(actor, 'knockedDown', turn)) {
      actor.nextAct += TU_PER_TURN
      continue
    }
    observeNpcMap(w,actor)
    observeNpcWorld(w,actor)
    if(actor.faction!=='player'&&resolveNpcStress(w,actor))stopActivity(w,actor)
    const coldAction=coldConfusionAction(w,actor)
    if(coldAction){
      if(actor.asleep)wakeUp(w,actor)
      stopActivity(w,actor)
      const result=perform(w,actor,coldAction)
      if(result.ok){
        if(actor.activity)actor.activity.label=`저체온 혼란 · ${actor.activity.label}`
      }
      actor.history.push({turn,kind:'cold',text:'덥다는 착각에 외투를 벗으려 했다.'})
      if(actor.id===w.s.playerId)log(w,'danger',result.ok?'덥다는 착각이 들었다. 저체온 혼란에 외투를 벗으려 한다.':'덥다는 착각에 외투를 벗으려 했지만 몸을 움직이기 어렵다.')
      actor.nextAct+=result.ok&&actor.activity?result.tu:Math.max(100,result.tu);continue
    }
    if (actor.id === w.s.playerId) {
      encounterCaravans(w)
      encounterWorldRaids(w)
      discoverRoom(w, actor)
      const forced = breakdownAction(w, actor)
      if (forced) {
        const res = perform(w, actor, forced)
        updatePlayerVision(w, actor)
        actor.nextAct += Math.max(100, res.tu)
        continue
      }
      if (actor.activity) {
        const why = interrupted(w, actor)
        if (why) {
          log(w, 'warn', `${actor.activity.label} 중단: ${why}`)
          if (actor.activity.kind === 'sleep') { wakeUp(w, actor) }
          stopActivity(w, actor)
          updatePlayerVision(w, actor)
          w.s.simulationPending = undefined
          return
        }
        const kind = actor.activity.kind
        const done = activityStep(w, actor)
        actor.nextAct += TU_PER_TURN
        if (!actor.alive) { finish(w, 'death', actor.deathCause ?? '알 수 없음'); w.s.simulationPending = undefined; return }
        if (done) {
          if (kind === 'sleep') { wakeUp(w, actor) }
          // 끝난 행동의 마지막100TU와 그 사이 NPC 차례까지 정산한 뒤 다음 플레이어 차례에서 입력을 받는다.
          continue
        }
        if (turn % 10 === 0) updatePlayerVision(w, actor)
        continue
      }
      updatePlayerVision(w, actor)
      w.s.simulationPending = undefined
      return
    }
    // NPC 채널 행동 (조준 사격 등): 맞으면 끊긴다
    const fireResponse=npcFireResponse(w,actor)
    if(fireResponse){
      stopActivity(w,actor);actor.ai.path=undefined
      const result=perform(w,actor,fireResponse)
      actor.nextAct+=result.ok?Math.max(TU_PER_TURN,result.tu):TU_PER_TURN
      continue
    }
    if(urgentCompanionAid(w,actor))stopActivity(w,actor)
    if (actor.activity) {
      if (actor.activity.kind === 'sleep') {
        const why = interrupted(w, actor)
        if (why) { wakeUp(w, actor); stopActivity(w, actor); if (actor.residentSite && !['익숙한 소리에 잠이 깼다.','배가 고파 잠이 깼다.','목이 말라 잠이 깼다.'].includes(why)) delayResidentRest(w, actor); actor.nextAct += seasonalActionTU(w,actor,TU_PER_TURN); continue }
      }
      if (actor.body.wounds.length > (actor.activity.woundCount ?? actor.body.wounds.length)) stopActivity(w, actor)
      else {
        const kind = actor.activity.kind, done = activityStep(w, actor)
        if (done && kind === 'sleep') { wakeUp(w, actor) }
        actor.nextAct += seasonalActionTU(w,actor,TU_PER_TURN)
        continue
      }
    }
    let res = perform(w, actor, aiDecide(w, actor))
    // 동시성 충돌(01 §3.5): 먼저 처리된 쪽이 칸을 차지하면 같은 TU 안에서 1회만 다시 계획
    if (!res.ok) { actor.ai.path = undefined; res = perform(w, actor, aiDecide(w, actor)) }
    actor.nextAct += seasonalActionTU(w,actor,res.ok ? Math.max(30, res.tu) : TU_PER_TURN)
  }
  w.s.simulationPending = true
}

/** 플레이어 행동 1회 + 다음 입력까지 진행. 반환: 실패 메시지 */
export function playerAct(w: World, action: Action, maxSteps?: number, untilTU?: number): string | null {
  if (action.type === 'stopActivity' && !w.s.over) {
    if (player(w).activity?.drugSleep && drugEffects(w, player(w)).sedated) return '약기운 때문에 스스로 깨어날 수 없다'
    stopActivity(w, player(w)); advanceInput(w, maxSteps, untilTU); return null
  }
  if (w.s.simulationPending) return '시간이 흐르는 중이다'
  if (w.s.over) return '게임이 끝났다'
  const pl = player(w)
  if (pl.activity) stopActivity(w, pl)
  const res = perform(w, pl, action)
  if (!res.ok) {
    if (res.msg) log(w, 'info', res.msg)
    return res.msg ?? '할 수 없다'
  }
  if (res.msg === 'leave') {
    if (w.s.overworld) { const error=leaveRegion(w, markCleared);if(error)return error; advanceInput(w, maxSteps, untilTU); return null }
    finish(w, 'escape', '탈출')
    return null
  }
  if (res.msg === 'enterRegion') {
    const error = enterRegion(w, populate, settleReentry)
    if (error) return error
    advanceInput(w, maxSteps, untilTU); return null
  }
  if (res.msg === 'stairs') {
    const link = w.s.map.links.find((l) => eq(l.pos, pl.pos))!
    changeMap(w, link.to)
    // 계단도 1턴이다: 따라온 적이 먼저 움직일 수 있다 (계단 왕복으로 시간을 멈추지 못하게)
    advanceInput(w, maxSteps, untilTU)
    return null
  }
  const act = pl.activity as Activity | undefined
  if (act) {
    act.seenHostiles = [...visibleHostileIds(w, pl)]
    act.woundCount = pl.body.wounds.length
    act.snap = autoSnap(w)
  }
  pl.nextAct += res.tu
  if (res.tu > 0 || act) advanceInput(w, maxSteps, untilTU)
  else updatePlayerVision(w, pl)
  return null
}

function advanceInput(w: World, maxSteps?: number, untilTU?: number) {
  runUntilInput(w, maxSteps, untilTU)
  if (maxSteps === undefined) while (w.s.simulationPending && (untilTU === undefined || w.s.time < untilTU)) runUntilInput(w, undefined, untilTU)
}

/** 위기 극복 감시 (15 §3): 동맥 지혈 30 · 실혈 30% 후 출혈 정지 30 · 기절 후 100턴 생존 30 · 감염 경주 승리 40 */
function crisisTick(w: World, pl: Creature) {
  const cw = (pl.crisis ??= { last: {}, arterial: [], bleeding: false, wasUnconscious: false })
  const turn = turnOf(w)
  const arterialNow = pl.body.wounds.filter((wd) => wd.arterial && (wd.artery ?? 0) > 0 && effectiveBleed(w, pl, wd) > 0).map((wd) => wd.id)
  if (cw.arterial.some((id) => !arterialNow.includes(id))) awardCrisis(w, pl, 'arterial', 30, '동맥 출혈을 멈췄다')
  cw.arterial = arterialNow
  const bleed = totalBleed(w, pl)
  if (cw.bleeding && bleed <= 0 && bloodLoss(pl) >= 0.3) awardCrisis(w, pl, 'bloodloss', 30, '피를 쏟고도 출혈을 모두 막았다')
  cw.bleeding = bleed > 0
  if (cw.wasUnconscious && !pl.unconscious) cw.wokeAt = turn
  cw.wasUnconscious = pl.unconscious
  if (cw.wokeAt !== undefined && turn - cw.wokeAt >= 100) {
    cw.wokeAt = undefined
    awardCrisis(w, pl, 'woke', 30, '정신을 잃었다가 살아남았다')
  }
  if (cw.infectionWon) {
    cw.infectionWon = false
    awardCrisis(w, pl, 'infection', 40, '감염과의 경주에서 이겼다')
  }
}

/** 채널 끊기 (01 §7): 착탈은 반쯤 입은 상태, 부목은 절반 보존, 조준 사격은 기력 절반 환급 */
export function stopActivity(w: World, c: Creature) {
  const act = c.activity
  if (!act) return
  if(act.kind==='ransom'||act.kind==='ransomWait'){cancelRansom(w,c);return}
  if(act.kind==='gearSwap'){cancelGearSwap(w,c,act);c.activity=undefined;return}
  if (act.kind === 'sleep' && (c.asleep || c.sleepObservation)) wakeUp(w, c)
  if(act.kind==='packFurniture'&&c.residentSite)delayResidentBedding(w,c)
  cancelLesson(w, c)
  cancelRecruitment(w,c)
  halfEquip(w, c)
  interruptTreat(w, c)
  if (act.kind === 'aim' && act.abilityId) {
    c.needs.energy += Math.floor((w.db.ability(act.abilityId).energy ?? 0) / 2)
    if (c.faction === 'player') log(w, 'warn', '조준이 흐트러졌다. (기력 절반 환급)')
  }
  c.activity = undefined
}

/** 입다가 끊기면 반쯤 걸친 채로 남는다: 방어·단열 50% (13 §6.1) */
function halfEquip(w: World, c: Creature) {
  const act = c.activity
  if(!act||(act.elapsed??0)<=0||!clothingPairPresent(w,c,act))return
  if(act.kind==='unequip'&&act.slot){
    const worn=c.equip[act.slot]
    if(worn&&worn.uid===act.uid){
      const total=Math.max(1,act.total??act.remaining+(act.elapsed??0)),base=act.gearWork??w.db.item(worn.def).equipTurns?.[1]??1
      markClothingProgress(c,worn,act,'unequip',base*Math.max(0,act.remaining)/total,clothingBaseTurns(w,c,worn,'unequip',act.slot))
      if(c.id===w.s.playerId)log(w,'warn',`${w.db.item(worn.def).label}을(를) 반쯤 벗은 채 멈췄다. (방어·단열50%)`)
    }
    return
  }
  if (act.kind !== 'equip' || act.uid === undefined) return
  const it = allItems(c).find((i) => i.uid === act.uid)
  if(!it)return
  const original=clothingBaseTurns(w,c,it,'equip',act.slot)
  if(equip(w,c,act.uid,act.slot,false))return
  markClothingProgress(c,it,act,'equip',(act.gearWork??w.db.item(it.def).equipTurns?.[0]??1)*Math.max(0,act.remaining)/Math.max(1,act.total??act.remaining+(act.elapsed??0)),original)
  if(c.id===w.s.playerId)log(w, 'warn', `${w.db.item(it.def).label}을(를) 반쯤 걸친 채 멈췄다. (방어 50%)`)
}

// ── 재점거 (14 §9.3 · §9.4, CANON D20) ─────────────────────

export const REOCCUPY_GRACE_DAYS = 3
export const REOCCUPY_CHANCE = 0.15
const DAY_BOUNDARY_HOUR = 6

export function initialSources(): PopSource[] {
  return [
    { id: 'reaverCamp', label: '약탈자 야영지', species: 'Creature.Reaver', count: 6, cap: 8, regenDays: Number.MAX_SAFE_INTEGER, floors: ['surface'], lastRegenDay: 0, deployed: true },
    { id: 'conduit', label: '관로 하단', species: 'Creature.Shade', count: 18, cap: 24, regenDays: 4, floors: ['crypt1', 'crypt2'], lastRegenDay: 0 },
    { id: 'pilgrims', label: '순례길', species: 'Creature.SporeMan', count: 4, cap: 6, regenDays: 7, floors: ['crypt1', 'crypt3'], lastRegenDay: 0 },
    { id: 'ward', label: '납골당 병동', species: 'Creature.Withered', count: 0, cap: 4, regenDays: 10, floors: ['crypt2', 'crypt3'], lastRegenDay: 0, needsAlive: 'Creature.Amalgam' },
  ]
}

/** 방 거주자 전원이 사망·도주·항복했고 플레이어가 그 방을 봤으면 '정리됨' */
export function markCleared(w: World, map: MapState, creatures: Creature[]) {
  const turn = turnOf(w)
  map.rooms.forEach((R, i) => {
    if (!R.residents?.length || R.clearedAt !== undefined || !R.discovered) return
    const holding = creatures.some((c) => c.room === i && c.alive && c.ai.mode !== 'surrender' && c.faction !== 'player')
    if (!holding) R.clearedAt = turn
  })
}

function bossAlive(w: World, defId: string): boolean {
  const all = [...w.s.creatures, ...Object.values(w.s.offCreatures).flat(),...convoyStoredPeople(w)]
  return all.some((c) => c.def === defId && c.alive)
}

/** 06:00 경계마다: 공급원 회복 → 유예가 끝난 정리된 방마다 15% 재점거 */
export function settleReentry(w: World, map: MapState, residents: Creature[], leftAt: number) {
  const s = w.s
  const sources = (s.sources ??= initialSources())
  const r = rng(w, w.s.overworld ? `world.settle.${w.s.overworld.currentRegion}.${map.id}` : 'story')
  const now = turnOf(w)
  const elapsed = now - leftAt
  settleDormantCultivation(w,map,leftAt)
  markCleared(w, map, residents)
  // 포자 구름도 턴 단위 과정이라 층과 함께 정지한다.
  for (const t of map.tiles) if (t.spores) t.spores.until += elapsed
  if (map.sporesExpire !== undefined) map.sporesExpire += elapsed
  expireCampfires(w,map)
  // 1) 불씨: 바닥에 둔 켜진 등불은 연료가 탄다
  for (const t of map.tiles) for (const it of t.items) {
    if (!it.lit || it.fuel === undefined) continue
    it.fuel = Math.max(0, it.fuel - elapsed)
    if (it.fuel <= 0) it.lit = false
  }
  // 2) 부패: 핏자국은 12시간에 마른다, 시체는 5일 뒤 뼈만 남는다(소지품은 그 자리 바닥으로)
  let dry = 1
  for (let h = 0; h < Math.min(200, Math.floor(elapsed / TURNS_PER_HOUR)); h++) dry *= BLOOD_DRY_PER_HOUR
  for (const t of map.tiles) if (t.blood) t.blood = t.blood * dry < 1 ? 0 : t.blood * dry
  for (let i = residents.length - 1; i >= 0; i--) {
    const c = residents[i]
    if (c.alive || c.parasites?.length || now - (c.deathTurn ?? now) < CORPSE_DAYS * TURNS_PER_DAY) continue
    const t = map.tiles[c.pos.y * map.w + c.pos.x]
    for (const it of allItems(c)) t.items.push({ ...it, gx: undefined, gy: undefined, rot: undefined })
    if(w.db.body(c.body.def).kind!=='invertebrate')t.items.push(makeItem(w, 'Item.Bones'))
    residents.splice(i, 1)
  }
  // 3) 치유: 출혈 중이 아닌 상처는 경과 일수만큼 아문다 (02 §13, 무처치 0.6 · 휴식 1.2)
  const days = elapsed / TURNS_PER_DAY
  for (const c of residents) {
    if (!c.alive) continue
    // 전투 시계는 층과 함께 정지한다. 절대 시각으로 저장한 기한을 경과만큼 옮긴다.
    c.nextAct += elapsed * TU_PER_TURN
    if (c.breakdown) c.breakdown.until += elapsed
    for (const t of c.traumas ?? []) {
      if (t.darkSince !== undefined) t.darkSince += elapsed
      if (t.lastStressTurn !== undefined) t.lastStressTurn += elapsed
    }
    if (c.cond) for (const k of ['shockOkSince', 'painHighSince', 'faintUntil'] as const) if (c.cond[k] !== undefined) c.cond[k]! += elapsed
    if (c.ai.mev) for (const e of c.ai.mev) e.t += elapsed
    for (const k of ['alertTurn', 'moraleCheck', 'goneSince', 'waitUntil'] as const) if (c.ai[k] !== undefined) c.ai[k]! += elapsed
    if (c.movedTurn !== undefined) c.movedTurn += elapsed
    if (c.freeActTurn !== undefined) c.freeActTurn += elapsed
    if (c.reactions) c.reactions.turn += elapsed
    if (c.heat) c.heat.at += elapsed
    for (const id of Object.keys(c.cooldowns)) c.cooldowns[id] += elapsed
    for (const e of c.effects) e.untilTurn += elapsed
    if (c.drowsyUntil !== undefined) c.drowsyUntil += elapsed
    if(c.wildlifeState?.wakeSlowUntil!==undefined)c.wildlifeState.wakeSlowUntil+=elapsed
    if (c.activity?.snap) c.activity.snap.turn += elapsed
    for (const wd of c.body.wounds) {
      healFracture(wd, elapsed)
      if (wd.bleed > 0 || wd.artery) continue
      wd.healed = Math.min(wd.severity, wd.healed + w.db.wound(wd.def).healPerDay * (wd.bandage ? 1 : 0.6) * 1.2 * days)
    }
    completeHealing(w, c, (wd) => wd.bleed <= 0 && !wd.artery)
    c.hp = Math.min(hpCap(w, c), c.hp + days * TURNS_PER_DAY / regenerationPeriod(w, c))
  }
  const firstBoundary = Math.ceil((leftAt - DAY_BOUNDARY_HOUR * TURNS_PER_HOUR) / TURNS_PER_DAY) * TURNS_PER_DAY + DAY_BOUNDARY_HOUR * TURNS_PER_HOUR
  let came = 0
  for (let t = firstBoundary; t <= now; t += TURNS_PER_DAY) {
    const day = Math.floor(t / TURNS_PER_DAY)
    for (const src of sources) {
      if(!sourceDefinitionsAvailable(w,src))continue
      if(src.closed&&t>=src.closed.at)continue
      if (src.needsAlive && !bossAlive(w, src.needsAlive)) { src.lastRegenDay = day; continue }
      while (day - src.lastRegenDay >= src.regenDays) {
        src.lastRegenDay += src.regenDays
        src.count = Math.min(src.cap, src.count + 1)
      }
    }
    map.rooms.forEach((R, i) => {
      if (R.clearedAt === undefined || t - R.clearedAt < REOCCUPY_GRACE_DAYS * TURNS_PER_DAY) return
      if (!r.chance(REOCCUPY_CHANCE)) return
      const options = sources.filter((src) => sourceDefinitionsAvailable(w,src) && (!src.closed||t<src.closed.at) && !src.deployed && src.floors.includes(map.id) && src.count >= 1 && R.residents!.includes(src.species))
      if (!options.length) return
      const src = r.pick(options)
      const orig = R.residents!.filter((d) => d === src.species).length
      const n = Math.min(src.count, Math.max(1, Math.floor(orig * r.range(0.5, 1))))
      for (let k = 0; k < n; k++) {
        const c = createCreature(w, src.species, { x: R.x + r.int(0, R.w - 1), y: R.y + r.int(0, R.h - 1) })
        c.reoccupied = true
        c.room = i
        c.mapId = map.id
        c.home = { x: R.x + Math.floor(R.w / 2), y: R.y + Math.floor(R.h / 2) }
        c.asleep = r.chance(w.db.creature(src.species).sleepChance ?? 0.3)
        // 방 안의 바닥 물건은 점거자가 주워 간다 (13 §20)
        if (k === 0) {
          for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) {
            const tl = map.tiles[y * map.w + x]
            for (const it of tl.items.splice(0)) addToInventory(w, c, it)
          }
        }
        residents.push(c)
      }
      src.count -= n
      R.clearedAt = undefined
      came += n
    })
  }
  if (came) log(w, 'flavor', w.db.event('Event.Reoccupy').hint ?? '')
  // 5) 잠듦 재배정 (14 §7.1): 방 유형 + 종 + 시간대, 깊은 잠 50%
  for (const c of residents) {
    if (!c.alive || c.room === undefined || c.ai.mode === 'hunt' || c.ai.route) continue
    const R = map.rooms[c.room]
    if (!R) continue
    c.asleep = r.chance(sleepChance(w, R.type as RoomType, c.def))
    c.deepSleep = c.asleep && r.chance(0.5) ? true : undefined
  }
  // 6) 지상만: 장소 사건 정산 (순찰이 야영지를 찾았는가)
  if (map.kind === 'surface') {
    for (let t = firstBoundary; t <= now; t += TURNS_PER_DAY) settleSurfaceEvents(w, map, residents, t, r)
  }
}

/** 핏자국 마름: 시간당 ×0.85 → 12시간이면 약 14% (14 §9.2 '12시간') */
export const BLOOD_DRY_PER_HOUR = 0.85
/** 시체 → 뼈 (5일) */
export const CORPSE_DAYS = 5
