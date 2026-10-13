import { describe, expect, it } from 'vitest'
import { autoBlocked, autoSnap, autoStop } from '../src/core/autostop'
import { previewHit } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR } from '../src/core/ctx'
import { addToBag, makeItem } from '../src/core/items'
import { emitNoise, sleepCycleDeep, wakeThreshold } from '../src/core/perception'
import type { Creature } from '../src/core/types'
import { makeWorld } from './helpers'

/** 한낮·맑음, 주변 개체 정리, 플레이어 주변 9×9 맨땅 */
function setup(seed: string) {
  const w = makeWorld(seed)
  w.s.time = (TURNS_PER_DAY + 12 * TURNS_PER_HOUR) * 100
  w.s.weather = 'clear'
  w.s.weatherUntil = Infinity
  const pl = player(w)
  w.s.creatures = [pl]
  pl.traits = []
  pl.abilities = []
  pl.equip = {}
  pl.bag = []
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const t = tileAt(w, { x: pl.pos.x + dx, y: pl.pos.y + dy })
    t.t = 'Terrain.Earth'
    t.items = []
    t.spores = undefined
  }
  return { w, pl }
}

const sleep = (pl: Creature) => { pl.activity = { kind: 'sleep', remaining: 9600, label: '수면' } }
const at = (pl: Creature, dx: number) => ({ x: pl.pos.x + dx, y: pl.pos.y })

describe('수면 주기 (01 §8)', () => {
  it('얕은 30분 → 깊은 45분 → 얕은 15분, 지침이면 깊은 잠 +15분', () => {
    const M = TURNS_PER_HOUR / 60 // 1분 = 20턴
    expect(sleepCycleDeep(0, 50)).toBe(false)
    expect(sleepCycleDeep(30 * M - 1, 50)).toBe(false)
    expect(sleepCycleDeep(30 * M, 50)).toBe(true)
    expect(sleepCycleDeep(75 * M - 1, 50)).toBe(true)
    expect(sleepCycleDeep(75 * M, 50)).toBe(false)
    expect(sleepCycleDeep(90 * M + 30 * M, 50)).toBe(true) // 다음 주기
    expect(sleepCycleDeep(89 * M, 80)).toBe(true) // 지침: 깊은 잠 30~90분, 주기 105분
    expect(sleepCycleDeep(90 * M, 80)).toBe(false)
  })

  it('검산 4: 깊은 잠 8 + 지침 1 = 9. 외침 12가 4칸이면 못 깨고 3칸이면 깬다', () => {
    const { w, pl } = setup('slp1')
    pl.needs.fatigue = 80
    sleep(pl)
    pl.deepSleep = true
    expect(wakeThreshold(w, pl)).toBe(9)
    emitNoise(w, at(pl, 4), 12, 999)
    expect(pl.activity?.wokeBy).toBeUndefined()
    emitNoise(w, at(pl, 3), 12, 999)
    expect(pl.activity?.wokeBy).toBe('소리에 잠이 깼다.')
  })

  it('얕은 잠(3 + 1)이면 8칸 밖 외침에도 깬다, 가죽 장화 발소리 3은 바로 옆이어도 못 깨운다', () => {
    const { w, pl } = setup('slp2')
    pl.needs.fatigue = 80
    sleep(pl)
    emitNoise(w, { x: pl.pos.x + 4, y: pl.pos.y + 4 }, 3, 999)
    emitNoise(w, at(pl, 1), 3, 999)
    expect(pl.activity?.wokeBy).toBeUndefined()
    emitNoise(w, { x: pl.pos.x - 4, y: pl.pos.y }, 8, 999) // 세기 8 − 4 = 4 ≥ 4
    expect(pl.activity?.wokeBy).toBe('소리에 잠이 깼다.')
  })

  it('자는 플레이어는 잠든 상대 (명중 +40, 08 §8.4 대칭)', () => {
    const { w, pl } = setup('slp3')
    const r = createCreature(w, 'Creature.Reaver', at(pl, 1))
    w.s.creatures.push(r)
    sleep(pl)
    const pv = previewHit(w, r, pl)!
    expect(pv.lines.some((l) => l.includes('잠든 상대 +40'))).toBe(true)
  })
})

describe('자동 모드 중단 T1~T6 (01 §6.2)', () => {
  function world() {
    const { w, pl } = setup('auto1')
    return { w, pl, snap: autoSnap(w) }
  }
  it('T1 새 적대 개체(잠든 개체 포함)', () => {
    const { w, pl, snap } = world()
    const s = createCreature(w, 'Creature.Shade', at(pl, 2))
    s.asleep = true
    w.s.creatures.push(s)
    w.s.visible = [s.pos.y * w.s.map.w + s.pos.x]
    expect(autoStop(w, snap)).toContain('(잠듦)')
  })
  it('T2 피해 · T3 보이지 않는 곳의 소리 · T6 배낭 가득', () => {
    const { w, pl, snap } = world()
    expect(autoStop(w, snap)).toBeNull()
    w.s.time += 100
    emitNoise(w, { x: pl.pos.x + 30, y: pl.pos.y }, 3, 999) // 멀어서 못 들음
    expect(autoStop(w, snap)).toBeNull()
    emitNoise(w, at(pl, 4), 8, 999) // 8 − 4 = 4 ≥ 2 '수상한 소리'
    expect(autoStop(w, snap)).toBe('어디선가 수상한 소리가 났다')
    const { w: w2, pl: p2, snap: s2 } = world()
    p2.hp -= 1
    expect(autoStop(w2, s2)).toBe('다쳤다')
    const { w: w3, pl: p3, snap: s3 } = world()
    // 1칸짜리로 배낭을 채운다 (가로 × 세로 칸 수 이상 넣으면 반드시 가득)
    for (let i = 0; i < 200; i++) if (addToBag(w3, p3, makeItem(w3, 'Item.Bones')) > 0) break
    expect(autoStop(w3, s3)).toBe('배낭이 가득 찼다')
  })
  it('이력 현상: 멈춘 뒤 3턴은 자동 이동 불가', () => {
    const { w } = world()
    w.s.autoStopTurn = turnOf(w)
    expect(autoBlocked(w)).toBe(3)
    w.s.time += 300
    expect(autoBlocked(w)).toBe(0)
  })
})

