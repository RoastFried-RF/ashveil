import {describe, expect, it} from 'vitest'
import {mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {collectRepository, SourceCatalog, writeInventory} from '../tools/localization/source-catalog'

function inventory(file: string, source: string) {const catalog = new SourceCatalog();catalog.collect(file, source);return catalog.result()}

describe('read-only localization source catalog', () => {
  it('keeps template parameters and numeric concatenation semantics, without capturing personal/technical names', () => {
    const source = [
      "const NAMES = ['아라', '에다']",
      "const sprite = {id:'기술ID', name:'사용자이름', label:'문양'}",
      "log(w, 'info', `남은 ${n}턴 · ${p.name}의 기록`)",
      "const total = (a + b) + '턴 후'",
      "const result = '판정: ' + (ok ? '생존' : '사망')",
    ].join('\n')
    const result = inventory('src/core/example.ts', source), entries = result.entries
    expect(entries.some(e => e.parts.includes('아라') || e.parts.includes('기술ID') || e.parts.includes('사용자이름'))).toBe(false)
    expect(result.excluded.map(e => e.reason)).toEqual(expect.arrayContaining(['personal-name-pool', 'technical-property:id', 'possible-personal-name']))
    const format = entries.find(e => e.parts.join('') === '남은 턴 · 의 기록')!
    expect(format.parts).toEqual(['남은 ', '턴 · ', '의 기록'])
    expect(format.occurrences[0]).toMatchObject({line:3, usage:'log', expressions:['n','p.name']})
    expect(entries.find(e => e.parts.join('') === '턴 후')!.occurrences[0].expressions).toEqual(['(a + b)'])
    expect(entries.filter(e => e.parts.length === 1).map(e => e.parts[0])).toEqual(expect.arrayContaining(['문양', '생존', '사망']))
  })

  it('groups Vue text/interpolations, preserves expression origin and excludes CSS/identifiers', () => {
    const source = `<script setup lang="ts">const label='가방'</script>\n<template><p>남은 {{ count }}개 · {{ p.name }}의 물품</p><input title="검색" class="한글식별자" :aria-label="ok ? '사용 가능' : '사용 불가'" @click="notice('알림'); close()" /></template>`
    const result = inventory('src/client/Fixture.vue', source)
    const grouped = result.entries.find(e => e.parts.join('') === '남은 개 · 의 물품')!
    expect(grouped.occurrences[0]).toMatchObject({line:2, usage:'ui', expressions:['count','p.name']})
    expect(result.entries.flatMap(e => e.parts)).toEqual(expect.arrayContaining(['가방', '검색', '사용 가능', '사용 불가', '알림']))
    expect(result.entries.flatMap(e => e.parts)).not.toContain('한글식별자')
    expect(result.excluded).toContainEqual(expect.objectContaining({reason:'non-display-attribute:class'}))
  })

  it('classifies content/patch display fields and gives identical content stable IDs', () => {
    const first = inventory('src/content/core/defs/sample.json', '[{"id":"기술ID","label":"기록","note":"현장 메모"}]')
    const second = inventory('mods/sample/patches/sample.json', '[{"op":"add","path":"/label","value":"기록"}]')
    expect(first.entries.flatMap(e => e.parts)).not.toContain('기술ID')
    expect(first.entries.find(e => e.parts[0] === '기록')!.id).toBe(second.entries.find(e => e.parts[0] === '기록')!.id)
    expect(second.entries[0].occurrences[0]).toMatchObject({usage:'content',context:'json:label'})
    expect(() => inventory('src/content/broken.json','{"x":')).toThrow()
  })

  it('writes only fresh ignored output, refuses reuse/symlink escapes and preserves source bytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'ashveil-locale-'))
    try {
      mkdirSync(join(root,'src'));mkdirSync(join(root,'test-results'))
      const source = "export const label = '각인'\n", input = join(root,'src','label.ts')
      writeFileSync(input,source)
      const out = join(root,'test-results','catalog')
      expect(writeInventory(root,out)).toMatchObject({inputFiles:1,entries:1,inputBytesUnchanged:true})
      expect(readFileSync(input,'utf8')).toBe(source)
      const previous = readFileSync(join(out,'catalog.json'),'utf8')
      expect(() => writeInventory(root,out)).toThrow('Output already exists')
      expect(readFileSync(join(out,'catalog.json'),'utf8')).toBe(previous)
      expect(() => writeInventory(root,join(root,'src','wrong-output'))).toThrow('--out must be')
      symlinkSync(join(root,'src'),join(root,'test-results','escape'),process.platform==='win32'?'junction':'dir')
      expect(() => writeInventory(root,join(root,'test-results','escape','new'))).toThrow('escapes test-results')
    } finally {rmSync(root,{recursive:true,force:true})}
  })
  it('rejects malformed input bytes and symlinked source roots instead of certifying a partial inventory', () => {
    const root = mkdtempSync(join(tmpdir(), 'ashveil-locale-input-'))
    try {
      mkdirSync(join(root, 'src'))
      writeFileSync(join(root, 'src', 'invalid.ts'), Buffer.from([0x65, 0xff, 0x0a]))
      expect(() => collectRepository(root)).toThrow('not valid UTF-8')
      rmSync(join(root, 'src'), {recursive:true})
      mkdirSync(join(root, 'actual-src'))
      symlinkSync(join(root, 'actual-src'), join(root, 'src'),process.platform==='win32'?'junction':'dir')
      expect(() => collectRepository(root)).toThrow('Source symlink requires explicit review: src')
    } finally {rmSync(root, {recursive:true, force:true})}
  })
})
