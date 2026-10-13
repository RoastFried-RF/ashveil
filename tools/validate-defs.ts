// Def 검증 CLI: pnpm validate-defs [modId...]
import { loadDb } from './loadContent'

const enabled = process.argv.slice(2)
const { db, report } = loadDb(enabled)
console.log(`로드 순서: ${report.order.join(' → ')}`)
console.log(`Def ${['Body', 'Wound', 'Item', 'Creature', 'Terrain', 'LootTable', 'Trait', 'Background', 'Thought', 'Event', 'PillEffect', 'Skill'].map((t) => `${t} ${db.all(t).length}`).join(' · ')}`)
console.log(`패치 적용 ${report.patched}건`)
for (const wn of report.warnings) console.log(`경고: ${wn}`)
for (const e of report.errors) console.log(`오류: ${e}`)
if (report.errors.length) process.exit(1)
console.log('OK')
