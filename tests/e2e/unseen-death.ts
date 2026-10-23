import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { startNativePreview } from '../../tools/native-preview'
import { unseenDeathFixture } from '../unseen-death-fixture'
import { autoSnap, autoStop, player, playerAct, serialize, type Action, type World } from '../../src/core'

const out = process.argv[2], width = Number(process.argv[3] ?? 1440), height = width === 1366 ? 768 : 1080
if (!out || existsSync(out)) throw Error('Fresh output directory required')
mkdirSync(out, { recursive: true })
const server = await startNativePreview(), browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/workspace/.ashveil-tools/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }), page = await browser.newPage({ viewport: { width, height } })
type Hook = { __ashveil: { world(): World }; render_game_to_text(): string }
const errors: string[] = [], checks: string[] = [], images: string[] = [], fixtures: unknown[] = [], actions: unknown[] = []
let d = unseenDeathFixture(), w = d.w, restores = 0
page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()) })
function target() { return w.s.creatures.find(c => c.id === d.targetId)! }
async function check(name: string) {
  await page.waitForFunction(() => { const s = (window as unknown as Hook).__ashveil.world().s; return !s.simulationPending && s.fx.length === 0 }, {}, { timeout: 60000 })
  w.s.fx = []
  const actual = await page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s))), expected = JSON.parse(serialize(w.s))
  writeFileSync(join(out, name + '-actual.json'), JSON.stringify(actual)); writeFileSync(join(out, name + '-expected.json'), JSON.stringify(expected))
  assert.ok(isDeepStrictEqual(actual, expected), 'Whole-state mismatch: ' + name); checks.push(name); console.log('PASS', name)
}
async function shot(name: string) { await page.mouse.move(100, 40); await page.waitForTimeout(300); await page.screenshot({ path: join(out, name + '.png') }); images.push(name + '.png') }
async function initial(occlusion = true) {
  d = unseenDeathFixture(occlusion); w = d.w; const raw = serialize(w.s)
  if (occlusion && process.argv[4]) assert.ok(isDeepStrictEqual(JSON.parse(raw), JSON.parse(readFileSync(process.argv[4], 'utf8'))), 'Initial world differs from recorded309 reproduction')
  fixtures.push({ ...d.proof, original309Initial: occlusion ? process.argv[4] : undefined })
  writeFileSync(join(out, (occlusion ? 'occluded' : 'visible') + '-declared-initial.json'), raw)
  await page.goto(server.url); await page.evaluate(raw => { localStorage.setItem('ashveil.imprint.v1', raw); localStorage.removeItem('ashveil.preferences.v1') }, raw); await page.reload(); await page.getByTestId('continue').click(); await page.waitForSelector('[data-testid=map][data-ready=true] canvas'); await check(occlusion ? 'occluded-initial' : 'visible-initial')
}
async function input(name: string, steps: Action[], fn: () => Promise<unknown>, navigation = false) {
  const before = w.s.time
  const snap = navigation ? autoSnap(w) : undefined
  for (const a of steps) { assert.equal(playerAct(w, a), null); if (snap) assert.equal(autoStop(w, snap), null) }
  const start = performance.now(); await fn()
  await page.waitForFunction(tu => (window as unknown as Hook).__ashveil.world().s.time === tu, w.s.time, { timeout: 30000 })
  await check(name); actions.push({ name, steps, tu: w.s.time - before, inputToWholeStateMs: performance.now() - start })
}
async function roundtrip(name: string) {
  await page.getByRole('button', { name: '타이틀', exact: true }).click(); await page.getByTestId('continue').waitFor(); await page.reload(); await page.getByTestId('continue').click(); await page.waitForSelector('[data-testid=map][data-ready=true] canvas'); await check(name); restores++
}
async function assertHidden() {
  assert.ok(!w.s.visible.includes(target().pos.y * w.s.map.w + target().pos.x))
  const dto = JSON.parse(await page.evaluate(() => (window as unknown as Hook).render_game_to_text()))
  assert.ok(!dto.visibleCreatures.some((c: { id: number }) => c.id === d.targetId))
  assert.ok(!w.s.log.some(e => e.text.includes('쓰러졌다')))
  assert.ok(!player(w).thoughts.some(t => t.def === 'Thought.SawDeath'))
}
try {
  await initial(); await shot('2301-visible-alive')
  await page.getByTestId('map').focus(); await input('south-occludes-living-actor', [{ type: 'move', dir: 4 }], () => page.keyboard.press('ArrowDown')); assert.equal(target().alive, true); await assertHidden(); await shot('2302-hidden-alive')
  await input('actual-unseen-bleeding-death', [{ type: 'wait' }], () => page.keyboard.press('Period')); assert.equal(target().alive, false); assert.equal(target().deathCause, '과다 출혈'); await assertHidden(); await shot('2303-hidden-dead-no-ghost')
  await input('north-observes-original-corpse', [{ type: 'move', dir: 0 }], () => page.keyboard.press('ArrowUp')); assert.ok(w.s.visible.includes(target().pos.y * w.s.map.w + target().pos.x)); await shot('2304-corpse-first-observed')
  await input('south-hides-observed-corpse', [{ type: 'move', dir: 4 }], () => page.keyboard.press('ArrowDown')); await assertHidden(); await shot('2305-remembered-tile-no-corpse')
  await roundtrip('hidden-corpse-save205-restored'); await assertHidden(); await shot('2306-hidden-restored')
  // Auto zoom centres vertically one tile above centre; the small viewport also
  // clamps the map's left edge. Validate the pointer with the independent three
  // real actions and normal Core auto-stop bookkeeping, not browser output.
  const rect = await page.getByTestId('map').boundingBox(); assert.ok(rect)
  const size = 16 * Math.max(1, Math.floor(rect.height / 360)), p = player(w), pos = target().pos
  const mapWidth = w.s.map.w * size, cameraX = mapWidth < rect.width ? (rect.width - mapWidth) / 2 : Math.min(0, Math.max(rect.width - mapWidth, rect.width / 2 - (p.pos.x + .5) * size))
  const point = { x: rect.x + Math.round(cameraX) + (pos.x + .5) * size, y: rect.y + rect.height / 2 - size + (pos.y - p.pos.y) * size }
  await input('hidden-tile-click-walks-without-reading-corpse', [{ type: 'move', dir: 1 }, { type: 'move', dir: 2 }, { type: 'move', dir: 2 }], () => page.mouse.click(point.x, point.y), true); assert.deepEqual(player(w).pos, target().pos); assert.equal(w.s.loot, undefined); await shot('2307-actual-hidden-tile-click')
  await page.getByTestId('map').focus(); await input('north-leaves-corpse-visible', [{ type: 'move', dir: 0 }], () => page.keyboard.press('ArrowUp')); await shot('2308-corpse-visible-after-walk')
  await roundtrip('visible-corpse-save205-restored'); await shot('2309-visible-restored')
  await initial(false); await shot('2310-visible-positive-initial'); await page.getByTestId('map').focus()
  await input('visible-first-bleeding-turn', [{ type: 'wait' }], () => page.keyboard.press('Period')); assert.equal(target().alive, true)
  await input('visible-death-keeps-witness-log', [{ type: 'wait' }], () => page.keyboard.press('Period')); assert.equal(target().alive, false); assert.ok(player(w).thoughts.some(t => t.def === 'Thought.SawDeath')); assert.ok(w.s.log.some(e => e.text.includes('쓰러졌다') && e.text.includes('과다 출혈'))); await shot('2311-visible-positive-death')
  await roundtrip('visible-positive-save205-restored'); await shot('2312-visible-positive-restored')
  assert.deepEqual(errors, []); const audit = { width, height, wholePairs: checks.length, restores, images, checks, actions, fixtures, errors }
  writeFileSync(join(out, 'audit.json'), JSON.stringify(audit, null, 2)); console.log(JSON.stringify({ width, wholePairs: checks.length, restores, images: images.length, errors }))
} catch (error) {
  await page.screenshot({ path: join(out, 'failure.png') }).catch(() => {}); writeFileSync(join(out, 'failure-errors.json'), JSON.stringify(errors)); writeFileSync(join(out, 'failure-body.txt'), await page.locator('body').innerText()); throw error
} finally { await page.close(); await browser.close(); server.stop() }
