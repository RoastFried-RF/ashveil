// 02 §12.2·13. 외과 처치의 조건과 지속 효과. 행동 시작/완료는 actions가 담당한다.
import { log, rng, turnOf, type World } from './ctx'
import { capacity } from './body'
import { allItems, itemDef, qualityOf } from './items'
import { masteryStage } from './skills'
import type { Creature, RecoveryDef, SurgeryDef, Wound } from './types'

export type Surgery = SurgeryDef['kind']
export const isSurgery = (kind?: string): kind is Surgery => ['suture', 'ligate', 'tendon'].includes(kind ?? '')
export function surgeryDef(w: World, kind: Surgery): SurgeryDef { return w.db.all<SurgeryDef>('Surgery').find((d) => d.kind === kind)! }
export function surgeryTool(w: World, c: Creature, def: SurgeryDef) {
  return allItems(c).filter((i) => (i.durability ?? 100) > 0 && itemDef(w, i).toolTags?.includes(def.toolTag)).sort((a, b) => qualityOf(b) - qualityOf(a) || a.uid - b.uid)[0]
}
export function surgeryError(w: World, c: Creature, d: SurgeryDef, wd?: Wound, part?: string, patient: Creature = c): string | null {
  if (capacity(w, c, 'consciousness') < .5) return '혼미한 상태에서는 봉합할 수 없다'
  if (masteryStage(w, c, 'medicine') < d.mastery) return `의료 숙달${d.mastery}단계가 필요하다`
  if (!surgeryTool(w, c, d)) return '쓸 수 있는 바늘이 필요하다'
  if (c.bag.filter((i) => i.def === d.supply).reduce((n, i) => n + i.count, 0) < d.count) return `${w.db.item(d.supply).label} ${d.count}개가 필요하다`
  const target = wd?.part ?? part, p = w.db.body(patient.body.def).parts.find((p) => p.id === target)
  if (!p) return '처치할 부위가 없다'
  let ancestor = p
  while (ancestor) {
    if (patient.body.missing.includes(ancestor.id)) return '처치할 부위가 없다'
    const parent = w.db.body(patient.body.def).parts.find((p) => p.id === ancestor.parent)
    if (!parent) break
    ancestor = parent
  }
  if (patient.id === c.id && (p.groups.includes('eye') || p.groups.includes('back') || /Eye|Back/.test(p.id))) return '자기 눈이나 등에 봉합할 수 없다'
  if (wd?.internal || p.internal) return '몸속 상처는 이 처치로 봉합할 수 없다'
  if (d.kind === 'tendon' && target) {
    const since = patient.body.tendonSince?.[target] ?? (wd?.tendon ? wd.tendonAt ?? turnOf(w) - wd.ageTurns : undefined)
    if (since !== undefined && turnOf(w) - since >= w.db.get<RecoveryDef>('Recovery.Wounds').tendonPermanentTurns) return '30일 방치한 힘줄 손상은 영구적이다'
  }
  if (d.kind === 'tendon') return wd?.tendon || (target && patient.body.damagedTendons?.includes(target)) ? null : '봉합할 힘줄 손상이 없다'
  if (!wd || wd.healed >= wd.severity) return '봉합할 열린 상처가 없다'
  if (d.kind === 'ligate') return (wd.artery ?? 0) > 0 ? null : '결찰할 동맥 출혈이 없다'
  if ((wd.artery ?? 0) > 0) return '동맥 결찰이 먼저 필요하다 (의료 숙달3단계)'
  if (!w.db.wound(wd.def).suturable) return '이 종류의 상처는 꿰맬 수 없다'
  return wd.suture ? '이미 봉합되어 있다' : null
}
export function sutureRule(w: World, wd: Wound): SurgeryDef | undefined { return wd.suture ? w.db.get<SurgeryDef>(wd.suture.def) : undefined }
export function strainStitches(w: World, c: Creature) {
  for (const wd of c.body.wounds) {
    const s = wd.suture, rule = s && sutureRule(w, wd)
    if (!s || !rule || s.quality >= rule.tearBelowQ || !rng(w, 'body').chance(rule.tearChance)) continue
    wd.suture = undefined
    if (c.faction === 'player') log(w, 'danger', '격한 움직임에 실밥이 터졌다. 상처가 다시 벌어졌다.')
  }
}
export function markSuture(w: World, wd: Wound, def: SurgeryDef, quality: number) { wd.suture = { def: def.id, quality, at: turnOf(w) } }
