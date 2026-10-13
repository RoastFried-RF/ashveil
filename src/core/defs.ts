// Def 로더: 모드 정렬 → Def 수집 → 패치 → 상속 해석 → 검증
// 엔진 독립: 입력은 순수 JSON 객체, 파일 시스템/번들러에 의존하지 않음.

import type {
  AbilityDef, AnyDef, BodyDef, CreatureDef, DefBase, EventDef, ItemDef, LootTableDef, PillEffectDef,
  SkillDef, TerrainDef, ThoughtDef, TraitDef, BackgroundDef, WoundDef,
} from './types'

export interface ModManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  dependencies?: string[]
  loadAfter?: string[]
  incompatibleWith?: string[]
}

export interface PatchOp {
  op: 'add' | 'replace' | 'remove' | 'merge'
  target: string
  path: string
  value?: unknown
  ifModLoaded?: string
  ifModNotLoaded?: string
}

export interface ModPackage {
  manifest: ModManifest
  defs: DefBase[]
  patches: PatchOp[]
}

export interface LoadReport {
  order: string[]
  errors: string[]
  warnings: string[]
  patched: number
}

/** 경로 → JSON 맵에서 모드 패키지 구성. 경로 예: <root>/<modId>/manifest.json, <root>/<modId>/defs/x.json */
export function packagesFromFiles(files: Record<string, unknown>): ModPackage[] {
  const byMod = new Map<string, ModPackage>()
  const get = (mod: string) => {
    let p = byMod.get(mod)
    if (!p) {
      p = { manifest: { id: mod, name: mod, version: '0.0.0' }, defs: [], patches: [] }
      byMod.set(mod, p)
    }
    return p
  }
  for (const [path, json] of Object.entries(files)) {
    const norm = path.replace(/\\/g, '/')
    const m = norm.match(/([^/]+)\/(manifest\.json|defs\/.+\.json|patches\/.+\.json)$/)
    if (!m) continue
    const [, folder, rest] = m
    const pkg = get(folder)
    if (rest === 'manifest.json') pkg.manifest = json as ModManifest
    else if (rest.startsWith('defs/')) pkg.defs.push(...(json as DefBase[]))
    else pkg.patches.push(...(json as PatchOp[]))
  }
  // 폴더명 대신 manifest.id 로 정규화
  return [...byMod.values()].map((p) => ({ ...p }))
}

function topoSort(pkgs: ModPackage[], report: LoadReport): ModPackage[] {
  const byId = new Map(pkgs.map((p) => [p.manifest.id, p]))
  const out: ModPackage[] = []
  const state = new Map<string, 0 | 1 | 2>()
  const visit = (p: ModPackage, stack: string[]) => {
    const id = p.manifest.id
    if (state.get(id) === 2) return
    if (state.get(id) === 1) {
      report.errors.push(`순환 의존성: ${[...stack, id].join(' → ')}`)
      return
    }
    state.set(id, 1)
    const deps = [...(p.manifest.dependencies ?? []), ...(p.manifest.loadAfter ?? [])]
    for (const d of deps) {
      const dp = byId.get(d)
      if (!dp) {
        if (p.manifest.dependencies?.includes(d)) report.errors.push(`${id}: 필수 의존 모드 없음 '${d}'`)
        continue
      }
      visit(dp, [...stack, id])
    }
    state.set(id, 2)
    out.push(p)
  }
  // core 우선, 나머지는 id 순 (결정론)
  const sorted = [...pkgs].sort((a, b) =>
    a.manifest.id === 'core' ? -1 : b.manifest.id === 'core' ? 1 : a.manifest.id.localeCompare(b.manifest.id))
  for (const p of sorted) visit(p, [])
  for (const p of out) {
    for (const inc of p.manifest.incompatibleWith ?? []) {
      if (byId.has(inc)) report.errors.push(`${p.manifest.id} 와 ${inc} 는 호환되지 않음`)
    }
  }
  return out
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (isObj(base) && isObj(over)) {
    const out: Record<string, unknown> = { ...base }
    for (const [k, v] of Object.entries(over)) out[k] = k in base ? deepMerge(base[k], v) : clone(v)
    return out
  }
  return clone(over)
}

function parsePath(path: string): string[] {
  if (path === '' || path === '/') return []
  return path.replace(/^\//, '').split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
}

export function applyPatch(def: Record<string, unknown>, op: PatchOp): string | null {
  const keys = parsePath(op.path)
  if (keys.length === 0) {
    if (op.op === 'merge' && isObj(op.value)) {
      Object.assign(def, deepMerge(def, op.value))
      return null
    }
    return '루트 경로에는 merge 만 가능'
  }
  let cur: unknown = def
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (Array.isArray(cur)) cur = cur[Number(k)]
    else if (isObj(cur)) {
      if (!(k in cur) && (op.op === 'add' || op.op === 'merge')) cur[k] = {}
      cur = cur[k]
    } else return `경로 없음: ${op.path}`
    if (cur === undefined) return `경로 없음: ${op.path}`
  }
  const last = keys[keys.length - 1]
  if (Array.isArray(cur)) {
    const idx = last === '-' ? cur.length : Number(last)
    if (Number.isNaN(idx)) return `배열 인덱스 오류: ${op.path}`
    switch (op.op) {
      case 'add': cur.splice(idx, 0, clone(op.value)); return null
      case 'replace': if (idx >= cur.length) return `인덱스 범위 밖: ${op.path}`; cur[idx] = clone(op.value); return null
      case 'remove': if (idx >= cur.length) return `인덱스 범위 밖: ${op.path}`; cur.splice(idx, 1); return null
      case 'merge': cur[idx] = deepMerge(cur[idx], op.value); return null
    }
  }
  if (!isObj(cur)) return `경로 없음: ${op.path}`
  switch (op.op) {
    case 'add':
    case 'replace':
      if (op.op === 'replace' && !(last in cur)) return `replace 대상 없음: ${op.path}`
      cur[last] = clone(op.value)
      return null
    case 'remove':
      if (!(last in cur)) return `remove 대상 없음: ${op.path}`
      delete cur[last]
      return null
    case 'merge':
      cur[last] = last in cur ? deepMerge(cur[last], op.value) : clone(op.value)
      return null
  }
}

// defType 별 필수 필드
const REQUIRED: Record<string, string[]> = {
  Body: ['bloodMl', 'parts'],
  Wound: ['label', 'bleedPerSeverity', 'painPerSeverity', 'contamination', 'healPerDay'],
  Item: ['label', 'sprite', 'category', 'weight'],
  Creature: ['label', 'body', 'faction', 'moveTU', 'stats', 'skills', 'ai', 'morale', 'lightThreshold', 'sightRange'],
  Terrain: ['label', 'sprites', 'passable', 'opaque', 'moveMult'],
  LootTable: ['rolls', 'entries'],
  Trait: ['label', 'description'],
  Background: ['label', 'description', 'startItems'],
  Thought: ['label', 'mood', 'durationTurns'],
  Event: ['label', 'cost', 'weight'],
  PillEffect: ['label', 'description', 'effect', 'durationTurns'],
  Skill: ['label'],
  Ability: ['label', 'description', 'tree', 'tier', 'kind', 'icon'],
}

export class DefDatabase {
  private map = new Map<string, AnyDef>()
  private byType = new Map<string, AnyDef[]>()
  constructor(defs: AnyDef[], public readonly loadedMods: string[]) {
    for (const d of defs) {
      this.map.set(d.id, d)
      const list = this.byType.get(d.defType) ?? []
      list.push(d)
      this.byType.set(d.defType, list)
    }
  }
  has(id: string): boolean { return this.map.has(id) }
  get<T extends AnyDef = AnyDef>(id: string): T {
    const d = this.map.get(id)
    if (!d) throw new Error(`Def 없음: ${id}`)
    return d as T
  }
  tryGet<T extends AnyDef = AnyDef>(id: string): T | undefined {
    return this.map.get(id) as T | undefined
  }
  all<T extends AnyDef = AnyDef>(defType: string): T[] {
    return (this.byType.get(defType) ?? []) as T[]
  }
  body(id: string) { return this.get<BodyDef>(id) }
  wound(id: string) { return this.get<WoundDef>(id) }
  item(id: string) { return this.get<ItemDef>(id) }
  creature(id: string) { return this.get<CreatureDef>(id) }
  terrain(id: string) { return this.get<TerrainDef>(id) }
  loot(id: string) { return this.get<LootTableDef>(id) }
  trait(id: string) { return this.get<TraitDef>(id) }
  background(id: string) { return this.get<BackgroundDef>(id) }
  thought(id: string) { return this.get<ThoughtDef>(id) }
  event(id: string) { return this.get<EventDef>(id) }
  pill(id: string) { return this.get<PillEffectDef>(id) }
  skill(id: string) { return this.get<SkillDef>(id) }
  ability(id: string) { return this.get<AbilityDef>(id) }
}

export function loadMods(pkgs: ModPackage[], enabled?: string[]): { db: DefDatabase; report: LoadReport } {
  const report: LoadReport = { order: [], errors: [], warnings: [], patched: 0 }
  const active = pkgs.filter((p) => p.manifest.id === 'core' || !enabled || enabled.includes(p.manifest.id))
  const ordered = topoSort(active, report)
  report.order = ordered.map((p) => p.manifest.id)
  const loadedIds = new Set(report.order)

  const raw = new Map<string, Record<string, unknown>>()
  for (const pkg of ordered) {
    for (const d of pkg.defs) {
      if (!d.id || !d.defType) {
        report.errors.push(`${pkg.manifest.id}: id/defType 없는 Def`)
        continue
      }
      if (raw.has(d.id)) report.warnings.push(`${pkg.manifest.id}: '${d.id}' 를 덮어씀`)
      raw.set(d.id, { ...clone(d), _mod: pkg.manifest.id })
    }
    for (const op of pkg.patches) {
      if (op.ifModLoaded && !loadedIds.has(op.ifModLoaded)) continue
      if (op.ifModNotLoaded && loadedIds.has(op.ifModNotLoaded)) continue
      const target = raw.get(op.target)
      if (!target) {
        report.errors.push(`${pkg.manifest.id}: 패치 대상 없음 '${op.target}'`)
        continue
      }
      const err = applyPatch(target, op)
      if (err) report.errors.push(`${pkg.manifest.id}: ${op.target} ${err}`)
      else {
        target._mod = pkg.manifest.id
        report.patched++
      }
    }
  }

  // 상속 해석
  const resolved = new Map<string, Record<string, unknown>>()
  const resolve = (id: string, stack: string[]): Record<string, unknown> | undefined => {
    const done = resolved.get(id)
    if (done) return done
    const d = raw.get(id)
    if (!d) return undefined
    if (stack.includes(id)) {
      report.errors.push(`순환 상속: ${[...stack, id].join(' → ')}`)
      return d
    }
    let out = d
    if (typeof d.parent === 'string') {
      const p = resolve(d.parent, [...stack, id])
      if (!p) report.errors.push(`'${id}' 의 부모 '${d.parent}' 없음`)
      else {
        const { abstract: _a, id: _i, ...inherit } = p
        out = deepMerge(inherit, d) as Record<string, unknown>
        if (!('abstract' in d)) delete out.abstract
      }
    }
    resolved.set(id, out)
    return out
  }
  for (const id of raw.keys()) resolve(id, [])

  const final: AnyDef[] = []
  for (const d of resolved.values()) {
    if (d.abstract) continue
    const req = REQUIRED[d.defType as string]
    if (!req) report.warnings.push(`알 수 없는 defType '${String(d.defType)}' (${String(d.id)})`)
    else for (const f of req) if (!(f in d)) report.errors.push(`${String(d.id)}: 필수 필드 '${f}' 없음`)
    if (d.defType === 'Creature' && !('sprite' in d) && !('char' in d)) report.errors.push(`${String(d.id)}: 'sprite' 또는 'char' 필요`)
    final.push(d as unknown as AnyDef)
  }
  const db = new DefDatabase(final, report.order)
  validateRefs(db, report)
  return { db, report }
}

function validateRefs(db: DefDatabase, report: LoadReport) {
  const need = (owner: string, ref: string | undefined, type: string) => {
    if (!ref) return
    const d = db.tryGet(ref)
    if (!d) report.errors.push(`${owner}: 참조 '${ref}' 없음`)
    else if (d.defType !== type) report.errors.push(`${owner}: '${ref}' 는 ${type} 가 아님 (${d.defType})`)
  }
  for (const c of db.all<CreatureDef>('Creature')) {
    need(c.id, c.body, 'Body')
    for (const s of c.loadout?.slots ?? []) for (const it of s.items) need(c.id, it, 'Item')
  }
  for (const l of db.all<LootTableDef>('LootTable')) for (const e of l.entries) need(l.id, e.item, 'Item')
  for (const t of db.all<TerrainDef>('Terrain')) need(t.id, t.container, 'LootTable')
  for (const b of db.all<BackgroundDef>('Background')) {
    for (const it of b.startItems) need(b.id, it, 'Item')
    for (const a of b.startAbilities ?? []) need(b.id, a, 'Ability')
  }
  for (const a of db.all<AbilityDef>('Ability')) for (const r of a.requires ?? []) need(a.id, r, 'Ability')
  for (const e of db.all<EventDef>('Event')) for (const s of e.spawn ?? []) need(e.id, s.creature, 'Creature')
  for (const i of db.all<ItemDef>('Item')) need(i.id, i.ranged?.ammo, 'Item')
  for (const b of db.all<BodyDef>('Body')) {
    const ids = new Set(b.parts.map((p) => p.id))
    for (const p of b.parts) if (p.parent && !ids.has(p.parent)) report.errors.push(`${b.id}: 부위 '${p.id}' 의 부모 '${p.parent}' 없음`)
    // 외부 부위 커버리지(‰) 합은 1000 (07 §2.3), 내부 부위는 부모가 있어야 한다
    const ext = b.parts.filter((p) => !p.internal).reduce((n, p) => n + (p.coverage ?? 0), 0)
    if (ext !== 1000) report.errors.push(`${b.id}: 외부 커버리지 합 ${ext} ≠ 1000`)
    for (const p of b.parts) if (p.internal && !p.parent) report.errors.push(`${b.id}: 내부 부위 '${p.id}' 에 부모가 없음`)
  }
}
