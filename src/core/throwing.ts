// 실물 한 개의 투척 공격. 검사는 읽기 전용, 성공한 입력만 분리·판정·착지한다.
import { handCapacity, regionState } from './body'
import { previewHit, rangedRange, resolveAttack, type HitPreview } from './combat'
import { creatureById, inBounds, terrainAt, tileAt, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb, line, type Pos } from './geom'
import { canStack, itemDef, maxStack, removeOne, supplyItems, type Wield } from './items'
import { diagonalBlocked } from './path'
import { prostheticGrip } from './prosthetic-state'
import { equipmentSnapshot, runEquipmentWorkers } from './script-item'
import type { Creature, ItemInst } from './types'

export interface ThrowQuote {
  error: string | null
  item?: ItemInst
  target?: Creature
  wield?: Wield
  preview?: HitPreview
  range?: number
}

const validPos = (w: World, p: Pos) => Number.isSafeInteger(p.x) && Number.isSafeInteger(p.y) && inBounds(w, p)

/** 착용한 의복/닫힌 가방을 빼고 배낭과 실제 두 손의 물품만 접근한다. */
export function throwItems(c:Creature):ItemInst[]{return [...supplyItems(c),...([c.equip.main,c.equip.off].filter((i):i is ItemInst=>!!i&&!i.half))]}

/** 기존 시선과 같은 벽 판정에 각 대각 구간의 닫힌 모서리 검사를 더한다. */
function clearThrowLine(w: World, from: Pos, to: Pos): boolean {
  if (!hasLos(w, from, to)) return false
  let prev = from
  for (const p of line(from, to)) {
    if (diagonalBlocked(w, prev, p.x - prev.x, p.y - prev.y)) return false
    prev = p
  }
  return true
}

/** 미리보기와 실제 입력이 같은 실물 UID·팔·대상·시선을 검증한다. 난수/상태 변경 없음. */
export function throwQuote(w: World, c: Creature, uid: number, targetId: number): ThrowQuote {
  const fail = (error: string): ThrowQuote => ({ error })
  if (!w.s.creatures.includes(c) || !c.alive || c.unconscious || c.asleep || c.captivity || c.breakdown?.kind === 'catatonia' || !validPos(w, c.pos)) return fail('지금은 던질 수 없다')
  const item = throwItems(c).find(i => i.uid === uid)
  if (!item || item.missingItem || !Number.isSafeInteger(item.count) || item.count < 1) return fail('손에 닿는 투척물이 없다')
  const def=itemDef(w,item),td = def.throwable
  if (!td) return fail('공격용으로 던질 물건이 아니다')
  if(def.category==='weapon'&&(item.durability??100)<=0)return fail('투척 무기가 부서졌다')
  const usable = (side: 'Right' | 'Left', region: 'rarm' | 'larm') => regionState(w, c, region) < 4 && prostheticGrip(w, c, side) && handCapacity(w, c, side) >= .5
  const heldRight=c.equip.main===item,heldLeft=c.equip.off===item
  const arm = heldRight?(usable('Right','rarm')?'rarm':undefined):heldLeft?(usable('Left','larm')?'larm':undefined):usable('Right', 'rarm') ? 'rarm' : usable('Left', 'larm') ? 'larm' : undefined
  if (!arm) return fail('손 상태 때문에 던질 수 없다')
  if(def.twoHanded&&(!usable('Right','rarm')||!usable('Left','larm')))return fail('두 손 상태 때문에 던질 수 없다')
  const target = creatureById(w, targetId)
  if (!target || target === c || !target.alive || !validPos(w, target.pos) || !terrainAt(w, target.pos).passable || cheb(c.pos, target.pos) < 1) return fail('던질 대상이 없다')
  if (!canSee(w, c, target.pos) || c.id === w.s.playerId && !w.s.visible.includes(target.pos.y * w.s.map.w + target.pos.x)) return fail('대상이 보이지 않는다')
  if (!clearThrowLine(w, c.pos, target.pos)) return fail('투척 경로가 막혔다')
  const source: Wield = { atk: td.attack, item, arm, twoHanded: !!def.twoHanded, throwing: true }
  const range = rangedRange(w, c, target, source)
  if (cheb(c.pos, target.pos) > range) return fail('투척 사거리 밖이다')
  const preview = previewHit(w, c, target, true, undefined, source)
  if (!preview) return fail('투척할 수 없다')
  return { error: null, item, target, wield: source, preview, range }
}

/** 다른 추가 상태를 가진 물품도 병합으로 잃지 않는다. 좌표/UID/개수만 병합 대상에서 뺀다. */
function sameGroundState(a: ItemInst, b: ItemInst): boolean {
  if (!canStack(a, b)) return false
  const skip = new Set(['uid', 'count', 'gx', 'gy'])
  const left = a as unknown as Record<string, unknown>, right = b as unknown as Record<string, unknown>
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].every(key => skip.has(key) || JSON.stringify(left[key]) === JSON.stringify(right[key]))
}

export function throwAtCreature(w: World, c: Creature, uid: number, targetId: number): {error:string|null;arm?:'larm'|'rarm';twoHanded?:boolean} {
  const quote = throwQuote(w, c, uid, targetId)
  if (quote.error) return {error:quote.error}
  const target = quote.target!, landing = { ...target.pos }
  const equipped=c.equip.main===quote.item||c.equip.off===quote.item,before=equipped?equipmentSnapshot(c):[]
  const projectile = removeOne(w, c, uid)
  if (!projectile) return {error:'투척물이 없어졌다'}
  resolveAttack(w, c, target, { ranged: true, wield: { ...quote.wield!, item: projectile } })
  // 명중/빗나감/막기/튕김 모두 같은 실제 투척물이 남는다. 화살 회수·박힘 판정은 하지 않는다.
  const floor = tileAt(w, landing).items, limit = maxStack(itemDef(w, projectile))
  const stack = floor.find(i => i.count < limit && sameGroundState(i, projectile))
  if (stack) stack.count++
  else floor.push(projectile)
  if(equipped)runEquipmentWorkers(w,c,before)
  return {error:null,arm:quote.wield!.arm,...(quote.wield!.twoHanded?{twoHanded:true}:{})}
}
