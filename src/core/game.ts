// 게임 루프: TU 스케줄러 + 턴 단위 전역 처리 + 지도 전환(지상 ↔ 던전 층)

import { activityStep, perform, type Action, hostile } from './actions'
import { aiDecide } from './ai'
import { bodyTick, deathCause } from './body'
import { killCreature } from './combat'
import { log, player, rng, START_TURN, turnOf, TU_PER_TURN, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import { createCreature, createPlayer } from './creatures'
import type { DefDatabase } from './defs'
import { weatherTick } from './environment'
import { canSee, invalidateLights, updatePlayerVision } from './fov'
import { cheb, eq, type Pos } from './geom'
import { allItems } from './items'
import { generateDungeon, generateSurface, type GenResult } from './mapgen'
import { needsTick, psycheTick } from './needs'
import { gainXp } from './progression'
import { buildReport } from './report'
import { RNG_STREAMS, Rng, seedState } from './rng'
import { storytellerTick } from './storyteller'
import { hasEffect } from './traits'
import type { Activity, Creature, GameState, MapState, PillEffectDef } from './types'

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
    c.home = sp.home ? { ...sp.home } : { ...sp.pos }
    c.mapId = gen.map.id
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
  s.offCreatures[fromId] = s.creatures.filter((c) => c.id !== pl.id && (c.alive || turnOf(w) - (c.deathTurn ?? 0) < 2400))
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
  // 재점거: 하루 넘게 비운 던전의 정리된 방
  const leftAt = (target as MapState & { leftAt?: number }).leftAt
  if (!firstVisit && target.kind === 'dungeon' && leftAt !== undefined && turnOf(w) - leftAt > TURNS_PER_DAY) {
    const r = rng(w, 'story')
    const empty = target.rooms.filter((R, i) => R.type !== 'entry' && R.type !== 'boss' && !others.some((c) => c.alive && c.pos.x >= R.x && c.pos.x < R.x + R.w && c.pos.y >= R.y && c.pos.y < R.y + R.h) && i > 0)
    if (empty.length) {
      const R = r.pick(empty)
      for (let i = 0; i < r.int(1, 2); i++) {
        const c = createCreature(w, 'Creature.Shade', { x: R.x + r.int(0, R.w - 1), y: R.y + r.int(0, R.h - 1) })
        c.home = { x: R.x + Math.floor(R.w / 2), y: R.y + Math.floor(R.h / 2) }
        others.push(c)
      }
      log(w, 'flavor', w.db.event('Event.Reoccupy').hint ?? '')
    }
  }
  s.creatures = [pl, ...others]
  for (const c of others) c.nextAct = Math.max(c.nextAct, s.time) + 50
  pl.pos = freeNear(w, arrival)
  pl.mapId = toId
  pl.nextAct = s.time
  s.loot = undefined
  s.visible = []
  updatePlayerVision(w, pl)
  log(w, 'info', `${target.name}${target.kind === 'dungeon' ? ' — 축축한 냉기와 썩은 향 냄새.' : '. 바깥 공기다.'}`)
  if (firstVisit && target.kind === 'dungeon') gainXp(w, pl, 20 * target.depth, target.name)
}

function freeNear(w: World, p: Pos): Pos {
  for (let r = 0; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const q = { x: p.x + dx, y: p.y + dy }
    if (q.x < 0 || q.y < 0 || q.x >= w.s.map.w || q.y >= w.s.map.h) continue
    if (!w.db.terrain(w.s.map.tiles[q.y * w.s.map.w + q.x].t).passable) continue
    if (w.s.creatures.some((c) => c.alive && eq(c.pos, q) && c.id !== w.s.playerId)) continue
    return q
  }
  return p
}

function isSleeping(c: Creature) {
  return c.activity?.kind === 'sleep'
}

/** 새 방 발견 (경험치) */
function discoverRoom(w: World, pl: Creature) {
  const t = w.s.map.tiles[pl.pos.y * w.s.map.w + pl.pos.x]
  if (t.room === undefined) return
  const R = w.s.map.rooms[t.room]
  if (!R || R.discovered) return
  R.discovered = true
  if (R.type === 'entry') return
  log(w, 'info', `${R.name}에 들어섰다.`)
  gainXp(w, pl, 5 + w.s.map.depth * 2, R.name)
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
    if (c.faction === 'player') psycheTick(w, c)
    for (const it of allItems(c)) {
      if (it.lit && it.fuel !== undefined) {
        it.fuel--
        if (it.fuel <= 0) {
          it.lit = false
          if (c.faction === 'player') log(w, 'warn', '등불의 기름이 다 떨어졌다. 어둠이 덮친다.')
        }
      }
    }
    c.effects = c.effects.filter((e) => e.untilTurn > turn)
    const cause = deathCause(w, c)
    if (cause) {
      if (c.faction === 'player') c.history.push({ turn, kind: 'death', text: `사망: ${cause}` })
      killCreature(w, c, cause)
    }
    c.exerted = false
  }
  if (turn % 600 === 0) w.s.creatures = w.s.creatures.filter((c) => c.alive || c.id === w.s.playerId || turn - (c.deathTurn ?? turn) < 4800)
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

function nextActor(w: World): Creature | undefined {
  let best: Creature | undefined
  for (const c of w.s.creatures) {
    if (!c.alive) continue
    if (!best || c.nextAct < best.nextAct || (c.nextAct === best.nextAct && (c.faction === 'player' || (best.faction !== 'player' && c.id < best.id)))) best = c
  }
  return best
}

function visibleHostileIds(w: World, pl: Creature): Set<number> {
  return new Set(w.s.creatures.filter((o) => o.alive && !o.asleep && hostile(pl, o) && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos)).map((o) => o.id))
}

function interrupted(w: World, pl: Creature): string | null {
  const act = pl.activity
  if (!act) return null
  if (pl.body.wounds.length > (act.woundCount ?? pl.body.wounds.length)) return '공격받았다!'
  const known = new Set(act.seenHostiles ?? [])
  for (const id of visibleHostileIds(w, pl)) if (!known.has(id)) {
    const o = w.s.creatures.find((c) => c.id === id)!
    return `${o.name}이(가) 보인다!`
  }
  if (pl.activity?.kind === 'sleep' && (act.elapsed ?? 0) > 0) {
    if (pl.needs.fatigue <= 2) return '개운하게 깼다.'
    if (pl.needs.bodyTemp < 34.5) return '추위에 잠이 깼다.'
    if (w.s.noiseEvents.some((n) => n.source !== pl.id && cheb(n.pos, pl.pos) <= n.radius && n.radius >= 7)) return '소리에 잠이 깼다.'
  }
  return null
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
          if (actor.activity.kind === 'sleep') sleepQuality(w, actor)
          actor.activity = undefined
          updatePlayerVision(w, actor)
          return
        }
        const kind = actor.activity.kind
        const done = activityStep(w, actor)
        actor.nextAct += TU_PER_TURN
        if (done) {
          if (kind === 'sleep') sleepQuality(w, actor)
          updatePlayerVision(w, actor)
          return
        }
        if (turn % 10 === 0) updatePlayerVision(w, actor)
        continue
      }
      updatePlayerVision(w, actor)
      return
    }
    const action = aiDecide(w, actor)
    const res = perform(w, actor, action)
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
  if (pl.activity) pl.activity = undefined
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
  }
  pl.nextAct += res.tu
  if (res.tu > 0 || act) runUntilInput(w)
  else updatePlayerVision(w, pl)
  return null
}
