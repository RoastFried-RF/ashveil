// 자연 생성한 수도원 원정 관찰. 몸·시각·난수·봇 정책을 변경하지 않는다.
import { createHash } from 'node:crypto'
import { botDecide } from '../src/core/bot'
import { player, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { playerAct } from '../src/core/game'
import { serialize } from '../src/core/save'

export interface ExpeditionVisit { map: string; depth: number; firstTU: number }
export interface ExpeditionRow {
  index: number; seed: string; overworld: false; background?: string; loadHash?: string
  startTU: number; endTU: number; actualTU: number; days: number; cause: string; kind: string
  level: number; maxLevel: number; map: string; maxDepth: number; visited: ExpeditionVisit[]
  decisions: number; rejected: number; errors: { error: string; count: number }[]
  initialSha256: string; finalSha256: string; seconds: number
}
export const sha256 = (raw: string | Uint8Array) => createHash('sha256').update(raw).digest('hex')

export function validateExpeditionRange(from: number, runs: number, days: number) {
  const budget = Math.floor(days * TURNS_PER_DAY * 100)
  if (!Number.isSafeInteger(from) || from < 0 || !Number.isSafeInteger(runs) || runs < 1 || runs > 1000 || !Number.isSafeInteger(from + runs) || !Number.isFinite(days) || !Number.isSafeInteger(budget) || budget < 1) {
    throw Error('시드 시작은0 이상, 판 수는1~1000, 기간은 안전한 정수 범위의1TU 이상이어야 한다')
  }
  return budget
}

/** 호출자는 정상 newGame/runUntilInput으로 만든 세계를 넘긴다. */
export function runExpedition(w: World, index: number, maxDays: number): ExpeditionRow {
  const budget = validateExpeditionRange(index, 1, maxDays), s = w.s, startTU = s.time, endTU = startTU + budget
  if (s.overworld || s.seed !== `sim-${index}`) throw Error('지정한 sim 시드의 자연 수도원 원정만 집계한다')
  if (!Number.isSafeInteger(endTU)) throw Error('원정 종료 TU가 안전한 정수 범위를 넘었다')
  const initialSha256 = sha256(serialize(s)), began = performance.now(), errors = new Map<string, number>()
  let decisions = 0, rejected = 0, maxDepth = s.map.depth, maxLevel = player(w).level
  const visited = new Map<string, ExpeditionVisit>([[s.map.id, { map: s.map.id, depth: s.map.depth, firstTU: s.time }]])
  while (!s.over && s.time < endTU && decisions < 150000) {
    const action = botDecide(w), error = playerAct(w, action, undefined, endTU)
    decisions++
    if (error) {
      rejected++; const key = action.type + ': ' + error
      errors.set(key, (errors.get(key) ?? 0) + 1)
      const fallback = playerAct(w, { type: 'wait' }, undefined, endTU)
      if (fallback) throw Error('거절된 행동 뒤 대기도 거절됐다: ' + fallback)
    }
    if (!visited.has(s.map.id)) visited.set(s.map.id, { map: s.map.id, depth: s.map.depth, firstTU: s.time })
    maxDepth = Math.max(maxDepth, s.map.depth); maxLevel = Math.max(maxLevel, player(w).level)
  }
  if (!s.over && s.time < endTU) throw Error('결정 상한에 도달했다. 시간 제한 생존으로 집계하지 않는다')
  if (s.time > endTU) throw Error('선언한 원정 종료 TU를 넘었다')
  const p = player(w), cause = s.over?.kind === 'escape' ? '탈출' : s.over?.kind === 'retire' ? '은퇴' : s.over?.report.cause ?? '생존(시간 종료)'
  return {
    index, seed: s.seed, overworld: false, background: p.background, loadHash: s.loadHash,
    startTU, endTU, actualTU: s.time, days: (s.time - startTU) / (TURNS_PER_DAY * 100),
    cause, kind: s.over?.kind ?? 'time-limit', level: p.level, maxLevel, map: s.map.id, maxDepth, visited: [...visited.values()],
    decisions, rejected, errors: [...errors].map(([error, count]) => ({ error, count })),
    initialSha256, finalSha256: sha256(serialize(s)), seconds: (performance.now() - began) / 1000,
  }
}

/** 전체 원정이 있어야 집계한다. 완료된 일부 행은 실패 시에도 원문 파일에 남는다. */
export function summarizeExpeditions(rows: ExpeditionRow[], from: number, runs: number, days: number) {
  const budget = validateExpeditionRange(from, runs, days)
  const sorted = [...rows].sort((a, b) => a.index - b.index)
  if (sorted.length !== runs || sorted.some((row, i) =>
    row.index !== from + i || row.seed !== `sim-${from + i}` || row.overworld !== false ||
    !Number.isSafeInteger(row.startTU) || row.endTU - row.startTU !== budget ||
    !Number.isSafeInteger(row.actualTU) || row.actualTU < row.startTU || row.actualTU > row.endTU ||
    !['death', 'escape', 'retire', 'time-limit'].includes(row.kind) ||
    row.days !== (row.actualTU - row.startTU) / (TURNS_PER_DAY * 100) ||
    row.kind === 'time-limit' && row.actualTU !== row.endTU ||
    row.kind === 'time-limit' && row.cause !== '생존(시간 종료)' ||
    row.kind === 'escape' && row.cause !== '탈출' || row.kind === 'retire' && row.cause !== '은퇴' ||
    !row.visited.length || !row.visited.some(v => v.map === row.map) ||
    new Set(row.visited.map(v => v.map)).size !== row.visited.length ||
    row.visited.some(v => !Number.isSafeInteger(v.depth) || v.depth < 0 || v.firstTU < row.startTU || v.firstTU > row.actualTU) ||
    Math.max(...row.visited.map(v => v.depth)) !== row.maxDepth ||
    !Number.isSafeInteger(row.level) || row.level < 1 || !Number.isSafeInteger(row.maxLevel) || row.maxLevel < row.level ||
    !Number.isSafeInteger(row.decisions) || row.decisions < 0 || row.decisions > 150000 ||
    !Number.isSafeInteger(row.rejected) || row.rejected < 0 || row.rejected > row.decisions ||
    row.errors.some(e => !Number.isSafeInteger(e.count) || e.count < 1) ||
    row.errors.reduce((n, e) => n + e.count, 0) !== row.rejected ||
    !/^[a-f0-9]{64}$/.test(row.initialSha256) || !/^[a-f0-9]{64}$/.test(row.finalSha256) ||
    row.loadHash !== sorted[0].loadHash
  )) throw Error('전체 원정의 시드·시각·방문/레벨·거절·해시 기록이 누락되거나 잘못됐다')
  const tally = (key: 'cause' | 'maxDepth' | 'level') => sorted.reduce<Record<string, number>>((counts, row) => {
    const value = row[key]; counts[value] = (counts[value] ?? 0) + 1; return counts
  }, {})
  const causes = tally('cause'), deaths = sorted.filter(row => !['escape', 'retire', 'time-limit'].includes(row.kind)).length
  const topDeath = Object.entries(causes).filter(([cause]) => !['탈출', '은퇴', '생존(시간 종료)'].includes(cause)).sort((a, b) => b[1] - a[1])[0]
  return {
    completed: runs, averageDays: sorted.reduce((n, r) => n + r.days, 0) / runs,
    averageFinalLevel: sorted.reduce((n, r) => n + r.level, 0) / runs,
    averageMaximumLevel: sorted.reduce((n, r) => n + r.maxLevel, 0) / runs,
    maximumReachedDepth: Math.max(...sorted.map(r => r.maxDepth)), reachedDepthDistribution: tally('maxDepth'), finalLevelDistribution: tally('level'),
    causes, deaths, largestDeathCause: topDeath?.[0], largestDeathCount: topDeath?.[1] ?? 0,
    largestDeathShareOfRuns: (topDeath?.[1] ?? 0) / runs, largestDeathShareOfDeaths: deaths ? (topDeath?.[1] ?? 0) / deaths : 0,
    topDeathOverFortyPercentOfRuns: !!topDeath && topDeath[1] / runs > .4,
    totalDecisions: sorted.reduce((n, r) => n + r.decisions, 0), totalRejectedActions: sorted.reduce((n, r) => n + r.rejected, 0), rows: sorted,
  }
}
