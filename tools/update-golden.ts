// 규칙 변경을 검토한 뒤 명시적으로 실행한다: pnpm exec tsx tools/update-golden.ts --write
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { botDecide } from '../src/core/bot'
import { newGame, playerAct } from '../src/core/game'
import { stateHash } from '../src/core/save'
import { loadDb } from './loadContent'
import { type GoldenVector, type ReplayOp, replayOp, replay } from './replay'

if (!process.argv.includes('--write')) throw new Error('골든 갱신은 --write가 필요하다. 예상 결과의 차이를 검토해야 한다.')
const { db, report } = loadDb()
if (report.errors.length) throw new Error(report.errors.join('\n'))
if (process.argv.includes('--refresh-existing')) {
  const pinned = JSON.parse(readFileSync('tests/fixtures/golden.json', 'utf8')) as GoldenVector[]
  for (const v of pinned) {
    const r = replay(db, v)
    if (v.expectedInitialHash && r.initialHash !== v.expectedInitialHash && !process.argv.includes('--refresh-initial')) throw new Error(`${v.name}: 초기 생성 결과 변경. 감사 후 --refresh-initial을 함께 지정한다`)
    if (JSON.stringify(r.errors) !== JSON.stringify(v.expectedErrors)) throw new Error(`${v.name}: 오류 결과가 바뀌었다. 차이를 먼저 검토해야 한다`)
    console.log(`${v.name}: ${v.expectedHash} → ${r.hash} (명령·오류 유지)`)
    v.expectedHash = r.hash
    v.expectedInitialHash = r.initialHash
  }
  writeFileSync('tests/fixtures/golden.json', JSON.stringify(pinned, null, 2) + '\n')
  process.exit(0)
}
const vectors: GoldenVector[] = []
for (const [name, seed, background] of [['surface', 'golden-surface', 'Bg.Hunter'], ['dungeon-combat', 'smoke-1', 'Bg.Deserter'], ['freeze-reentry', 'golden-freeze', 'Bg.Excommunicate']]) {
  const w = { db, s: newGame(db, { seed, background }) }, ops: ReplayOp[] = [], errors: (string | null)[] = []
  const expectedInitialHash = stateHash(w.s)
  const record = (op: ReplayOp) => { ops.push(op); errors.push(replayOp(w, op)) }
  if (name !== 'surface') record({ map: 'crypt1' })
  for (let i = 0; i < 80 && !w.s.over; i++) {
    if (name === 'freeze-reentry' && i === 40) {
      record({ map: 'surface' })
      for (let t = 0; t < 64 && !w.s.over; t++) record({ action: { type: 'wait' } })
      if (!w.s.over) record({ map: 'crypt1' })
    }
    const action = botDecide(w)
    // 의사 결정은 기록할 때만. 검증은 기록된 커맨드만 재생한다.
    ops.push({ action }); const err = playerAct(w, action); errors.push(err)
    if (err && !w.s.over) record({ action: { type: 'wait' } })
  }
  delete w.s.bot // 봇의 내부 기억은 커맨드의 결과가 아니므로 벡터에서 제외한다.
  vectors.push({ name, seed, background, ops, expectedInitialHash, expectedHash: stateHash(w.s), expectedErrors: errors })
}
mkdirSync('tests/fixtures', { recursive: true })
writeFileSync('tests/fixtures/golden.json', JSON.stringify(vectors, null, 2) + '\n')
console.log(vectors.map((v) => `${v.name}: ${v.ops.length} commands → ${v.expectedHash}`).join('\n'))
