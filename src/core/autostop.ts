// 자동 모드 중단 (01 §6.2): 경로 이동·휴식·채널 행동은 위협 T1~T6 중 하나라도 참이면 즉시 턴 모드로.
// 이력 현상: 멈춘 뒤 3턴 동안 새 트리거가 없어야 자동 이동을 다시 쓸 수 있다.

import { bloodLoss, painStage, painTotal, regionState, totalBleed } from './body'
import { canSee } from './fov'
import { cheb } from './geom'
import { bagGrid, gridSpot } from './items'
import { ambientNoise, hearingBonus } from './perception'
import { player, turnOf, type World } from './ctx'
import type { Creature, ItemDef, Region } from './types'

export interface AutoSnap {
  turn: number
  hp: number
  wounds: number
  hostiles: number[]
  bloodStage: number
  painStage: number
  regions: number[]
  bleeding: boolean
  fuelWarned: boolean
  bagFull: boolean
  spores: boolean
}

const REGIONS: Region[] = ['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg']
/** 등불 연료 1분 = 20턴 */
export const FUEL_WARN_TURNS = 20
/** 재개 대기 (이력 현상) */
export const AUTO_HYSTERESIS = 3
/** '수상한 소리' = 도달 세기 2 이상 */
const SUSPICIOUS = 2

const ONE_CELL = { size: [1, 1] } as unknown as ItemDef

function hostileIds(w: World, pl: Creature): number[] {
  // 잠든 개체도 처음 보면 트리거 (T1)
  return w.s.creatures.filter((o) => o.alive && o.faction !== 'player' && o.faction !== 'vermin' && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos)).map((o) => o.id)
}

const bloodStageOf = (loss: number) => (loss >= 0.4 ? 3 : loss >= 0.3 ? 2 : loss >= 0.15 ? 1 : 0)

function litFuel(pl: Creature): number | undefined {
  for (const it of [...pl.bag, ...Object.values(pl.equip)]) if (it?.lit && it.fuel !== undefined) return it.fuel
  return undefined
}

function sporesNear(w: World, pl: Creature): boolean {
  const turn = turnOf(w), m = w.s.map
  for (let y = pl.pos.y - 3; y <= pl.pos.y + 3; y++) for (let x = pl.pos.x - 3; x <= pl.pos.x + 3; x++) {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue
    const sp = m.tiles[y * m.w + x].spores
    if (sp && sp.until > turn && sp.conc > 0) return true
  }
  return false
}

export function autoSnap(w: World): AutoSnap {
  const pl = player(w)
  const fuel = litFuel(pl)
  return {
    turn: turnOf(w),
    hp: pl.hp,
    wounds: pl.body.wounds.length,
    hostiles: hostileIds(w, pl),
    bloodStage: bloodStageOf(bloodLoss(pl)),
    painStage: painStage(painTotal(w, pl)),
    regions: REGIONS.map((r) => regionState(w, pl, r)),
    bleeding: totalBleed(w, pl) > 0,
    fuelWarned: fuel !== undefined && fuel <= FUEL_WARN_TURNS,
    bagFull: !gridSpot(w, bagGrid(pl), ONE_CELL),
    spores: sporesNear(w, pl),
  }
}

export interface AutoStopOpts {
  /** 처치 중이면 신체 변화(T4)로 끊지 않는다 — 몸을 돌보는 중이므로 */
  skipBody?: boolean
}

/** 시작 시점 스냅샷 대비 새 위협. 사유 문자열 또는 null */
export function autoStop(w: World, s: AutoSnap, opts: AutoStopOpts = {}): string | null {
  const pl = player(w)
  // T2 피해·새 상처 (끌 수 없음)
  if (pl.hp < s.hp || pl.body.wounds.length > s.wounds) return '다쳤다'
  // T1 새로 인식한 적대 개체
  const known = new Set(s.hostiles)
  for (const id of hostileIds(w, pl)) if (!known.has(id)) {
    const o = w.s.creatures.find((c) => c.id === id)!
    return `${o.name}이(가) 보인다${o.asleep ? '(잠듦)' : ''}`
  }
  // T3 출처 미상 소음
  const amb = ambientNoise(w), hb = hearingBonus(w, pl)
  for (const n of w.s.noiseEvents) {
    if (n.turn <= s.turn || n.source === pl.id) continue
    const src = w.s.creatures.find((c) => c.id === n.source)
    if (src && canSee(w, pl, src.pos)) continue
    if (n.radius - cheb(n.pos, pl.pos) - amb + hb >= SUSPICIOUS) return '어디선가 수상한 소리가 났다'
  }
  // T4 신체 단계 변화
  if (!opts.skipBody) {
    if (bloodStageOf(bloodLoss(pl)) > s.bloodStage) return '피를 너무 많이 흘렸다'
    if (painStage(painTotal(w, pl)) > s.painStage) return '통증이 심해졌다'
    if (REGIONS.some((r, i) => regionState(w, pl, r) > s.regions[i])) return '몸 상태가 나빠졌다'
    if (!s.bleeding && totalBleed(w, pl) > 0) return '피가 흐르기 시작했다'
  }
  // T5 환경 위험: 포자 구름 3칸 이내
  if (!s.spores && sporesNear(w, pl)) return '포자 구름이 가깝다'
  // T6 자원 경고: 등불 1분 · 배낭 가득
  const fuel = litFuel(pl)
  if (!s.fuelWarned && fuel !== undefined && fuel <= FUEL_WARN_TURNS) return '등불 기름이 거의 다 됐다'
  if (!s.bagFull && !gridSpot(w, bagGrid(pl), ONE_CELL)) return '배낭이 가득 찼다'
  return null
}

/** 이력 현상: 마지막 중단 뒤 3턴 동안은 자동 이동을 다시 시작하지 않는다 */
export function autoBlocked(w: World): number {
  const last = w.s.autoStopTurn
  if (last === undefined) return 0
  return Math.max(0, last + AUTO_HYSTERESIS - turnOf(w))
}
