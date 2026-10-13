import { describe, expect, it } from 'vitest'
import { applyPatch, loadMods, type ModPackage } from '../src/core/defs'
import { readPackages } from '../tools/loadContent'

const pkg = (id: string, defs: unknown[], patches: unknown[] = [], extra: object = {}): ModPackage =>
  ({ manifest: { id, name: id, version: '1', ...extra }, defs: defs as never, patches: patches as never })

describe('Def 로더', () => {
  it('코어 콘텐츠는 오류 없이 로드된다', () => {
    const { report } = loadMods(readPackages())
    expect(report.errors).toEqual([])
  })
  it('샘플 모드: 패치가 상속 전에 적용되어 자식에게 전파된다', () => {
    const { db, report } = loadMods(readPackages(), ['sample.grim'])
    expect(report.errors).toEqual([])
    expect(db.wound('Wound.Cut').bleedPerSeverity).toBe(2.3)
    expect(db.item('Item.SawMachete').weight).toBe(db.item('Item.Machete').weight) // 상속
    expect(db.loot('Loot.Chest').entries.some((e) => e.item === 'Item.SawMachete')).toBe(true)
  })
  it('상속: 부모 필드 병합, abstract 제외', () => {
    const { db } = loadMods([pkg('core', [
      { defType: 'Skill', id: 'A', abstract: true, label: 'a', description: 'base' },
      { defType: 'Skill', id: 'B', parent: 'A', label: 'b' },
    ])])
    expect(db.has('A')).toBe(false)
    expect(db.get('B').description).toBe('base')
  })
  it('순환 상속·없는 의존성은 오류로 보고', () => {
    const { report } = loadMods([
      pkg('core', [{ defType: 'Skill', id: 'A', parent: 'B', label: 'a' }, { defType: 'Skill', id: 'B', parent: 'A', label: 'b' }]),
      pkg('m', [], [], { dependencies: ['nope'] }),
    ], ['m'])
    expect(report.errors.some((e) => e.includes('순환 상속'))).toBe(true)
    expect(report.errors.some((e) => e.includes('nope'))).toBe(true)
  })
  it('패치 연산 add/replace/remove/merge', () => {
    const d: Record<string, unknown> = { a: { b: [1, 2] }, c: 1 }
    expect(applyPatch(d, { op: 'add', target: 'x', path: '/a/b/-', value: 3 })).toBeNull()
    expect(applyPatch(d, { op: 'replace', target: 'x', path: '/c', value: 9 })).toBeNull()
    expect(applyPatch(d, { op: 'merge', target: 'x', path: '/a', value: { z: true } })).toBeNull()
    expect(applyPatch(d, { op: 'remove', target: 'x', path: '/a/b/0' })).toBeNull()
    expect(d).toEqual({ a: { b: [2, 3], z: true }, c: 9 })
    expect(applyPatch(d, { op: 'replace', target: 'x', path: '/nope', value: 1 })).not.toBeNull()
  })
  it('ifModLoaded 조건부 패치', () => {
    const { db } = loadMods([
      pkg('core', [{ defType: 'Skill', id: 'S', label: 'x' }]),
      pkg('m', [], [{ op: 'replace', target: 'S', path: '/label', value: 'y', ifModLoaded: 'other' }]),
    ], ['m'])
    expect(db.get('S').label).toBe('x')
  })
})
