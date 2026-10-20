// 결손 부위에 설치한 의수족의 수술·정비·피격. 원래의 결손 기록은 보존한다.
import {runItemLifecycleWorker,runItemMaterialWorker,type ScriptItemDebit} from './script-item'
import type {ProstheticWorkerMethod,ScriptJson} from './script-contracts'
import { anatomicalMissing, capacity, handCapacity, isDescendantOrSelf } from './body'
import { log, tileAt, turnOf, type World } from './ctx'
import { allItems, addToBag, findItem, itemDef, removeOne, removeStack } from './items'
import { treatmentArm } from './medical'
import { prostheticAt, prostheticEfficiency } from './prosthetic-state'
import { masteryStage, practice } from './skills'
import { addThought } from './thoughts'
import { effectiveStat, traitAdd } from './traits'
import type { Creature, ItemInst, ProstheticDef, ProstheticOperation } from './types'

export function relicAppraisal(w: World, c: Creature): number {
  return effectiveStat(w, c, 'per') + (c.literacy ?? (c.literate ? 2 : 0)) * 3 + traitAdd(w, c, 'relicAppraisal')
}
export function appraiseRelic(w: World, c: Creature, it: ItemInst) {
  const score = relicAppraisal(w, c), stage = score >= 25 ? 2 : score >= 15 ? 1 : 0
  it.appraisal = Math.max(it.appraisal ?? 0, stage) as 0 | 1 | 2
  if (c.faction === 'player') log(w, stage === 2 ? 'good' : 'info', stage === 2 ? `${itemDef(w, it).label}의 용도와 기능을 알아냈다.` : stage === 1 ? '용도는 짐작하지만 정확한 구조는 알 수 없다.' : '유물의 용도를 알아내지 못했다.')
}
export function prostheticError(w: World, c: Creature, operation: ProstheticOperation, root: string, uid?: number): string | null {
  const parts = w.db.body(c.body.def).parts, part = parts.find((p) => p.id === root), installed = c.body.prosthetics?.[root]
  const it = operation === 'install' ? c.bag.find((i) => i.uid === uid) : installed?.item
  const id = operation === 'install' ? it && itemDef(w, it).prosthetic : installed?.def
  if (!part || !it || !id) return '대상 의수족이나 부위를 찾을 수 없다'
  const d = w.db.get<ProstheticDef>(id)
  if (operation === 'install') {
    if (installed || !c.body.missing.includes(root) || !d.targets.includes(root)) return '맞는 결손 부위에만 설치할 수 있다'
    if (part.parent && anatomicalMissing(w, c, part.parent)) return '그 위의 팔다리도 없어 고정할 수 없다'
    if ((it.durability ?? 100) <= 0) return '부서진 의수족은 설치할 수 없다'
    if (d.appraisalRequired && (it.appraisal ?? 0) < 2) return '정확히 감정한 유물만 설치할 수 있다'
  }
  if (capacity(w, c, 'consciousness') < .5) return '의식이 흐려 처치할 수 없다'
  const arm = treatmentArm(w, c, root)
  if (handCapacity(w, c, arm === 'larm' ? 'Left' : 'Right') < .1) return '처치할 손을 쓸 수 없다'
  if (masteryStage(w, c, 'medicine') < d.medicine) return `의료 숙달${d.medicine}단계가 필요하다`
  if (d.tool && !allItems(c).some((i) => itemDef(w, i).toolTags?.includes(d.tool!) && (i.durability ?? 100) > 0)) return '설치·분리에 필요한 도구가 없다'
  const supply = operation === 'service' ? d.maintenanceItem : operation === 'charge' ? d.powerItem : undefined
  if ((operation === 'service' || operation === 'charge') && !supply) return '이 의수족에는 해당 정비가 필요하지 않다'
  if (supply && !c.bag.some((i) => i.def === supply && i.count > 0)) return `${w.db.item(supply).label}이(가) 필요하다`
  return null
}
export function startProsthetic(w: World, c: Creature, operation: ProstheticOperation, root: string, uid: number | undefined, factor: number): string | null {
  const err = prostheticError(w, c, operation, root, uid)
  if (err) return err
  const it = operation === 'install' ? findItem(c, uid!)! : c.body.prosthetics![root].item
  const d = w.db.get<ProstheticDef>(operation === 'install' ? itemDef(w, it).prosthetic! : c.body.prosthetics![root].def)
  const tool = d.tool ? allItems(c).find((i) => itemDef(w, i).toolTags?.includes(d.tool!) && (i.durability ?? 100) > 0) : undefined
  const total = Math.max(1, Math.ceil((operation === 'install' ? d.installTurns : operation === 'remove' ? d.removeTurns : d.serviceTurns) * factor))
  c.activity = { kind: 'prosthetic', prostheticDef: d.id, prostheticOperation: operation, remaining: total, total, uid: it.uid, toolUid: tool?.uid, limb: root, label: `${d.label} ${operation === 'install' ? '설치' : operation === 'remove' ? '분리' : operation === 'service' ? '정비' : '전원셀 교체'}` }
  return null
}
export function prostheticStep(w: World, c: Creature): boolean {
  const act = c.activity!, operation = act.prostheticOperation!, root = act.limb!
  const err = prostheticError(w, c, operation, root, act.uid)
  const tool = act.toolUid === undefined ? undefined : allItems(c).find((i) => i.uid === act.toolUid)
  const installed = c.body.prosthetics?.[root]
  const actualDef = operation === 'install' ? c.bag.find((i) => i.uid === act.uid)?.def : installed?.item.def
  if (err || (actualDef && w.db.item(actualDef).prosthetic !== act.prostheticDef) || (operation !== 'install' && installed?.item.uid !== act.uid) || (act.toolUid !== undefined && (!tool || (tool.durability ?? 100) <= 0))) {
    if (c.faction === 'player') log(w, 'warn', `${act.label} 중단: ${err ?? '쓰던 의수족이나 도구가 바뀌었다'}.`)
    c.activity = undefined; return true
  }
  if (act.remaining > 0) return false
  const now = turnOf(w)
  let changed:ItemInst,material:ScriptItemDebit|undefined
  const details:Record<string,ScriptJson>={operation,part:root,prosthetic:act.prostheticDef!,at:now}
  if (operation === 'install') {
    const it = removeStack(c, act.uid!)!, d = w.db.get<ProstheticDef>(itemDef(w, it).prosthetic!)
    changed=it
    it.gx = undefined; it.gy = undefined; it.rot = undefined
    ;(c.body.prosthetics ??= {})[root] = { def: d.id, item: it, installedAt: now, servicedAt: now - (d.maintenanceTurns ? d.maintenanceTurns - (it.maintenanceRemaining ?? d.maintenanceTurns) : 0), ...(d.whispers ? { whisperAt: now + d.whispers.everyTurns } : {}), ...(d.powerTurns ? { powerUntil: now + (it.powerRemaining ?? d.powerTurns) } : {}) }
    c.body.wounds = c.body.wounds.filter((wd) => !isDescendantOrSelf(w, c, wd.part, root))
    practice(w, c, 'medicine', `prosthetic:${it.uid}`)
  } else {
    const state = installed!, d = w.db.get<ProstheticDef>(state.def)
    changed=state.item
    if (operation === 'remove') {
      if (d.maintenanceTurns) state.item.maintenanceRemaining = Math.max(0, d.maintenanceTurns - (now - state.servicedAt))
      if (d.powerTurns) state.item.powerRemaining = Math.max(0, (state.powerUntil ?? now) - now)
      delete c.body.prosthetics![root]
      const left = addToBag(w, c, state.item)
      details.destination=left?'ground':'bag'
      if (left) tileAt(w, c.pos).items.push({ ...state.item, count: left, gx: undefined, gy: undefined })
    } else {
      const supply = operation === 'charge' ? d.powerItem! : d.maintenanceItem!
      const source=c.bag.find(i=>i.def===supply)!
      material={uid:source.uid,item:source.def,countConsumed:1,usesConsumed:0,mlConsumed:0,gramsConsumed:0}
      removeOne(w,c,source.uid)
      details.materialUid=source.uid;details.material=source.def
      details.before=operation==='charge'?(state.powerUntil??now):state.servicedAt
      if (operation === 'charge') state.powerUntil = now + d.powerTurns!
      else state.servicedAt = now
      details.after=operation==='charge'?state.powerUntil!:state.servicedAt
    }
  }
  if (tool) tool.durability = Math.max(0, (tool.durability ?? 100) - 1)
  if (c.faction === 'player') log(w, 'good', `${act.label} 완료.`)
  c.activity = undefined
  if(material)runItemMaterialWorker(w,c,material,{operation,part:root,prosthetic:act.prostheticDef!,targetUid:changed.uid})
  const method:ProstheticWorkerMethod=operation==='install'?'onProstheticInstalled':operation==='remove'?'onProstheticRemoved':operation==='charge'?'onProstheticCharged':'onProstheticServiced'
  runItemLifecycleWorker(w,method,c,changed,details)
  return true
}
export function damageProsthetic(w: World, c: Creature, part: string, damage: number): boolean {
  const p = prostheticAt(w, c, part)
  if (!p) return false
  p.state.item.durability = Math.max(0, (p.state.item.durability ?? 100) - damage / p.rule.structureHp * 100)
  if (p.state.item.durability <= 0) {
    if (p.rule.maintenanceTurns) p.state.item.maintenanceRemaining = Math.max(0, p.rule.maintenanceTurns - (turnOf(w) - p.state.servicedAt))
    p.state.item.powerRemaining = Math.max(0, (p.state.powerUntil ?? turnOf(w)) - turnOf(w))
    delete c.body.prosthetics![p.root]
    tileAt(w, c.pos).items.push({ ...p.state.item, gx: undefined, gy: undefined })
    if (c.faction === 'player') log(w, 'danger', `${p.rule.label}이(가) 부서져 떨어졌다.`)
    runItemLifecycleWorker(w,'onProstheticBroken',c,p.state.item,{part:p.root,prosthetic:p.rule.id,damage,durability:p.state.item.durability!,destination:'ground',at:turnOf(w)})
  }
  return true
}
export function prostheticTick(w: World, c: Creature) {
  const now = turnOf(w)
  for (const state of Object.values(c.body.prosthetics ?? {})) {
    const d = w.db.get<ProstheticDef>(state.def)
    if (d.whispers && now >= (state.whisperAt ?? state.installedAt + d.whispers.everyTurns)) { addThought(w, c, d.whispers.thought); state.whisperAt = now + d.whispers.everyTurns }
  }
}
export function prostheticLines(w: World, c: Creature): string[] {
  return Object.entries(c.body.prosthetics ?? {}).map(([root, state]) => {
    const d = w.db.get<ProstheticDef>(state.def), name = w.db.body(c.body.def).parts.find((p) => p.id === root)?.label ?? root
    const remaining = Math.max(0, (state.powerUntil ?? turnOf(w)) - turnOf(w))
    const power = d.powerTurns ? ` · 전원${remaining === 0 ? '꺼짐' : remaining >= 28800 ? `${Math.ceil(remaining / 28800)}일` : '1일 미만'}` : ''
    return `${name} · ${d.label} · 효율${(prostheticEfficiency(w, c, root, state) * 100).toFixed(0)}% · 내구${(state.item.durability ?? 100).toFixed(0)}%${power}${d.maintenanceTurns && turnOf(w) - state.servicedAt >= d.maintenanceTurns ? ' · 가죽끈 정비 필요' : ''}`
  })
}
