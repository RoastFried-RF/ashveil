// 소음·냄새 전파. 벽은 소리를 줄이고, 바람은 냄새를 실어 나른다.

import { capacity, totalBleed } from './body'
import { isOpaque, log, player, terrainAt, turnOf, type World } from './ctx'
import { cheb, dirIndex, DIR_LABELS, line, type Pos } from './geom'
import { allItems, itemDef } from './items'
import type { Creature } from './types'

export function emitNoise(w: World, pos: Pos, radius: number, sourceId: number) {
  const turn = turnOf(w)
  w.s.noiseEvents.push({ pos: { ...pos }, radius, source: sourceId, turn })
  if (w.s.noiseEvents.length > 30) w.s.noiseEvents.shift()
  const pl = player(w)
  const src = w.s.creatures.find((o) => o.id === sourceId)
  for (const c of w.s.creatures) {
    if (!c.alive || c.unconscious || c.id === sourceId) continue
    // 동료의 발소리·일상 소음은 무시한다 (경보 외침은 radius ≥ 6)
    if (src && src.faction === c.faction && radius < 6) continue
    const d = cheb(c.pos, pos)
    if (d > radius) continue
    let walls = 0
    for (const p of line(c.pos, pos)) if (isOpaque(w, p)) walls++
    const eff = (radius - walls * 2) * Math.max(0.2, capacity(w, c, 'hearing'))
    if (d > eff) continue
    if (c.id === pl.id) {
      if (radius >= 6 && d > 2 && !w.s.visible.includes(pos.y * w.s.map.w + pos.x)) {
        const dir = DIR_LABELS[dirIndex(pos.x - c.pos.x, pos.y - c.pos.y)]
        log(w, 'flavor', `${dir}쪽 어딘가에서 소리가 났다.`)
      }
      continue
    }
    if (c.asleep) {
      // 각성 판정 (14 §7.2): 도달 세기 = 소음 − 거리 − 가로막힘(벽 2·닫힌 문 4) + 청각 보정 ≥ 임계(얕은 잠 3 · 깊은 잠 8, 포자 +2 · 말라붙은 자 −1)
      let block = 0
      for (const p of line(c.pos, pos)) { const t = terrainAt(w, p); if (t.door === 'closed') block += 4; else if (t.opaque) block += 2 }
      const strength = radius - d - block + Math.round((capacity(w, c, 'hearing') - 1) * 3)
      const cid = c.def
      const thr = (c.deepSleep ? 8 : 3) + (cid === 'Creature.SporeMan' ? 2 : 0) + (cid === 'Creature.Withered' || cid === 'Creature.WitheredPriest' ? -1 : 0)
      if (strength >= thr) {
        c.asleep = false
        c.deepSleep = undefined
        c.ai.alertTurn = turnOf(w)
        w.s.fx.push({ k: 'status', id: c.id, text: '!', color: '#ffd060', turn: turnOf(w) })
      } else continue
    }
    if (c.ai.mode === 'idle' || c.ai.mode === 'wander' || c.ai.mode === 'investigate' || c.ai.mode === 'guard' || c.ai.mode === 'return') {
      c.ai.mode = 'investigate'
      c.ai.dest = { ...pos }
      c.ai.path = undefined
    }
  }
}

/** 냄새 세기: 외부 출혈 + 들고 있는 날고기 등 */
export function scentStrength(w: World, c: Creature): number {
  let s = totalBleed(w, c, true)
  for (const it of allItems(c)) s += (itemDef(w, it).food?.scent ?? 0) * it.count
  return s
}

/** 냄새로 대상을 감지하는가 (바람 방향 반영) */
export function smells(w: World, sniffer: Creature, target: Creature): boolean {
  const sense = w.db.creature(sniffer.def).scentSense ?? 0
  if (sense <= 0) return false
  const strength = scentStrength(w, target)
  if (strength <= 0.3) return false
  let range = Math.min(22, (3 + strength / 3) * sense)
  const vx = sniffer.pos.x - target.pos.x, vy = sniffer.pos.y - target.pos.y
  const dot = vx * w.s.wind.x + vy * w.s.wind.y
  if (dot > 0) range *= 1.6
  else if (dot < 0) range *= 0.5
  return cheb(sniffer.pos, target.pos) <= range
}
