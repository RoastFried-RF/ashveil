// 게임 루프: TU 스케줄러 + 턴 단위 전역 처리 + 지도 전환(지상 ↔ 던전 층)

import { activityStep, interruptTreat, perform, type Action, hostile } from './actions'
import { aiDecide } from './ai'
import { bloodLoss, bodyTick, deathCause, effectiveBleed, hpCap, totalBleed } from './body'
import { killCreature } from './combat'
import { log, player, rng, START_TURN, turnOf, TU_PER_TURN, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import { createCreature, createPlayer } from './creatures'
import type { DefDatabase } from './defs'
import { weatherTick } from './environment'
import { canSee, invalidateLights, updatePlayerVision } from './fov'
import { cheb, eq, type Pos } from './geom'
import { addToInventory, allItems, equip, makeItem } from './items'
import { generateDungeon, generateSurface, sleepChance, type GenResult, type RoomType } from './mapgen'
import { needsTick, psycheTick } from './needs'
import { awardCrisis, gainXp } from './progression'
import { buildReport } from './report'
import { emitNoise, sleepCycleDeep } from './perception'
import { RNG_STREAMS, Rng, seedState } from './rng'
import { autoSnap, autoStop } from './autostop'
import { nextActor } from './scheduler'
import { settleSurfaceEvents, storytellerTick } from './storyteller'
import { hasEffect } from './traits'
import type { Activity, Creature, GameState, MapState, PillEffectDef, PopSource } from './types'

export const SAVE_VERSION = 2
export { START_TURN } from './ctx'

export interface NewGameOptions { seed: string; background?: string; mods?: string[] }

function emptyMap(): MapState {
  return { id: '', name: '', kind: 'surface', depth: 0, ambient: 0, w: 1, h: 1, tiles: [], exits: [], links: [], rooms: [], props: [], lights: [] }
}

function populate(w: World, gen: GenResult): Creature[] {
  const out: Creature[] = []
  for (const sp of gen.spawns) {
    const c = createCreature(w, sp.def, sp.pos)
    c.asleep = !!sp.asleep
    if (sp.asleep && sp.deep) c.deepSleep = true
    c.home = sp.home ? { ...sp.home } : { ...sp.pos }
    c.mapId = gen.map.id
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
  const rngState: GameState['rng'] = {}
  for (const s of RNG_STREAMS) rngState[s] = seedState(opts.seed, s)
  const s: GameState = {
    version: SAVE_VERSION,
    seed: opts.seed,
    mods: opts.mods ?? db.loadedMods,
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
    weatherUntil: START_TURN + TURNS_PER_HOUR * 2,
    wind: { x: 1, y: 0 },
    storyteller: { budget: 0, lastEventTurn: START_TURN, history: [] },
    knowledge: { pillMap: {}, pillKnown: {}, bestiary: {} },
    visible: [],
    noiseEvents: [],
    fx: [],
  }
  const w: World = { db, s }
  const gen = generateSurface(w)
  s.map = gen.map
  const pills = db.all('Item').filter((d) => (d as { unidentified?: string }).unidentified === 'pill').map((d) => d.id).sort()
  const effects = db.all<PillEffectDef>('PillEffect').map((e) => e.id).sort()
  const shuffled = new Rng(seedState(opts.seed, 'pills')).shuffle([...effects])
  pills.forEach((p, i) => { s.knowledge.pillMap[p] = shuffled[i % shuffled.length] })

  const pl = createPlayer(w, gen.start, opts.background)
  pl.mapId = gen.map.id
  s.playerId = pl.id
  s.creatures.push(pl, ...populate(w, gen))
  updatePlayerVision(w, pl)
  log(w, 'flavor', '잿빛 수도원 앞뜰. 해가 지고 있다. 장막 너머로 붉은 빛이 꺼져 간다.')
  log(w, 'info', `당신은 ${pl.name}, ${db.background(pl.background!).label}. 특성: ${pl.traits.map((t) => db.trait(t).label).join(', ')}.`)
  log(w, 'info', '북쪽 무너진 수도원 아래 납골당. 그 바닥에 무엇이 있는지 아무도 돌아와 말해주지 않았다. (? 키: 조작법)')
  return s
}

/** 지도 전환: 현재 지도·생물은 정지 보관, 대상 지도를 (없으면 생성해) 불러온다 */
export function changeMap(w: World, toId: string) {
  const s = w.s
  const pl = player(w)
  const fromId = s.map.id
  markCleared(w, s.map, s.creatures)
  // 따라오기 (14 §8): 플레이어를 추적 중이고 인접한 적. 사기 ≥ 40 (사기 없는 종은 항상).
  // 그늘 사람은 지상으로 나오지 않고, 융합체는 대성소를 떠나지 않는다
  const followers = s.creatures.filter((c) => {
    if (!c.alive || c.id === pl.id || c.asleep || c.unconscious || !hostile(c, pl)) return false
    if (c.ai.mode !== 'hunt' || c.ai.target !== pl.id || cheb(c.pos, pl.pos) > 1) return false
    if (c.def === 'Creature.Amalgam') return false
    if (toId === 'surface' && (c.def === 'Creature.Shade' || c.def === 'Creature.ShadeChief')) return false
    const noMorale = c.def === 'Creature.Withered' || c.def === 'Creature.WitheredPriest' || c.def === 'Creature.SporeMan'
    return noMorale || c.ai.morale >= 40
  })
  // 시체는 남는다 (증거·뼈, 14 §9.2) — 지우지 않는다
  s.offCreatures[fromId] = s.creatures.filter((c) => c.id !== pl.id && !followers.includes(c))
  s.maps[fromId] = s.map
  ;(s.map as MapState & { leftAt?: number }).leftAt = turnOf(w)
  let target = s.maps[toId]
  let firstVisit = false
  if (!target) {
    const gen = toId === 'surface' ? generateSurface(w) : generateDungeon(w, Number(toId.replace('crypt', '')))
    target = gen.map
    s.offCreatures[toId] = populate(w, gen)
    firstVisit = true
  }
  delete s.maps[toId]
  s.map = target
  invalidateLights(w)
  const arrival = target.links.find((l) => l.to === fromId)?.pos ?? { x: 1, y: 1 }
  const others = s.offCreatures[toId] ?? []
  delete s.offCreatures[toId]
  // 재진입 정산 (14 §9.2): 일 단위 과정만 — 공급원 회복, 정리된 방 재점거
  const leftAt = (target as MapState & { leftAt?: number }).leftAt
  if (!firstVisit && leftAt !== undefined) settleReentry(w, target, others, leftAt)
  s.creatures = [pl, ...others]
  for (const c of others) c.nextAct = Math.max(c.nextAct, s.time) + 50
  pl.pos = freeNear(w, arrival)
  pl.mapId = toId
  pl.nextAct = s.time + TU_PER_TURN // 계단 1턴
  for (const f of followers) {
    s.creatures.push(f)
    f.pos = freeNear(w, pl.pos, true)
    f.mapId = toId
    f.room = undefined
    f.home = undefined
    f.ai.path = undefined
    f.nextAct = s.time + TU_PER_TURN
  }
  const goingUp = target.depth < (s.maps[fromId]?.depth ?? 0)
  if (followers.length) log(w, 'danger', `${followers.map((f) => f.name).join(', ')}이(가) 계단을 따라 ${goingUp ? '올라왔다' : '내려왔다'}!`)
  s.loot = undefined
  s.visible = []
  updatePlayerVision(w, pl)
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

/** 굶주림·갈증 단계 0 보통 · 1 배고픔(<900) · 2 굶주림(<0) */
function sleepStart(c: Creature) {
  const st = (v: number) => (v < 0 ? 2 : v < 900 ? 1 : 0)
  return { fatigue: c.needs.fatigue, hunger: st(c.needs.kcal), thirst: st(c.needs.water), wet: c.needs.wetness }
}

/** 깬 직후 잠기운 (01 §8.3): 10턴, 깊은 잠에서 깼다면 20턴 */
function wakeUp(w: World, c: Creature) {
  c.drowsyUntil = turnOf(w) + (c.deepSleep ? 20 : 10)
  if (c.deepSleep && c.faction === 'player') log(w, 'warn', '깊은 잠에서 끌려 나왔다. 머리가 멍하다.')
  c.deepSleep = undefined
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
    log(w, 'info', `${R.name}을(를) 찾았다.`)
    gainXp(w, pl, 5, R.name)
  }
}

/** 턴 경계마다 1회: 모든 생물의 신체·생존, 날씨, 사건 */
function globalTurnTick(w: World) {
  const turn = turnOf(w)
  weatherTick(w)
  for (const c of w.s.creatures) {
    if (!c.alive) continue
    const sleeping = isSleeping(c) || !!c.asleep
    needsTick(w, c, sleeping)
    bodyTick(w, c, sleeping)
    if (c.faction === 'player') {
      psycheTick(w, c)
      crisisTick(w, c)
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
    if (sp && sp.until > turn && !c.def.startsWith('Creature.SporeMan') && c.def !== 'Creature.Amalgam') {
      c.needs.energy = Math.max(0, c.needs.energy - 2)
      emitNoise(w, c.pos, 4, c.id)
      if (c.faction === 'player' && turn % 5 === 0) log(w, 'warn', '포자 구름 속이다. 기침이 멎지 않고 숨이 가쁘다.')
    }
    c.effects = c.effects.filter((e) => e.untilTurn > turn)
    const cause = deathCause(w, c)
    if (cause) {
      if (c.faction === 'player') c.history.push({ turn, kind: 'death', text: `사망: ${cause}` })
      killCreature(w, c, cause)
    }
    c.exerted = false
  }
  if (turn % 600 === 0) {
    // 오래된 시체는 치운다. 남은 소지품은 그 자리 바닥으로
    w.s.creatures = w.s.creatures.filter((c) => {
      if (c.alive || c.id === w.s.playerId || turn - (c.deathTurn ?? turn) < CORPSE_DAYS * TURNS_PER_DAY) return true
      const t = w.s.map.tiles[c.pos.y * w.s.map.w + c.pos.x]
      for (const it of allItems(c)) t.items.push({ ...it, gx: undefined, gy: undefined, rot: undefined })
      t.items.push(makeItem(w, 'Item.Bones'))
      return false
    })
  }
  if (turn % TURNS_PER_HOUR === 0) for (const t of w.s.map.tiles) if (t.blood) t.blood = t.blood * BLOOD_DRY_PER_HOUR < 1 ? 0 : t.blood * BLOOD_DRY_PER_HOUR
  storytellerTick(w)
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
  return new Set(w.s.creatures.filter((o) => o.alive && !o.asleep && hostile(pl, o) && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos)).map((o) => o.id))
}

function interrupted(w: World, pl: Creature): string | null {
  const act = pl.activity
  if (!act) return null
  if (act.kind === 'sleep') {
    // 수면 주기 (01 §8): 눈을 감고 있으니 적을 '보고' 깨지는 않는다. 소리(각성 임계)·피해·몸 신호로만 깬다
    const s0 = (act.sleep0 ??= sleepStart(pl))
    pl.deepSleep = sleepCycleDeep(act.elapsed ?? 0, s0.fatigue) || undefined
    if (pl.body.wounds.length > (act.woundCount ?? pl.body.wounds.length)) return '공격받았다!'
    if (act.wokeBy) return act.wokeBy
    if ((act.elapsed ?? 0) > 0) {
      if (pl.needs.fatigue <= 2) return '개운하게 깼다.'
      if (pl.needs.bodyTemp < 35) return '추위에 잠이 깼다.'
      if (pl.needs.wetness >= s0.wet + 20) return '몸이 젖어 잠이 깼다.'
      const now = sleepStart(pl)
      if (now.hunger > s0.hunger) return '배가 고파 잠이 깼다.'
      if (now.thirst > s0.thirst) return '목이 말라 잠이 깼다.'
    }
    return null
  }
  // 휴식·채널 행동은 자동 모드: T1~T6 (01 §6.2). 처치·압박 중에는 신체 변화로 끊지 않는다
  if (!act.snap) return null
  const why = autoStop(w, act.snap, { skipBody: act.kind === 'treat' || act.kind === 'press' })
  if (why) w.s.autoStopTurn = turnOf(w)
  return why && (why.endsWith('다') ? why + '!' : why)
}

/** 플레이어 입력이 필요할 때까지 시뮬레이션 진행 */
export function runUntilInput(w: World, maxSteps = 300000) {
  for (let i = 0; i < maxSteps; i++) {
    if (w.s.over) return
    const actor = nextActor(w)
    if (!actor) return
    advanceTo(w, actor.nextAct)
    if (w.s.over) return
    if (!actor.alive) continue
    const turn = turnOf(w)
    if (actor.unconscious || hasEffect(actor, 'panic', turn) || hasEffect(actor, 'stunned', turn) || hasEffect(actor, 'knockedDown', turn)) {
      actor.nextAct += TU_PER_TURN
      continue
    }
    if (actor.id === w.s.playerId) {
      discoverRoom(w, actor)
      if (actor.activity) {
        const why = interrupted(w, actor)
        if (why) {
          log(w, 'warn', `${actor.activity.label} 중단: ${why}`)
          if (actor.activity.kind === 'sleep') { sleepQuality(w, actor); wakeUp(w, actor) }
          stopActivity(w, actor)
          updatePlayerVision(w, actor)
          return
        }
        const kind = actor.activity.kind
        const done = activityStep(w, actor)
        actor.nextAct += TU_PER_TURN
        if (done) {
          if (kind === 'sleep') { sleepQuality(w, actor); wakeUp(w, actor) }
          updatePlayerVision(w, actor)
          return
        }
        if (turn % 10 === 0) updatePlayerVision(w, actor)
        continue
      }
      updatePlayerVision(w, actor)
      return
    }
    // NPC 채널 행동 (조준 사격 등): 맞으면 끊긴다
    if (actor.activity) {
      if (actor.body.wounds.length > (actor.activity.woundCount ?? actor.body.wounds.length)) stopActivity(w, actor)
      else {
        activityStep(w, actor)
        actor.nextAct += TU_PER_TURN
        continue
      }
    }
    let res = perform(w, actor, aiDecide(w, actor))
    // 동시성 충돌(01 §3.5): 먼저 처리된 쪽이 칸을 차지하면 같은 TU 안에서 1회만 다시 계획
    if (!res.ok) { actor.ai.path = undefined; res = perform(w, actor, aiDecide(w, actor)) }
    actor.nextAct += res.ok ? Math.max(30, res.tu) : TU_PER_TURN
  }
}

function sleepQuality(w: World, pl: Creature) {
  const t = w.s.map.tiles[pl.pos.y * w.s.map.w + pl.pos.x]
  if (w.s.map.kind === 'surface' && w.s.weather === 'ashrain' && !t.roof) pl.thoughts.push({ def: 'Thought.SleptRough', untilTurn: turnOf(w) + 12000, count: 1 })
  else if (pl.needs.fatigue < 20) pl.thoughts.push({ def: 'Thought.SleptWell', untilTurn: turnOf(w) + 12000, count: 1 })
}

/** 플레이어 행동 1회 + 다음 입력까지 진행. 반환: 실패 메시지 */
export function playerAct(w: World, action: Action): string | null {
  if (w.s.over) return '게임이 끝났다'
  const pl = player(w)
  if (pl.activity) stopActivity(w, pl)
  const res = perform(w, pl, action)
  if (!res.ok) {
    if (res.msg) log(w, 'info', res.msg)
    return res.msg ?? '할 수 없다'
  }
  if (res.msg === 'leave') {
    finish(w, 'escape', '탈출')
    return null
  }
  if (res.msg === 'stairs') {
    const link = w.s.map.links.find((l) => eq(l.pos, pl.pos))!
    changeMap(w, link.to)
    return null
  }
  const act = pl.activity as Activity | undefined
  if (act) {
    act.seenHostiles = [...visibleHostileIds(w, pl)]
    act.woundCount = pl.body.wounds.length
    act.snap = autoSnap(w)
  }
  pl.nextAct += res.tu
  if (res.tu > 0 || act) runUntilInput(w)
  else updatePlayerVision(w, pl)
  return null
}

/** 위기 극복 감시 (15 §3): 동맥 지혈 30 · 실혈 30% 후 출혈 정지 30 · 기절 후 100턴 생존 30 · 감염 경주 승리 40 */
function crisisTick(w: World, pl: Creature) {
  const cw = (pl.crisis ??= { last: {}, arterial: [], bleeding: false, wasUnconscious: false })
  const turn = turnOf(w)
  const arterialNow = pl.body.wounds.filter((wd) => wd.arterial && effectiveBleed(w, pl, wd) > 0).map((wd) => wd.id)
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
function stopActivity(w: World, c: Creature) {
  const act = c.activity
  if (!act) return
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
  if (act?.kind !== 'equip' || act.uid === undefined || (act.elapsed ?? 0) <= 0) return
  const it = allItems(c).find((i) => i.uid === act.uid)
  if (!it || equip(w, c, act.uid, act.slot)) return
  it.half = true
  log(w, 'warn', `${w.db.item(it.def).label}을(를) 반쯤 걸친 채 멈췄다. (방어 50%)`)
}

// ── 재점거 (14 §9.3 · §9.4, CANON D20) ─────────────────────

export const REOCCUPY_GRACE_DAYS = 3
export const REOCCUPY_CHANCE = 0.15
const DAY_BOUNDARY_HOUR = 6

export function initialSources(): PopSource[] {
  return [
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
  const all = [...w.s.creatures, ...Object.values(w.s.offCreatures).flat()]
  return all.some((c) => c.def === defId && c.alive)
}

/** 06:00 경계마다: 공급원 회복 → 유예가 끝난 정리된 방마다 15% 재점거 */
export function settleReentry(w: World, map: MapState, residents: Creature[], leftAt: number) {
  const s = w.s
  const sources = (s.sources ??= initialSources())
  const r = rng(w, 'story')
  const now = turnOf(w)
  const elapsed = now - leftAt
  markCleared(w, map, residents)
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
    if (c.alive || now - (c.deathTurn ?? now) < CORPSE_DAYS * TURNS_PER_DAY) continue
    const t = map.tiles[c.pos.y * map.w + c.pos.x]
    for (const it of allItems(c)) t.items.push({ ...it, gx: undefined, gy: undefined, rot: undefined })
    t.items.push(makeItem(w, 'Item.Bones'))
    residents.splice(i, 1)
  }
  // 3) 치유: 출혈 중이 아닌 상처는 경과 일수만큼 아문다 (02 §13, 무처치 0.6 · 휴식 1.2)
  const days = elapsed / TURNS_PER_DAY
  for (const c of residents) {
    if (!c.alive) continue
    for (const wd of c.body.wounds) {
      if (wd.bleed > 0 || wd.artery) continue
      wd.healed = Math.min(wd.severity, wd.healed + w.db.wound(wd.def).healPerDay * (wd.bandage ? 1 : 0.6) * 1.2 * days)
    }
    c.body.wounds = c.body.wounds.filter((wd) => wd.healed < wd.severity || wd.bleed > 0 || !!wd.artery)
    c.hp = Math.min(hpCap(w, c), c.hp + days * TURNS_PER_DAY / Math.max(1, Math.floor(100 / c.stats.vit)))
  }
  const firstBoundary = Math.ceil((leftAt - DAY_BOUNDARY_HOUR * TURNS_PER_HOUR) / TURNS_PER_DAY) * TURNS_PER_DAY + DAY_BOUNDARY_HOUR * TURNS_PER_HOUR
  let came = 0
  for (let t = firstBoundary; t <= now; t += TURNS_PER_DAY) {
    const day = Math.floor(t / TURNS_PER_DAY)
    for (const src of sources) {
      if (src.needsAlive && !bossAlive(w, src.needsAlive)) { src.lastRegenDay = day; continue }
      while (day - src.lastRegenDay >= src.regenDays) {
        src.lastRegenDay += src.regenDays
        src.count = Math.min(src.cap, src.count + 1)
      }
    }
    map.rooms.forEach((R, i) => {
      if (R.clearedAt === undefined || t - R.clearedAt < REOCCUPY_GRACE_DAYS * TURNS_PER_DAY) return
      if (!r.chance(REOCCUPY_CHANCE)) return
      const options = sources.filter((src) => src.floors.includes(map.id) && src.count >= 1 && R.residents!.includes(src.species))
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
