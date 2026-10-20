// 트라우마의 관찰 상태와 수치. 사고·붕괴·전투를 호출하지 않는 읽기 전용 계층.
import { terrainAt, type World } from './ctx'
import { canSee, lightLevel, hasLos } from './fov'
import { cheb } from './geom'
import { itemDef, lightSource } from './items'
import type { Creature, Trauma, TraumaDef } from './types'

export function fearFamily(w: World, c: Creature): string { return w.db.creature(c.def).fearFamily ?? c.def }
export function traumaLabel(w: World, t: Trauma): string {
  const d = w.db.get<TraumaDef>(t.def)
  const label = t.target ? `${d.label} (${w.db.creature(t.target).label})` : d.label
  return t.overcome <= -50 ? `공황: ${label}` : label
}
export function fearTargets(w: World, c: Creature, target: string): Creature[] {
  return w.s.creatures.filter((o) => o.id !== c.id && o.alive && fearFamily(w, o) === target && canSee(w, c, o.pos))
}
export function fearActive(w: World, c: Creature, t: Trauma): boolean {
  if (!c.alive || c.unconscious || c.asleep) return false
  switch (w.db.get<TraumaDef>(t.def).kind) {
    case 'species': return !!t.target && fearTargets(w, c, t.target).length > 0
    case 'fire': return w.s.map.lights.some((l) => !l.off && (l.kind === 'campfire' || l.kind === 'brazier' || l.kind === 'torch') && cheb(l.pos, c.pos) <= 3 && hasLos(w, c.pos, l.pos)) || w.s.creatures.some((o) => o.alive && cheb(o.pos, c.pos) <= 3 && hasLos(w, c.pos, o.pos) && (itemDefForLight(w, o)?.light?.warmth ?? 0) > 0)
    case 'water': return !!terrainAt(w, c.pos).water
    case 'dark': return lightLevel(w, c.pos) === 3
    case 'blood': return c.body.wounds.some((wd) => !wd.internal && wd.bleed > 0 && wd.healed < wd.severity) || w.s.creatures.some((o) => o.id !== c.id && canSee(w, c, o.pos) && o.body.wounds.some((wd) => !wd.internal && wd.bleed > 0 && wd.healed < wd.severity))
  }
}
export function traumaHit(w: World, c: Creature, target: Creature): number {
  const family = fearFamily(w, target)
  let v = 0
  for (const t of c.traumas ?? []) if (t.target === family && fearActive(w, c, t)) v += w.db.get<TraumaDef>(t.def).hit
  if (c.fearlessAgainst?.includes(family)) v += w.db.get<TraumaDef>('Trauma.Species').positive.hit
  return v
}
export function traumaMorale(w: World, c: Creature): number {
  let v = 0
  for (const t of c.traumas ?? []) if (fearActive(w, c, t)) v += w.db.get<TraumaDef>(t.def).morale
  if (c.fearlessAgainst?.some((f) => fearTargets(w, c, f).length)) v += w.db.get<TraumaDef>('Trauma.Species').positive.morale
  return v
}

function itemDefForLight(w: World, c: Creature) { const source = lightSource(w, c); return source ? itemDef(w, source.it) : undefined }
export function traumaHelp(w: World, t: Trauma): string[] {
  const d = w.db.get<TraumaDef>(t.def)
  const detail: Record<TraumaDef['kind'], string[]> = {
    species: [`시야에 들면 기분 ${d.mood} · 스트레스 +${d.stressPer10}/10턴 · 상대 명중 ${d.hit} · 사기 ${d.morale}`, `붕괴 없이 교전 승리 +${d.overcome.victory} · 마무리 +${d.overcome.finishing}`, `위협이 자신의 절반 이상인 상대만 인정 · 물러남 ${d.overcome.flee} · 앞에서 붕괴 ${d.overcome.breakdown}`],
    fire: [`불 3칸 안 기분 ${d.mood} · 자기 상처 소작 거부`, `모닥불·횃불 켜기 +${d.overcome.fireDay}/일`],
    water: ['얕은 물 진입 시 즉시 붕괴 판정 · 깊은 물 진입 거부', `반대 기슭까지 건너기 +${d.overcome.crossing}`],
    dark: [`칠흑에서 스트레스 +${d.stressPer10}/10턴`, `잠들지 않고 광원 없이 칠흑 1시간 +${d.overcome.darkHour}`],
    blood: ['처음 보는 출혈 상처마다 기절 확률 5% + 심각도%', `자기 상처 처치 +${d.overcome.treatment} · 같은 상처 한 번`],
  }
  return [...detail[d.kind], '100점이면 극복 · −50점 이하면 공황(등장 시 붕괴 판정 ×3)']
}
