import {privateSound} from './hallucination-state'
import {visibleBeddingFires} from './bedding-fire'
import { aquaticRules } from './aquatic-state'
import { knownCreatureName } from './bestiary-state'
import { hostile } from './diplomacy'
// 자동 모드 중단 (01 §6.2): 경로 이동·휴식·채널 행동은 위협 T1~T6 중 하나라도 참이면 즉시 턴 모드로.
// 이력 현상: 멈춘 뒤 3턴 동안 새 트리거가 없어야 자동 이동을 다시 쓸 수 있다.

import { hungerStage, thirstStage } from './nutrition-state'
import { bloodLoss, painStage, painTotal, regionState, totalBleed } from './body'
import { canSee } from './fov'
import { cheb } from './geom'
import { bagGrid, gridSpot } from './items'
import { ambientNoise, hearingBonus, smells } from './perception'
import { player, turnOf, type World } from './ctx'
import {hasEffect} from './traits'
import type { Creature, ItemDef, Region } from './types'

export interface AutoSnap {
  lice?:boolean
  beddingFires?:number[]
  water?:{submerged:boolean;air:number}
  turn: number
  hp: number
  wounds: number
  hostiles: number[]
  bloodStage: number
  painStage: number
  regions: number[]
  bleeding: boolean
  hungerStage?: number
  thirstStage?: number
  fuelWarned: boolean
  bagFull: boolean
  spores: boolean
  smells?: string[]
  coldStage?: number
  heatStage?: number
  prosthetics?: Record<number, number>
  frostbiteStage?: number
}

const REGIONS: Region[] = ['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg']
/** 등불 연료 1분 = 20턴 */
export const FUEL_WARN_TURNS = 20
/** 재개 대기 (이력 현상) */
export const AUTO_HYSTERESIS = 3
/** '수상한 소리' = 도달 세기 2 이상 */
const SUSPICIOUS = 2

const ONE_CELL = { size: [1, 1] } as unknown as ItemDef

/** T1 위협 거리: 이보다 멀고 나를 쫓지 않는 적은 '본 채로 두고' 계속한다 (01 §6.2 무시 목록의 자동판, CANON D37) */
export const T1_RANGE = 10

function hostileIds(w: World, pl: Creature): number[] {
  w.s.autoIgnored = (w.s.autoIgnored ?? []).filter((id) => w.s.creatures.some((o) => o.id === id && o.alive && cheb(o.pos, pl.pos) > 3))
  // 잠든 개체도 처음 보면 트리거 (T1). 단 멀리서 제 일을 하는 적은 다가오거나 나를 쫓을 때 트리거
  return w.s.creatures.filter((o) => o.alive && hostile(w, pl, o) && o.faction !== 'vermin' && o.ai.mode !== 'surrender' && canSee(w, pl, o.pos)
    && !w.s.autoIgnored!.includes(o.id) && t1Relevant(o, pl)).map((o) => o.id)
}

/** T7: 볼 수 없는 썩은 내·연기. 기본은 꺼짐이며 기존 냄새를 반복 경고하지 않는다 */
function detectedSmells(w: World, pl: Creature): string[] {
  if (!w.s.autoSmells) return []
  const out = w.s.creatures.filter((o) => !o.alive && o.id !== pl.id && smells(w, pl, o)).map((o) => `corpse:${o.id}`)
  for (const L of w.s.map.lights) if (!L.off && L.kind === 'campfire' && cheb(L.pos, pl.pos) <= 8) out.push(`smoke:${w.s.map.id}:${L.pos.x}:${L.pos.y}`)
  return out
}

export function ignoreThreat(w: World, id: number): string | null {
  const pl = player(w), o = w.s.creatures.find((c) => c.id === id && c.alive)
  if (!o || !hostile(w, pl, o)) return '무시할 적이 없다'
  if (cheb(o.pos, pl.pos) <= 3) return '3칸 이내의 위협은 무시할 수 없다'
  if (!(w.s.autoIgnored ??= []).includes(id)) w.s.autoIgnored.push(id)
  w.s.autoStopTurn = undefined
  w.s.autoThreat = undefined
  return null
}

/** T1에 넣을 적: 10칸 안이거나 나를 쫓는 중 */
export function t1Relevant(o: Creature, pl: Creature): boolean {
  return cheb(o.pos, pl.pos) <= T1_RANGE || (o.ai.mode === 'hunt' && o.ai.target === pl.id)
}

const coldStage = (t: number) => t < 32 ? 3 : t < 35 ? 2 : t < 36 ? 1 : 0
const heatStage = (t: number) => t > 40.5 ? 2 : t > 38.5 ? 1 : 0

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
    ...(hasEffect(pl,'lice',turnOf(w))?{lice:true}:{}),
    ...(visibleBeddingFires(w,pl).length?{beddingFires:visibleBeddingFires(w,pl)}:{}),
    ...(pl.aquatic?{water:{submerged:pl.aquatic.submerged,air:pl.aquatic.air}}:{}),
    ...(Object.keys(pl.body.prosthetics ?? {}).length ? { prosthetics: Object.fromEntries(Object.values(pl.body.prosthetics!).map((s) => [s.item.uid, s.item.durability ?? 100])) } : {}),
    hungerStage: hungerStage(w, pl),
    thirstStage: thirstStage(w, pl),
    wounds: pl.body.wounds.length,
    hostiles: hostileIds(w, pl),
    bloodStage: bloodStageOf(bloodLoss(pl)),
    painStage: painStage(painTotal(w, pl)),
    regions: REGIONS.map((r) => regionState(w, pl, r)),
    bleeding: totalBleed(w, pl) > 0,
    fuelWarned: fuel !== undefined && fuel <= FUEL_WARN_TURNS,
    bagFull: !gridSpot(w, bagGrid(pl), ONE_CELL),
    spores: sporesNear(w, pl),
    smells: detectedSmells(w, pl),
    coldStage: coldStage(pl.needs.bodyTemp),
    heatStage: heatStage(pl.needs.bodyTemp),
    frostbiteStage: Math.max(0, ...Object.values(pl.frostbite ?? {}).map((f) => f.grade)),
  }
}

export interface AutoStopOpts {
  /** 처치 중이면 신체 변화(T4)로 끊지 않는다 — 몸을 돌보는 중이므로 */
  skipBody?: boolean
}

/** 시작 시점 스냅샷 대비 새 위협. 사유 문자열 또는 null */
export function autoStop(w: World, s: AutoSnap, opts: AutoStopOpts = {}): string | null {
  const pl = player(w)
  w.s.autoThreat = undefined
  if(pl.aquatic?.submerged&&!s.water?.submerged)return '물속으로 가라앉았다'
  if(pl.aquatic?.submerged&&pl.aquatic.air<=aquaticRules(w).criticalAir&&(s.water?.air??Infinity)>aquaticRules(w).criticalAir)return '숨을 참을 여력이 부족하다'
  // T2 피해·새 상처 (끌 수 없음)
  if (pl.hp < s.hp || pl.body.wounds.length > s.wounds) return '다쳤다'
  if (s.prosthetics && Object.entries(s.prosthetics).some(([uid, dur]) => (Object.values(pl.body.prosthetics ?? {}).find((p) => p.item.uid === Number(uid))?.item.durability ?? -1) < dur)) return '의수족이 손상됐다'
  // T1 새로 인식한 적대 개체
  const known = new Set(s.hostiles)
  for (const id of hostileIds(w, pl)) if (!known.has(id)) {
    const o = w.s.creatures.find((c) => c.id === id)!
    w.s.autoThreat = id
    return `${knownCreatureName(w,o)}이(가) 보인다${o.asleep ? '(잠듦)' : ''}`
  }
  // T3 출처 미상 소음: 수면 박탈의 소리는 이 관찰자에게만 속한다.
  const phantom=privateSound(w,pl)
  if(phantom&&phantom.at>s.turn)return '어디선가 수상한 소리가 났다'
  // 실제 외부 소음
  const amb = ambientNoise(w), hb = hearingBonus(w, pl)
  for (const n of w.s.noiseEvents) {
    if (n.turn <= s.turn || n.source === pl.id) continue
    const src = w.s.creatures.find((c) => c.id === n.source)
    if (src && canSee(w, pl, src.pos)) continue
    if (n.radius - cheb(n.pos, pl.pos) - amb + hb >= SUSPICIOUS) return '어디선가 수상한 소리가 났다'
  }
  // T4 신체 단계 변화
  if(!s.lice&&hasEffect(pl,'lice',turnOf(w)))return '몸이 가렵기 시작했다'
  if (!opts.skipBody) {
    if (hungerStage(w, pl) > (s.hungerStage ?? hungerStage(w, pl))) return '굶주림이 심해졌다'
    if (thirstStage(w, pl) > (s.thirstStage ?? thirstStage(w, pl))) return '갈증이 심해졌다'
    if (bloodStageOf(bloodLoss(pl)) > s.bloodStage) return '피를 너무 많이 흘렸다'
    if (painStage(painTotal(w, pl)) > s.painStage) return '통증이 심해졌다'
    if (REGIONS.some((r, i) => regionState(w, pl, r) > s.regions[i])) return '몸 상태가 나빠졌다'
    if (!s.bleeding && totalBleed(w, pl) > 0) return '피가 흐르기 시작했다'
  }
  if (coldStage(pl.needs.bodyTemp) > (s.coldStage ?? 0)) return '체온이 위험하게 떨어졌다'
  if (heatStage(pl.needs.bodyTemp) > (s.heatStage ?? 0)) return '체온이 위험하게 올랐다'
  if (Math.max(0, ...Object.values(pl.frostbite ?? {}).map((f) => f.grade)) > (s.frostbiteStage ?? 0)) return '말단의 동상이 심해졌다'
  // T5 환경 위험: 포자 구름 3칸 이내
  if(visibleBeddingFires(w,pl).some(id=>!s.beddingFires?.includes(id)))return '가까운 침구에 불이 붙었다'
  if (!s.spores && sporesNear(w, pl)) return '포자 구름이 가깝다'
  // T6 자원 경고: 등불 1분 · 배낭 가득
  const fuel = litFuel(pl)
  if (!s.fuelWarned && fuel !== undefined && fuel <= FUEL_WARN_TURNS) return '등불 기름이 거의 다 됐다'
  if (!s.bagFull && !gridSpot(w, bagGrid(pl), ONE_CELL)) return '배낭이 가득 찼다'
  if (detectedSmells(w, pl).some((key) => !(s.smells ?? []).includes(key))) return '연기나 썩은 냄새가 난다'
  return null
}

/** 이력 현상: 마지막 중단 뒤 3턴 동안은 자동 이동을 다시 시작하지 않는다 */
export function autoBlocked(w: World): number {
  const last = w.s.autoStopTurn
  if (last === undefined) return 0
  return Math.max(0, last + AUTO_HYSTERESIS - turnOf(w))
}
