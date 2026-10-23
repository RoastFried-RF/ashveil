import { describe, expect, it } from 'vitest'
import { botDecide } from '../src/core/bot'
import { TURNS_PER_DAY } from '../src/core/ctx'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { serialize } from '../src/core/save'
import { runExpedition, sha256, summarizeExpeditions, validateExpeditionRange, type ExpeditionRow } from '../tools/expedition-run'
import { db } from './helpers'

// 집계의 인위적 경계 입력이다. 자연 원정 실측으로 세지 않는다.
function row(index: number, death = false): ExpeditionRow {
  return {
    index, seed: `sim-${index}`, overworld: false, loadHash: db.loadHash,
    startTU: 100, endTU: 2880100, actualTU: 2880100, days: 1,
    cause: death ? '저체온증' : '생존(시간 종료)', kind: death ? 'death' : 'time-limit',
    level: 2, maxLevel: 3, map: 'surface', maxDepth: 2,
    visited: [{ map: 'surface', depth: 0, firstTU: 100 }, { map: 'crypt2', depth: 2, firstTU: 500 }],
    decisions: 10, rejected: 1, errors: [{ error: 'move: 막힘', count: 1 }],
    initialSha256: '0'.repeat(64), finalSha256: 'f'.repeat(64), seconds: 1,
  }
}

describe('수도원 원정 보고서의 실제 관찰과 완결성', () => {
  it('자연 생성·봇 입력의 전체 최종 상태를 바꾸지 않고 실제 하강을 관찰한다', () => {
    const a = { db, s: newGame(db, { seed: 'sim-0', overworld: false }) }, b = { db, s: newGame(db, { seed: 'sim-0', overworld: false }) }
    runUntilInput(a); runUntilInput(b)
    const initial = serialize(b.s), days = .003, end = b.s.time + Math.floor(days * TURNS_PER_DAY * 100)
    const measured = runExpedition(a, 0, days)
    while (!b.s.over && b.s.time < end) {
      const error = playerAct(b, botDecide(b), undefined, end)
      if (error) expect(playerAct(b, { type: 'wait' }, undefined, end)).toBeNull()
    }
    expect(serialize(a.s)).toBe(serialize(b.s))
    expect(measured.initialSha256).toBe(sha256(initial)); expect(measured.finalSha256).toBe(sha256(serialize(b.s)))
    expect(measured.maxDepth).toBe(1); expect(measured.visited.map(v => v.map)).toEqual(['surface', 'crypt1'])
    expect(measured.actualTU).toBe(end); expect(measured.rejected).toBe(0)
    expect(summarizeExpeditions([measured], 0, 1, days).completed).toBe(1)
  })
  it('지상 귀환을 최대 도달 층으로 오해하지 않으며 평균 레벨과 사인40% 경계를 구분한다', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(i, i < 2)), raw = JSON.stringify(rows)
    const at = summarizeExpeditions([...rows].reverse(), 0, 5, 1)
    expect(at.reachedDepthDistribution).toEqual({ 2: 5 }); expect(at.maximumReachedDepth).toBe(2)
    expect(at.averageFinalLevel).toBe(2); expect(at.averageMaximumLevel).toBe(3)
    expect(at.largestDeathShareOfRuns).toBe(.4); expect(at.largestDeathShareOfDeaths).toBe(1)
    expect(at.topDeathOverFortyPercentOfRuns).toBe(false); expect(JSON.stringify(rows)).toBe(raw)
    rows[2] = row(2, true)
    expect(summarizeExpeditions(rows, 0, 5, 1).topDeathOverFortyPercentOfRuns).toBe(true)
  })
  it.each([
    (rows: ExpeditionRow[]) => rows.pop(),
    (rows: ExpeditionRow[]) => { rows[1].index = 0 },
    (rows: ExpeditionRow[]) => { rows[0].actualTU-- },
    (rows: ExpeditionRow[]) => { rows[0].actualTU++; rows[0].days += 1 / 2880000 },
    (rows: ExpeditionRow[]) => { rows[0].maxDepth = 0 },
    (rows: ExpeditionRow[]) => { rows[0].visited[1].firstTU = rows[0].endTU + 1 },
    (rows: ExpeditionRow[]) => { rows[0].errors = [] },
    (rows: ExpeditionRow[]) => { rows[0].finalSha256 = 'short' },
    (rows: ExpeditionRow[]) => { rows[0].loadHash = 'different-source' },
  ])('누락·중복·조기 종료·상한 초과·가짜 방문·거절·해시 손상을 성공으로 집계하지 않는다 %#', damage => {
    const rows = [row(0), row(1)]; damage(rows)
    expect(() => summarizeExpeditions(rows, 0, 2, 1)).toThrow()
  })
  it.each([[0, 1, 0], [0, 1, 1e-12], [-1, 1, 1], [0, 1001, 1], [Number.MAX_SAFE_INTEGER, 2, 1], [0, 1, Infinity]])('잘못된 범위는 실행 전에 거절한다 %j', (from, runs, days) => {
    expect(() => validateExpeditionRange(from, runs, days)).toThrow()
  })
})
