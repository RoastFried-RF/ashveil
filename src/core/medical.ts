// 02 §12. 절단·이물질·탈구. 중단 때는 효과를 내지 않고 완료 시 조건을 다시 검사한다.
import { addWound, capacity, handCapacity, isDescendantOrSelf, isMissing, painSpike, part, tryPart } from './body'
import { killCreature } from './combat'
import { clamp, log, rng, tileAt, turnOf, type World } from './ctx'
import { hasLos } from './fov'
import { cheb } from './geom'
import { allItems, itemDef, makeItem, qualityOf } from './items'
import {rememberPartLoss} from './body-memories'
import { practice } from './skills'
import type { Creature, ProcedureDef, RecoveryDef, Slot, Wound } from './types'

export type Procedure = ProcedureDef['kind']
export const isProcedure = (kind?: string): kind is Procedure => ['amputate', 'extract', 'reduce'].includes(kind ?? '')
export const procedureDef = (w: World, kind: Procedure) => w.db.all<ProcedureDef>('Procedure').find((d) => d.kind === kind)!
export const medicalRules = (w: World) => w.db.get<RecoveryDef>('Recovery.Wounds')
export function treatmentArm(w: World, c: Creature, target?: string): 'larm' | 'rarm' {
  const region = target ? tryPart(w, c, target)?.region : undefined
  if (region === 'rarm') return 'larm'
  if (region === 'larm') return 'rarm'
  return handCapacity(w, c, 'Left') > handCapacity(w, c, 'Right') ? 'larm' : 'rarm'
}
export function medicalBlade(w: World, c: Creature) {
  return allItems(c).filter((i) => (i.durability ?? 100) > 0 && itemDef(w, i).attacks?.some((a) => a.family === 'blade')).sort((a, b) => qualityOf(b) - qualityOf(a) || a.uid - b.uid)[0]
}
export function canHeatBlade(w: World, c: Creature): boolean {
  if (!medicalBlade(w, c)) return false
  return allItems(c).some((i) => i.lit && (i.fuel ?? 0) > 0 && itemDef(w, i).light)
    || w.s.map.lights.some((l) => !l.off && ['campfire', 'brazier'].includes(l.kind) && cheb(l.pos, c.pos) <= 1 && hasLos(w, c.pos, l.pos))
}
export function procedureError(w: World, c: Creature, d: ProcedureDef, wd?: Wound, target = wd?.part, patient: Creature = c): string | null {
  if(w.db.body(patient.body.def).kind==='mechanical')return '기계형에는 의료 시술을 할 수 없다'
  const p = target && tryPart(w, patient, target)
  if (!p || isMissing(w, patient, p.id)) return '처치할 부위가 없다'
  if (p.internal || wd?.internal || c.id === patient.id && /Eye|Back/.test(p.id)) return '혼자 처치할 수 없는 부위다'
  const side = treatmentArm(w, c, c.id === patient.id ? p.id : undefined) === 'larm' ? 'Left' : 'Right'
  if (capacity(w, c, 'consciousness') < .5 || handCapacity(w, c, side) < .1) return '의식이나 손 상태 때문에 처치할 수 없다'
  if (d.blade && !medicalBlade(w, c)) return '쓸 수 있는 칼날이 필요하다'
  if (d.kind === 'amputate') {
    if (!p.limb || p.vital || (!p.parent && !p.stumpParent)) return '팔다리만 절단할 수 있다'
    if (patient.body.tourniquets[p.limb] === undefined) return '먼저 해당 상완이나 대퇴에 지혈대를 감아야 한다'
  }
  if (d.kind === 'extract' && !wd?.foreign) return '제거할 이물질이 없다'
  if (d.kind === 'reduce' && !wd?.dislocated) return '맞출 탈구가 없다'
  return null
}

/** 절단면은 부모 부위에 남고, 기존 지혈대가 절단면의 혈류도 차단한다. */
function amputate(w: World, c: Creature, target: string, d: ProcedureDef, q: number) {
  const pd = part(w, c, target), removed = (id: string) => isDescendantOrSelf(w, c, id, target)
  c.body.missing = c.body.missing.filter((id) => !removed(id)); c.body.missing.push(target)
  c.body.wounds = c.body.wounds.filter((wd) => !removed(wd.part))
  c.body.scars = c.body.scars?.filter((s) => !removed(s.part))
  c.body.chronicPain = c.body.chronicPain?.filter((id) => !removed(id))
  c.body.damagedTendons = c.body.damagedTendons?.filter((id) => !removed(id))
  if (c.body.tendonSince) for (const id of Object.keys(c.body.tendonSince)) if (removed(id)) delete c.body.tendonSince[id]
  const severity = Math.max(1, Math.round(c.body.maxHp[target] * d.stumpFraction!))
  const { wound } = addWound(w, c, { def: 'Wound.Cut', part: (pd.parent ?? pd.stumpParent)!, severity, source: `${pd.label} 절단`, contam: 15 })
  wound.stumpLimb = pd.limb
  ;(c.body.amputationQuality ??= {})[target] = q >= d.prostheticThreshold! ? d.prostheticBonus! : 0
  c.hp = Math.max(0, c.hp - severity)
  const drops: [Slot, string][] = [['main', 'RightHand'], ['off', 'LeftHand'], ['ring1', 'RightRing'], ['ring2', 'LeftRing']]
  for (const [slot, anchor] of drops) {
    const it = c.equip[slot]
    if (!it || !isMissing(w, c, anchor)) continue
    delete c.equip[slot]; it.gx = undefined; it.gy = undefined; it.half = undefined; tileAt(w, c.pos).items.push(it)
  }
  if (c.equip.main && itemDef(w, c.equip.main).twoHanded && isMissing(w, c, 'LeftHand')) { tileAt(w, c.pos).items.push(c.equip.main); delete c.equip.main }
  rememberPartLoss(w,c,pd)
  c.history.push({ turn: turnOf(w), kind: 'maimed', text: `${pd.label} 절단 (Q ${q})` })
}

export function finishProcedure(w: World, c: Creature, d: ProcedureDef, q: number, wd?: Wound, target = wd?.part, actor: Creature = c) {
  if (d.kind === 'amputate') amputate(w, c, target!, d, q)
  if (d.kind === 'extract' && wd?.foreign) {
    wd.suture = undefined; wd.bandage = undefined
    if (rng(w, 'body').chance(q / 100)) {
      const foreign = wd.foreign
      wd.foreign = undefined; wd.contam = Math.max(0, wd.contam - foreign.contam)
      c.body.blood = Math.max(0, c.body.blood - wd.severity * d.bloodPerSeverity!)
      if (foreign.kind === 'arrow' && foreign.ammo) tileAt(w, c.pos).items.push(makeItem(w, foreign.ammo))
      if (c.faction === 'player') log(w, 'good', `이물질을 뽑았다. 순간적으로 피 ${wd.severity * d.bloodPerSeverity!}ml을(를) 잃었다.`)
    } else {
      wd.severity += d.failureSeverity!
      c.hp = Math.max(0, c.hp - d.failureSeverity!)
      wd.bleed += d.failureSeverity! * w.db.wound(wd.def).bleedPerSeverity * (part(w, c, wd.part).vessel ?? 1)
      if (c.faction === 'player') log(w, 'danger', '이물질을 꺼내지 못하고 상처가 더 벌어졌다.')
    }
  }
  if (d.kind === 'reduce' && wd) wd.dislocated = false
  painSpike(w, c, d.painSpike)
  practice(w, actor, 'medicine', wd ? `wound:${wd.id}` : `amputate:${target}`)
  if (c.faction === 'player') log(w, 'info', `${d.label} 시도 종료 (Q ${q}).`)
  if (c.hp <= 0) killCreature(w, c, '치명상')
  else if (c.body.blood <= c.body.bloodMax * .5) killCreature(w, c, '과다 출혈')
}

export function lodgeProjectile(w: World, c: Creature, wd: Wound, ammo: string, intact: boolean) {
  const rules = medicalRules(w)
  if (!intact && !rng(w, 'combat').chance(rules.brokenHeadChance)) return
  const contam = Math.min(rules.foreignContam, 100 - wd.contam)
  wd.foreign = { kind: intact ? 'arrow' : 'fragment', ammo: intact ? ammo : undefined, contam, pain: 0 }
  wd.contam = clamp(wd.contam + contam, 0, 100)
  if (c.faction === 'player') log(w, 'warn', intact ? '화살이 박혔다. 움직이면 아프고, 뽑으면 피가 더 흐른다.' : '부러진 촉이 상처에 남았다.')
}
export function strainProjectiles(w: World, c: Creature) {
  for (const wd of c.body.wounds) if (wd.foreign?.kind === 'arrow') wd.foreign.pain = Math.min(150, wd.foreign.pain + medicalRules(w).arrowMovePain)
}
