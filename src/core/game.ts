// 게임 루프: TU 스케줄러 + 턴 단위 전역 처리

import { activityStep, perform, type Action, hostile } from './actions'
import { aiDecide } from './ai'
import { bodyTick, deathCause } from './body'
import { killCreature } from './combat'
import { log, player, terrainAt, turnOf, TU_PER_TURN, TURNS_PER_HOUR, type World } from './ctx'
import { createCreature, createPlayer } from './creatures'
import type { DefDatabase } from './defs'
import { weatherTick } from './environment'
import { canSee, updatePlayerVision } from './fov'
import { cheb } from './geom'
import { generateMap } from './mapgen'
import { needsTick, psycheTick } from './needs'
import { buildReport } from './report'
import { RNG_STREAMS, Rng, seedState } from './rng'
import { storytellerTick } from './storyteller'
import { hasEffect } from './traits'
import type { Activity, Creature, GameState, PillEffectDef } from './types'

export const SAVE_VERSION = 1
export const START_TURN = 8 * TURNS_PER_HOUR // 1일차 08:00

export interface NewGameOptions { seed: string; background?: string; mods?: string[] }

export function newGame(db: DefDatabase, opts: NewGameOptions): GameState {
  const rngState: GameState['rng'] = {}
  for (const s of RNG_STREAMS) rngState[s] = seedState(opts.seed, s)
  const s: GameState = {
    version: SAVE_VERSION,
    seed: opts.seed,
    mods: opts.mods ?? db.loadedMods,
    time: START_TURN * TU_PER_TURN,
    rng: rngState,
    map: { w: 1, h: 1, tiles: [], exits: [] },
    creatures: [],
    playerId: -1,
    nextId: 1,
    log: [],
    weather: 'overcast',
    weatherUntil: START_TURN + TURNS_PER_HOUR * 2,
    wind: { x: 1, y: 0 },
    storyteller: { budget: 0, lastEventTurn: START_TURN - 2400 + 1800, history: [] },
    knowledge: { pillMap: {}, pillKnown: {}, bestiary: {} },
    visible: [],
    noiseEvents: [],
  }
  const w: World = { db, s }
  const { map, start } = generateMap(w)
  s.map = map
  // 알약 외형 ↔ 효과 섞기 (시드별 비밀)
  const pills = db.all('Item').filter((d) => (d as { unidentified?: string }).unidentified === 'pill').map((d) => d.id).sort()
  const effects = db.all<PillEffectDef>('PillEffect').map((e) => e.id).sort()
  const r = new Rng(s.rng.world)
  const shuffled = r.shuffle([...effects])
  pills.forEach((p, i) => { s.knowledge.pillMap[p] = shuffled[i % shuffled.length] })

  const pl = createPlayer(w, start, opts.background)
  s.playerId = pl.id
  s.creatures.push(pl)
  // 초기 주민: 건물 안 굴쥐 몇 마리
  const r2 = new Rng(s.rng.world)
  const indoor: { x: number; y: number }[] = []
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const t = map.tiles[y * map.w + x]
    if (t.roof && db.terrain(t.t).passable && cheb({ x, y }, start) > 12) indoor.push({ x, y })
  }
  for (let i = 0; i < Math.min(indoor.length, r2.int(2, 4)); i++) {
    const c = createCreature(w, 'Creature.BurrowRat', r2.pick(indoor))
    if (!s.creatures.some((o) => o.pos.x === c.pos.x && o.pos.y === c.pos.y)) s.creatures.push(c)
  }
  updatePlayerVision(w, pl)
  log(w, 'flavor', '회색 고원의 폐허 외곽. 하늘은 언제나처럼 재의 장막에 덮여 있다.')
  log(w, 'info', `당신은 ${pl.name}, ${db.background(pl.background!).label}. 특성: ${pl.traits.map((t) => db.trait(t).label).join(', ')}.`)
  log(w, 'info', '살아남아라. 동쪽 길 끝에 닿으면 이 땅을 떠날 수 있다. (? 키: 조작법)')
  return s
}

function edgeSpawnable(w: World) {
  const out: { x: number; y: number }[] = []
  const { w: W, h: H } = w.s.map
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (terrainAt(w, { x, y }).passable) out.push({ x, y })
  for (let y = 1; y < H - 1; y++) for (const x of [0, W - 1]) if (terrainAt(w, { x, y }).passable) out.push({ x, y })
  return out
}

function isSleeping(c: Creature) {
  return c.activity?.kind === 'sleep'
}

/** 턴 경계마다 1회: 모든 생물의 신체·생존, 날씨, 스토리텔러 */
function globalTurnTick(w: World) {
  const turn = turnOf(w)
  weatherTick(w)
  for (const c of w.s.creatures) {
    if (!c.alive) continue
    const sleeping = isSleeping(c)
    needsTick(w, c, sleeping)
    bodyTick(w, c, sleeping)
    if (c.faction === 'player') psycheTick(w, c)
    // 등불 연료
    for (const it of c.inventory) {
      if (it.lit && it.fuel !== undefined) {
        it.fuel--
        if (it.fuel <= 0) {
          it.lit = false
          if (c.faction === 'player') log(w, 'warn', '등불의 기름이 다 떨어졌다.')
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
  // 오래된 시체 정리
  if (turn % 600 === 0) w.s.creatures = w.s.creatures.filter((c) => c.alive || c.id === w.s.playerId || turn - (c.deathTurn ?? turn) < 2400)
  storytellerTick(w, () => edgeSpawnable(w))
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
  return new Set(w.s.creatures.filter((o) => o.alive && hostile(pl, o) && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos)).map((o) => o.id))
}

function interrupted(w: World, pl: Creature): string | null {
  const act = pl.activity
  if (!act) return null
  if (pl.body.wounds.length > (act.woundCount ?? pl.body.wounds.length)) return '공격받았다!'
  const known = new Set(act.seenHostiles ?? [])
  const now = visibleHostileIds(w, pl)
  for (const id of now) if (!known.has(id)) {
    const o = w.s.creatures.find((c) => c.id === id)!
    return `${o.name}이(가) 보인다!`
  }
  // 시작 직후에는 상태 조건으로 끊지 않는다 (시간이 흐르지 않는 무한 반복 방지)
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
    if (actor.unconscious || hasEffect(actor, 'panic', turn)) {
      actor.nextAct += TU_PER_TURN
      continue
    }
    if (actor.id === w.s.playerId) {
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
  if (w.s.weather === 'ashrain' && !t.roof) pl.thoughts.push({ def: 'Thought.SleptRough', untilTurn: turnOf(w) + 12000, count: 1 })
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
  const act = pl.activity as Activity | undefined
  if (act) {
    act.seenHostiles = [...visibleHostileIds(w, pl)]
    act.woundCount = pl.body.wounds.length
  }
  pl.nextAct += res.tu
  runUntilInput(w)
  return null
}
