import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { startNativePreview } from '../../tools/native-preview'
import { visionFixture, type VisionScene } from '../vision-fixture'
import { player, playerAct, serialize, deserialize, updatePlayerVision, idx, type World, type Action } from '../../src/core'
import { applyContentTransition } from '../../src/core/content-transition'

const out = process.argv[2]; if (!out || existsSync(out)) throw Error('Fresh output directory required')
mkdirSync(out, { recursive: true })
const width = Number(process.argv[3] ?? 1440), height = width === 1366 ? 768 : 1080
const server = await startNativePreview(), browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/workspace/.ashveil-tools/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }), page = await browser.newPage({ viewport: { width, height } })
type Hook = { __ashveil: { world(): World } }
const errors: string[] = [], checks: string[] = [], images: string[] = [], fixtures: unknown[] = [], actions: unknown[] = []
let d = visionFixture(), w = d.w, restores = 0
page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()) })
async function check(name: string) {
  await page.waitForFunction(() => { const s = (window as unknown as Hook).__ashveil.world().s; return !s.simulationPending && s.fx.length === 0 }, {}, { timeout: 60000 })
  w.s.fx = []; const actual = await page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s))), expected = JSON.parse(serialize(w.s))
  writeFileSync(join(out, name + '-actual.json'), JSON.stringify(actual)); writeFileSync(join(out, name + '-expected.json'), JSON.stringify(expected))
  assert.ok(isDeepStrictEqual(actual, expected), 'Whole-state mismatch: ' + name); checks.push(name); console.log('PASS', name)
}
async function shot(name: string) { await page.mouse.move(100, 40); await page.waitForTimeout(200); await page.screenshot({ path: join(out, name + '.png') }); images.push(name + '.png') }
async function initial(kind: VisionScene) {
  d = visionFixture(kind); w = d.w; const raw = serialize(w.s); fixtures.push(d.proof)
  writeFileSync(join(out, kind + '-declared-initial.json'), raw)
  await page.goto(server.url); await page.evaluate(raw => { localStorage.setItem('ashveil.imprint.v1', raw); localStorage.removeItem('ashveil.preferences.v1') }, raw)
  await page.reload(); await page.getByTestId('continue').click(); await page.waitForSelector('[data-testid=map][data-ready=true] canvas'); await check(kind + '-loaded')
}
async function input(name: string, a: Action, fn: () => Promise<unknown>) { const before = w.s.time; assert.equal(playerAct(w, a), null); await fn(); await check(name); actions.push({ name, action: a, tu: w.s.time - before }) }
async function torch(name: string) {
  await page.keyboard.press('i'); await page.locator('[data-inventory-item="' + d.torch + '"]').click({ button: 'right' })
  await input(name, { type: 'toggleLight', uid: d.torch }, () => page.getByTestId('item-menu').getByRole('button', { name: player(w).equip.main!.lit ? '불 켜기' : '불 끄기', exact: true }).click())
  await page.keyboard.press('Escape')
}
async function zoom(mode: string) {
  await page.keyboard.press('F3'); await page.getByTestId('map-zoom').selectOption(mode); await page.keyboard.press('Escape'); await check('zoom-' + mode + '-no-turn')
}
async function clickWest(name: string, zoom: number) {
  await page.waitForTimeout(300)
  const h = await page.getByTestId('hud').evaluate(el => el.parentElement!.getBoundingClientRect().height), usable = height - Math.min(height * .45, h) - 24, s = 16 * zoom, p = player(w).pos, mw = w.s.map.w * s, mh = w.s.map.h * s
  let x = width / 2 - (p.x + .5) * s, y = usable / 2 - (p.y + .5) * s
  x = mw < width ? (width - mw) / 2 : Math.min(0, Math.max(width - mw, x)); y = mh < usable ? (usable - mh) / 2 : Math.min(0, Math.max(usable - mh, y))
  const point = { x: x + (p.x - .5) * s, y: y + (p.y + .5) * s }
  await input(name, { type: 'move', dir: 6 }, () => page.mouse.click(point.x, point.y))
}
try {
  await initial('day'); assert.ok(w.s.visible.includes(idx(w, { x: 20, y: 8 }))); assert.ok(!w.s.visible.includes(idx(w, { x: 20, y: 7 }))); assert.ok(!w.s.visible.includes(idx(w, { x: 26, y: 20 })))
  await shot('1901-day-12-wall'); await page.keyboard.press('c'); await page.getByTestId('win-char').waitFor(); assert.ok((await page.getByTestId('win-char').innerText()).includes('12칸 · 어둠 6칸')); await check('character-window-no-turn'); await shot('1902-character-ranges'); await page.keyboard.press('Escape')
  await input('day-real-left-step', { type: 'move', dir: 6 }, () => page.keyboard.press('ArrowLeft')); await shot('1903-day-step-memory')
  await zoom('vision'); await shot('1909-whole-vision-fit'); await clickWest('vision-fit-real-pointer-step', width === 1366 ? 1 : 2)
  await page.keyboard.press('i'); await page.getByRole('button', { name: '타이틀', exact: true }).click(); await page.getByTestId('continue').waitFor(); await page.reload(); await page.getByTestId('continue').click(); await page.waitForSelector('[data-testid=map][data-ready=true] canvas'); await check('zoom-save204-whole-restore'); restores++
  await page.keyboard.press('F3'); assert.equal(await page.getByTestId('map-zoom').inputValue(), 'vision'); await page.keyboard.press('Escape'); await check('vision-fit-preference-restored-no-turn')
  for (const mode of [1, 2, 3, 4]) { await zoom(String(mode)); await clickWest('zoom-' + mode + '-real-pointer-step', mode); await shot('191' + mode + '-manual-zoom-' + mode) }
  await zoom('auto')
  await initial('dark'); assert.ok(w.s.visible.includes(idx(w, { x: 20, y: 14 }))); assert.ok(!w.s.visible.includes(idx(w, { x: 20, y: 13 }))); assert.ok(w.s.visible.includes(idx(w, { x: 9, y: 20 }))); assert.ok(!w.s.visible.includes(idx(w, { x: 13, y: 20 })))
  await shot('1904-dark-6-remote-light'); await torch('real-equipped-torch-on'); assert.equal(player(w).equip.main!.lit, true); await shot('1905-torch-lit-materials'); await torch('real-equipped-torch-off'); assert.equal(player(w).equip.main!.lit, false)
  await input('dark-real-left-step', { type: 'move', dir: 6 }, () => page.keyboard.press('ArrowLeft')); await shot('1906-dark-step-memory')
  await page.keyboard.press('i'); await page.getByRole('button', { name: '타이틀', exact: true }).click(); await page.getByTestId('continue').waitFor(); await page.reload(); await page.getByTestId('continue').click(); await page.waitForSelector('[data-testid=map][data-ready=true] canvas'); await check('dark-save204-whole-restore'); restores++
  await initial('fog'); await shot('1907-fog-reduced-range'); await input('fog-real-wait', { type: 'wait' }, () => page.keyboard.press('Period'))
  await initial('blind'); assert.deepEqual(w.s.visible, []); await shot('1908-blind-no-terrain'); await input('blind-real-wait', { type: 'wait' }, () => page.keyboard.press('Period')); assert.deepEqual(w.s.visible, [])
  if (process.argv[4]) {
    const raw = readFileSync(process.argv[4], 'utf8'); w = { db: d.w.db, s: deserialize(raw) }
    assert.notEqual(w.s.loadHash, w.db.loadHash); fixtures.push({ kind: 'actual-v304-source-imprint', source: process.argv[4], sha256: createHash('sha256').update(raw).digest('hex'), oldHash: w.s.loadHash, save: w.s.version })
    assert.equal(applyContentTransition(w), null); updatePlayerVision(w, player(w)); w.s.fx = []
    await page.goto(server.url); await page.evaluate(raw => { localStorage.setItem('ashveil.imprint.v1', raw); localStorage.removeItem('ashveil.preferences.v1') }, raw); await page.reload(); await page.getByTestId('continue').click(); await page.getByTestId('content-change-review').waitFor()
    assert.equal(await page.evaluate(() => localStorage.getItem('ashveil.imprint.v1')), raw); assert.equal(await page.evaluate(() => (window as unknown as Hook).__ashveil.world()), null); await shot('1915-v304-content-review')
    await page.getByTestId('content-change-cancel').click(); assert.equal(await page.evaluate(() => localStorage.getItem('ashveil.imprint.v1')), raw)
    await page.getByTestId('continue').click(); await page.getByTestId('content-change-accept').click(); await page.waitForSelector('[data-testid=map][data-ready=true] canvas'); await check('actual-v304-imprint-adopted-new-vision'); await shot('1916-v304-new-vision')
    await input('v304-adopted-real-wait', { type: 'wait' }, () => page.keyboard.press('Period'))
    await page.keyboard.press('i'); await page.getByRole('button', { name: '타이틀', exact: true }).click(); await page.getByTestId('continue').waitFor(); await page.reload(); await page.getByTestId('continue').click(); await page.waitForSelector('[data-testid=map][data-ready=true] canvas'); await check('v304-adoption-save204-whole-restore'); restores++
  }
  assert.deepEqual(errors, []); writeFileSync(join(out, 'audit.json'), JSON.stringify({ width, height, wholePairs: checks.length, restores, checks, images, fixtures, actions, errors }, null, 2)); console.log(JSON.stringify({ width, wholePairs: checks.length, restores, images: images.length, errors }))
} catch (error) { await page.screenshot({ path: join(out, 'failure.png') }).catch(() => {}); writeFileSync(join(out, 'failure-body.txt'), await page.locator('body').innerText()); throw error } finally { await page.close(); await browser.close(); server.stop() }
