import { describe, expect, it } from 'vitest'
import { deserialize, serialize, stateHash } from '../src/core/save'
import vectors from './fixtures/golden.json'
import worldVectors from './fixtures/world-golden.json'
import { replay, replayOp, replayWorld, type GoldenVector } from '../tools/replay'
import { db } from './helpers'

describe('엔진 이전용 고정 골든 벡터', () => {
  for (const raw of [...vectors, ...worldVectors]) {
    const v = raw as GoldenVector
    it(`${v.name}: 고정 커맨드 → 고정 해시`, () => {
      const result = replay(db, v)
      if (v.expectedInitialHash) expect(result.initialHash).toBe(v.expectedInitialHash)
      expect(result.errors).toEqual(v.expectedErrors)
      expect(result.hash).toBe(v.expectedHash)
    }, 60000)
    it(`${v.name}: 커맨드 중간 저장·복원 → 같은 해시`, () => {
      const w = replayWorld(db,v)
      if (v.expectedInitialHash) expect(stateHash(w.s)).toBe(v.expectedInitialHash)
      for (let i = 0; i < v.ops.length; i++) {
        expect(replayOp(w, v.ops[i])).toBe(v.expectedErrors[i])
        if (i === Math.floor(v.ops.length / 2)) w.s = deserialize(serialize(w.s))
      }
      expect(stateHash(w.s)).toBe(v.expectedHash)
    }, 60000)
  }
})
