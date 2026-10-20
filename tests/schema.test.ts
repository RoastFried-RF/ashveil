import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { defSchema } from '../tools/export-schema'

describe('엔진 독립 Def 계약', () => {
  it('보관한 JSON Schema는 현재 TypeScript Def 타입과 일치한다', () => {
    expect(JSON.parse(readFileSync('docs/schema/defs.schema.json', 'utf8'))).toEqual(defSchema())
  })
})
