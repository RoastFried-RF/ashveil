import { loadDb } from '../../tools/loadContent'
import { newGame, playerAct } from '../../src/core/game'
import { killCreature, resolveAttack } from '../../src/core/combat'
import { clinicQuote } from '../../src/core/clinic'
import { invalidateLights } from '../../src/core/fov'
import { exchange, marketFor, stockCount } from '../../src/core/economy'
import { readNote } from '../../src/core/rumors'
import { generateDungeon } from '../../src/core/mapgen'
import { investigationOffers, isInvestigation } from '../../src/core/investigation'
import { enterRegion } from '../../src/core/journey'
import { createCreature } from '../../src/core/creatures'
import { addWound, capacity } from '../../src/core/body'
import { channelTurns } from '../../src/core/action-time'
import { Rng, seedState } from '../../src/core/rng'
import { addEffect } from '../../src/core/traits'
import { addToBag, makeItem, itemDef as coreItemDef } from '../../src/core/items'
import { initializeSettlement } from '../../src/core/settlements'
import { ensureSociety } from '../../src/core/diplomacy'
import { activityStep, perform } from '../../src/core/actions'
import { player as corePlayer, tileAt as coreTile } from '../../src/core/ctx'
// Playwright 스모크: 새 게임 → 이동 → 창(I/C/K/B/M) → 봇으로 던전 진입·전투 → 스크린샷. 콘솔 오류가 있으면 실패.
// 설정만: SMOKE_SECTION=settings (전체 전투/침구 회귀 뒤 설정 화면만 재검증할 때)
// 사용: npm run build && node --import tsx tests/e2e/smoke.ts [outDir]
import { chromium, type Page } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import type { World } from '../../src/core/ctx'

const out = process.argv[2] ?? 'test-results'
mkdirSync(out, { recursive: true })
const server = spawn('npx', ['vite', 'preview', '--port', '4317', '--strictPort'], { stdio: 'pipe', detached: true })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const errors: string[] = []

type Hook = { __ashveil: { botSteps(n: number): string; world(): World } }
const bot = (page: Page, n: number) => page.evaluate((k) => (window as unknown as Hook).__ashveil.botSteps(k), n)
const mapId = (page: Page) => page.evaluate(() => (window as unknown as Hook).__ashveil.world().s.map.id)

try {
  if (!['settings', 'gear', 'psyche', 'creation', 'recovery', 'surgery', 'medical', 'backgrounds', 'nutrition', 'food', 'water', 'prosthetics', 'injury', 'storage', 'world', 'climate', 'society', 'pharmacology', 'knowledge', 'bestiary', 'clinic', 'inn', 'hands', 'resident', 'provisions', 'well', 'purification', 'teaching', 'warmth', 'bedding', 'mortality', 'contracts', 'investigation', 'keys', 'relations', 'cold', 'companions', 'bonds', 'prisoners'].includes(process.env.SMOKE_SECTION ?? '')) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push(e.message))
    const bootStart = performance.now()
    await page.goto('http://localhost:4317/?debug')
    await page.fill('[data-testid=seed]', process.env.SEED ?? 'smoke-1')
    await page.screenshot({ path: `${out}/01-title.png` })
    await page.getByRole('button', { name: /탈영 경비병/ }).click()
    await page.click('[data-testid=start]')
    await page.waitForSelector('[data-testid=map] canvas')
    await page.waitForTimeout(1800)
    const bootMs = performance.now() - bootStart
    const frames: number[] = await page.evaluate(`new Promise((resolve) => {
      const times = [];
      let last = performance.now();
      const tick = (now) => { times.push(now - last); last = now; if (times.length < 120) requestAnimationFrame(tick); else resolve(times); };
      requestAnimationFrame(tick);
    })`)
    const sorted = frames.slice(5).sort((a, b) => a - b)
    writeFileSync(`${out}/performance.json`, JSON.stringify({ renderer: 'Chromium SwiftShader (software GPU)', viewport: [1440, 900], bootIncludingSettleMs: Math.round(bootMs), samples: sorted.length, frameMedianMs: sorted[Math.floor(sorted.length * 0.5)], frameP95Ms: sorted[Math.floor(sorted.length * 0.95)] }, null, 2) + '\n')
    await page.screenshot({ path: `${out}/02-surface.png` })
    for (const k of ['ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowUp']) { await page.keyboard.press(k); await page.waitForTimeout(170) }
    await page.keyboard.press('i')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}/03-inventory.png` })
    await page.keyboard.press('i')
    await page.keyboard.press('c')
    await page.keyboard.press('Shift+KeyK')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}/04-char-abil.png` })
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Shift+KeyJ')
    await page.waitForSelector('[data-testid=temperature-detail]')
    const temperature = await page.textContent('[data-testid=temperature-detail]')
    assert.match(temperature ?? '', /전신 단열/)
    assert.match(temperature ?? '', /체감.*바람.*열원/)
    assert.match(temperature ?? '', /°C\/10분/)
    await page.waitForSelector('[data-testid=sleep-detail]')
    assert.match(await page.textContent('[data-testid=sleep-detail]') ?? '', /수면 질.*수면 부채/)
    await page.screenshot({ path: `${out}/04b-temperature.png` })
    await page.keyboard.press('Escape')
    // 봇: 지하로 내려가 싸울 때까지
    let fought = false
    for (let i = 0; i < 80; i++) {
      const st = await bot(page, 12)
      if (st === 'over') break
      const hunting = await page.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.some((c) => c.alive && c.faction !== 'player' && c.ai.mode === 'hunt'))
      if ((await mapId(page)) !== 'surface' && hunting) { fought = true; break }
    }
    await page.waitForTimeout(250)
    assert.ok(fought, '봇이 던전에 진입해 실제 교전을 시작해야 한다')
    await page.screenshot({ path: `${out}/05-crypt-fight.png` })
    if (fought) {
      await bot(page, 1)
      await page.waitForTimeout(120)
      await page.screenshot({ path: `${out}/06-anim-midframe.png` })
    }
    await page.mouse.move(720, 430)
    await page.keyboard.down('Shift')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}/07-hover.png` })
    await page.keyboard.up('Shift')
    await page.keyboard.press('Shift+KeyB')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}/08-body.png` })
    await page.keyboard.press('Escape')
    await page.keyboard.press('m')
    await page.waitForSelector('[data-testid=win-map]')
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${out}/08b-map.png` })
    await page.keyboard.press('Escape')
    for (let i = 0; i < 30; i++) { if ((await bot(page, 30)) === 'over') break }
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${out}/09-later.png` })
    console.log('map:', await mapId(page), 'fought:', fought)
    const logText = await page.textContent('[data-testid=log]')
    console.log('log tail:', (logText ?? '').slice(-300))
    await page.close()
    // 별도 게임에서 긴 휴식 중에도 창이 열리고, 계산이 끝나면 입력이 복귀하는지 확인한다.
    const sliced = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    sliced.on('pageerror', (e) => errors.push(e.message))
    sliced.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await sliced.goto('http://localhost:4317/?debug')
    await sliced.fill('[data-testid=seed]', 'smoke-1')
    await sliced.click('[data-testid=start]')
    await sliced.waitForSelector('[data-testid=map] canvas')
    await sliced.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    const pending = await sliced.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', bubbles: true }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', bubbles: true }))
      return (window as unknown as Hook).__ashveil.world().s.simulationPending
    })
    assert.equal(pending, true, '긴 휴식은 화면에 제어를 돌려줘야 한다')
    await sliced.waitForSelector('[data-testid=win-journal]')
    await sliced.waitForFunction(() => !(window as unknown as Hook).__ashveil.world().s.simulationPending, undefined, { timeout: 60000 })
    assert.ok(await sliced.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time > 21600 * 100))
    await sliced.screenshot({ path: `${out}/10-sliced-rest.png` })
    await sliced.close()
    // 실제 시작 재료로 F2 제작 → 재료 소비 → 완성품·정비 화면을 확인한다.
    const craft = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    craft.on('pageerror', (e) => errors.push(e.message))
    craft.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await craft.goto('http://localhost:4317/?debug')
    await craft.fill('[data-testid=seed]', 'crafting-smoke')
    await craft.getByRole('button', { name: /파문된 순례자/ }).click()
    await craft.click('[data-testid=start]')
    await craft.waitForSelector('[data-testid=map] canvas')
    await craft.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    const counts = () => craft.evaluate(() => {
      const s = (window as unknown as Hook).__ashveil.world().s
      const p = s.creatures.find((c) => c.faction === 'player')!
      return { cloth: p.bag.filter((i) => i.def === 'Item.Cloth').reduce((n, i) => n + i.count, 0), bandage: p.bag.filter((i) => i.def === 'Item.Bandage').reduce((n, i) => n + i.count, 0) }
    })
    const before = await counts()
    assert.equal(before.cloth, 2)
    await craft.keyboard.press('F2')
    await craft.waitForSelector('[data-testid=win-craft]')
    const bandage = craft.locator('[data-testid="Recipe.Bandage"]')
    await bandage.getByRole('button', { name: '제작', exact: true }).click()
    await craft.waitForFunction(() => {
      const s = (window as unknown as Hook).__ashveil.world().s
      return !s.simulationPending && !s.creatures.find((c) => c.faction === 'player')?.activity
    }, undefined, { timeout: 60000 })
    assert.deepEqual(await counts(), { cloth: 0, bandage: before.bandage + 1 })
    await craft.screenshot({ path: `${out}/11-crafting.png` })
    await craft.getByRole('button', { name: '수리·분해', exact: true }).click()
    assert.match(await craft.textContent('[data-testid=win-craft]') ?? '', /최대 내구가 영구 감소/)
    const repairs = craft.locator('[data-testid=win-craft]').getByRole('button', { name: '수리', exact: true })
    for (const button of await repairs.all()) assert.equal(await button.isEnabled(), false, '멀쩡한 장비의 수리는 비활성화한다')
    await craft.screenshot({ path: `${out}/12-maintenance.png` })
    await craft.close()
    // 침구 UI는 안전한 고정 환경에서 설치·수면 표시·접기를 검증한다.
    const camp = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    camp.on('pageerror', (e) => errors.push(e.message))
    camp.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await camp.goto('http://localhost:4317/?debug')
    await camp.fill('[data-testid=seed]', 'camping-smoke')
    await camp.getByRole('button', { name: /파문된 순례자/ }).click()
    await camp.click('[data-testid=start]')
    await camp.waitForSelector('[data-testid=map] canvas')
    await camp.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    await camp.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.weather = 'clear'; s.wind = { x: 0, y: 0 }
      p.traits = []; p.facing = 2
      p.bag = [{ uid: s.nextId++, def: 'Item.Bedroll', count: 1, quality: 1, wetness: {}, gx: 0, gy: 0 }]
      for (let y = p.pos.y - 2; y <= p.pos.y + 2; y++) for (let x = p.pos.x - 2; x <= p.pos.x + 2; x++) Object.assign(s.map.tiles[y * s.map.w + x], { t: 'Terrain.Earth', roof: true, items: [] })
      s.map.lights = [{ pos: { ...p.pos }, kind: 'campfire', radius: 6 }]
    })
    await camp.keyboard.press('i')
    await camp.locator('[data-testid="item-Item.Bedroll"]').click({ button: 'right' })
    await camp.getByText('바라보는 쪽에 설치', { exact: true }).click()
    await camp.keyboard.press('Escape')
    await camp.keyboard.press('ArrowRight')
    await camp.keyboard.press('Shift+KeyJ')
    await camp.waitForSelector('[data-testid=sleep-detail]')
    assert.match(await camp.textContent('[data-testid=sleep-detail]') ?? '', /침구 침낭.*수면 질 0.80/)
    await camp.screenshot({ path: `${out}/13-bedroll-sleep.png` })
    await camp.keyboard.press('Escape')
    await camp.keyboard.press('F2')
    await camp.getByRole('button', { name: '접어 가져가기', exact: true }).click()
    const bedrolls = await camp.evaluate(() => {
      const s = (window as unknown as Hook).__ashveil.world().s, p = s.creatures.find((c) => c.faction === 'player')!
      return p.bag.filter((i) => i.def === 'Item.Bedroll').reduce((n, i) => n + i.count, 0)
    })
    assert.equal(bedrolls, 1)
    await camp.screenshot({ path: `${out}/14-bedroll-packed.png` })
    await camp.close()
    const material = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    material.on('pageerror', (e) => errors.push(e.message))
    material.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await material.goto('http://localhost:4317/?debug')
    await material.fill('[data-testid=seed]', 'material-smoke')
    await material.getByRole('button', { name: /파문된 순례자/ }).click()
    await material.click('[data-testid=start]')
    await material.waitForSelector('[data-testid=map] canvas')
    await material.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    await material.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; p.traits = []
      p.recipes = ['Recipe.SteelHatchet']
      p.bag = [['SteelIngot', 3, 0], ['SteelIngot', 1, 1], ['Wood', 1, 2], ['Charcoal', 3, 3], ['IronHammer', 1, 4], ['Tongs', 1, 5]].map(([id, count, gx]) => ({ uid: s.nextId++, def: `Item.${id}`, count: count as number, gx: gx as number, gy: 0, durability: id === 'IronHammer' || id === 'Tongs' ? 100 : undefined }))
      for (let y = p.pos.y - 2; y <= p.pos.y + 2; y++) for (let x = p.pos.x - 2; x <= p.pos.x + 2; x++) Object.assign(s.map.tiles[y * s.map.w + x], { t: 'Terrain.Earth', roof: true, items: [] })
      s.map.tiles[p.pos.y * s.map.w + p.pos.x + 1].t = 'Terrain.Forge'
      s.map.lights = [{ pos: { ...p.pos }, kind: 'campfire', radius: 6 }]
    })
    await material.keyboard.press('F2')
    await material.getByLabel('제작 분야').selectOption('smithing')
    await material.locator('[data-testid="Recipe.SteelHatchet"]').getByRole('button', { name: '제작', exact: true }).click()
    await material.waitForFunction(() => {
      const s = (window as unknown as Hook).__ashveil.world().s, p = s.creatures.find((c) => c.faction === 'player')!
      return !s.simulationPending && !p.activity
    }, undefined, { timeout: 60000 })
    const made = await material.evaluate(() => {
      const s = (window as unknown as Hook).__ashveil.world().s, p = s.creatures.find((c) => c.faction === 'player')!
      return { stuff: p.bag.find((i) => i.def === 'Item.SteelHatchet')?.stuff, steel: p.bag.filter((i) => i.def === 'Item.SteelIngot').reduce((n, i) => n + i.count, 0) }
    })
    assert.deepEqual(made, { stuff: { head: 'Material.Steel' }, steel: 0 })
    await material.keyboard.press('Escape')
    await material.keyboard.press('i')
    await material.locator('[data-testid="item-Item.SteelHatchet"]').hover()
    await material.waitForTimeout(300)
    assert.match(await material.textContent('body') ?? '', /재질 주재료: 강철/)
    await material.screenshot({ path: `${out}/17-steel-hatchet.png` })
    await material.close()
  }
  if (!['settings', 'psyche', 'creation', 'recovery', 'surgery', 'medical', 'backgrounds', 'nutrition', 'food', 'water', 'prosthetics', 'injury', 'storage', 'world', 'climate', 'society', 'pharmacology', 'knowledge', 'bestiary', 'clinic', 'inn', 'hands', 'resident', 'provisions', 'well', 'purification', 'teaching', 'warmth', 'bedding', 'mortality', 'contracts', 'investigation', 'keys', 'relations', 'cold', 'companions', 'bonds', 'prisoners'].includes(process.env.SMOKE_SECTION ?? '')) {
    const gear = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    gear.on('pageerror', (e) => errors.push(e.message))
    gear.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await gear.goto('http://localhost:4317/?debug')
    await gear.fill('[data-testid=seed]', 'gear-smoke')
    await gear.getByRole('button', { name: /파문된 순례자/ }).click()
    await gear.click('[data-testid=start]')
    await gear.waitForSelector('[data-testid=map] canvas')
    await gear.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    await gear.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; p.traits = []
      p.equip.main = { uid: s.nextId++, def: 'Item.Bow', count: 1, durability: 100, bowBroken: true, bowMoisture: 90 }
      p.bag = [{ uid: s.nextId++, def: 'Item.Wax', count: 1, gx: 0, gy: 0 }, { uid: s.nextId++, def: 'Item.LampOil', count: 1, gx: 1, gy: 0 }, { uid: s.nextId++, def: 'Item.BowString', count: 1, gx: 2, gy: 0 }, { uid: s.nextId++, def: 'Item.SharpeningStone', count: 1, gx: 3, gy: 0, durability: 100 }, { uid: s.nextId++, def: 'Item.SteelKnife', count: 1, gx: 4, gy: 0, durability: 100, edge: 20, stuff: { blade: 'Material.Steel' } }]
      for (let y = p.pos.y - 2; y <= p.pos.y + 2; y++) for (let x = p.pos.x - 2; x <= p.pos.x + 2; x++) Object.assign(s.map.tiles[y * s.map.w + x], { t: 'Terrain.Earth', roof: true, items: [] })
      s.map.lights = [{ pos: { ...p.pos }, kind: 'campfire', radius: 6 }]
    })
    await gear.keyboard.press('f')
    assert.match(await gear.textContent('[data-testid=hint]') ?? '', /시위/)
    await gear.keyboard.press('F2')
    await gear.getByRole('button', { name: '수리·분해', exact: true }).click()
    const settle = () => gear.waitForFunction(() => {
      const s = (window as unknown as Hook).__ashveil.world().s
      return !s.simulationPending && !s.creatures.find((c) => c.faction === 'player')?.activity
    }, undefined, { timeout: 60000 })
    const bow = gear.locator('[data-testid="gear-Item.Bow"]')
    await bow.getByRole('button', { name: '시위 걸기', exact: true }).click(); await settle()
    await bow.getByRole('button', { name: '밀랍칠', exact: true }).click(); await settle()
    const knife = gear.locator('[data-testid="gear-Item.SteelKnife"]')
    await knife.getByRole('button', { name: '기름칠', exact: true }).click(); await settle()
    await knife.getByRole('button', { name: '날 갈기', exact: true }).click(); await settle()
    const done = await gear.evaluate(() => {
      const s = (window as unknown as Hook).__ashveil.world().s, p = s.creatures.find((c) => c.faction === 'player')!, knife = p.bag.find((i) => i.def === 'Item.SteelKnife')!
      return { broken: p.equip.main!.bowBroken, waxed: p.equip.main!.waxedUntil! > s.time / 100, oiled: knife.oiledUntil! > s.time / 100, edge: knife.edge, materials: p.bag.filter((i) => ['Item.Wax', 'Item.LampOil', 'Item.BowString'].includes(i.def)).length, stone: p.bag.find((i) => i.def === 'Item.SharpeningStone')!.durability }
    })
    assert.deepEqual(done, { broken: false, waxed: true, oiled: true, edge: 100, materials: 0, stone: 99 })
    await gear.mouse.move(10, 10)
    await knife.hover()
    await gear.waitForSelector('[data-testid=tooltip]')
    assert.match(await gear.textContent('[data-testid=tooltip]') ?? '', /날 상태 100%/)
    assert.match(await gear.textContent('[data-testid=tooltip]') ?? '', /기름칠:.*부식 면제/)
    await gear.waitForTimeout(200)
    await gear.screenshot({ path: `${out}/18-gear-care.png` })
    await gear.close()
  }
  if (!['settings', 'gear', 'creation', 'recovery', 'surgery', 'medical', 'backgrounds', 'nutrition', 'food', 'water', 'prosthetics', 'injury', 'storage', 'world', 'climate', 'society', 'pharmacology', 'knowledge', 'bestiary', 'clinic', 'inn', 'hands', 'resident', 'provisions', 'well', 'purification', 'teaching', 'warmth', 'bedding', 'mortality', 'contracts', 'investigation', 'keys', 'relations', 'cold', 'companions', 'bonds', 'prisoners'].includes(process.env.SMOKE_SECTION ?? '')) {
    const psyche = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    psyche.on('pageerror', (e) => errors.push(e.message))
    psyche.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await psyche.goto('http://localhost:4317/?debug')
    await psyche.fill('[data-testid=seed]', 'psyche-smoke')
    await psyche.getByRole('button', { name: /파문된 순례자/ }).click()
    await psyche.click('[data-testid=start]')
    await psyche.waitForSelector('[data-testid=map] canvas')
    await psyche.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    await psyche.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!, enemy = s.creatures.find((c) => c.def === 'Creature.Reaver')!
      s.creatures = [p, enemy]; p.pos = { x: 20, y: 20 }; enemy.pos = { x: 22, y: 20 }; enemy.asleep = true; enemy.deepSleep = true
      s.time = 14400 * 100; p.nextAct = s.time; enemy.nextAct = s.time + 1000000; s.weather = 'clear'; s.wind = { x: 0, y: 0 }
      p.traits = []; p.traumas = []; p.needs.stress = 0; p.needs.energy = 100; p.activity = undefined
      p.body.blood = p.body.bloodMax * .59
      p.body.wounds = [{ id: s.nextId++, def: 'Wound.Cut', part: 'LeftForearm', severity: 3, healed: 0, bleed: .1, arterial: false, internal: false, contam: 0, ageTurns: 0, source: enemy.name, sourceId: enemy.id }]
      for (let y = 16; y <= 24; y++) for (let x = 16; x <= 24; x++) { const t = s.map.tiles[y * s.map.w + x]; t.t = 'Terrain.Earth'; t.roof = false }
      s.rng.body = [0, 0, 0, 1]
    })
    await psyche.keyboard.press('.')
    await psyche.waitForFunction(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')?.traumas?.some((t) => t.def === 'Trauma.Species'))
    await psyche.keyboard.press('c')
    await psyche.waitForSelector('[data-testid=traumas]')
    assert.match(await psyche.textContent('[data-testid=traumas]') ?? '', /종족 공포증.*약탈자/)
    await psyche.locator('[data-testid=traumas] .cursor-help').hover()
    await psyche.waitForSelector('[data-testid=tooltip]')
    assert.match(await psyche.textContent('[data-testid=tooltip]') ?? '', /스트레스.*2\/10턴/)
    await psyche.screenshot({ path: `${out}/19-trauma.png` })
    await psyche.keyboard.press('c'); await psyche.keyboard.press('Shift+KeyJ')
    await psyche.waitForSelector('[data-testid=win-journal]')
    assert.match(await psyche.textContent('[data-testid=win-journal]') ?? '', /죽을 뻔했다.*시간.*남음/)
    await psyche.screenshot({ path: `${out}/20-thoughts.png` })
    await psyche.reload(); await psyche.click('[data-testid=continue]'); await psyche.waitForSelector('[data-testid=map] canvas')
    await psyche.keyboard.press('c'); await psyche.waitForSelector('[data-testid=traumas]')
    assert.match(await psyche.textContent('[data-testid=traumas]') ?? '', /극복 0\/100/)
    const beforePrayer = await psyche.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; p.body.blood = p.body.bloodMax; p.body.wounds = []; p.effects = []; p.cond = {}; p.unconscious = false; p.traumas = []; p.breakdown = undefined; p.activity = undefined
      p.traits = ['Trait.Pious']; p.needs.stress = 40; p.needs.energy = 100; p.nearDeath = false
      return s.time
    })
    await psyche.keyboard.press('.')
    await psyche.waitForSelector('[data-testid=pray]')
    await psyche.click('[data-testid=pray]')
    await psyche.waitForFunction(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      return !s.simulationPending && !p.activity && p.needs.stress === 30
    }, undefined, { timeout: 60000 })
    assert.ok(await psyche.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) >= beforePrayer + 20000)
    await psyche.screenshot({ path: `${out}/21-prayer.png` })
    await psyche.reload(); await psyche.click('[data-testid=continue]'); await psyche.waitForSelector('[data-testid=map] canvas')
    assert.equal(await psyche.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.needs.stress), 30)
    await psyche.close()
  }
  if (!['settings', 'gear', 'psyche', 'recovery', 'surgery', 'medical', 'backgrounds', 'nutrition', 'food', 'water', 'prosthetics', 'injury', 'storage', 'world', 'climate', 'society', 'pharmacology', 'knowledge', 'bestiary', 'clinic', 'inn', 'hands', 'resident', 'provisions', 'well', 'purification', 'teaching', 'warmth', 'bedding', 'mortality', 'contracts', 'investigation', 'keys', 'relations', 'cold', 'companions', 'bonds', 'prisoners'].includes(process.env.SMOKE_SECTION ?? '')) {
    const creation = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    creation.on('pageerror', (e) => errors.push(e.message))
    creation.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await creation.goto('http://localhost:4317/?debug')
    await creation.fill('[data-testid=seed]', 'creation-smoke')
    await creation.getByRole('button', { name: /촌락 사냥꾼/ }).click()
    const preview = creation.locator('[data-testid=creation-preview]')
    await preview.waitFor()
    const before = await preview.innerText()
    await creation.click('[data-testid=reroll]')
    await creation.waitForFunction(() => (document.querySelector('[data-testid=reroll]') as HTMLButtonElement)?.disabled)
    const after = await preview.innerText()
    assert.notEqual(before, after)
    const expectedTraits = await preview.locator('.text-amber-200').allTextContents()
    const expectedStats = [...after.matchAll(/(?:근력|민첩|지각|활력|의지) (\d+)/g)].map((m) => Number(m[1]))
    assert.equal(expectedStats.reduce((a, b) => a + b, 0), 50)
    const expectedAge = Number(after.match(/(\d+)세/)?.[1])
    assert.ok(expectedAge >= 18 && expectedAge <= 45)
    await creation.screenshot({ path: `${out}/22-creation.png` })
    await creation.click('[data-testid=start]')
    await creation.waitForSelector('[data-testid=map] canvas')
    await creation.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    const actual = await creation.evaluate(() => {
      const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!
      return { stats: Object.values(p.stats), age: p.age!.years, roll: p.creationRoll, traits: p.traits.map((id) => (window as unknown as Hook).__ashveil.world().db.trait(id).label) }
    })
    assert.deepEqual(actual, { stats: expectedStats, age: expectedAge, roll: 1, traits: expectedTraits })
    await creation.keyboard.press('c'); await creation.waitForSelector('[data-testid=win-char]')
    assert.match(await creation.textContent('[data-testid=win-char]') ?? '', new RegExp(`${expectedAge}세`))
    await creation.screenshot({ path: `${out}/23-age.png` })
    await creation.reload(); await creation.click('[data-testid=continue]'); await creation.waitForSelector('[data-testid=map] canvas')
    assert.equal(await creation.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.creationRoll), 1)
    await creation.close()
  }
  if (!['settings', 'gear', 'psyche', 'creation', 'surgery', 'medical', 'backgrounds', 'nutrition', 'food', 'water', 'prosthetics', 'injury', 'storage', 'world', 'climate', 'society', 'pharmacology', 'knowledge', 'bestiary', 'clinic', 'inn', 'hands', 'resident', 'provisions', 'well', 'purification', 'teaching', 'warmth', 'bedding', 'mortality', 'contracts', 'investigation', 'keys', 'relations', 'cold', 'companions', 'bonds', 'prisoners'].includes(process.env.SMOKE_SECTION ?? '')) {
    const recovery = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    recovery.on('pageerror', (e) => errors.push(e.message))
    recovery.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await recovery.goto('http://localhost:4317/?debug')
    await recovery.fill('[data-testid=seed]', 'recovery-smoke')
    await recovery.getByRole('button', { name: /파문된 순례자/ }).click()
    await recovery.click('[data-testid=start]')
    await recovery.waitForSelector('[data-testid=map] canvas')
    await recovery.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    await recovery.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; s.map.lights = []; p.nextAct = s.time; p.pos = { x: 20, y: 20 }
      p.age = undefined; p.traits = ['Trait.Vain']; p.effects = []; p.equip = {}; p.activity = undefined; p.breakdown = undefined; p.cond = {}; p.unconscious = false
      p.body.blood = p.body.bloodMax; p.needs.stress = 0; p.needs.bodyTemp = 37; p.needs.energy = 100
      p.body.wounds = [
        { id: s.nextId++, def: 'Wound.Cut', part: 'Skull', severity: 2, healed: 2 - 1e-7, bleed: 0, arterial: false, internal: false, contam: 0, ageTurns: 100, source: '옛 상처', scar: true },
        { id: s.nextId++, def: 'Wound.Burn', part: 'LeftHand', severity: 1, healed: 1 - 1e-7, bleed: 0, arterial: false, internal: false, contam: 0, ageTurns: 100, source: '소작', scar: true },
      ]
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) { const t = s.map.tiles[y * s.map.w + x]; t.t = 'Terrain.Earth'; t.roof = false }
    })
    await recovery.keyboard.press('.')
    await recovery.waitForFunction(() => {
      const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!
      return p.body.wounds.length === 0 && p.body.scars?.length === 2
    })
    await recovery.keyboard.press('Shift+KeyB'); await recovery.waitForSelector('[data-testid=aftermath]')
    assert.match(await recovery.textContent('[data-testid=aftermath]') ?? '', /흉터/)
    assert.match(await recovery.textContent('[data-testid=aftermath]') ?? '', /화상 구축.*85%/)
    await recovery.screenshot({ path: `${out}/24-recovery.png` })
    await recovery.reload(); await recovery.click('[data-testid=continue]'); await recovery.waitForSelector('[data-testid=map] canvas')
    await recovery.keyboard.press('Shift+KeyB'); await recovery.waitForSelector('[data-testid=aftermath]')
    assert.match(await recovery.textContent('[data-testid=aftermath]') ?? '', /화상 구축.*85%/)
    await recovery.keyboard.press('Shift+KeyJ'); await recovery.waitForSelector('[data-testid=win-journal]')
    assert.match(await recovery.textContent('[data-testid=win-journal]') ?? '', /얼굴의 흉터/)
    await recovery.screenshot({ path: `${out}/25-scar-mood.png` })
    await recovery.close()
  }
  if (!['settings', 'gear', 'psyche', 'creation', 'recovery', 'medical', 'backgrounds', 'nutrition', 'food', 'water', 'prosthetics', 'injury', 'storage', 'world', 'climate', 'society', 'pharmacology', 'knowledge', 'bestiary', 'clinic', 'inn', 'hands', 'resident', 'provisions', 'well', 'purification', 'teaching', 'warmth', 'bedding', 'mortality', 'contracts', 'investigation', 'keys', 'relations', 'cold', 'companions', 'bonds', 'prisoners'].includes(process.env.SMOKE_SECTION ?? '')) {
    const surgery = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    surgery.on('pageerror', (e) => errors.push(e.message))
    surgery.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await surgery.goto('http://localhost:4317/?debug')
    await surgery.fill('[data-testid=seed]', 'surgery-smoke')
    await surgery.getByRole('button', { name: /파문된 순례자/ }).click()
    await surgery.click('[data-testid=start]'); await surgery.waitForSelector('[data-testid=map] canvas')
    await surgery.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    await surgery.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; s.map.lights = []; p.pos = { x: 20, y: 20 }; p.nextAct = s.time
      p.age = undefined; p.traits = []; p.background = undefined; p.abilities = []; p.equip = {}; p.effects = []; p.cond = {}; p.unconscious = false; p.skills.medicine = 30; p.needs.stress = 0; p.needs.bodyTemp = 37; p.needs.fatigue = 20
      p.hp = 90; p.body.blood = p.body.bloodMax; p.body.damagedTendons = ['RightForearm']
      p.body.wounds = [{ id: s.nextId++, def: 'Wound.Cut', part: 'LeftForearm', severity: 3, healed: 0, bleed: .5, arterial: true, artery: 5, internal: false, contam: 0, ageTurns: 10, source: '검증', washedAt: 14400 }]
      p.bag = [{ uid: s.nextId++, def: 'Item.Needle', count: 1, durability: 100, gx: 0, gy: 0 }, { uid: s.nextId++, def: 'Item.Thread', count: 5, gx: 1, gy: 0 }]
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) { const t = s.map.tiles[y * s.map.w + x]; t.t = 'Terrain.Earth'; t.roof = false }
    })
    await surgery.keyboard.press('Shift+KeyB'); await surgery.waitForSelector('[data-testid=win-body]')
    await surgery.getByRole('button', { name: '동맥 결찰', exact: true }).click()
    try {
      await surgery.waitForFunction(() => {
        const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
        return !s.simulationPending && !p.activity && p.body.wounds[0].ligated
      }, undefined, { timeout: 60000 })
    } catch (error) {
      console.error('수술 중단 상태:', await surgery.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(); const p = s.creatures.find((c) => c.faction === 'player')!; return { time: s.time, pending: s.simulationPending, player: p, log: s.log.slice(-10) } }))
      await surgery.screenshot({ path: `${out}/surgery-failure.png` }); throw error
    }
    await surgery.getByRole('button', { name: '힘줄 봉합', exact: true }).click()
    await surgery.waitForFunction(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      return !s.simulationPending && !p.activity && p.body.damagedTendons?.length === 0
    }, undefined, { timeout: 60000 })
    const result = await surgery.evaluate(() => {
      const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!
      return { thread: p.bag.find((i) => i.def === 'Item.Thread')?.count, needle: p.bag.find((i) => i.def === 'Item.Needle')?.durability, artery: p.body.wounds[0].artery, sewn: !!p.body.wounds[0].suture, mastery: p.skills.medicine }
    })
    assert.deepEqual(result, { thread: 1, needle: 98, artery: undefined, sewn: true, mastery: 32 })
    assert.match(await surgery.textContent('[data-testid=wounds]') ?? '', /봉합 Q/)
    await surgery.screenshot({ path: `${out}/26-surgery.png` })
    await surgery.reload(); await surgery.click('[data-testid=continue]'); await surgery.waitForSelector('[data-testid=map] canvas')
    await surgery.keyboard.press('Shift+KeyB'); await surgery.waitForSelector('[data-testid=wounds]')
    assert.match(await surgery.textContent('[data-testid=wounds]') ?? '', /결찰/)
    assert.equal(await surgery.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.body.damagedTendons?.length), 0)
    await surgery.close()
  }
  if (!['settings', 'gear', 'psyche', 'creation', 'recovery', 'surgery', 'backgrounds', 'nutrition', 'food', 'water', 'prosthetics', 'injury', 'storage', 'world', 'climate', 'society', 'pharmacology', 'knowledge', 'bestiary', 'clinic', 'inn', 'hands', 'resident', 'provisions', 'well', 'purification', 'teaching', 'warmth', 'bedding', 'mortality', 'contracts', 'investigation', 'keys', 'relations', 'cold', 'companions', 'bonds', 'prisoners'].includes(process.env.SMOKE_SECTION ?? '')) {
    const medical = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    medical.on('pageerror', (e) => errors.push(e.message)); medical.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await medical.goto('http://localhost:4317/?debug'); await medical.fill('[data-testid=seed]', 'medical-smoke'); await medical.click('[data-testid=start]'); await medical.waitForSelector('[data-testid=map] canvas')
    await medical.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; s.map = { ...s.map, lights: [{ pos: { x: 20, y: 20 }, radius: 6, kind: 'campfire' }] }; p.pos = { x: 20, y: 20 }; p.nextAct = s.time
      p.age = undefined; p.traits = []; p.background = undefined; p.abilities = []; p.equip = {}; p.effects = []; p.cond = {}; p.unconscious = false; p.skills.medicine = 80; p.stats = { str: 10, agi: 10, per: 20, vit: 10, wil: 10 }; p.hp = 90; p.needs.stress = 0; p.needs.bodyTemp = 37; p.needs.fatigue = 20
      p.body.blood = p.body.bloodMax; p.body.tourniquets = {}; p.body.wounds = [
        { id: s.nextId++, def: 'Wound.Stab', part: 'RightThigh', severity: 2, healed: 0, bleed: 2, arterial: false, internal: false, contam: 15, ageTurns: 10, source: '화살', foreign: { kind: 'arrow', ammo: 'Item.Arrow', contam: 10, pain: 2 } },
        { id: s.nextId++, def: 'Wound.Bruise', part: 'RightForearm', severity: 1, healed: 0, bleed: 0, arterial: false, internal: false, contam: 0, ageTurns: 10, source: '넘어짐', dislocated: true },
        { id: s.nextId++, def: 'Wound.Cut', part: 'LeftHand', severity: 1, healed: 0, bleed: 1, arterial: false, internal: false, contam: 0, ageTurns: 10, source: '검증' },
      ]
      p.bag = [{ uid: s.nextId++, def: 'Item.HuntingKnife', count: 1, durability: 100, gx: 0, gy: 0 }, { uid: s.nextId++, def: 'Item.Tourniquet', count: 1, gx: 1, gy: 0 }]
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) { const t = s.map.tiles[y * s.map.w + x]; t.t = 'Terrain.Earth'; t.roof = true; t.items = [] }
      s.rng.body = [0, 0, 0, 1]
    })
    await medical.keyboard.press('Shift+KeyB'); await medical.waitForSelector('[data-testid=win-body]')
    await medical.getByRole('button', { name: '이물질 제거', exact: true }).click()
    await medical.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && !p.body.wounds[0].foreign })
    await medical.getByRole('button', { name: '관절 맞추기', exact: true }).click()
    await medical.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && !p.body.wounds.some((wd) => wd.dislocated) })
    await medical.locator('[data-testid=wounds] li').filter({ hasText: '왼손 ·' }).getByRole('button', { name: '지혈대', exact: true }).click()
    await medical.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && p.body.tourniquets.LeftUpperArm !== undefined })
    await medical.locator('[data-testid=amputation-panel] summary').click(); await medical.getByLabel('절단 부위', { exact: true }).selectOption('LeftHand')
    assert.equal(await medical.getByRole('button', { name: '선택 부위 절단', exact: true }).isDisabled(), true)
    await medical.getByLabel('부위 상실 확인', { exact: true }).check(); await medical.getByRole('button', { name: '선택 부위 절단', exact: true }).click()
    await medical.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && p.body.missing.includes('LeftHand') }, undefined, { timeout: 60000 })
    assert.match(await medical.textContent('[data-testid=win-body]') ?? '', /잃은 부위: 왼손/)
    await medical.screenshot({ path: `${out}/27-medical.png` })
    await medical.reload(); await medical.click('[data-testid=continue]'); await medical.waitForSelector('[data-testid=map] canvas'); await medical.keyboard.press('Shift+KeyB'); await medical.waitForSelector('[data-testid=win-body]')
    const result = await medical.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return { missing: p.body.missing, bonus: p.body.amputationQuality?.LeftHand, needle: p.bag.find((i) => i.def === 'Item.HuntingKnife')?.durability, arrows: s.map.tiles[p.pos.y * s.map.w + p.pos.x].items.filter((i) => i.def === 'Item.Arrow').reduce((n, i) => n + i.count, 0) } })
    assert.deepEqual(result, { missing: ['LeftHand'], bonus: .1, needle: 99, arrows: 1 }); await medical.close()
  }
  if (!['settings', 'gear', 'psyche', 'creation', 'recovery', 'surgery', 'medical', 'nutrition', 'food', 'water', 'prosthetics', 'injury', 'storage', 'world', 'climate', 'society', 'pharmacology', 'knowledge', 'bestiary', 'clinic', 'inn', 'hands', 'resident', 'provisions', 'well', 'purification', 'teaching', 'warmth', 'bedding', 'mortality', 'contracts', 'investigation', 'keys', 'relations', 'cold', 'companions', 'bonds', 'prisoners'].includes(process.env.SMOKE_SECTION ?? '')) {
    const archivist = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    archivist.on('pageerror', (e) => errors.push(e.message)); archivist.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await archivist.goto('http://localhost:4317/?debug'); await archivist.fill('[data-testid=seed]', 'archivist-smoke')
    for (const name of ['약탈단 탈주 노예', '회색열 고아', '대장간 도제', '경비대 기록관', '떠돌이 이야기꾼', '강변 뱃사공']) assert.equal(await archivist.getByRole('button', { name: new RegExp(name) }).count(), 1)
    await archivist.getByRole('button', { name: /경비대 기록관/ }).click(); assert.match(await archivist.textContent('[data-testid=creation-preview]') ?? '', /경비대 기록관/)
    await archivist.click('[data-testid=start]'); await archivist.waitForSelector('[data-testid=map] canvas')
    await archivist.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; s.map = { ...s.map, lights: [] }; p.pos = { x: 20, y: 20 }; p.nextAct = s.time; p.age = undefined; p.traits = []; p.needs.bodyTemp = 37; p.needs.fatigue = 20
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) { const t = s.map.tiles[y * s.map.w + x]; t.t = 'Terrain.Earth'; t.roof = false }
    })
    await archivist.keyboard.press('i'); await archivist.waitForSelector('[data-testid=win-inv]')
    await archivist.locator('[data-testid=slot-main]').click({ button: 'right' }); await archivist.getByRole('button', { name: '장전 (기본4턴)', exact: true }).click()
    await archivist.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && p.equip.main?.loadedAmmo === 'Item.Bolt' })
    assert.equal(await archivist.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time), 16800 * 100 + 400)
    await archivist.locator('[data-testid=slot-main]').hover(); await archivist.waitForTimeout(200); assert.match(await archivist.textContent('body') ?? '', /한 발 장전됨/)
    await archivist.locator('[data-testid="item-Item.OldMap"]').dblclick(); await archivist.keyboard.press('Shift+KeyJ'); await archivist.waitForSelector('[data-testid=win-journal]'); await archivist.getByRole('button', { name: '소문', exact: true }).click()
    assert.equal(await archivist.locator('[data-testid=rumor]').count(), 1); await archivist.mouse.move(20, 20); await archivist.screenshot({ path: `${out}/28-archivist.png` })
    await archivist.reload(); await archivist.click('[data-testid=continue]'); await archivist.waitForSelector('[data-testid=map] canvas')
    const archived = await archivist.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return { loaded: p.equip.main?.loadedAmmo, bolts: p.bag.find((i) => i.def === 'Item.Bolt')?.count, map: s.knowledge.rumors?.[0].mapId } })
    assert.deepEqual(archived, { loaded: 'Item.Bolt', bolts: 5, map: 'crypt1' }); await archivist.close()
    const bard = await browser.newPage({ viewport: { width: 1440, height: 900 } }); bard.on('pageerror', (e) => errors.push(e.message)); bard.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await bard.goto('http://localhost:4317/?debug'); await bard.fill('[data-testid=seed]', 'bard-smoke'); await bard.getByRole('button', { name: /떠돌이 이야기꾼/ }).click(); await bard.click('[data-testid=start]'); await bard.waitForSelector('[data-testid=map] canvas')
    await bard.keyboard.press('Shift+KeyJ'); await bard.waitForSelector('[data-testid=win-journal]'); await bard.getByRole('button', { name: '소문', exact: true }).click(); assert.equal(await bard.locator('[data-testid=rumor]').count(), 3)
    await bard.screenshot({ path: `${out}/29-bard-rumors.png` }); await bard.close()
  }
  if (!['settings', 'gear', 'psyche', 'creation', 'recovery', 'surgery', 'medical', 'backgrounds', 'food', 'water', 'prosthetics', 'injury', 'storage', 'world', 'climate', 'society', 'pharmacology', 'knowledge', 'bestiary', 'clinic', 'inn', 'hands', 'resident', 'provisions', 'well', 'purification', 'teaching', 'warmth', 'bedding', 'mortality', 'contracts', 'investigation', 'keys', 'relations', 'cold', 'companions', 'bonds', 'prisoners'].includes(process.env.SMOKE_SECTION ?? '')) {
    const nutrition = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    nutrition.on('pageerror', (e) => errors.push(e.message)); nutrition.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await nutrition.goto('http://localhost:4317/?debug'); await nutrition.fill('[data-testid=seed]', 'nutrition-smoke'); await nutrition.getByRole('button', { name: /떠돌이 약초꾼/ }).click(); await nutrition.click('[data-testid=start]'); await nutrition.waitForSelector('[data-testid=map] canvas')
    await nutrition.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; s.map = { ...s.map, lights: [{ pos: { x: 20, y: 20 }, radius: 6, kind: 'campfire' }] }; p.pos = { x: 20, y: 20 }; p.nextAct = s.time
      p.age = undefined; p.traits = []; p.background = undefined; p.abilities = []; p.equip = {}; p.effects = []; p.cond = {}; p.unconscious = false; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.hp = 90
      Object.assign(p.needs, { kcal: -2100, waterDeficit: 3100, protein: 20, vitamin: 10, hygiene: 50, scurvy: 0, nutritionDay: 0, kcalRemainder: 0, waterRemainder: 0, stress: 0, bodyTemp: 37, fatigue: 20, energy: 0 })
      p.body.blood = p.body.bloodMax; p.body.wounds = []
      p.bag = [{ uid: s.nextId++, def: 'Item.Jerky', count: 1, gx: 0, gy: 0 }, { uid: s.nextId++, def: 'Item.WaterBottle', uses: 5, count: 1, gx: 1, gy: 0 }, { uid: s.nextId++, def: 'Item.DriedApple', count: 1, gx: 2, gy: 0 }]
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) { const t = s.map.tiles[y * s.map.w + x]; t.t = 'Terrain.Earth'; t.roof = true; t.items = [] }
    })
    await nutrition.keyboard.press('Shift+KeyJ'); await nutrition.waitForSelector('[data-testid=nutrition-detail]'); assert.match(await nutrition.textContent('[data-testid=nutrition-detail]') ?? '', /칼로리 균형 -2100.*굶주림1.*수분 결손 3100.*탈수2/)
    await nutrition.keyboard.press('Escape'); await nutrition.keyboard.press('i'); await nutrition.waitForSelector('[data-testid=win-inv]'); await nutrition.locator('[data-testid="item-Item.Jerky"]').dblclick()
    for (let i = 0; i < 5; i++) await nutrition.locator('[data-testid="item-Item.WaterBottle"]').dblclick()
    await nutrition.locator('[data-testid="item-Item.DriedApple"]').dblclick()
    const consumed = await nutrition.evaluate(() => { const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!; return { kcal: p.needs.kcal, deficit: p.needs.waterDeficit, protein: p.needs.protein, vitamin: p.needs.vitamin, uses: p.bag.find((i) => i.def === 'Item.WaterBottle')?.uses } })
    assert.ok(consumed.kcal > -1892 && consumed.kcal < -1889); assert.ok(consumed.deficit >= 2090 && consumed.deficit <= 2092); assert.equal(consumed.protein, 23.67); assert.equal(consumed.vitamin, 15); assert.equal(consumed.uses, 0)
    await nutrition.keyboard.press('Shift+KeyJ'); await nutrition.waitForSelector('[data-testid=nutrition-detail]'); assert.match(await nutrition.textContent('[data-testid=nutrition-detail]') ?? '', /배고픔.*탈수1/)
    await nutrition.screenshot({ path: `${out}/30-nutrition.png` })
    const saved = await nutrition.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.needs)
    await nutrition.reload(); await nutrition.click('[data-testid=continue]'); await nutrition.waitForSelector('[data-testid=map] canvas')
    assert.deepEqual(await nutrition.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.needs), saved); await nutrition.close()
    const legacy = await browser.newPage({ viewport: { width: 1440, height: 900 } }); legacy.on('pageerror', (e) => errors.push(e.message)); legacy.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await legacy.goto('http://localhost:4317/?debug'); await legacy.fill('[data-testid=seed]', 'legacy-nutrition'); await legacy.getByRole('button', { name: /탈영 경비병/ }).click(); await legacy.click('[data-testid=start]'); await legacy.waitForSelector('[data-testid=map] canvas')
    await legacy.evaluate(() => {
      const s = JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s']; s.version = 2
      for (const c of [...s.creatures, ...Object.values(s.offCreatures).flat()]) {
        const n = c.needs as unknown as Record<string, number>; n.kcal = 1800; n.water = 1800; n.vitamin = 37.25
        for (const key of ['waterDeficit', 'protein', 'hygiene', 'nutritionDay', 'kcalRemainder', 'waterRemainder', 'scurvy']) delete n[key]
      }
      localStorage.setItem('ashveil.imprint.v1', JSON.stringify(s))
    })
    await legacy.reload(); await legacy.click('[data-testid=continue]'); await legacy.waitForSelector('[data-testid=map] canvas')
    const migrated = await legacy.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return { version: s.version, kcal: p.needs.kcal, deficit: p.needs.waterDeficit, protein: p.needs.protein, vitamin: p.needs.vitamin } })
    assert.deepEqual(migrated, { version: 10, kcal: 0, deficit: 0, protein: 100, vitamin: 37.25 })
    await legacy.keyboard.press('Shift+KeyJ'); await legacy.waitForSelector('[data-testid=nutrition-detail]'); await legacy.screenshot({ path: `${out}/31-legacy-nutrition.png` }); await legacy.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'food') {
    const food = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    food.on('pageerror', (e) => errors.push(e.message)); food.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await food.goto('http://localhost:4317/?debug'); await food.fill('[data-testid=seed]', 'food-smoke'); await food.getByRole('button', { name: /떠돌이 약초꾼/ }).click(); await food.click('[data-testid=start]'); await food.waitForSelector('[data-testid=map] canvas')
    await food.evaluate(() => {
      const w = (window as unknown as Hook).__ashveil.world(), { s } = w, p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; s.map = { ...s.map, lights: [{ pos: { x: 20, y: 20 }, radius: 6, kind: 'campfire' }] }; p.pos = { x: 20, y: 20 }; p.nextAct = s.time
      p.age = undefined; p.traits = []; p.background = undefined; p.abilities = []; p.equip = {}; p.effects = []; p.cond = {}; p.unconscious = false; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.hp = 90; p.body.blood = p.body.bloodMax; p.body.wounds = []
      Object.assign(p.needs, { kcal: -1000, waterDeficit: 0, protein: 100, vitamin: 100, hygiene: 10, stress: 0, bodyTemp: 37, fatigue: 20, energy: 100 })
      w.db.item('Item.RawMeat').food!.poison = 100
      p.bag = [{ uid: s.nextId++, def: 'Item.RawMeat', count: 1, gx: 0, gy: 0, freshness: 20 }, { uid: s.nextId++, def: 'Item.WaterBottle', uses: 5, count: 1, gx: 1, gy: 0 }, { uid: s.nextId++, def: 'Item.WaterBottle', uses: 5, count: 1, gx: 2, gy: 0 }, { uid: s.nextId++, def: 'Item.Jerky', count: 1, gx: 3, gy: 0, freshness: 25 }]
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) { const t = s.map.tiles[y * s.map.w + x]; t.t = 'Terrain.Earth'; t.roof = true; t.items = [] }
    })
    await food.keyboard.press('i'); await food.waitForSelector('[data-testid=win-inv]'); await food.locator('[data-testid="item-Item.RawMeat"]').dblclick()
    await food.keyboard.press('Escape'); await food.keyboard.press('Shift+KeyJ'); await food.waitForSelector('[data-testid=poisoning-detail]')
    assert.match(await food.textContent('[data-testid=poisoning-detail]') ?? '', /식중독.*시간 남음.*예정 구토/)
    const ill = await food.evaluate(() => { const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!; return { kcal: p.needs.kcal, water: p.needs.waterDeficit, poisoning: p.needs.poisoning } })
    assert.ok(ill.kcal <= -1000 && ill.kcal > -1002); assert.ok(ill.water >= 800 && ill.water < 803); assert.ok(ill.poisoning)
    await food.screenshot({ path: `${out}/32-food-poisoning.png` })
    await food.getByRole('button', { name: '몸 씻기 (10분)', exact: true }).click()
    await food.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && p.needs.hygiene === 70 }, undefined, { timeout: 60000 })
    assert.deepEqual(await food.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.bag.filter((i) => i.def === 'Item.WaterBottle').map((i) => i.uses)), [0, 0])
    const time = await food.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await food.getByLabel('위생 관리', { exact: true }).uncheck()
    assert.equal(await food.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time), time)
    await food.screenshot({ path: `${out}/33-hygiene.png` })
    const saved = await food.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return { enabled: s.hygieneEnabled, needs: s.creatures.find((c) => c.faction === 'player')!.needs, jerky: s.creatures.find((c) => c.faction === 'player')!.bag.find((i) => i.def === 'Item.Jerky')!.freshness } })
    await food.reload(); await food.click('[data-testid=continue]'); await food.waitForSelector('[data-testid=map] canvas')
    assert.deepEqual(await food.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return { enabled: s.hygieneEnabled, needs: s.creatures.find((c) => c.faction === 'player')!.needs, jerky: s.creatures.find((c) => c.faction === 'player')!.bag.find((i) => i.def === 'Item.Jerky')!.freshness } }), saved)
    await food.keyboard.press('Shift+KeyJ'); await food.waitForSelector('[data-testid=hygiene-controls]'); assert.equal(await food.getByLabel('위생 관리', { exact: true }).isChecked(), false)
    await food.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'water') {
    const water = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    water.on('pageerror', (e) => errors.push(e.message)); water.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await water.goto('http://localhost:4317/?debug'); await water.fill('[data-testid=seed]', 'water-smoke'); await water.getByRole('button', { name: /떠돌이 약초꾼/ }).click(); await water.click('[data-testid=start]'); await water.waitForSelector('[data-testid=map] canvas')
    await water.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; s.map = { ...s.map, lights: [{ pos: { x: 20, y: 20 }, radius: 6, kind: 'campfire' }] }; p.pos = { x: 20, y: 20 }; p.nextAct = s.time
      p.age = undefined; p.traits = []; p.background = undefined; p.abilities = []; p.equip = {}; p.effects = []; p.cond = {}; p.unconscious = false; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.hp = 90; p.skills.survival = 5; p.body.blood = p.body.bloodMax; p.body.wounds = []
      Object.assign(p.needs, { kcal: -1000, waterDeficit: 2000, protein: 100, vitamin: 100, hygiene: 100, ash: 29.9, stress: 0, bodyTemp: 37, fatigue: 20, energy: 100 })
      p.bag = [{ uid: s.nextId++, def: 'Item.DirtyWaterBottle', count: 1, uses: 5, gx: 0, gy: 0, water: { pathogen: 35, ash: 15, source: '개울물' } }, { uid: s.nextId++, def: 'Item.Wood', count: 2, gx: 1, gy: 0 }, { uid: s.nextId++, def: 'Item.CharcoalFilter', uses: 10, count: 1, gx: 2, gy: 0 }]
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) { const t = s.map.tiles[y * s.map.w + x]; t.t = 'Terrain.Earth'; t.roof = true; t.items = [] }
    })
    await water.keyboard.press('i'); await water.waitForSelector('[data-testid=win-inv]')
    const before = await water.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await water.locator('[data-testid="item-Item.DirtyWaterBottle"]').click({ button: 'right' }); await water.getByRole('button', { name: '물 끓임', exact: true }).click()
    await water.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && p.bag.some((i) => i.def === 'Item.WaterBottle') }, undefined, { timeout: 60000 })
    assert.equal(await water.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) - before, 19000)
    const boiled = await water.evaluate(() => { const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!; return { quality: p.bag.find((i) => i.def === 'Item.WaterBottle')!.water, wood: p.bag.find((i) => i.def === 'Item.Wood')!.count } })
    assert.equal(boiled.quality!.pathogen, 0); assert.equal(boiled.quality!.ash, 16.5); assert.equal(boiled.wood, 1)
    await water.locator('[data-testid="item-Item.WaterBottle"]').hover(); await water.waitForSelector('[data-testid=tooltip]'); assert.match(await water.textContent('[data-testid=tooltip]') ?? '', /병원체 없음.*재 보통/)
    await water.screenshot({ path: `${out}/34-boiled-water.png` })
    await water.locator('[data-testid="item-Item.WaterBottle"]').dblclick()
    await water.locator('[data-testid="item-Item.WaterBottle"]').click({ button: 'right' }); await water.getByRole('button', { name: '물 숯 여과', exact: true }).click()
    await water.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && p.bag.find((i) => i.def === 'Item.CharcoalFilter')!.uses === 9 })
    const saved = await water.evaluate(() => { const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!; return { needs: p.needs, bottle: p.bag.find((i) => i.def === 'Item.WaterBottle'), filter: p.bag.find((i) => i.def === 'Item.CharcoalFilter')!.uses } })
    assert.equal(saved.needs.ash, 30.23); assert.equal(saved.bottle!.uses, 4); assert.equal(saved.bottle!.water!.ash, 6.6); assert.equal(saved.filter, 9)
    await water.keyboard.press('Escape'); await water.keyboard.press('Shift+KeyJ'); await water.waitForSelector('[data-testid=win-journal]'); assert.match(await water.textContent('[data-testid=win-journal]') ?? '', /재 축적.*30.2.*재 체기/s)
    await water.screenshot({ path: `${out}/35-water-journal.png` })
    await water.reload(); await water.click('[data-testid=continue]'); await water.waitForSelector('[data-testid=map] canvas')
    assert.deepEqual(await water.evaluate(() => { const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!; return { needs: p.needs, bottle: p.bag.find((i) => i.def === 'Item.WaterBottle'), filter: p.bag.find((i) => i.def === 'Item.CharcoalFilter')!.uses } }), saved)
    await water.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'prosthetics') {
    const prosthetic = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    prosthetic.on('pageerror', (e) => errors.push(e.message)); prosthetic.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await prosthetic.goto('http://localhost:4317/?debug'); await prosthetic.fill('[data-testid=seed]', 'prosthetic-smoke'); await prosthetic.getByRole('button', { name: /떠돌이 약초꾼/ }).click(); await prosthetic.click('[data-testid=start]'); await prosthetic.waitForSelector('[data-testid=map] canvas')
    const ids = await prosthetic.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; s.map = { ...s.map, lights: [{ pos: { x: 20, y: 20 }, radius: 6, kind: 'campfire' }] }; p.pos = { x: 20, y: 20 }; p.nextAct = s.time
      p.age = undefined; p.traits = []; p.background = undefined; p.abilities = []; p.equip = {}; p.effects = []; p.cond = {}; p.unconscious = false; p.stats = { str: 10, agi: 10, per: 16, vit: 10, wil: 10 }; p.hp = 90; p.skills.medicine = 50; p.literacy = 3; p.body.blood = p.body.bloodMax; p.body.wounds = []; p.body.missing = ['LeftShin', 'RightForearm']
      Object.assign(p.needs, { kcal: 0, waterDeficit: 0, protein: 100, vitamin: 100, hygiene: 100, stress: 0, bodyTemp: 37, fatigue: 20, energy: 100 })
      const peg = s.nextId++, pioneer = s.nextId++
      p.bag = [{ uid: peg, def: 'Item.PegLeg', count: 1, durability: 100, gx: 0, gy: 0 }, { uid: pioneer, def: 'Item.PioneerArm', count: 1, durability: 100, gx: 1, gy: 0 }, { uid: s.nextId++, def: 'Item.Needle', durability: 100, count: 1, gx: 2, gy: 0 }, { uid: s.nextId++, def: 'Item.PowerCell', count: 2, gx: 3, gy: 0 }]
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) { const t = s.map.tiles[y * s.map.w + x]; t.t = 'Terrain.Earth'; t.roof = true; t.items = [] }
      return { peg, pioneer }
    })
    await prosthetic.keyboard.press('i'); await prosthetic.waitForSelector('[data-testid=win-inv]'); await prosthetic.locator('[data-testid="item-Item.PioneerArm"]').hover(); await prosthetic.waitForSelector('[data-testid=tooltip]')
    assert.match(await prosthetic.textContent('[data-testid=tooltip]') ?? '', /따뜻한 금속 팔.*용도 미확인/s); assert.doesNotMatch(await prosthetic.textContent('[data-testid=tooltip]') ?? '', /효율85/)
    await prosthetic.locator('[data-testid="item-Item.PegLeg"]').dblclick(); await prosthetic.waitForSelector('[data-testid=prosthetic-panel]')
    await prosthetic.getByLabel('설치할 의수족', { exact: true }).selectOption(String(ids.pioneer)); assert.equal(await prosthetic.getByRole('button', { name: '선택한 의수족 설치', exact: true }).isDisabled(), true)
    await prosthetic.getByLabel('설치할 의수족', { exact: true }).selectOption(String(ids.peg)); await prosthetic.getByLabel('의수족 설치 부위', { exact: true }).selectOption('LeftShin')
    const before = await prosthetic.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await prosthetic.getByRole('button', { name: '선택한 의수족 설치', exact: true }).click()
    await prosthetic.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && !!p.body.prosthetics?.LeftShin })
    assert.equal(await prosthetic.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) - before, 3000)
    assert.match(await prosthetic.textContent('[data-testid=prosthetic-LeftShin]') ?? '', /막대 의족.*효율55%/)
    await prosthetic.screenshot({ path: `${out}/36-peg-leg.png` })
    await prosthetic.keyboard.press('Escape'); await prosthetic.locator('[data-testid="item-Item.PioneerArm"]').click({ button: 'right' }); await prosthetic.getByRole('button', { name: '살펴보기', exact: true }).click()
    await prosthetic.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && p.bag.some((i) => i.def === 'Item.PioneerArm' && i.appraisal === 2) })
    await prosthetic.locator('[data-testid="item-Item.PioneerArm"]').dblclick(); await prosthetic.waitForSelector('[data-testid=prosthetic-panel]'); await prosthetic.getByLabel('의수족 설치 부위', { exact: true }).selectOption('RightForearm'); await prosthetic.getByRole('button', { name: '선택한 의수족 설치', exact: true }).click()
    await prosthetic.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && !!p.body.prosthetics?.RightForearm }, undefined, { timeout: 60000 })
    assert.match(await prosthetic.textContent('[data-testid=prosthetic-RightForearm]') ?? '', /개척 의수.*효율85%.*전원30일/)
    await prosthetic.getByRole('button', { name: '전원셀 교체', exact: true }).click()
    await prosthetic.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && p.bag.find((i) => i.def === 'Item.PowerCell')!.count === 1 })
    await prosthetic.locator('[data-testid=prosthetic-LeftShin]').getByRole('button', { name: '분리', exact: true }).click()
    await prosthetic.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && !p.body.prosthetics?.LeftShin })
    await prosthetic.getByRole('button', { name: '선택한 의수족 설치', exact: true }).click()
    await prosthetic.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && !!p.body.prosthetics?.LeftShin })
    await prosthetic.screenshot({ path: `${out}/37-prosthetics.png` })
    const saved = await prosthetic.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.body.prosthetics)))
    assert.equal(saved.LeftShin.item.uid, ids.peg); assert.equal(saved.RightForearm.item.uid, ids.pioneer)
    await prosthetic.reload(); await prosthetic.click('[data-testid=continue]'); await prosthetic.waitForSelector('[data-testid=map] canvas')
    assert.deepEqual(await prosthetic.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.body.prosthetics))), saved)
    await prosthetic.keyboard.press('Shift+KeyB'); await prosthetic.waitForSelector('[data-testid=prosthetic-panel]'); assert.match(await prosthetic.textContent('[data-testid=prosthetic-panel]') ?? '', /개척 의수.*효율85%/s)
    await prosthetic.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'injury') {
    const injury = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    injury.on('pageerror', (e) => errors.push(e.message)); injury.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await injury.goto('http://localhost:4317/?debug'); await injury.fill('[data-testid=seed]', 'injury-smoke'); await injury.getByRole('button', { name: /떠돌이 약초꾼/ }).click(); await injury.click('[data-testid=start]'); await injury.waitForSelector('[data-testid=map] canvas')
    await injury.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.wind = { x: 0, y: 0 }; s.map = { ...s.map, lights: [{ pos: { x: 20, y: 20 }, radius: 6, kind: 'campfire' }] }; p.pos = { x: 20, y: 20 }; p.nextAct = s.time
      p.age = undefined; p.traits = ['Trait.Forgetful']; p.background = undefined; p.abilities = []; p.equip = {}; p.bag = []; p.effects = []; p.cond = {}; p.unconscious = false; p.stats = { str: 10, agi: 10, per: 18, vit: 10, wil: 10 }; p.hp = 90; p.skills = { medicine: 30, survival: 15 }; p.masteryFloor = { medicine: 3, survival: 2 }; p.literacy = 3; p.body.blood = p.body.bloodMax; p.body.missing = []
      p.body.concussionEvents = [s.nextId++, s.nextId++, s.nextId++]; p.body.concussionCap = .95
      p.body.wounds = [{ id: s.nextId++, def: 'Wound.Bruise', part: 'LeftHand', severity: Math.ceil(p.body.maxHp.LeftHand * .3), healed: 0, bleed: 0, arterial: false, internal: false, contam: 0, ageTurns: 0, source: '넘어져 관절을 다침', dislocated: true }]
      Object.assign(p.needs, { kcal: 0, waterDeficit: 0, protein: 100, vitamin: 100, hygiene: 100, stress: 0, bodyTemp: 37, fatigue: 20, energy: 100 })
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) { const t = s.map.tiles[y * s.map.w + x]; t.t = 'Terrain.Earth'; t.roof = true; t.items = [] }
    })
    await injury.keyboard.press('c'); await injury.waitForSelector('[data-testid=win-char]')
    assert.match(await injury.textContent('[data-testid=win-char]') ?? '', /의료 숙달.*3단계.*30\/75/s); assert.match(await injury.textContent('[data-testid=win-char]') ?? '', /생존 숙달.*2단계.*15\/45/s)
    await injury.getByText('건망', { exact: true }).hover(); await injury.waitForSelector('[data-testid=tooltip]'); assert.match(await injury.textContent('[data-testid=tooltip]') ?? '', /문턱.*1.5/)
    await injury.screenshot({ path: `${out}/38-head-trauma.png` })
    await injury.keyboard.press('Escape'); await injury.keyboard.press('Shift+KeyB'); await injury.waitForSelector('[data-testid=win-body]'); assert.match(await injury.textContent('[data-testid=aftermath]') ?? '', /뇌진탕 누적3회.*의식 상한95%/)
    await injury.getByRole('button', { name: '관절 맞추기', exact: true }).click()
    await injury.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && !p.body.wounds.some((wd) => wd.dislocated) }, undefined, { timeout: 60000 })
    await injury.screenshot({ path: `${out}/39-joint-reduced.png` })
    const saved = await injury.evaluate(() => { const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!; return { traits: p.traits, events: p.body.concussionEvents, cap: p.body.concussionCap, floor: p.masteryFloor, skills: p.skills, dislocated: p.body.wounds.some((wd) => wd.dislocated) } })
    await injury.reload(); await injury.click('[data-testid=continue]'); await injury.waitForSelector('[data-testid=map] canvas')
    assert.deepEqual(await injury.evaluate(() => { const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!; return { traits: p.traits, events: p.body.concussionEvents, cap: p.body.concussionCap, floor: p.masteryFloor, skills: p.skills, dislocated: p.body.wounds.some((wd) => wd.dislocated) } }), saved)
    await injury.keyboard.press('c'); await injury.waitForSelector('[data-testid=win-char]'); assert.match(await injury.textContent('[data-testid=win-char]') ?? '', /3단계.*31\/75/s)
    await injury.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'storage') {
    const storage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    storage.on('pageerror', (e) => errors.push(e.message))
    storage.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await storage.goto('http://localhost:4317/?debug')
    await storage.fill('[data-testid=seed]', 'storage-smoke')
    await storage.click('[data-testid=start]')
    await storage.waitForSelector('[data-testid=map] canvas')
    await storage.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    const before = await storage.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world()
      // 여러 지역을 탐험한 각인에 해당하는 실제 지도 데이터로 할당량을 넘긴다.
      for (let i = 0; i < 40; i++) { const m = structuredClone(s.map); m.id = `archive${i}`; s.maps[m.id] = m }
      const p = s.creatures.find((c) => c.id === s.playerId)!
      return { time: s.time, hp: p.hp, pos: p.pos, maps: Object.keys(s.maps).length }
    })
    await storage.getByRole('button', { name: '타이틀', exact: true }).click()
    await storage.waitForSelector('[data-testid=continue]')
    const bytes = await storage.evaluate(async () => {
      const req = indexedDB.open('ashveil', 1)
      const db = await new Promise<IDBDatabase>((resolve) => { req.onsuccess = () => resolve(req.result) })
      const read = db.transaction('imprint').objectStore('imprint').get('current')
      const record = await new Promise<{ raw: string }>((resolve) => { read.onsuccess = () => resolve(read.result) })
      db.close()
      return { size: record.raw.length, pointer: localStorage.getItem('ashveil.imprint.v1') }
    })
    assert.ok(bytes.size > 6 * 1024 * 1024, `큰 각인 크기: ${bytes.size}`)
    assert.match(bytes.pointer ?? '', /ashveilIndexedDB/)
    await storage.reload()
    await storage.click('[data-testid=continue]')
    await storage.waitForSelector('[data-testid=map] canvas')
    assert.deepEqual(await storage.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; return { time: s.time, hp: p.hp, pos: p.pos, maps: Object.keys(s.maps).length } }), before)
    await storage.screenshot({ path: `${out}/40-large-imprint.png` })
    // 실제 IndexedDB 쓰기 오류가 숨겨지지 않고, 재시도로 회복되는지 확인한다.
    await storage.evaluate(() => {
      const original = IDBDatabase.prototype.transaction
      ;(window as unknown as { restoreStorage: () => void }).restoreStorage = () => { IDBDatabase.prototype.transaction = original }
      IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
        if (args[1] === 'readwrite') throw new DOMException('test quota', 'QuotaExceededError')
        return original.apply(this, args)
      }
    })
    await storage.getByRole('button', { name: '타이틀', exact: true }).click()
    await storage.waitForSelector('[data-testid=save-error]')
    assert.match(await storage.textContent('[data-testid=save-error]') ?? '', /각인을 저장하지 못했다/)
    assert.equal(await storage.locator('[data-testid=map] canvas').count(), 1)
    await storage.screenshot({ path: `${out}/41-save-retry.png` })
    await storage.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage())
    await storage.getByRole('button', { name: '다시 저장', exact: true }).click()
    await storage.waitForSelector('[data-testid=save-error]', { state: 'detached' })
    await storage.waitForSelector('[data-testid=save-status]', { state: 'detached' })
    await storage.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(); s.creatures.find((c) => c.id === s.playerId)!.body.blood = 0 })
    await storage.keyboard.press('.')
    await storage.waitForFunction(() => !!(window as unknown as Hook).__ashveil.world().s.over)
    await storage.waitForSelector('[data-testid=save-status]', { state: 'detached' })
    await storage.reload()
    await storage.waitForSelector('[data-testid=start]:not([disabled])')
    assert.equal(await storage.locator('[data-testid=continue]').count(), 0, '사망한 큰 각인을 복원하면 안 된다')
    await storage.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'world') {
    const journey = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    journey.on('pageerror', (e) => errors.push(e.message)); journey.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await journey.goto('http://localhost:4317/?debug')
    await journey.fill('[data-testid=seed]', 'journey-browser')
    await journey.getByRole('button', { name: /탈영 경비병/ }).click()
    await journey.click('[data-testid=start]'); await journey.waitForSelector('[data-testid=map] canvas'); await journey.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    await journey.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!
      s.time = 7 * 1200 * 100; p.nextAct = s.time; p.pos = { ...s.map.exits[0] }; p.traits = []; p.traumas = []; p.thoughts = []; p.effects = []; p.age = undefined
      Object.assign(p.needs, { kcal: 3000, waterDeficit: 0, protein: 100, vitamin: 100, fatigue: 10, stress: 0, bodyTemp: 37, wetness: 0 })
      s.weather = 'clear'; s.weatherUntil = 1e12
      // 여행 조작 회귀는 온화한 맑음으로 고정한다. 한겨울 노출은 별도 시나리오로 검증한다.
      for (let y = 69; y <= 76; y++) { s.overworld!.cells[y * s.overworld!.w + 24].temperature = 15; (s.overworld!.weatherCells ??= {})[`24,${y}`] = { weather: 'clear', until: 1e12, wind: { x: 0, y: 0 } } }
    })
    await journey.keyboard.press('m'); await journey.waitForSelector('[data-testid=win-map]'); await journey.click('[data-testid=world-tab]')
    assert.equal(await journey.locator('[data-site^="Region."]').count() >= 10, true)
    await journey.click('[data-site="Region.ChimneySeven"]')
    assert.match(await journey.textContent('[data-testid=world-route]') ?? '', /14km.*7시간/s)
    await journey.screenshot({ path: `${out}/42-world-route.png` })
    await journey.click('[data-testid=depart-region]')
    await journey.waitForFunction(() => !(window as unknown as Hook).__ashveil.world().s.overworld!.currentRegion)
    await journey.waitForSelector('[data-testid=world-travel]')
    // 첫 분할 계산 직후 같은 브라우저 입력으로 중단한다. 다음 타이머를 기다리지 않는다.
    const stopped = await journey.evaluate(async () => {
      ;(document.querySelector('[data-testid=world-travel]') as HTMLButtonElement).click()
      await Promise.resolve()
      const m = (window as unknown as Hook).__ashveil.world().s.overworld!, remaining = m.travel!.segmentRemaining
      ;(document.querySelector('[data-testid=stop-world-travel]') as HTMLButtonElement).click()
      return { remaining, after: m.travel!.segmentRemaining }
    })
    assert.equal(stopped.after, stopped.remaining)
    await journey.waitForFunction(() => !(window as unknown as Hook).__ashveil.world().s.simulationPending)
    assert.ok(await journey.locator('[data-testid=resume-world-travel]').count())
    for (let i = 0; i < 10; i++) {
      if (!await journey.evaluate(() => !!(window as unknown as Hook).__ashveil.world().s.overworld!.travel)) break
      await journey.click('[data-testid=resume-world-travel]')
      await journey.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return !s.simulationPending && !s.creatures.find((c) => c.id === s.playerId)!.activity }, undefined, { timeout: 60000 })
      assert.equal(await journey.evaluate(() => !!(window as unknown as Hook).__ashveil.world().s.over), false)
    }
    await journey.waitForSelector('[data-testid=enter-region]'); assert.match(await journey.textContent('[data-testid=enter-region]') ?? '', /칠번 굴뚝/)
    await journey.click('[data-testid=enter-region]'); await journey.waitForFunction(() => (window as unknown as Hook).__ashveil.world().s.overworld!.currentRegion === 'Region.ChimneySeven')
    await journey.keyboard.press('Escape')
    for (let i = 0; i < 26; i++) await journey.keyboard.press('ArrowUp')
    await journey.waitForTimeout(350)
    assert.ok(await journey.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.id === (window as unknown as Hook).__ashveil.world().s.playerId)!.pos.y <= 23), '새 지역의 실제 건물까지 걸어가야 한다')
    await journey.screenshot({ path: `${out}/43-chimney-region.png` })
    const saved = await journey.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return { time: s.time, region: s.overworld!.currentRegion, position: s.overworld!.position, visited: s.overworld!.visited, stored: Object.keys(s.overworld!.scenes), playerId: s.playerId, npcs: s.overworld!.scenes['Region.GreyCloister'].creatures.map((c) => c.id) } })
    await journey.getByRole('button', { name: '타이틀', exact: true }).click(); await journey.waitForSelector('[data-testid=continue]'); await journey.reload(); await journey.click('[data-testid=continue]'); await journey.waitForSelector('[data-testid=map] canvas')
    assert.deepEqual(await journey.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return { time: s.time, region: s.overworld!.currentRegion, position: s.overworld!.position, visited: s.overworld!.visited, stored: Object.keys(s.overworld!.scenes), playerId: s.playerId, npcs: s.overworld!.scenes['Region.GreyCloister'].creatures.map((c) => c.id) } }), saved)
    await journey.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'climate') {
    const climate = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    climate.on('pageerror', (e) => errors.push(e.message)); climate.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await climate.goto('http://localhost:4317/?debug'); await climate.fill('[data-testid=seed]', 'climate-browser'); await climate.getByRole('button', { name: /탈영 경비병/ }).click(); await climate.click('[data-testid=start]'); await climate.waitForSelector('[data-testid=map] canvas'); await climate.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
    await climate.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!
      s.time = (28 * 28800 + 5 * 1200) * 100; p.nextAct = s.time; p.pos = { x: 20, y: 20 }; s.creatures = [p]; p.traits = []; p.traumas = []; p.abilities = []; p.thoughts = []; p.effects = []; p.age = undefined; p.equip = {}; p.hp = 90; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.unconscious = false; p.cond = {}; p.skills = {}; p.masteryFloor = undefined; p.body.wounds = []; p.body.blood = p.body.bloodMax
      Object.assign(p.needs, { kcal: 2000, waterDeficit: 800, nutritionDay: 28, protein: 100, vitamin: 100, hygiene: 100, fatigue: 10, stress: 0, bodyTemp: 37, wetness: 0, skinWetness: undefined, thermal: undefined, waterRemainder: 0, energy: 100, ash: 0 })
      p.bag = [{ uid: s.nextId++, def: 'Item.WaterBottle', count: 1, uses: 0, gx: 0, gy: 0 }, { uid: s.nextId++, def: 'Item.Wood', count: 1, gx: 2, gy: 0 }]
      s.weather = 'ashsnow'; s.weatherUntil = 1e12; s.wind = { x: 0, y: 0 }
      s.map = { ...s.map, lights: [{ pos: { ...p.pos }, radius: 6, kind: 'campfire' }] }
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(s.map.tiles[y * s.map.w + x], { t: 'Terrain.Earth', roof: true, items: [], icy: undefined, snow: undefined })
      Object.assign(s.map.tiles[20 * s.map.w + 21], { t: 'Terrain.ShallowWater', roof: false, icy: true, snow: 80 })
    })
    await climate.keyboard.press('.'); await climate.keyboard.press('Shift+KeyJ'); await climate.waitForSelector('[data-testid=climate-status]')
    assert.match(await climate.textContent('[data-testid=climate-status]') ?? '', /겨울18일.*장막50/s)
    await climate.screenshot({ path: `${out}/44-winter-ice.png` })
    const beforeIce = await climate.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await climate.click('[data-testid=break-ice]')
    await climate.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return !s.simulationPending && !!s.map.tiles[20 * s.map.w + 21].iceHoleUntil })
    assert.equal(await climate.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) - beforeIce, 300)
    await climate.click('[data-testid=eat-snow]')
    assert.equal(await climate.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.id === (window as unknown as Hook).__ashveil.world().s.playerId)!.needs.bodyTemp), 36.95)
    await climate.keyboard.press('Escape'); await climate.keyboard.press('i'); await climate.waitForSelector('[data-testid=win-inv]')
    await climate.locator('[data-testid="item-Item.WaterBottle"]').click({ button: 'right' }); await climate.getByRole('button', { name: '눈 모으기', exact: true }).click()
    await climate.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return !s.simulationPending && s.creatures.find((c) => c.id === s.playerId)!.bag.some((i) => i.waterFrozen) })
    await climate.locator('[data-testid="item-Item.DirtyWaterBottle"]').hover(); await climate.waitForSelector('[data-testid=tooltip]'); assert.match(await climate.textContent('[data-testid=tooltip]') ?? '', /눈\/얼음.*불에서 녹여야/s)
    await climate.screenshot({ path: `${out}/45-collected-snow.png` })
    await climate.locator('[data-testid="item-Item.DirtyWaterBottle"]').click({ button: 'right' }); await climate.getByRole('button', { name: '눈 녹여 끓이기', exact: true }).click()
    await climate.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return !s.simulationPending && !s.creatures.find((c) => c.id === s.playerId)!.activity && s.creatures.find((c) => c.id === s.playerId)!.bag.some((i) => i.def === 'Item.WaterBottle' && !i.waterFrozen) }, undefined, { timeout: 60000 })
    const melted = await climate.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; return { needs: p.needs, bottle: p.bag.find((i) => i.def === 'Item.WaterBottle'), wood: p.bag.filter((i) => i.def === 'Item.Wood').length, warnings: p.needWarnings, time: s.time } })
    assert.equal(melted.wood, 0); assert.equal(melted.bottle!.uses, 5); assert.equal(melted.bottle!.water!.pathogen, 0); assert.equal(melted.bottle!.water!.ash, 27.5)
    await climate.screenshot({ path: `${out}/46-melted-snow.png` })
    await climate.keyboard.press('Escape'); await climate.getByRole('button', { name: '타이틀', exact: true }).click(); await climate.waitForSelector('[data-testid=continue]'); await climate.reload(); await climate.click('[data-testid=continue]'); await climate.waitForSelector('[data-testid=map] canvas')
    assert.deepEqual(await climate.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; return { needs: p.needs, bottle: p.bag.find((i) => i.def === 'Item.WaterBottle'), wood: p.bag.filter((i) => i.def === 'Item.Wood').length, warnings: p.needWarnings, time: s.time } }), melted)
    await climate.keyboard.press('.')
    assert.equal(await climate.evaluate(() => (window as unknown as Hook).__ashveil.world().s.log.filter((e) => e.text === '목이 마르다.').length), 1)
    await climate.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'society') {
    const society = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    society.on('pageerror', (e) => errors.push(e.message)); society.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await society.goto('http://localhost:4317/?debug'); await society.fill('[data-testid=seed]', 'settlement-browser')
    await society.getByRole('button', { name: /몰락한 길드 상인/ }).click()
    assert.match(await society.textContent('[data-testid=creation-preview]') ?? '', /소지금 20표/)
    await society.click('[data-testid=start]'); await society.waitForSelector('[data-testid=map] canvas')
    // 거래 UI는 한 칸 거리의 온화한 정착지로 격리한다. 장거리 이동/한겨울은 앞의 별도 회귀에서 확인한다.
    await society.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!, m = s.overworld!
      m.sites.find((x) => x.id === 'Region.ForkwayLedgerhouse')!.cell = { x: 24, y: 75 }
      s.time = 14 * 1200 * 100; p.nextAct = s.time; p.pos = { ...s.map.exits[0] }; p.traits = []; p.traumas = []; p.thoughts = []; p.effects = []; p.age = undefined
      Object.assign(p.needs, { kcal: 3000, waterDeficit: 0, fatigue: 10, stress: 0, bodyTemp: 37, wetness: 0 })
      s.weather = 'clear'; s.weatherUntil = 1e12
      for (const y of [75, 76]) { m.cells[y * m.w + 24].temperature = 20; (m.weatherCells ??= {})[`24,${y}`] = { weather: 'clear', until: 1e12, wind: { x: 0, y: 0 } } }
    })
    await society.keyboard.press('m'); await society.click('[data-testid=world-tab]'); await society.click('[data-site="Region.ForkwayLedgerhouse"]')
    await society.click('[data-testid=depart-region]'); await society.waitForSelector('[data-testid=world-travel]'); await society.click('[data-testid=world-travel]')
    await society.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return !s.simulationPending && !s.overworld!.travel }, undefined, { timeout: 60000 })
    await society.click('[data-testid=enter-region]'); await society.keyboard.press('Escape')
    for (let i = 0; i < 29; i++) await society.keyboard.press('ArrowUp')
    for (let i = 0; i < 2; i++) await society.keyboard.press('ArrowLeft')
    await society.keyboard.press('n'); await society.waitForSelector('[data-testid=win-society]'); await society.click('[data-testid=talk-person]')
    assert.match(await society.textContent('[data-testid=win-society]') ?? '', /갈래길 장부관 상인/)
    const beforeTrade = await society.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; return { time: s.time, money: p.money, bandages: p.bag.filter((i) => i.def === 'Item.Bandage').reduce((n, i) => n + i.count, 0) } })
    await society.getByRole('button', { name: '붕대 구매 늘리기', exact: true }).click(); await society.getByRole('button', { name: '붕대 구매 늘리기', exact: true }).click()
    assert.match(await society.textContent('[data-testid=trade-total]') ?? '', /구매 10/)
    await society.click('[data-testid=trade-confirm]')
    const afterTrade = await society.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; return { time: s.time, money: p.money, bandages: p.bag.filter((i) => i.def === 'Item.Bandage').reduce((n, i) => n + i.count, 0) } })
    assert.deepEqual(afterTrade, { time: beforeTrade.time + 100, money: beforeTrade.money! - 10, bandages: beforeTrade.bandages + 2 })
    await society.evaluate(() => { (window as unknown as Hook).__ashveil.world().s.rng.story = [0, 0, 0, 1] })
    await society.click('[data-testid=bargain]')
    assert.equal(await society.evaluate(() => (window as unknown as Hook).__ashveil.world().s.overworld!.markets!['Region.ForkwayLedgerhouse'].haggle!.successes), 1)
    await society.screenshot({ path: `${out}/47-settlement-trade.png` })
    await society.getByRole('button', { name: '세력·소식', exact: true }).click(); assert.match(await society.textContent('[data-testid=win-society]') ?? '', /고물길드.*우호.*20/s)
    await society.screenshot({ path: `${out}/48-factions.png` })
    const saved = await society.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; return JSON.stringify({ money: p.money, market: s.overworld!.markets, society: s.overworld!.society, people: s.creatures.map((c) => c.id) }) })
    await society.getByRole('button', { name: '타이틀', exact: true }).click(); await society.reload(); await society.click('[data-testid=continue]'); await society.waitForSelector('[data-testid=map] canvas')
    assert.equal(await society.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; return JSON.stringify({ money: p.money, market: s.overworld!.markets, society: s.overworld!.society, people: s.creatures.map((c) => c.id) }) }), saved)
    // 같은 정착지의 월드 인구를 감염시켜 실제 자정/06시 틱·가격·출입 제한을 확인한다.
    await society.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), settlement = s.overworld!.simulation!.settlements['Region.ForkwayLedgerhouse']
      Object.assign(settlement.population, { total: 400, S: 380, I: 20, R: 0, deaths: 0, infectionCarry: 0, recoveryCarry: 0, deathCarry: 0 })
      s.time = (28800 - 1) * 100
      for (const c of s.creatures) { c.nextAct = s.time + 100; c.needs.nutritionDay = 1 }
      s.creatures.find((c) => c.id === s.playerId)!.nextAct = s.time
    })
    await society.keyboard.press('.')
    assert.deepEqual(await society.evaluate(() => { const q = (window as unknown as Hook).__ashveil.world().s.overworld!.simulation!.settlements['Region.ForkwayLedgerhouse']; return [q.population.S, q.population.I, q.population.R, q.population.deaths, q.quarantined] }), [375,23,2,0,true])
    await society.keyboard.press('n'); await society.waitForSelector('[data-testid=trade-stock]')
    assert.match(await society.locator('[data-testid=trade-stock] [data-def="Item.Bandage"]').textContent() ?? '', /8표\/개/)
    await society.screenshot({ path: `${out}/49-plague-price.png` })
    await society.keyboard.press('Escape')
    await society.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(); s.time = (28800 + 7200 - 1) * 100; for (const c of s.creatures) { c.nextAct = s.time + 100; c.needs.nutritionDay = 1 }; s.creatures.find((c) => c.id === s.playerId)!.nextAct = s.time })
    await society.keyboard.press('.')
    assert.equal(await society.evaluate(() => (window as unknown as Hook).__ashveil.world().s.map.quarantine), true)
    await society.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; p.pos = { ...s.map.exits[0] } })
    await society.keyboard.press('m'); await society.click('[data-testid=world-tab]'); await society.click('[data-testid=depart-region]')
    await society.waitForSelector('[data-testid=settlement-quarantine]'); assert.equal(await society.locator('[data-testid=enter-region]').isDisabled(), true)
    await society.screenshot({ path: `${out}/50-quarantine-gate.png` })
    await society.getByRole('button', { name: '타이틀', exact: true }).click(); await society.reload(); await society.click('[data-testid=continue]'); await society.waitForSelector('[data-testid=map] canvas')
    assert.equal(await society.evaluate(() => (window as unknown as Hook).__ashveil.world().s.overworld!.simulation!.settlements['Region.ForkwayLedgerhouse'].quarantined), true)
    await society.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), q = s.overworld!.simulation!.settlements['Region.ForkwayLedgerhouse']; q.population.R += q.population.I; q.population.I = 0
      s.time = (2 * 28800 - 1) * 100
      for (const c of s.creatures) { c.nextAct = s.time + 100; c.needs.nutritionDay = 2 }; s.creatures.find((c) => c.id === s.playerId)!.nextAct = s.time
    })
    await society.keyboard.press('.'); await society.keyboard.press('m'); await society.click('[data-testid=world-tab]')
    assert.equal(await society.locator('[data-testid=enter-region]').isDisabled(), false); await society.click('[data-testid=enter-region]')
    assert.equal(await society.evaluate(() => (window as unknown as Hook).__ashveil.world().s.map.quarantine), false)
    assert.equal(await society.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.filter((c) => c.id !== (window as unknown as Hook).__ashveil.world().s.playerId).length), 4)
    await society.screenshot({ path: `${out}/51-settlement-reopened.png` })
    await society.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'pharmacology') {
    const drugs = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    drugs.on('pageerror', (e) => errors.push(e.message)); drugs.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await drugs.goto('http://localhost:4317/?debug'); await drugs.fill('[data-testid=seed]', 'pharmacology-browser'); await drugs.getByRole('button', { name: /탈영 경비병/ }).click(); await drugs.click('[data-testid=start]'); await drugs.waitForSelector('[data-testid=map] canvas')
    await drugs.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.weatherUntil = 1e12; s.wind = { x: 0, y: 0 }; s.map = { ...s.map, lights: [{ pos: { x: 20, y: 20 }, radius: 6, kind: 'campfire' }] }; p.pos = { x: 20, y: 20 }; p.nextAct = s.time
      p.age = undefined; p.traits = []; p.traumas = []; p.background = undefined; p.abilities = []; p.equip = {}; p.effects = []; p.thoughts = []; p.cond = {}; p.unconscious = false; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.hp = 95; p.body.blood = p.body.bloodMax; p.body.missing = []
      p.body.wounds = [{ id: s.nextId++, def: 'Wound.Cut', part: 'LeftForearm', severity: 15, healed: 0, bleed: 0, arterial: false, internal: false, contam: 0, ageTurns: 0, source: '검증 상처' }]
      p.bag = [{ uid: s.nextId++, def: 'Item.PoppyTincture', count: 2, gx: 0, gy: 0 }, { uid: s.nextId++, def: 'Item.BitterMoss', count: 1, gx: 2, gy: 0 }, { uid: s.nextId++, def: 'Item.PillBlue', count: 1, gx: 4, gy: 0 }]
      s.knowledge.pillMap['Item.PillBlue'] = 'Pill.Sedative'; s.knowledge.pillKnown['Item.PillBlue'] = 'Pill.Sedative'
      Object.assign(p.needs, { kcal: 2000, waterDeficit: 0, protein: 100, vitamin: 100, hygiene: 100, stress: 0, bodyTemp: 37, fatigue: 20, energy: 100, wetness: 0, ash: 0 })
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(s.map.tiles[y * s.map.w + x], { t: 'Terrain.Earth', roof: true, items: [] })
    })
    await drugs.keyboard.press('.'); await drugs.keyboard.press('i'); await drugs.locator('[data-testid="item-Item.PoppyTincture"]').hover(); await drugs.waitForSelector('[data-testid=tooltip]')
    assert.match(await drugs.textContent('[data-testid=tooltip]') ?? '', /통증.*35.*내성.*의존/s)
    const beforeDose = await drugs.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await drugs.locator('[data-testid="item-Item.PoppyTincture"]').dblclick()
    await drugs.waitForFunction(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.drugs?.active.some((d) => d.def === 'Drug.PoppyTincture'))
    assert.equal(await drugs.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) - beforeDose, 100)
    await drugs.keyboard.press('Escape'); await drugs.keyboard.press('Shift+KeyB'); await drugs.waitForSelector('[data-testid=body-drugs]')
    assert.match(await drugs.textContent('[data-testid=body-drugs]') ?? '', /잠꽃 팅크.*통증−35.0.*진통 내성 20.0.*의식 감점 0.08.*호흡 감소 0.10/s)
    await drugs.screenshot({ path: `${out}/52-poppy-body.png` })
    const beforeTopical = await drugs.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await drugs.getByRole('button', { name: '쓴이끼 습포 바르기', exact: true }).click()
    await drugs.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && p.body.wounds.some((wd) => wd.topicalDrug?.def === 'Drug.BitterMoss') })
    assert.equal(await drugs.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) - beforeTopical, 300)
    assert.equal(await drugs.evaluate(() => (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.bag.some((it) => it.def === 'Item.BitterMoss')), false)
    await drugs.screenshot({ path: `${out}/53-topical-body.png` })
    const saved = await drugs.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return JSON.stringify({ time: s.time, drugs: p.drugs, wounds: p.body.wounds, bag: p.bag, needs: p.needs }) })
    await drugs.getByRole('button', { name: '타이틀', exact: true }).click(); await drugs.reload(); await drugs.click('[data-testid=continue]'); await drugs.waitForSelector('[data-testid=map] canvas')
    assert.equal(await drugs.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return JSON.stringify({ time: s.time, drugs: p.drugs, wounds: p.body.wounds, bag: p.bag, needs: p.needs }) }), saved)
    await drugs.keyboard.press('Shift+KeyJ'); await drugs.waitForSelector('[data-testid=drug-detail]'); assert.match(await drugs.textContent('[data-testid=drug-detail]') ?? '', /쓴이끼 습포/)
    await drugs.screenshot({ path: `${out}/54-drug-imprint.png` }); await drugs.keyboard.press('Escape'); await drugs.keyboard.press('i')
    const beforeSleep = await drugs.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await drugs.locator('[data-testid="item-Item.PillBlue"]').dblclick()
    await drugs.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.faction === 'player')!; return !s.simulationPending && !p.activity && !p.asleep && !p.bag.some((i) => i.def === 'Item.PillBlue') }, undefined, { timeout: 60000 })
    assert.equal(await drugs.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) - beforeSleep, 2400 * 100)
    await drugs.keyboard.press('Escape'); await drugs.keyboard.press('Shift+KeyJ'); await drugs.waitForSelector('[data-testid=drug-detail]'); await drugs.screenshot({ path: `${out}/55-drug-sleep.png` })
    await drugs.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'knowledge') {
    const know = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    know.on('pageerror', (e) => errors.push(e.message)); know.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await know.goto('http://localhost:4317/?debug'); await know.fill('[data-testid=seed]', 'knowledge-browser'); await know.getByRole('button', { name: /탈영 경비병/ }).click(); await know.click('[data-testid=start]'); await know.waitForSelector('[data-testid=map] canvas')
    await know.evaluate(() => {
      const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!
      s.creatures = [p]; s.time = 16800 * 100; s.weather = 'clear'; s.weatherUntil = 1e12; s.wind = { x: 0, y: 0 }; s.map = { ...s.map, lights: [{ pos: { x: 20, y: 20 }, radius: 6, kind: 'campfire' }] }; p.pos = { x: 20, y: 20 }; p.nextAct = s.time
      p.age = undefined; p.traits = []; p.traumas = []; p.background = undefined; p.abilities = []; p.equip = {}; p.effects = []; p.thoughts = []; p.cond = {}; p.unconscious = false; p.stats = { str: 10, agi: 10, per: 12, vit: 10, wil: 10 }; p.hp = 95; p.body.blood = p.body.bloodMax; p.body.wounds = []; p.body.missing = []; p.literacy = 1; p.skills = { medicine: 5, survival: 0 }; p.booksRead = []
      p.bag = [{ uid: s.nextId++, def: 'Item.PillWhite', count: 1, gx: 0, gy: 0 }, { uid: s.nextId++, def: 'Item.PillGreen', count: 2, gx: 2, gy: 0 }, { uid: s.nextId++, def: 'Item.PioneerPharmacopoeia', count: 1, gx: 4, gy: 0, readPages: 119 }, { uid: s.nextId++, def: 'Item.PioneerDictionary', count: 1, gx: 6, gy: 0, readPages: 799 }]
      s.knowledge.pillMap['Item.PillWhite'] = 'Pill.Sedative'; s.knowledge.pillMap['Item.PillGreen'] = 'Pill.Vitamin'; s.knowledge.pillKnown = {}; s.rng['world.knowledge'] = [Math.floor(.30 * 4294967296), 0, 0, 0]
      Object.assign(p.needs, { kcal: 2000, waterDeficit: 0, protein: 100, vitamin: 20, hygiene: 100, stress: 0, bodyTemp: 37, fatigue: 20, energy: 100, wetness: 0, ash: 0 })
      for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(s.map.tiles[y * s.map.w + x], { t: 'Terrain.Earth', roof: true, items: [] })
    })
    await know.keyboard.press('.'); await know.keyboard.press('i'); await know.locator('[data-testid="item-Item.PillWhite"]').click({ button: 'right' })
    const beforeExamine = await know.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await know.getByRole('button', { name: '감별 (6턴)', exact: true }).click()
    await know.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return !s.simulationPending && s.knowledge.pillBeliefs?.['Item.PillWhite']?.confidence === 'likely' })
    assert.equal(await know.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) - beforeExamine, 600)
    await know.keyboard.press('Escape'); await know.keyboard.press('Shift+KeyJ'); await know.getByRole('button', { name: '지식', exact: true }).click(); assert.match(await know.textContent('[data-testid="knowledge-Item.PillWhite"]') ?? '', /추정/)
    assert.equal(await know.evaluate(() => (window as unknown as Hook).__ashveil.world().s.knowledge.pillKnown['Item.PillWhite']), undefined)
    await know.screenshot({ path: `${out}/56-pill-belief.png` }); await know.keyboard.press('Escape'); await know.keyboard.press('i')
    await know.evaluate(() => { (window as unknown as Hook).__ashveil.world().s.rng['world.knowledge'] = [Math.floor(.90 * 4294967296),0,0,0] })
    await know.locator('[data-testid="item-Item.PillGreen"]').click({ button: 'right' }); const beforeTaste = await know.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await know.getByRole('button', { name: '맛보기 (¼·3턴)', exact: true }).click()
    await know.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return !s.simulationPending && s.creatures.find((c) => c.id === s.playerId)!.bag.some((i) => i.pillRemaining === .75) })
    assert.equal(await know.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) - beforeTaste, 300)
    const part = await know.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; return { uid: p.bag.find((i) => i.pillRemaining)!.uid, vitamin: p.needs.vitamin, total: p.bag.filter((i) => i.def === 'Item.PillGreen').reduce((sum,i) => sum+i.count*(i.pillRemaining??1),0) } })
    assert.ok(Math.abs(part.vitamin-30) < .01); assert.equal(part.total, 1.75); await know.waitForSelector('[data-testid=pill-fraction]'); assert.match(await know.textContent('[data-testid=pill-fraction]') ?? '', /75%/)
    await know.locator(`[data-uid="${part.uid}"]`).hover(); await know.waitForSelector('[data-testid=tooltip]'); assert.match(await know.textContent('[data-testid=tooltip]') ?? '', /3\/4정.*남은 정제 75%/s)
    await know.screenshot({ path: `${out}/57-quarter-pill.png` })
    const saved = await know.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; return JSON.stringify({ time: s.time, knowledge: s.knowledge, bag: p.bag, needs: p.needs }) })
    await know.getByRole('button', { name: '타이틀', exact: true }).click(); await know.reload(); await know.click('[data-testid=continue]'); await know.waitForSelector('[data-testid=map] canvas')
    assert.equal(await know.evaluate(() => { const { s } = (window as unknown as Hook).__ashveil.world(), p = s.creatures.find((c) => c.id === s.playerId)!; return JSON.stringify({ time: s.time, knowledge: s.knowledge, bag: p.bag, needs: p.needs }) }), saved)
    await know.keyboard.press('i'); await know.locator(`[data-uid="${part.uid}"]`).dblclick()
    assert.ok(await know.evaluate(() => { const p = (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!; return Math.abs(p.needs.vitamin-60) < .01 && p.bag.filter((i) => i.def === 'Item.PillGreen').length === 1 }))
    // 문해2에서 사전의 실제 마지막쪽20턴을 읽고 학자3으로 오른 뒤 약전14턴을 읽는다.
    await know.evaluate(() => { (window as unknown as Hook).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.literacy = 2 })
    const beforeDictionary = await know.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await know.locator('[data-testid="item-Item.PioneerDictionary"]').dblclick()
    await know.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return !s.simulationPending && s.creatures.find((c) => c.id === s.playerId)!.literacy === 3 })
    assert.equal(await know.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) - beforeDictionary, 2000)
    const beforeBook = await know.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
    await know.locator('[data-testid="item-Item.PioneerPharmacopoeia"]').dblclick()
    await know.waitForFunction(() => { const { s } = (window as unknown as Hook).__ashveil.world(); return !s.simulationPending && s.knowledge.pillKnown['Item.PillWhite'] === 'Pill.Sedative' })
    assert.equal(await know.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) - beforeBook, 1400)
    await know.keyboard.press('Escape'); await know.keyboard.press('Shift+KeyJ'); await know.getByRole('button', { name: '지식', exact: true }).click(); assert.match(await know.textContent('[data-testid="knowledge-Item.PillWhite"]') ?? '', /수면제 \(확정\)/); await know.screenshot({ path: `${out}/58-book-identification.png` })
    await know.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'bestiary') {
    const {db:content}=loadDb(),specimenWorld={db:content,s:newGame(content,{seed:'bestiary-specimen',background:'Bg.Deserter'})}
    const specimen=createCreature(specimenWorld,'Creature.AshHound',{x:21,y:20})
    const beast = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    beast.on('pageerror', (e) => errors.push(e.message)); beast.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await beast.goto('http://localhost:4317/?debug'); await beast.fill('[data-testid=seed]', 'bestiary-browser'); await beast.getByRole('button', { name: /탈영 경비병/ }).click(); await beast.click('[data-testid=start]'); await beast.waitForSelector('[data-testid=map] canvas')
    const targetId=await beast.evaluate((specimen)=>{
      const {s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!
      s.time=16800*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};s.map={...s.map,lights:[{pos:{x:20,y:20},radius:6,kind:'campfire'}]};p.pos={x:20,y:20};p.nextAct=s.time
      p.age=undefined;p.traits=[];p.traumas=[];p.background=undefined;p.abilities=[];p.effects=[];p.thoughts=[];p.cond={};p.unconscious=false;p.stats={str:10,agi:10,per:12,vit:10,wil:10};p.hp=95;p.body.wounds=[];p.body.missing=[];p.body.blood=p.body.bloodMax;p.literacy=2;p.skills={survival:30,medicine:0};p.booksRead=[]
      p.equip={main:{uid:s.nextId++,def:'Item.RustyKnife',count:1,durability:100}};p.bag=[{uid:s.nextId++,def:'Item.HighlandBestiary',count:1,gx:0,gy:0,readPages:119}]
      Object.assign(p.needs,{kcal:2000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:20,energy:100,wetness:0,ash:0})
      const c=specimen;c.id=s.nextId++;c.nextAct=1e12;c.faction='guild';c.pos={x:21,y:20};c.mapId=s.map.id;c.home=undefined;c.room=undefined;c.asleep=true;c.ai.mode='idle';c.body.wounds=[];c.body.blood=c.body.bloodMax
      s.creatures=[p,c];s.knowledge.bestiary={}
      for(let y=17;y<=23;y++)for(let x=17;x<=23;x++)Object.assign(s.map.tiles[y*s.map.w+x],{t:'Terrain.Earth',roof:true,items:[]})
      return c.id
    },specimen)
    await beast.keyboard.press('.');await beast.keyboard.press('Shift+KeyJ');await beast.getByRole('button',{name:'도감',exact:true}).click()
    assert.match(await beast.textContent('[data-testid="bestiary-Creature.AshHound"]')??'',/\?\?\?.*실루엣.*관찰1\/20/s)
    assert.equal(await beast.locator('[data-testid="bestiary-Creature.Amalgam"]').count(),0)
    await beast.screenshot({path:`${out}/59-bestiary-silhouette.png`});await beast.keyboard.press('Escape')
    for(let n=0;n<19;n++)await beast.keyboard.press('.')
    await beast.keyboard.press('Shift+KeyJ');await beast.getByRole('button',{name:'도감',exact:true}).click();assert.match(await beast.textContent('[data-testid="bestiary-Creature.AshHound"]')??'',/재늑대.*S1.*혈액 약 1800~3000ml/s)
    await beast.screenshot({path:`${out}/60-bestiary-observed.png`});await beast.keyboard.press('Escape')
    await beast.evaluate((id)=>{(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.id===id)!.faction='beasts'},targetId)
    for(let n=0;n<40;n++){if(!await beast.evaluate((id)=>(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.id===id)!.alive,targetId))break;await beast.keyboard.press('ArrowRight')}
    assert.equal(await beast.evaluate((id)=>(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.id===id)!.alive,targetId),false)
    await beast.keyboard.press('Shift+KeyJ');await beast.getByRole('button',{name:'도감',exact:true}).click();assert.match(await beast.textContent('[data-testid="bestiary-Creature.AshHound"]')??'',/S2.*다음: 사체 해부 성공/s);await beast.keyboard.press('Escape')
    await beast.keyboard.press('s');await beast.waitForSelector('[data-testid=dissection-panel]');assert.match(await beast.textContent('[data-testid=dissection-panel]')??'',/성공 42%/)
    await beast.evaluate(()=>{(window as unknown as Hook).__ashveil.world().s.rng['world.knowledge']=[0,0,0,1]})
    const before=await beast.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.time)
    await beast.click('[data-testid=dissect-corpse]')
    await beast.waitForFunction((id)=>{const {s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&s.creatures.find((c)=>c.id===id)!.dissected?.success},targetId)
    assert.equal(await beast.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.time)-before,20000)
    await beast.waitForSelector('[data-testid="loot-Item.RawHide"]');assert.equal(await beast.locator('[data-testid="loot-Item.RawHide"]').count(),3)
    await beast.locator('[data-testid="loot-Item.RawHide"]').first().dblclick();assert.equal(await beast.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.faction==='player')!.bag.filter((i)=>i.def==='Item.RawHide').length),1)
    await beast.screenshot({path:`${out}/61-dissected-materials.png`});await beast.keyboard.press('Escape');await beast.keyboard.press('Shift+KeyJ');await beast.getByRole('button',{name:'도감',exact:true}).click()
    const entry=beast.locator('[data-testid="bestiary-Creature.AshHound"]');assert.match(await entry.textContent()??'',/S3.*혈액 2400ml.*동맥/s);await entry.locator('summary').click();await beast.screenshot({path:`${out}/62-bestiary-anatomy.png`})
    const saved=await beast.evaluate(()=>{const {s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({knowledge:s.knowledge,time:s.time,corpse:s.creatures.find((c)=>c.def==='Creature.AshHound')!.dissected,bag:s.creatures.find((c)=>c.faction==='player')!.bag})})
    await beast.getByRole('button',{name:'타이틀',exact:true}).click();await beast.reload();await beast.click('[data-testid=continue]');await beast.waitForSelector('[data-testid=map] canvas')
    assert.equal(await beast.evaluate(()=>{const {s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({knowledge:s.knowledge,time:s.time,corpse:s.creatures.find((c)=>c.def==='Creature.AshHound')!.dissected,bag:s.creatures.find((c)=>c.faction==='player')!.bag})}),saved)
    await beast.keyboard.press('i');const bookTime=await beast.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.time);await beast.locator('[data-testid="item-Item.HighlandBestiary"]').dblclick()
    await beast.waitForFunction(()=>{const {s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!!s.knowledge.bestiary['Creature.AshHound'].literature?.length})
    assert.equal(await beast.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.time)-bookTime,2000)
    await beast.keyboard.press('Escape');await beast.keyboard.press('Shift+KeyJ');await beast.getByRole('button',{name:'도감',exact:true}).click();assert.match(await beast.textContent('[data-testid="bestiary-Creature.AshHound"]')??'',/S4.*먹이를 던지면/s);await beast.screenshot({path:`${out}/63-bestiary-literature.png`});await beast.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'prisoners') {
    const{db:content}=loadDb()
    const fixture=(execution=false)=>{
      const w={db:content,s:newGame(content,{seed:`prisoners-browser-${execution}`,background:'Bg.Hunter',overworld:true})},s=w.s,p=corePlayer(w),natives=s.creatures.filter((c)=>c.def==='Creature.Reaver'),target=natives[0]!,witness=natives[1]!
      s.creatures=execution?[p,target,witness]:[p,target];s.time=12*1200*100;s.storyteller.budget=-1e9;ensureSociety(w)!.reputation.reavers=-70
      for(const c of s.creatures){c.nextAct=s.time;c.hp=95;c.age=undefined;c.traits=[];c.background=undefined;c.skills={};c.traumas=[];c.effects=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.asleep=false;c.unconscious=false;c.activity=undefined;c.stats={str:10,agi:10,per:10,vit:10,wil:10};c.bag=[];c.equip={};Object.assign(c.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0,protein:100,vitamin:100,ash:0})}
      p.pos={x:20,y:20};target.pos={x:21,y:20};target.home={x:25,y:20};target.ai.mode='surrender';target.ai.mev=[];if(execution){witness.pos={x:22,y:20};witness.ai.mode='calm'}
      for(let y=17;y<=24;y++)for(let x=17;x<=27;x++)Object.assign(coreTile(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]});coreTile(w,p.pos).t='Terrain.Campfire';s.map.ambient=1;s.map.lights=[{pos:{...p.pos},radius:8,kind:'campfire'}];invalidateLights(w);addToBag(w,p,makeItem(w,'Item.Cloth',2));return{w,p,target,witness}
    }
    const{w,p,target}=fixture(),page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())});await page.goto('http://localhost:4317/?debug');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((state)=>((window as unknown as Hook).__ashveil.world().s = state),w.s)
    await page.keyboard.press('F2');await page.locator('[data-testid="Recipe.Rope"]').getByRole('button',{name:'제작',exact:true}).click();await page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity});const crafted=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return{time:s.time,cloth:p.bag.filter((i)=>i.def==='Item.Cloth').reduce((n,i)=>n+i.count,0),rope:p.bag.find((i)=>i.def==='Item.Rope'),id:s.nextId}});assert.equal(crafted.cloth,0);assert.ok(crafted.rope);assert.equal(crafted.time-w.s.time,2000);await page.screenshot({path:`${out}/146-prisoner-rope-crafted.png`});await page.keyboard.press('F2');await page.keyboard.press('n');const row=page.locator(`[data-prisoner-id="${target.id}"]`);await row.locator('[data-prisoner-action=bind]').click();const bound=await page.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,target:s.creatures.find((c)=>c.id===id),next:s.nextId}},target.id);assert.equal(bound.time-crafted.time,200);assert.equal(bound.target!.captivity!.rope.uid,crafted.rope!.uid);assert.equal(bound.target!.captivity!.captor,p.id);assert.equal(bound.next,crafted.id);await page.screenshot({path:`${out}/147-prisoner-bound.png`})
    await row.locator('[data-prisoner-action=interrogate]').click();const rumor=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,rumors:s.knowledge.rumors??[]}});assert.equal(rumor.time-bound.time,2000);assert.equal(rumor.rumors.length,1);assert.equal(rumor.rumors[0]!.hop,1);await page.keyboard.press('Shift+KeyJ');await page.getByRole('button',{name:'소문',exact:true}).click();await page.screenshot({path:`${out}/148-prisoner-rumor.png`});await page.keyboard.press('Escape')
    await row.locator('[data-prisoner-action=release]').click();const released=await page.evaluate(({id,uid,pos})=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,captive:s.creatures.find((c)=>c.id===id)!.captivity,rope:s.map.tiles[pos.y*s.map.w+pos.x].items.find((i)=>i.uid===uid),events:s.overworld!.society!.events.filter((e)=>e.target===id),next:s.nextId}},{id:target.id,uid:crafted.rope!.uid,pos:target.pos});assert.equal(released.time-rumor.time,100);assert.equal(released.captive,undefined);assert.equal(released.rope!.uid,crafted.rope!.uid);assert.equal(released.next,crafted.id);assert.deepEqual(released.events.map((e)=>e.delta),[3]);await page.screenshot({path:`${out}/149-prisoner-released-rope.png`})
    const saved=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,tiles:s.map.tiles,rng:s.rng,nextId:s.nextId,knowledge:s.knowledge,society:s.overworld!.society})});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');assert.deepEqual(JSON.parse(await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,tiles:s.map.tiles,rng:s.rng,nextId:s.nextId,knowledge:s.knowledge,society:s.overworld!.society})})),JSON.parse(saved));await page.keyboard.press('Shift+KeyJ');await page.getByRole('button',{name:'소문',exact:true}).click();await page.screenshot({path:`${out}/150-prisoner-imprint-restored.png`});await page.close()
    const exec=fixture(true),execution=await browser.newPage({viewport:{width:1440,height:1000}});execution.on('pageerror',(e)=>errors.push(e.message));execution.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())});await execution.goto('http://localhost:4317/?debug');await execution.click('[data-testid=start]');await execution.waitForSelector('[data-testid=map] canvas');await execution.evaluate((state)=>((window as unknown as Hook).__ashveil.world().s = state),exec.w.s);await execution.keyboard.press('n');await execution.locator(`[data-prisoner-id="${exec.target.id}"] [data-prisoner-action=execute]`).click();const killed=await execution.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,target:s.creatures.find((c)=>c.id===id),thoughts:s.creatures.find((c)=>c.id===s.playerId)!.thoughts,events:s.overworld!.society!.events.filter((e)=>e.target===id)}},exec.target.id);assert.equal(killed.time-exec.w.s.time,300);assert.equal(killed.target!.alive,false);assert.equal(killed.target!.deathCause,'처형');assert.ok(killed.thoughts.some((t)=>t.def==='Thought.Execution'));assert.deepEqual(killed.events.map((e)=>({delta:e.delta,witnesses:e.witnesses})),[{delta:-5,witnesses:[exec.witness.id]}]);await execution.screenshot({path:`${out}/151-prisoner-executed.png`});await execution.close()
    // 실제 포박한 같은 인물: 깊은 잠 깨우기 → 같은 병/음식으로 급식 → 전체 저장 복원.
    const careData=fixture(),cw=careData.w,cp=careData.p,ct=careData.target,water=makeItem(cw,'Item.WaterBottle'),meal=makeItem(cw,'Item.Jerky');addToBag(cw,cp,makeItem(cw,'Item.Rope'));addToBag(cw,cp,water);addToBag(cw,cp,meal);cp.hands={kind:'washed',at:cw.s.time/100};assert.equal(perform(cw,cp,{type:'prisoner',target:ct.id,operation:'bind'}).ok,true);while(cp.activity)activityStep(cw,cp);Object.assign(ct.needs,{fatigue:90,kcal:-500,waterDeficit:700});assert.equal(perform(cw,ct,{type:'sleep'}).ok,true);ct.deepSleep=true
    const care=await browser.newPage({viewport:{width:1440,height:1000}});care.on('pageerror',(e)=>errors.push(e.message));care.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())});await care.goto('http://localhost:4317/?debug');await care.click('[data-testid=start]');await care.waitForSelector('[data-testid=map] canvas');await care.evaluate((state)=>((window as unknown as Hook).__ashveil.world().s = state),cw.s);await care.keyboard.press('n');const cr=care.locator(`[data-prisoner-id="${ct.id}"]`);assert.equal(await cr.locator('[data-prisoner-care=feed]').first().isDisabled(),true);await care.screenshot({path:`${out}/152-prisoner-asleep-care.png`});await cr.locator('[data-prisoner-care=wake]').click();const wakeTime=await care.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.time});assert.equal(wakeTime-cw.s.time,100)
    await cr.locator(`[data-care-uid="${water.uid}"]`).click();await cr.locator(`[data-care-uid="${meal.uid}"]`).click();const fed=await care.evaluate(({id,uid})=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,c=s.creatures.find((c)=>c.id===id)!;return{time:s.time,target:c,water:p.bag.find((i)=>i.uid===uid),next:s.nextId}},{id:ct.id,uid:water.uid});assert.equal(fed.time-wakeTime,200);assert.equal(fed.water!.uses,4);assert.equal(fed.target.asleep,false);assert.ok(fed.target.drowsyUntil!>fed.time/100);assert.equal(fed.target.captivity!.rope.uid,ct.captivity!.rope.uid);assert.equal(fed.target.captivity!.care![cp.id]!.water,200+(coreItemDef(cw,meal).food!.water??0));assert.equal(fed.target.captivity!.care![cp.id]!.kcal,coreItemDef(cw,meal).food!.kcal);assert.equal(fed.next,cw.s.nextId);await care.screenshot({path:`${out}/153-prisoner-woken-fed.png`})
    const careSaved=await care.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));await care.getByRole('button',{name:'타이틀',exact:true}).click();await care.reload();await care.click('[data-testid=continue]');await care.waitForSelector('[data-testid=map] canvas');assert.deepEqual(JSON.parse(await care.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s))),JSON.parse(careSaved));await care.keyboard.press('n');await care.screenshot({path:`${out}/154-prisoner-care-restored.png`});await care.close()
    const ew=fixture(),ep=ew.p,et=ew.target;addToBag(ew.w,ep,makeItem(ew.w,'Item.Rope'));assert.equal(perform(ew.w,ep,{type:'prisoner',target:et.id,operation:'bind'}).ok,true);while(ep.activity)activityStep(ew.w,ep);et.captivity!.rope.durability=1;ep.needs.fatigue=40;ep.needs.kcal=3000;const tiedUid=et.captivity!.rope.uid,escapeStart=ew.w.s.time
    const escape=await browser.newPage({viewport:{width:1440,height:1000}});escape.on('pageerror',(e)=>errors.push(e.message));escape.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())});await escape.goto('http://localhost:4317/?debug');await escape.click('[data-testid=start]');await escape.waitForSelector('[data-testid=map] canvas');await escape.evaluate((state)=>((window as unknown as Hook).__ashveil.world().s = state),ew.w.s);await escape.keyboard.press('z');await escape.waitForFunction((id)=>!(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.id===id)!.captivity,et.id);await escape.keyboard.press('Escape');await escape.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity});const escaped=await escape.evaluate(({id,uid})=>{const{s}=(window as unknown as Hook).__ashveil.world(),c=s.creatures.find((c)=>c.id===id)!;return{time:s.time,captive:c.captivity,history:c.history,rope:s.map.tiles.flatMap((t)=>t.items).find((i)=>i.uid===uid)}},{id:et.id,uid:tiedUid});assert.equal(escaped.captive,undefined);assert.equal(escaped.rope!.uid,tiedUid);assert.equal(escaped.rope!.durability,0);assert.ok(escaped.history.some((h)=>h.text==='오래 애써 밧줄을 끊었다.'));assert.ok(escaped.time-escapeStart>=19900);await escape.keyboard.press('Shift+KeyJ');await escape.screenshot({path:`${out}/155-prisoner-escaped-while-sleeping.png`});await escape.close()


  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'companions' || process.env.SMOKE_SECTION === 'bonds') {
    const{db:content}=loadDb(),w={db:content,s:newGame(content,{seed:'companions-browser',background:'Bg.Hunter',overworld:true})},s=w.s,p=corePlayer(w),m=s.overworld!,site=m.sites.find((s)=>s.kind==='settlement'&&s.faction==='coalition')!
    s.time=12*1200*100;s.creatures=[p];s.sources=[];s.storyteller.budget=-1e9;m.position={...site.cell};delete m.currentRegion;assert.equal(enterRegion(w,()=>[],()=>{}),null)
    const c=s.creatures.find((c)=>content.creature(c.def).ai==='guard')!;p.pos={...s.map.exits[0]};c.pos={x:p.pos.x+1,y:p.pos.y};p.money=1000;c.money=17
    for(const a of s.creatures){a.nextAct=s.time;a.hp=95;a.age=undefined;a.background=undefined;a.traits=[];a.traumas=[];a.effects=[];a.body.wounds=[];a.body.missing=[];a.body.blood=a.body.bloodMax;a.asleep=false;a.unconscious=false;a.activity=undefined;a.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(a.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0,protein:100,vitamin:100,ash:0})}
    s.map.ambient=.8;for(let y=p.pos.y-3;y<s.map.h;y++)for(let x=p.pos.x-2;x<=p.pos.x+3;x++)Object.assign(coreTile(w,{x,y}),{t:'Terrain.Earth',roof:true});invalidateLights(w)
    const id=s.nextId,time=s.time,guard=c.id,water=p.bag.find((it)=>it.def==='Item.WaterBottle')!.uid
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())});await page.goto('http://localhost:4317/?debug');await page.fill('[data-testid=seed]','companions-browser');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((state)=>((window as unknown as Hook).__ashveil.world().s = state),s)
    await page.keyboard.press('n');await page.click(`[data-person-id="${guard}"]`);await page.locator('[data-testid=companion-panel] summary').first().click();await page.click('[data-testid=companion-hire]')
    const hired=await page.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,c=s.creatures.find((c)=>c.id===id)!;return{p:p.money,c:c.money,time:s.time,id:s.nextId,contract:c.companion,faction:c.faction}},guard)
    assert.equal(hired.time-time,100);assert.equal(hired.p,960);assert.equal(hired.c,57);assert.equal(hired.id,id);assert.equal(hired.contract!.status,'employed');assert.equal(hired.faction,'coalition');await page.screenshot({path:`${out}/139-companion-hired.png`})
    await page.locator('[data-testid=companion-panel] details summary').click();await page.click(`[data-give-uid="${water}"]`);assert.equal(await page.evaluate(({guard,water})=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.creatures.find((c)=>c.id===guard)!.bag.some((it)=>it.uid===water)}, {guard,water}),true)
    await page.click('[data-testid=companion-hold]');const anchor=await page.evaluate((id)=>(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.id===id)!.pos,guard);await page.keyboard.press('n');await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');assert.deepEqual(await page.evaluate((id)=>(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.id===id)!.pos,guard),anchor);await page.screenshot({path:`${out}/140-companion-holds-position.png`});await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('n');await page.click(`[data-person-id="${guard}"]`)
    if(!await page.locator('[data-testid=companion-follow]').isVisible())await page.locator('[data-testid=companion-panel] summary').first().click();await page.click('[data-testid=companion-pay]');await page.click('[data-testid=companion-follow]');assert.equal(await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.creatures.find((c)=>c.id===s.playerId)!.money}),954)
    await page.keyboard.press('n');await page.keyboard.press('m');await page.click('[data-testid=world-tab]');await page.click('[data-testid=depart-region]');await page.waitForFunction(()=>!(window as unknown as Hook).__ashveil.world().s.overworld!.currentRegion)
    const left=await page.evaluate(({guard,site})=>{const{s}=(window as unknown as Hook).__ashveil.world();return{present:s.creatures.filter((c)=>c.id===guard).length,stored:s.overworld!.scenes[site].creatures.some((c)=>c.id===guard),id:s.nextId,time:s.time}}, {guard,site:site.id});assert.equal(left.present,1);assert.equal(left.stored,false);assert.equal(left.id,id);await page.screenshot({path:`${out}/141-companion-road-transfer.png`})
    const saved=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({creatures:s.creatures,scenes:s.overworld!.scenes,time:s.time,rng:s.rng,nextId:s.nextId})});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');assert.deepEqual(JSON.parse(await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({creatures:s.creatures,scenes:s.overworld!.scenes,time:s.time,rng:s.rng,nextId:s.nextId})})),JSON.parse(saved));await page.keyboard.press('m');await page.click('[data-testid=world-tab]');await page.click('[data-testid=enter-region]');await page.waitForFunction((site)=>(window as unknown as Hook).__ashveil.world().s.overworld!.currentRegion===site,site.id);assert.equal(await page.evaluate((id)=>(window as unknown as Hook).__ashveil.world().s.creatures.filter((c)=>c.id===id).length,guard),1);await page.screenshot({path:`${out}/142-companion-town-return.png`})
    // 관계의 실제 한 시간 누적과 대화로 들은 태도를 구분한다. 성향만 지정한 준비 상태다.
    await page.keyboard.press('Escape');await page.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();s.creatures.find((c)=>c.id===s.playerId)!.traits=['Trait.ColdBlooded'];s.creatures.find((c)=>c.id===id)!.traits=['Trait.TenderHearted']},guard);await page.keyboard.press('n');await page.click(`[data-person-id="${guard}"]`);if(!await page.locator('[data-testid=companion-attitude]').isVisible())await page.locator('[data-testid=companion-panel] summary').first().click();assert.match(await page.textContent('[data-testid=companion-attitude]')??'',/서로 알아/)
    const bondBefore=await page.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,score:s.creatures.find((c)=>c.id===id)!.companion!.bond!.score}},guard);await page.keyboard.press('Shift+KeyR');await page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity},undefined,{timeout:60000});const after=await page.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,bond:s.creatures.find((c)=>c.id===id)!.companion!.bond}},guard);assert.equal(after.time-bondBefore.time,120000);assert.equal(after.bond!.score,bondBefore.score-2);assert.equal(after.bond!.events.at(-1)!.kind,'conflict');assert.match(await page.textContent('[data-testid=companion-attitude]')??'',/서로 알아/);await page.screenshot({path:`${out}/143-bond-private-change.png`})
    await page.click('[data-testid=talk-person]');assert.match(await page.textContent('[data-testid=companion-attitude]')??'',/불편/);await page.screenshot({path:`${out}/144-bond-spoken-attitude.png`});const bondSave=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({creatures:s.creatures,time:s.time,rng:s.rng,nextId:s.nextId})});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');assert.deepEqual(JSON.parse(await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({creatures:s.creatures,time:s.time,rng:s.rng,nextId:s.nextId})})),JSON.parse(bondSave));await page.keyboard.press('n');await page.click(`[data-person-id="${guard}"]`);await page.locator('[data-testid=companion-panel] summary').first().click();assert.match(await page.textContent('[data-testid=companion-attitude]')??'',/불편/);await page.screenshot({path:`${out}/145-bond-restored.png`});await page.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'cold') {
    const{db:content}=loadDb()
    const fixture=(npc:boolean)=>{
      for(let i=0;i<200;i++){
        const seed=`cold-browser-${npc?'npc':'player'}-${i}`,w={db:content,s:newGame(content,{seed,background:'Bg.Hunter',overworld:true})},s=w.s,p=corePlayer(w),actor=npc?s.creatures.find((c)=>c.id!==p.id&&!!c.equip.chest&&!!coreItemDef(w,c.equip.chest).apparel)!:p
        assert.ok(actor);if(!new Rng(seedState(seed,`body.coldConfusion.${actor.id}`)).chance(.05))continue
        s.creatures=npc?[p,actor]:[p];s.sources=[];s.storyteller.budget=-1e9;s.time=399*100;s.map.kind='dungeon';s.map.depth=1;s.map.ambient=.8;s.map.lights=[];p.pos={x:20,y:20};if(npc)actor.pos={x:23,y:20}
        for(let y=17;y<=24;y++)for(let x=17;x<=26;x++)Object.assign(coreTile(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
        const coats=(['back','chest']as const).map((slot)=>({slot,it:actor.equip[slot]})).filter((row)=>row.it&&coreItemDef(w,row.it).apparel).sort((a,b)=>coreItemDef(w,b.it!).apparel!.layer-coreItemDef(w,a.it!).apparel!.layer),coat=coats[0].it!,slot=coats[0].slot
        for(const c of s.creatures){c.nextAct=s.time;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.drugs=undefined;c.thoughts=[];c.asleep=false;c.unconscious=false;c.activity=undefined;c.cond={};c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};c.bag=[];c.equip={};c.ai.mode='calm';Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:c.id===actor.id?31.9:37,fatigue:10,wetness:0,sleepDebt:0,ash:0})}
        actor.equip[slot]=coat;coat.quality=4;coat.durability=47;coat.wetness={torso:80};addEffect(actor,'alcohol',12000);assert.ok(capacity(w,actor,'consciousness')<.6);return{w,p,actor,coat,slot,seed}
      }
      throw Error('반복 가능한5% 저체온 시드를 찾지 못했다')
    }
    const{w,actor,coat,slot,seed}=fixture(false),before={time:w.s.time,id:w.s.nextId,turns:channelTurns(w,actor,coreItemDef(w,coat).equipTurns?.[1]??1)!}
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())});await page.goto('http://localhost:4317/?debug');await page.fill('[data-testid=seed]',seed);await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((state)=>{const s=(window as unknown as Hook).__ashveil.world().s;Object.assign(s,state)},w.s)
    await page.keyboard.press('i');await page.screenshot({path:`${out}/135-cold-coat-before.png`});await page.keyboard.press('.');await page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})
    const dropped=await page.evaluate(({slot,uid})=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return{time:s.time,id:s.nextId,worn:p.equip[slot]?.uid,item:s.map.tiles[p.pos.y*s.map.w+p.pos.x].items.find((it)=>it.uid===uid),history:p.history,cold:p.coldConfusion}}, {slot,uid:coat.uid})
    assert.equal(dropped.time-before.time,100+before.turns*100);assert.equal(dropped.id,before.id);assert.equal(dropped.worn,undefined);assert.equal(dropped.item!.uid,coat.uid);assert.equal(dropped.item!.quality,4);assert.equal(dropped.item!.durability,47);assert.ok(dropped.item!.wetness!.torso!<=80&&dropped.item!.wetness!.torso!>79);assert.ok(dropped.history.some((h)=>h.kind==='cold'));assert.equal(dropped.cold!.checked,400);await page.screenshot({path:`${out}/136-cold-coat-removed.png`})
    const saved=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,tiles:s.map.tiles,rng:s.rng,nextId:s.nextId})});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');const restored=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,tiles:s.map.tiles,rng:s.rng,nextId:s.nextId})});writeFileSync(`${out}/cold-before.json`,saved);writeFileSync(`${out}/cold-restored.json`,restored);assert.deepEqual(JSON.parse(restored),JSON.parse(saved));await page.keyboard.press('i');await page.screenshot({path:`${out}/137-cold-imprint-restored.png`});await page.close()
    const native=fixture(true),np=native.p,na=native.actor,source={...na.pos},id=native.w.s.nextId
    const npc=await browser.newPage({viewport:{width:1440,height:1000}});npc.on('pageerror',(e)=>errors.push(e.message));npc.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())});await npc.goto('http://localhost:4317/?debug');await npc.fill('[data-testid=seed]',native.seed);await npc.click('[data-testid=start]');await npc.waitForSelector('[data-testid=map] canvas');await npc.evaluate((state)=>{const s=(window as unknown as Hook).__ashveil.world().s;Object.assign(s,state)},native.w.s);await npc.keyboard.press('r');await npc.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})
    const removed=await npc.evaluate(({id,uid,source})=>{const{s}=(window as unknown as Hook).__ashveil.world(),c=s.creatures.find((c)=>c.id===id)!;return{id:s.nextId,item:s.map.tiles[source.y*s.map.w+source.x].items.find((it)=>it.uid===uid),worn:Object.values(c.equip).some((it)=>it?.uid===uid),history:c.history,privateLog:s.log.some((l)=>l.text.includes('덥다는 착각')),p:s.creatures.find((c)=>c.id===s.playerId)!.id}}, {id:na.id,uid:native.coat.uid,source})
    assert.equal(removed.id,id);assert.equal(removed.worn,false);assert.equal(removed.item!.uid,native.coat.uid);assert.ok(removed.history.some((h)=>h.kind==='cold'));assert.equal(removed.privateLog,false);assert.equal(removed.p,np.id);await npc.screenshot({path:`${out}/138-npc-cold-coat.png`});await npc.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'relations') {
    const{db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'relations-browser',background:'Bg.Hunter',overworld:true})},s=fixture.s,p=corePlayer(fixture),m=s.overworld!,site=m.sites.find((s)=>s.kind==='settlement'&&s.faction==='coalition')!
    s.creatures=[p];s.sources=[];s.storyteller.budget=-1e9;m.currentRegion=site.id;m.position={...site.cell};s.time=12*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20}
    for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    initializeSettlement(fixture);const doctor=s.creatures.find((c)=>c.clinicSite)!,raider=createCreature(fixture,'Creature.Reaver',{x:35,y:19});s.creatures.push(raider);p.pos={x:29,y:18}
    for(const c of s.creatures){c.nextAct=c.id===p.id?s.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0})}
    s.map.lights=[{pos:{x:32,y:18},radius:12,kind:'campfire'}];invalidateLights(fixture);resolveAttack(fixture,raider,doctor);addWound(fixture,doctor,{def:'Wound.Cut',part:'Chest',severity:1,source:raider.name,sourceId:raider.id});killCreature(fixture,doctor,'관계·원한 검증');raider.ai.mode='calm'
    assert.equal(m.society!.relations!.coalition.reavers.value,-90);assert.equal(m.society!.relations!.coalition.reavers.baseline,-75);assert.equal(m.society!.relationKnowledge,undefined);assert.equal(m.society!.reputation.coalition,0)
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())});await page.goto('http://localhost:4317/?debug');await page.fill('[data-testid=seed]','relations-browser');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    await page.keyboard.press('n');await page.getByRole('button',{name:'세력·소식',exact:true}).click();assert.equal(await page.locator('[data-testid=faction-relation]').count(),0);await page.screenshot({path:`${out}/131-relations-before-news.png`});await page.getByRole('button',{name:'대화·거래',exact:true}).click();const before=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.time);await page.click('[data-testid=talk-person]');assert.equal(await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.time),before+100);await page.getByRole('button',{name:'세력·소식',exact:true}).click()
    const row=page.locator('[data-testid=faction-relation][data-from=coalition][data-to=reavers]');assert.match(await row.textContent()??'',/적대 -90.*1일차/);await page.screenshot({path:`${out}/132-relations-heard.png`})
    const saved=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,society:s.overworld!.society,nextId:s.nextId})});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');assert.equal(await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,society:s.overworld!.society,nextId:s.nextId})}),saved)
    // 날짜별 관계/UI 회귀를 위한 달력 준비다. 주민의 하루 생존을 재생했다고 집계하지 않는다.
    await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();s.time+=28800*100;for(const c of s.creatures)c.nextAct=c.id===s.playerId?s.time:1e12})
    await page.keyboard.press('n');await page.getByRole('button',{name:'세력·소식',exact:true}).click();assert.match(await row.textContent()??'',/적대 -90.*1일차/);await page.screenshot({path:`${out}/133-relations-stale-news.png`});await page.getByRole('button',{name:'대화·거래',exact:true}).click();await page.click('[data-testid=talk-person]');await page.getByRole('button',{name:'세력·소식',exact:true}).click();assert.match(await row.textContent()??'',/적대 -89.*2일차/);assert.equal(await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.overworld!.society!.reputation.coalition),0);await page.screenshot({path:`${out}/134-relations-refreshed.png`});await page.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'keys') {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())});await page.goto('http://localhost:4317/?debug');await page.fill('[data-testid=seed]','keybinding-browser');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas')
    await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;s.creatures=[p];s.sources=[];s.storyteller.budget=-1e9;p.pos={x:20,y:20};p.traits=[];p.age=undefined;p.background=undefined;p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.hp=95;Object.assign(p.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,bodyTemp:37,wetness:0});for(let y=17;y<=23;y++)for(let x=17;x<=25;x++)Object.assign(s.map.tiles[y*s.map.w+x],{t:'Terrain.Earth',items:[]})})
    const before=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,pos:s.creatures.find((c)=>c.id===s.playerId)!.pos}})
    await page.keyboard.press('F3');await page.locator('[data-testid=keybinding-settings] summary').click();await page.click('[data-testid=key-change-inventory]');await page.keyboard.press('h');assert.match(await page.textContent('[data-testid=key-error]')??'',/서쪽.*이미/);await page.keyboard.press('Escape');assert.equal(await page.locator('[data-testid=win-settings]').count(),1)
    await page.click('[data-testid=key-change-inventory]');await page.keyboard.press('F3');assert.match(await page.textContent('[data-testid=key-error]')??'',/설정/);assert.equal(await page.locator('[data-testid=win-settings]').count(),1);await page.keyboard.press('F11');assert.equal(await page.textContent('[data-testid=key-label-inventory]'),'F11')
    await page.click('[data-testid=key-change-east]');await page.keyboard.press('Backslash');assert.equal(await page.textContent('[data-testid=key-label-east]'),'Backslash');await page.screenshot({path:`${out}/127-keybindings-custom.png`})
    assert.equal(await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.time),before.time);await page.keyboard.press('Escape');await page.keyboard.press('ArrowRight');await page.keyboard.press('i');assert.equal(await page.locator('[data-testid=win-inv]').count(),0);assert.equal(await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.time),before.time)
    await page.keyboard.press('Backslash');const moved=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,pos:s.creatures.find((c)=>c.id===s.playerId)!.pos}});assert.equal(moved.time-before.time,100);assert.deepEqual(moved.pos,{x:before.pos.x+1,y:before.pos.y});await page.keyboard.press('F11');await page.waitForSelector('[data-testid=win-inv]');assert.match(await page.textContent('[data-testid=btn-inv]')??'',/F11/);await page.screenshot({path:`${out}/128-custom-key-inventory.png`});await page.keyboard.press('Escape')
    await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await page.keyboard.press('F11');await page.waitForSelector('[data-testid=win-inv]');await page.keyboard.press('Escape');await page.keyboard.press('F3');await page.locator('[data-testid=keybinding-settings] summary').click();assert.equal(await page.textContent('[data-testid=key-label-inventory]'),'F11');await page.click('[data-testid=key-preset-left]');assert.equal(await page.textContent('[data-testid=key-label-east]'),'D');await page.screenshot({path:`${out}/129-left-hand-preset.png`});await page.keyboard.press('Escape')
    const presetBefore=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,pos:s.creatures.find((c)=>c.id===s.playerId)!.pos}});await page.keyboard.press('d');await page.keyboard.press('s');await page.keyboard.press('Control+d');const presetAfter=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,pos:s.creatures.find((c)=>c.id===s.playerId)!.pos}});assert.equal(presetAfter.time-presetBefore.time,300);assert.deepEqual(presetAfter.pos,{x:presetBefore.pos.x+1,y:presetBefore.pos.y});await page.keyboard.press('F4');await page.waitForSelector('[data-testid=win-inv]');assert.match(await page.textContent('[data-testid=btn-inv]')??'',/F4/);await page.keyboard.press('Escape');await page.keyboard.press('F10');await page.waitForSelector('[data-testid=current-keybindings]');assert.match(await page.textContent('[data-testid=current-keybindings]')??'',/소지품 창: F4/);await page.screenshot({path:`${out}/130-left-hand-help.png`});await page.keyboard.press('Escape');await page.keyboard.press('F3');await page.locator('[data-testid=keybinding-settings] summary').click();await page.click('[data-testid=key-preset-default]');await page.keyboard.press('Escape');await page.keyboard.press('i');await page.waitForSelector('[data-testid=win-inv]');await page.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'investigation') {
    const{db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'investigation-browser',background:'Bg.GuildMerchant',overworld:true})},s=fixture.s,p=corePlayer(fixture),m=s.overworld!,origin=m.sites.find((s)=>s.id==='Region.GreyCloister')!,site=m.sites.filter((s)=>s.kind==='settlement').sort((a,b)=>Math.abs(a.cell.x-origin.cell.x)+Math.abs(a.cell.y-origin.cell.y)-Math.abs(b.cell.x-origin.cell.x)-Math.abs(b.cell.y-origin.cell.y))[0]
    assert.equal(readNote(fixture,p,p.bag.find((it)=>it.def==='Item.OldLedger')!),true)
    s.creatures=[p];s.sources=[];s.storyteller.budget=-1e9;m.currentRegion=site.id;m.position={...site.cell};s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20}
    for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    initializeSettlement(fixture);const trader=s.creatures.find((c)=>c.traderSite)!,market=marketFor(fixture,trader)!;p.pos={x:29,y:18}
    for(const c of s.creatures){c.nextAct=c.id===p.id?s.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0})}
    s.map.lights=[{pos:p.pos,radius:12,kind:'campfire'}];invalidateLights(fixture);const offer=investigationOffers(fixture,p,trader)[0];assert.ok(offer,'실제 시장 돈으로 게시할 조사 계약이 있어야 한다')
    const before={player:p.money!,market:market.money,id:s.nextId,time:s.time},townMap=structuredClone(s.map),townPeople=structuredClone(s.creatures.filter((c)=>c.id!==p.id))
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())});await page.goto('http://localhost:4317/?debug');await page.fill('[data-testid=seed]','investigation-browser');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    await page.keyboard.press('n');await page.locator('[data-testid=investigation-panel] summary').click();await page.waitForSelector('[data-testid=investigation-offer]');await page.screenshot({path:`${out}/123-investigation-offer.png`});await page.locator('[data-testid=investigation-accept]').first().click();await page.waitForSelector('[data-testid=investigation-record]');assert.equal(await page.locator('[data-testid=investigation-report]').isDisabled(),true)
    const field={db:content,s:await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)},fp=corePlayer(field),record=field.s.overworld!.contracts!.filter(isInvestigation)[0],rect=record.rect
    assert.equal(fp.money,before.player);assert.equal(record.escrow,offer.reward);assert.equal(field.s.overworld!.markets![site.id]!.money,before.market-offer.reward)
    field.s.map=generateDungeon(field,1).map;field.s.map.ambient=.7;field.s.maps={};field.s.offCreatures={};field.s.creatures=[fp];field.s.overworld!.currentRegion=record.region;field.s.overworld!.position={...origin.cell};fp.mapId=field.s.map.id;fp.nextAct=field.s.time
    const cells=[];for(let y=rect.y+1;y<rect.y+rect.h-1;y++)for(let x=rect.x+1;x<rect.x+rect.w-1;x++)if(content.terrain(coreTile(field,{x,y}).t).passable)cells.push({x,y});assert.ok(cells.length);fp.pos={...cells[0]};field.s.map.lights=[{pos:{...fp.pos},radius:50,kind:'campfire'}]
    await page.keyboard.press('Escape');await page.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},field.s);await page.keyboard.press('Shift+KeyJ');await page.getByRole('button',{name:'계약',exact:true}).click();await page.screenshot({path:`${out}/124-investigation-before-survey.png`});assert.equal(await page.locator('[data-testid=investigation-survey]').isDisabled(),true);await page.keyboard.press('Escape');await page.keyboard.press('.')
    // 조사는 실제 시야가 내부를 덮어야 한다. 제어된 현장 안에서 실제 방향키로 걷는다.
    for(const goal of cells){
      await page.keyboard.press('Shift+KeyJ');await page.getByRole('button',{name:'계약',exact:true}).click();if(await page.locator('[data-testid=investigation-survey]').isEnabled())break;await page.keyboard.press('Escape')
      const at=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.creatures.find((c)=>c.id===s.playerId)!.pos}),queue=[at],parents=new Map<string,{x:number;y:number}>(),key=(q:{x:number;y:number})=>`${q.x},${q.y}`;parents.set(key(at),at)
      for(let i=0;i<queue.length&&!parents.has(key(goal));i++)for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){const q={x:queue[i].x+dx,y:queue[i].y+dy};if(q.x<rect.x+1||q.y<rect.y+1||q.x>=rect.x+rect.w-1||q.y>=rect.y+rect.h-1||parents.has(key(q))||!content.terrain(coreTile(field,q).t).passable)continue;parents.set(key(q),queue[i]);queue.push(q)}
      if(!parents.has(key(goal)))continue
      const path=[];for(let q=goal;key(q)!==key(at);q=parents.get(key(q))!)path.push(q);let last=at
      for(const q of path.reverse()){await page.keyboard.press(q.x>last.x?'ArrowRight':q.x<last.x?'ArrowLeft':q.y>last.y?'ArrowDown':'ArrowUp');last=q}
    }
    if(!await page.locator('[data-testid=investigation-survey]').count()){await page.keyboard.press('Shift+KeyJ');await page.getByRole('button',{name:'계약',exact:true}).click()}
    assert.equal(await page.locator('[data-testid=investigation-survey]').isEnabled(),true);await page.click('[data-testid=investigation-survey]');await page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.overworld!.contracts!.some((r)=>r.kind==='investigate'&&!!r.proof)});await page.screenshot({path:`${out}/125-investigation-field-record.png`})
    const saved=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,world:s.overworld,tiles:s.map.tiles,nextId:s.nextId})});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');assert.equal(await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,world:s.overworld,tiles:s.map.tiles,nextId:s.nextId})}),saved)
    const returned=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s),rp=returned.creatures.find((c)=>c.id===returned.playerId)!;returned.map=townMap;returned.creatures=[rp,...townPeople];returned.maps={};returned.offCreatures={};returned.overworld!.currentRegion=site.id;returned.overworld!.position={...site.cell};rp.pos={x:29,y:18};rp.mapId=returned.map.id;rp.nextAct=returned.time
    await page.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},returned);await page.keyboard.press('n');await page.locator('[data-testid=investigation-panel] summary').click();assert.equal(await page.locator('[data-testid=investigation-report]').isEnabled(),true);await page.click('[data-testid=investigation-report]');await page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.overworld!.contracts![0].status==='completed'})
    const done=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,money:s.creatures.find((c)=>c.id===s.playerId)!.money,id:s.nextId,record:s.overworld!.contracts![0]}});assert.equal(done.time,returned.time+100);assert.equal(done.money,before.player+offer.reward);assert.equal(done.id,before.id);assert.equal(done.record.escrow,0);assert.match(await page.textContent('[data-testid=investigation-record]')??'',/보고 완료/);await page.screenshot({path:`${out}/126-investigation-reported.png`});await page.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'contracts') {
    const{db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'contracts-browser',background:'Bg.Hunter',overworld:true})},s=fixture.s,p=corePlayer(fixture),site=s.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!
    s.creatures=[p];s.sources=[];s.storyteller.budget=-1e9;s.overworld!.currentRegion=site.id;s.overworld!.position={...site.cell};s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20}
    for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    initializeSettlement(fixture);const trader=s.creatures.find((c)=>c.traderSite)!,market=marketFor(fixture,trader)!;p.pos={x:29,y:18};p.bag=[];p.money=1000
    for(const c of s.creatures){c.nextAct=c.id===p.id?s.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0})}
    s.map.lights=[{pos:p.pos,radius:12,kind:'campfire'}];invalidateLights(fixture);const wood=market.items.find((it)=>it.def==='Item.Wood')!;assert.equal(exchange(fixture,p,trader,[{uid:wood.uid,count:4}],[]),null)
    const before={player:p.money,market:market.money,stock:stockCount(market,'Item.Wood'),pieces:p.bag.filter((it)=>it.def==='Item.Wood').map((it)=>({uid:it.uid,count:it.count})),id:s.nextId,time:s.time}
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await page.goto('http://localhost:4317/?debug');await page.fill('[data-testid=seed]','contracts-browser');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    await page.keyboard.press('n');await page.locator('[data-testid=contract-panel] summary').click();await page.waitForSelector('[data-testid=contract-offer-fuel]');await page.screenshot({path:`${out}/119-supply-contract-offer.png`});await page.click('[data-testid=contract-accept-fuel]');await page.waitForSelector('[data-testid=contract-record-fuel]')
    const accepted=await page.evaluate((site)=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,p:s.creatures.find((c)=>c.id===s.playerId)!.money,market:s.overworld!.markets![site]!.money,record:s.overworld!.contracts![0]}},site.id)
    assert.equal(accepted.time,before.time+100);assert.equal(accepted.p,before.player);assert.equal(accepted.market,before.market-20);assert.equal(accepted.record.escrow,20);assert.equal(accepted.record.status,'active')
    await page.keyboard.press('Escape');await page.keyboard.press('Shift+KeyJ');await page.getByRole('button',{name:'계약',exact:true}).click();assert.match(await page.textContent('[data-testid=journal-contract]')??'',/땔감 보충.*진행 중.*예치 20/s);await page.screenshot({path:`${out}/120-supply-contract-journal.png`})
    const saved=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,world:s.overworld,nextId:s.nextId})})
    await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');assert.equal(await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,world:s.overworld,nextId:s.nextId})}),saved)
    await page.keyboard.press('n');await page.locator('[data-testid=contract-panel] summary').click();await page.screenshot({path:`${out}/121-supply-contract-restored.png`});await page.click('[data-testid=contract-deliver-fuel]')
    await page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.overworld!.contracts![0].status==='completed'})
    const done=await page.evaluate((site)=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,market=s.overworld!.markets![site]!;return{time:s.time,money:p.money,market:market.money,id:s.nextId,wood:p.bag.filter((it)=>it.def==='Item.Wood').length,stock:market.items.filter((it)=>it.def==='Item.Wood').reduce((n,it)=>n+it.count,0),uids:market.items.filter((it)=>it.def==='Item.Wood').map((it)=>it.uid),contract:s.overworld!.contracts![0],rep:s.overworld!.society!.reputation.coalition}},site.id)
    assert.equal(done.time,before.time+200);assert.equal(done.money,before.player+20);assert.equal(done.market,before.market-20);assert.equal(done.id,before.id);assert.equal(done.wood,0);assert.equal(done.stock,before.stock+4);for(const piece of before.pieces)assert.ok(done.uids.includes(piece.uid));assert.equal(done.contract.escrow,0);assert.equal(done.rep,1);assert.match(await page.textContent('[data-testid=contract-record-fuel]')??'',/납품 완료/);assert.equal(await page.locator('[data-testid=contract-offer-fuel]').count(),0);await page.screenshot({path:`${out}/122-supply-contract-completed.png`});await page.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'mortality') {
    const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'mortality-browser',background:'Bg.Hunter',overworld:true})},p=corePlayer(fixture),s=fixture.s,site=s.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!
    s.sources=[];s.storyteller.budget=-1e9;s.overworld!.currentRegion=site.id;s.overworld!.position={...site.cell};s.creatures=[p];s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20}
    for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    initializeSettlement(fixture);const doctor=s.creatures.find((c)=>c.clinicSite)!,stock=s.overworld!.simulation!.settlements[site.id]!,market=s.overworld!.markets![site.id]!
    p.pos={x:34,y:18};doctor.pos={x:35,y:18};p.money=100
    for(const c of s.creatures){c.nextAct=c.id===p.id||c.id===doctor.id?s.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0})}
    s.map.lights=[{pos:{x:32,y:18},radius:12,kind:'campfire'}];invalidateLights(fixture)
    const quote=clinicQuote(fixture,p,doctor,{kind:'diagnose'}),before={population:structuredClone(stock.population),market:market.money}
    assert.equal(quote.error,null);assert.equal(playerAct(fixture,{type:'clinic',target:doctor.id,request:{kind:'diagnose'},expectedFee:quote.fee}),null)
    assert.equal(p.money,100-quote.fee);assert.equal(doctor.money,quote.fee);assert.equal(p.medicalReports!.length,1)
    killCreature(fixture,doctor,'사망·회수 화면 검증');assert.equal(stock.population.total,before.population.total);assert.equal(stock.population.deaths,before.population.deaths+1);assert.equal(stock.population.S+stock.population.I+stock.population.R+stock.population.deaths,stock.population.total)
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await page.goto('http://localhost:4317/?debug');await page.fill('[data-testid=seed]','mortality-browser');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    await page.keyboard.press('s');await page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&s.loot?.kind==='corpse'});await page.waitForSelector('[data-testid=corpse-money]')
    assert.match(await page.textContent('[data-testid=corpse-money]')??'',new RegExp(`주머니 동전 ${quote.fee}`));assert.match(await page.textContent('[data-testid=wallet-balance]')??'',new RegExp(`지갑 ${100-quote.fee}`));await page.screenshot({path:`${out}/116-corpse-private-money.png`})
    const takeBefore=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,id:s.nextId,rng:JSON.stringify(s.rng)}})
    await page.click('[data-testid=take-corpse-money]');await page.waitForSelector('[data-testid=corpse-money]',{state:'detached'});assert.match(await page.textContent('[data-testid=wallet-balance]')??'',/지갑 100/)
    const taken=await page.evaluate((site)=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,doctor=s.creatures.find((c)=>c.clinicSite)!;return{time:s.time,id:s.nextId,rng:JSON.stringify(s.rng),money:p.money,corpseMoney:doctor.money,dead:!doctor.alive,market:s.overworld!.markets![site]!.money,population:s.overworld!.simulation!.settlements[site]!.population}},site.id)
    assert.deepEqual({time:taken.time,id:taken.id,rng:taken.rng},takeBefore);assert.equal(taken.money,100);assert.equal(taken.corpseMoney,0);assert.equal(taken.dead,true);assert.equal(taken.market,before.market);assert.deepEqual(taken.population,stock.population);await page.screenshot({path:`${out}/117-corpse-money-transferred.png`})
    const saved=await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,world:s.overworld,nextId:s.nextId})})
    await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');assert.equal(await page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,world:s.overworld,nextId:s.nextId})}),saved)
    await page.keyboard.press('i');assert.equal(await page.locator('[data-testid=corpse-money]').count(),0);assert.match(await page.textContent('[data-testid=wallet-balance]')??'',/지갑 100/);await page.screenshot({path:`${out}/118-resident-death-restored.png`});await page.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'bedding') {
    const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'bedding-browser',background:'Bg.Hunter',overworld:true})},p=corePlayer(fixture),s=fixture.s
    s.creatures=[p];s.sources=[];s.storyteller.budget=-1e9;s.time=(14*1200+100)*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20};p.nextAct=s.time;p.hp=95;p.age=undefined;p.traits=[];p.traumas=[];p.background=undefined;p.effects=[];p.thoughts=[];p.body.wounds=[];p.body.missing=[];p.body.blood=p.body.bloodMax;p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.bag=[];p.facing=2
    Object.assign(p.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0})
    for(let y=17;y<=23;y++)for(let x=17;x<=25;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    s.map.lights=[{pos:{x:20,y:20},radius:8,kind:'campfire'}]
    const item=makeItem(fixture,'Item.Bed');item.quality=4;item.durability=47;item.wetness={torso:20};addToBag(fixture,p,item);assert.equal(perform(fixture,p,{type:'place',uid:item.uid,dir:2}).ok,true)
    const first={time:s.time,id:s.nextId,uid:item.uid}
    const furniture=await browser.newPage({viewport:{width:1440,height:900}});furniture.on('pageerror',(e)=>errors.push(e.message));furniture.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await furniture.goto('http://localhost:4317/?debug');await furniture.fill('[data-testid=seed]','bedding-browser');await furniture.click('[data-testid=start]');await furniture.waitForSelector('[data-testid=map] canvas');await furniture.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    await furniture.keyboard.press('F2');await furniture.waitForSelector('[data-testid=pack-furniture-21-20]');await furniture.screenshot({path:`${out}/111-fixed-bed-pack.png`});await furniture.click('[data-testid=pack-furniture-21-20]');await furniture.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})
    const packed=await furniture.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return{time:s.time,id:s.nextId,item:p.bag.find((it)=>it.uid===id),floor:s.map.tiles[20*s.map.w+21].t}},item.uid)
    assert.equal(packed.time-first.time,20000);assert.equal(packed.id,first.id);assert.equal(packed.floor,'Terrain.Earth');assert.equal(packed.item!.quality,4);assert.equal(packed.item!.durability,47);assert.equal(packed.item!.wetness!.torso,10)
    await furniture.keyboard.press('Escape');await furniture.keyboard.press('i');await furniture.locator('[data-testid="item-Item.Bed"]').click({button:'right'});await furniture.getByText('바라보는 쪽에 설치',{exact:true}).click();await furniture.keyboard.press('Escape');const placed=await furniture.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.map.tiles[20*s.map.w+21].placed!});assert.equal(placed.item.uid,item.uid);assert.equal(placed.item.quality,4);assert.equal(placed.item.durability,47);assert.equal(placed.owner,p.id);await furniture.screenshot({path:`${out}/112-fixed-bed-reinstalled.png`});await furniture.close()
    const native={db:content,s:newGame(content,{seed:'bedding-native',background:'Bg.Hunter',overworld:true})},ns=native.s,np=corePlayer(native),site=ns.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!
    ns.creatures=[np];ns.sources=[];ns.storyteller.budget=-1e9;ns.time=14*1200*100;ns.weather='clear';ns.weatherUntil=1e12;ns.wind={x:0,y:0};ns.overworld!.currentRegion=site.id;ns.overworld!.position={...site.cell};np.pos={x:20,y:20}
    for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(native,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    initializeSettlement(native);const guard=ns.creatures.find((c)=>c.def==='Creature.SettlementGuard')!,bed=ns.map.residentBeds!.find((b)=>b.owner===guard.id)!,source={...bed.pos},fire=ns.map.residentHearth!;np.pos={x:27,y:19}
    for(const c of ns.creatures){c.nextAct=c.id===np.id||c.id===guard.id?ns.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:c.id===guard.id?35.8:37,fatigue:c.id===guard.id?70:10,wetness:0,ash:0})}
    ns.map.lights=[{pos:fire.pos,radius:12,kind:'campfire'}];const nativeId=ns.nextId
    const moving=await browser.newPage({viewport:{width:1440,height:900}});moving.on('pageerror',(e)=>errors.push(e.message));moving.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())});await moving.goto('http://localhost:4317/?debug');await moving.fill('[data-testid=seed]','bedding-native');await moving.click('[data-testid=start]');await moving.waitForSelector('[data-testid=map] canvas');await moving.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},ns)
    await moving.keyboard.press('.');await moving.keyboard.press('F2');assert.equal(await moving.locator(`[data-testid=pack-furniture-${source.x}-${source.y}]`).isDisabled(),true);await moving.screenshot({path:`${out}/113-resident-bed-packing.png`});await moving.keyboard.press('Escape');for(let n=0;n<6;n++)await moving.keyboard.press('ArrowRight')
    assert.equal(await moving.evaluate((id)=>(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.id===id)!.activity?.kind,guard.id),'packFurniture')
    const save=await moving.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,beds:s.map.residentBeds,tiles:s.map.tiles})});await moving.getByRole('button',{name:'타이틀',exact:true}).click();await moving.reload();await moving.click('[data-testid=continue]');await moving.waitForSelector('[data-testid=map] canvas');assert.equal(await moving.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,beds:s.map.residentBeds,tiles:s.map.tiles})}),save);await moving.screenshot({path:`${out}/114-resident-bed-pack-restored.png`})
    for(let n=0;n<12;n++){await moving.keyboard.press('r');await moving.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})}
    const moved=await moving.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),bed=s.map.residentBeds!.find((b)=>b.owner===id)!;return{bed,placed:s.map.tiles[bed.pos.y*s.map.w+bed.pos.x].placed,old:s.map.tiles[19*s.map.w+26].t,id:s.nextId}},guard.id)
    assert.notDeepEqual(moved.bed.pos,source);assert.ok(Math.max(Math.abs(moved.bed.pos.x-fire.pos.x),Math.abs(moved.bed.pos.y-fire.pos.y))<=2);assert.equal(moved.bed.packedUid,undefined);assert.equal(moved.placed!.owner,guard.id);assert.equal(moved.placed!.item.uid,nativeId);assert.equal(moved.id,nativeId+1);assert.equal(moved.old,'Terrain.Earth');await moving.keyboard.press('ArrowLeft');await moving.keyboard.press('F2');await moving.screenshot({path:`${out}/115-resident-bed-moved.png`});await moving.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'warmth') {
    const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'warmth-browser',background:'Bg.Hunter',overworld:true})},p=corePlayer(fixture),s=fixture.s,site=s.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!
    s.sources=[];s.storyteller.budget=-1e9;s.overworld!.currentRegion=site.id;s.overworld!.position={...site.cell};s.creatures=[p];s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20}
    for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    initializeSettlement(fixture);const doctor=s.creatures.find((c)=>c.clinicSite)!;p.pos={x:33,y:19}
    for(const c of s.creatures){c.nextAct=c.id===p.id||c.id===doctor.id?s.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:c.id===p.id||c.id===doctor.id?35.8:37,fatigue:10,wetness:0,ash:0})}
    s.map.lights=[{pos:{x:32,y:18},radius:12,kind:'campfire'}]
    const before={time:s.time,kcal:p.needs.kcal,ids:doctor.bag.map((it)=>it.uid)}
    const warm=await browser.newPage({viewport:{width:1440,height:900}});warm.on('pageerror',(e)=>errors.push(e.message));warm.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await warm.goto('http://localhost:4317/?debug');await warm.fill('[data-testid=seed]','warmth-browser');await warm.click('[data-testid=start]');await warm.waitForSelector('[data-testid=map] canvas');await warm.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    await warm.keyboard.press('Shift+KeyJ');await warm.waitForSelector('[data-testid=warm-by-fire]');assert.equal(await warm.locator('[data-testid=warm-by-fire]').isEnabled(),true);await warm.screenshot({path:`${out}/107-warm-by-fire.png`})
    const exercise=async()=>{await warm.click('[data-testid=warm-by-fire]');await warm.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity},undefined,{timeout:60000})}
    await exercise();const first=await warm.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return{time:s.time,temp:p.needs.bodyTemp,kcal:p.needs.kcal,fatigue:p.needs.fatigue}});assert.equal(first.time-before.time,20000);assert.ok(first.temp>35.8&&first.temp<36.8);assert.ok(first.kcal<before.kcal);assert.ok(first.fatigue>10)
    await warm.keyboard.press('Escape');await warm.keyboard.press('n');await warm.waitForSelector('[data-testid=clinic-warming]');await warm.screenshot({path:`${out}/108-resident-warming.png`})
    const saved=await warm.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures})})
    await warm.getByRole('button',{name:'타이틀',exact:true}).click();await warm.reload();await warm.click('[data-testid=continue]');await warm.waitForSelector('[data-testid=map] canvas');assert.equal(await warm.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures})}),saved);await warm.keyboard.press('n');await warm.screenshot({path:`${out}/109-resident-warming-restored.png`});await warm.keyboard.press('Escape');await warm.keyboard.press('Shift+KeyJ')
    for(let n=0;n<11;n++)await exercise()
    const after=await warm.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),c=s.creatures.find((c)=>c.id===id)!;return{pos:c.pos,temp:c.needs.bodyTemp,warming:c.residentWarming,ids:c.bag.map((it)=>it.uid)}},doctor.id)
    assert.deepEqual(after.pos,doctor.home);assert.ok(after.temp>36.5);assert.equal(after.warming,undefined);assert.deepEqual(after.ids,before.ids);await warm.screenshot({path:`${out}/110-warmed-return.png`});await warm.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'teaching') {
    for(const phase of ['first','final']){
      const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:`teaching-${phase}`,background:'Bg.Hunter',overworld:true})},p=corePlayer(fixture),s=fixture.s,site=s.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!,day=phase==='first'?0:9
      s.sources=[];s.storyteller.budget=-1e9;s.overworld!.currentRegion=site.id;s.overworld!.position={...site.cell};s.creatures=[p];s.time=(day*28800+14*1200)*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20}
      for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
      initializeSettlement(fixture);const teacher=s.creatures.find((c)=>c.traderSite)!;p.pos={x:29,y:18};p.money=1000;p.literacy=0;p.literate=false
      for(const c of s.creatures){c.nextAct=c.id===p.id||c.id===teacher.id?s.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0,nutritionDay:day})}
      if(phase==='final')p.literacyLessons={course:'Teacher.Hearth',days:[0,1,2,3,4,5,6,7,8],teacher:teacher.name,at:8*28800}
      s.map.lights=[{pos:{x:32,y:18},radius:12,kind:'campfire'}]
      const before={time:s.time,money:p.money,cash:teacher.money??0,xp:p.xp,skills:JSON.stringify(p.skills),ids:teacher.bag.map((it)=>it.uid)}
      const learn=await browser.newPage({viewport:{width:1440,height:900}});learn.on('pageerror',(e)=>errors.push(e.message));learn.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
      await learn.goto('http://localhost:4317/?debug');await learn.fill('[data-testid=seed]',`teaching-${phase}`);await learn.click('[data-testid=start]');await learn.waitForSelector('[data-testid=map] canvas');await learn.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
      await learn.keyboard.press('n');await learn.waitForSelector('[data-testid=teaching-panel]');assert.equal(await learn.locator('[data-testid=lesson-start]').isEnabled(),true)
      if(phase==='first')await learn.screenshot({path:`${out}/102-teacher-offer.png`})
      await learn.click('[data-testid=lesson-start]');await learn.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity},undefined,{timeout:60000})
      const after=await learn.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,t=s.creatures.find((c)=>c.id===id)!;return{time:s.time,money:p.money,cash:t.money,lit:p.literacy,days:p.literacyLessons?.days,xp:p.xp,skills:JSON.stringify(p.skills),water:p.needs.waterDeficit,ids:t.bag.map((it)=>it.uid)}},teacher.id)
      assert.equal(after.time-before.time,120000);assert.equal(after.money,before.money-6);assert.equal(after.cash,before.cash+6);assert.equal(after.xp,before.xp);assert.equal(after.skills,before.skills);assert.deepEqual(after.ids,before.ids);assert.ok(after.water>0);assert.equal(after.days?.length,phase==='first'?1:10);assert.equal(after.lit,phase==='first'?0:1)
      if(phase==='first'){assert.equal(await learn.locator('[data-testid=lesson-start]').isDisabled(),true);assert.match(await learn.textContent('[data-testid=lesson-error]')??'',/오늘/);await learn.screenshot({path:`${out}/103-first-lesson.png`})}
      else{await learn.keyboard.press('Escape');await learn.keyboard.press('c');assert.match(await learn.textContent('[data-testid=win-char]')??'',/더듬더듬/);assert.match(await learn.textContent('[data-testid=win-char]')??'',/10일 수료/);await learn.screenshot({path:`${out}/105-tenth-lesson-literacy.png`});await learn.keyboard.press('Escape')}
      const saved=await learn.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures})})
      await learn.getByRole('button',{name:'타이틀',exact:true}).click();await learn.reload();await learn.click('[data-testid=continue]');await learn.waitForSelector('[data-testid=map] canvas');assert.equal(await learn.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures})}),saved);await learn.keyboard.press('n');await learn.screenshot({path:`${out}/${phase==='first'?'104-first-lesson-restored':'106-literacy-restored'}.png`});await learn.close()
    }
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'purification') {
    const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'purification-browser',background:'Bg.Hunter',overworld:true})},p=corePlayer(fixture),s=fixture.s,site=s.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!
    s.sources=[];s.storyteller.budget=-1e9;s.overworld!.currentRegion=site.id;s.overworld!.position={...site.cell};s.creatures=[p];s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20}
    for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    initializeSettlement(fixture);const doctor=s.creatures.find((c)=>c.clinicSite)!,fire=s.map.residentHearth!,depot=s.map.residentDepot!;p.pos={x:33,y:18}
    for(const c of s.creatures){c.nextAct=c.id===p.id||c.id===doctor.id?s.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0})}
    for(const it of doctor.bag)if(['Item.WaterBottle','Item.DirtyWaterBottle'].includes(it.def)){it.uses=0;delete it.water;delete it.waterFrozen}
    doctor.needs.waterDeficit=1000;s.map.lights=[{pos:fire.pos,radius:12,kind:'campfire'}]
    const before={fuel:s.overworld!.simulation!.settlements[site.id]!.reserve.Fuel!,ids:doctor.bag.map((it)=>it.uid),cash:doctor.money,uid:s.overworld!.simulation!.nextItemId!,time:s.time}
    const care=await browser.newPage({viewport:{width:1440,height:900}});care.on('pageerror',(e)=>errors.push(e.message));care.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await care.goto('http://localhost:4317/?debug');await care.fill('[data-testid=seed]','purification-browser');await care.click('[data-testid=start]');await care.waitForSelector('[data-testid=map] canvas');await care.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    let boiling=false
    for(let n=0;n<40;n++){await care.keyboard.press('.');boiling=await care.evaluate((id)=>(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.id===id)!.activity?.kind==='water',doctor.id);if(boiling)break}
    assert.ok(boiling);const started=await care.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),c=s.creatures.find((c)=>c.id===id)!;return{pos:c.pos,water:c.bag.find((it)=>it.water)!.water,fuel:c.bag.find((it)=>it.def==='Item.Wood')?.count,remaining:c.activity!.remaining}},doctor.id);assert.ok(Math.max(Math.abs(started.pos.x-fire.pos.x),Math.abs(started.pos.y-fire.pos.y))<=2);assert.equal(started.water!.pathogen,10);assert.equal(started.fuel,1);assert.ok(started.remaining>190)
    console.log('끓이기 위치',started.pos);await care.keyboard.press('y');await care.keyboard.press('n');await care.waitForSelector('[data-testid=clinic-boiling]');await care.screenshot({path:`${out}/98-resident-boiling.png`})
    const saved=await care.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,fire:s.map.residentHearth,simulation:s.overworld!.simulation})})
    await care.getByRole('button',{name:'타이틀',exact:true}).click();await care.reload();await care.click('[data-testid=continue]');await care.waitForSelector('[data-testid=map] canvas');assert.equal(await care.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,fire:s.map.residentHearth,simulation:s.overworld!.simulation})}),saved);await care.screenshot({path:`${out}/99-resident-boiling-restored.png`})
    for(let n=0;n<2;n++){await care.keyboard.press('r');await care.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})}
    const after=await care.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),c=s.creatures.find((c)=>c.id===id)!,stock=s.overworld!.simulation!.settlements[c.residentSite!]!;return{time:s.time,pos:c.pos,thirst:c.needs.waterDeficit,ids:c.bag.map((it)=>it.uid),cash:c.money,uid:s.overworld!.simulation!.nextItemId,fuel:stock.reserve.Fuel,credit:stock.residentConsumption?.units.Fuel,used:c.residentConsumption?.units.Fuel,ration:c.residentFuel?.units,filled:c.bag.find((it)=>it.water)}},doctor.id)
    assert.ok(after.time-before.time>=20000);assert.deepEqual(after.pos,doctor.home);assert.ok(after.thirst<500);assert.deepEqual(after.ids,before.ids);assert.equal(after.cash,before.cash);assert.equal(after.uid,before.uid+1);assert.ok(Math.abs(after.fuel!-(before.fuel-1))<1e-8);assert.equal(after.credit,.15);assert.equal(after.used,.15);assert.equal(after.ration,1);assert.equal(after.filled!.uses,2);assert.equal(after.filled!.water!.pathogen,0);assert.equal(after.filled!.water!.ash,5.5);await care.screenshot({path:`${out}/100-resident-boiled-water.png`})
    await care.keyboard.press('y')
    await care.keyboard.press('n');await care.waitForSelector('[data-testid=depot-fuel]');assert.match(await care.textContent('[data-testid=depot-fuel]')??'',/공동 연료/);assert.ok(depot);await care.screenshot({path:`${out}/101-resident-fuel-ledger.png`});await care.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'well') {
    const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'well-browser',background:'Bg.Hunter',overworld:true})},p=corePlayer(fixture),s=fixture.s,site=s.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!
    s.sources=[];s.storyteller.budget=-1e9;s.overworld!.currentRegion=site.id;s.overworld!.position={...site.cell};s.creatures=[p];s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:30,y:17}
    for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    initializeSettlement(fixture);const doctor=s.creatures.find((c)=>c.clinicSite)!,well=s.map.residentWell!
    for(const c of s.creatures){c.nextAct=c.id===p.id||c.id===doctor.id?s.time:1e12;c.hp=95;c.age=undefined;c.traits=[];c.traumas=[];c.background=undefined;c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0})}
    const bottle=p.bag.find((it)=>it.def==='Item.WaterBottle')!;assert.ok(bottle);bottle.uses=0;p.needs.waterDeficit=700
    for(const it of doctor.bag)if(['Item.WaterBottle','Item.DirtyWaterBottle'].includes(it.def)){it.uses=0;delete it.water;delete it.waterFrozen}
    doctor.needs.waterDeficit=1000;doctor.residentPurifyAfter=1e12;s.map.lights=[{pos:{x:32,y:18},radius:12,kind:'campfire'}]
    const before={ids:doctor.bag.map((it)=>it.uid),cash:doctor.money,uid:s.overworld!.simulation!.nextItemId!,time:s.time}
    const water=await browser.newPage({viewport:{width:1440,height:900}});water.on('pageerror',(e)=>errors.push(e.message));water.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await water.goto('http://localhost:4317/?debug');await water.fill('[data-testid=seed]','well-browser');await water.click('[data-testid=start]');await water.waitForSelector('[data-testid=map] canvas');await water.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    await water.keyboard.press('n');await water.waitForSelector('[data-testid=resident-well]');await water.screenshot({path:`${out}/94-resident-well.png`})
    await water.click(`[data-testid=well-fill-${bottle.uid}]`)
    const filled=await water.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return{time:s.time,item:p.bag.find((it)=>it.uid===id)!}},bottle.uid)
    assert.equal(filled.time,before.time+150);assert.equal(filled.item.uid,bottle.uid);assert.equal(filled.item.uses,5);assert.deepEqual(filled.item.water,{pathogen:10,ash:5,source:'우물물'});await water.screenshot({path:`${out}/95-well-bottle-filled.png`})
    const thirst=await water.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.id===(window as unknown as Hook).__ashveil.world().s.playerId)!.needs.waterDeficit)
    await water.click('[data-testid=well-drink]')
    const drank=await water.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return{time:s.time,thirst:p.needs.waterDeficit}})
    assert.equal(drank.time,filled.time+200);assert.ok(drank.thirst<=thirst-299&&drank.thirst>=thirst-300)
    await water.keyboard.press('Escape');const visited=[]
    for(let n=0;n<40;n++){await water.keyboard.press('.');visited.push(await water.evaluate((id)=>(window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.id===id)!.pos,doctor.id))}
    const after=await water.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),c=s.creatures.find((c)=>c.id===id)!;return{pos:c.pos,thirst:c.needs.waterDeficit,ids:c.bag.map((it)=>it.uid),cash:c.money,uid:s.overworld!.simulation!.nextItemId,filled:c.bag.find((it)=>it.water)}},doctor.id)
    assert.ok(visited.some((pos)=>Math.max(Math.abs(pos.x-well.pos.x),Math.abs(pos.y-well.pos.y))<=1));assert.deepEqual(after.pos,doctor.home);assert.ok(after.thirst<500);assert.deepEqual(after.ids,before.ids);assert.equal(after.cash,before.cash);assert.equal(after.uid,before.uid);assert.equal(after.filled?.uses,2);assert.deepEqual(after.filled?.water,{pathogen:10,ash:5,source:'우물물'})
    await water.keyboard.press('n');await water.screenshot({path:`${out}/96-resident-water-returned.png`})
    const saved=await water.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,well:s.map.residentWell,simulation:s.overworld!.simulation})})
    await water.getByRole('button',{name:'타이틀',exact:true}).click();await water.reload();await water.click('[data-testid=continue]');await water.waitForSelector('[data-testid=map] canvas');assert.equal(await water.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,well:s.map.residentWell,simulation:s.overworld!.simulation})}),saved)
    await water.keyboard.press('n');await water.screenshot({path:`${out}/97-resident-water-restored.png`});await water.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'provisions') {
    const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'provisions-browser',background:'Bg.Hunter',overworld:true})},p=corePlayer(fixture),s=fixture.s,site=s.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!
    s.sources=[];s.storyteller.budget=-1e9;s.overworld!.currentRegion=site.id;s.overworld!.position={...site.cell};s.creatures=[p];s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:29,y:18};p.nextAct=s.time;p.hp=95;p.age=undefined;p.traits=[];p.traumas=[];p.background=undefined;p.abilities=[];p.effects=[];p.thoughts=[];p.body.wounds=[];p.body.missing=[];p.body.blood=p.body.bloodMax;p.money=100
    Object.assign(p.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0})
    for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    initializeSettlement(fixture);const doctor=s.creatures.find((c)=>c.clinicSite)!,depot=s.map.residentDepot!;doctor.nextAct=s.time;doctor.age=undefined;doctor.needs.kcal=0;doctor.needs.waterDeficit=0;doctor.needs.bodyTemp=37;doctor.needs.fatigue=10;doctor.bag=doctor.bag.filter((it)=>!content.item(it.def).food)
    for(const c of s.creatures)if(c.id!==p.id&&c.id!==doctor.id)c.nextAct=1e12
    s.map.lights=[{pos:{x:32,y:18},radius:12,kind:'campfire'}]
    const before={reserve:s.overworld!.simulation!.settlements[site.id].reserve.Food!,uid:s.overworld!.simulation!.nextItemId!,cash:doctor.money,market:JSON.stringify(s.overworld!.markets![site.id])}
    const provisions=await browser.newPage({viewport:{width:1440,height:900}});provisions.on('pageerror',(e)=>errors.push(e.message));provisions.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await provisions.goto('http://localhost:4317/?debug');await provisions.fill('[data-testid=seed]','provisions-browser');await provisions.click('[data-testid=start]');await provisions.waitForSelector('[data-testid=map] canvas');await provisions.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    await provisions.keyboard.press('.');await provisions.keyboard.press('n');await provisions.waitForSelector('[data-testid=resident-depot]');assert.match(await provisions.textContent('[data-testid=depot-food]')??'',/공동 식량/);await provisions.screenshot({path:`${out}/90-resident-depot.png`});await provisions.keyboard.press('Escape')
    const visited=[];let issued=false
    for(let n=0;n<30;n++){
      await provisions.keyboard.press('.')
      const state=await provisions.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),c=s.creatures.find((c)=>c.id===id)!;return{pos:c.pos,food:c.bag.find((it)=>it.def==='Item.Hardtack')?.count??0}},doctor.id);visited.push(state.pos)
      if(!issued&&state.food>0){issued=true;await provisions.screenshot({path:`${out}/91-resident-ration-issued.png`})}
    }
    assert.ok(issued);assert.ok(visited.some((pos)=>Math.max(Math.abs(pos.x-depot.pos.x),Math.abs(pos.y-depot.pos.y))<=1))
    const after=await provisions.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),c=s.creatures.find((c)=>c.id===id)!,stock=s.overworld!.simulation!.settlements[c.residentSite!]!;return{pos:c.pos,food:c.bag.find((it)=>it.def==='Item.Hardtack')?.count,kcal:c.needs.kcal,reserve:stock.reserve.Food!,credit:stock.residentConsumption?.units.Food,used:c.residentConsumption?.units.Food,ration:c.residentRation?.units,cash:c.money,uid:s.overworld!.simulation!.nextItemId,market:JSON.stringify(s.overworld!.markets![c.residentSite!])}},doctor.id)
    assert.deepEqual(after.pos,doctor.home);assert.equal(after.food,4);assert.ok(after.kcal>300);assert.ok(Math.abs(after.reserve-(before.reserve-.7))<1e-8);assert.equal(after.credit,.14);assert.equal(after.used,.14);assert.equal(after.ration,.7);assert.equal(after.cash,before.cash);assert.equal(after.uid,before.uid+1);assert.equal(after.market,before.market)
    await provisions.keyboard.press('n');await provisions.waitForSelector('[data-testid=resident-depot]');await provisions.screenshot({path:`${out}/92-resident-depot-after.png`})
    const saved=await provisions.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,depot:s.map.residentDepot,simulation:s.overworld!.simulation})})
    await provisions.getByRole('button',{name:'타이틀',exact:true}).click();await provisions.reload();await provisions.click('[data-testid=continue]');await provisions.waitForSelector('[data-testid=map] canvas');assert.equal(await provisions.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,depot:s.map.residentDepot,simulation:s.overworld!.simulation})}),saved)
    await provisions.keyboard.press('n');await provisions.screenshot({path:`${out}/93-resident-provisions-restored.png`});await provisions.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'resident') {
    const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'resident-browser',background:'Bg.Hunter',overworld:true})},p=corePlayer(fixture),s=fixture.s,site=s.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!
    s.sources=[];s.storyteller.budget=-1e9;p.money=100
    s.overworld!.currentRegion=site.id;s.overworld!.position={...site.cell};s.creatures=[p];s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:33,y:18};p.nextAct=s.time;p.hp=95;p.age=undefined;p.traits=[];p.traumas=[];p.background=undefined;p.abilities=[];p.effects=[];p.thoughts=[];p.body.wounds=[];p.body.missing=[];p.body.blood=p.body.bloodMax;p.bag=[]
    Object.assign(p.needs,{kcal:2500,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0});assert.equal(addToBag(fixture,p,makeItem(fixture,'Item.WaterBottle')),0)
    for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    initializeSettlement(fixture);const doctor=s.creatures.find((c)=>c.clinicSite)!,bed=s.map.residentBeds!.find((b)=>b.owner===doctor.id)!;doctor.needs.fatigue=70;doctor.nextAct=s.time;doctor.age=undefined;doctor.needs.kcal=1000;doctor.needs.waterDeficit=0;doctor.needs.bodyTemp=37
    for(const c of s.creatures)if(c.id!==p.id&&c.id!==doctor.id)c.nextAct=1e12
    s.map.lights=[{pos:{x:32,y:18},radius:12,kind:'campfire'}]
    const resident=await browser.newPage({viewport:{width:1440,height:900}});resident.on('pageerror',(e)=>errors.push(e.message));resident.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await resident.goto('http://localhost:4317/?debug');await resident.fill('[data-testid=seed]','resident-browser');await resident.click('[data-testid=start]');await resident.waitForSelector('[data-testid=map] canvas');await resident.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    for(let n=0;n<4;n++)await resident.keyboard.press('.')
    const slept=await resident.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),c=s.creatures.find((c)=>c.id===id)!;return{time:s.time,pos:c.pos,asleep:c.asleep,wake:c.activity?.wakeFatigue}},doctor.id)
    assert.deepEqual(slept.pos,bed.pos);assert.equal(slept.asleep,true);assert.equal(slept.wake,20)
    await resident.keyboard.press('n');await resident.waitForSelector('[data-testid=clinic-panel]');await resident.click('[data-testid=clinic-diagnose]');assert.match(await resident.textContent('[data-testid=clinic-quote]')??'',/의식|깨어/);assert.equal(await resident.locator('[data-testid=clinic-confirm]').isDisabled(),true);await resident.screenshot({path:`${out}/87-resident-sleeping.png`});await resident.keyboard.press('Escape')
    let rested=false
    for(let n=0;n<60;n++){
      const state=await resident.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,c=s.creatures.find((c)=>c.id===id)!;return{awake:!c.asleep&&!c.activity&&c.pos.x===c.home!.x&&c.pos.y===c.home!.y,water:p.needs.waterDeficit}},doctor.id)
      if(state.awake){rested=true;break}
      if(state.water>=400){await resident.keyboard.press('i');await resident.locator('[data-testid="item-Item.WaterBottle"]').dblclick();await resident.keyboard.press('Escape')}
      await resident.keyboard.press('r');await resident.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})
    }
    assert.ok(rested,'의사가 실제 수면으로 회복하고 업무 자리로 돌아와야 한다')
    const after=await resident.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),c=s.creatures.find((c)=>c.id===id)!;return{time:s.time,fatigue:c.needs.fatigue,pos:c.pos}},doctor.id)
    assert.ok(after.time-slept.time>=3*1200*100);assert.ok(after.fatigue<=24);assert.deepEqual(after.pos,doctor.home)
    await resident.keyboard.press('l');await resident.keyboard.press('n');await resident.waitForSelector('[data-testid=clinic-panel]');await resident.click('[data-testid=clinic-diagnose]');assert.equal(await resident.locator('[data-testid=clinic-confirm]').isEnabled(),true);await resident.screenshot({path:`${out}/88-resident-rested.png`})
    const saved=await resident.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,beds:s.map.residentBeds,creatures:s.creatures})})
    await resident.getByRole('button',{name:'타이틀',exact:true}).click();await resident.reload();await resident.click('[data-testid=continue]');await resident.waitForSelector('[data-testid=map] canvas');assert.equal(await resident.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,beds:s.map.residentBeds,creatures:s.creatures})}),saved)
    await resident.keyboard.press('n');await resident.screenshot({path:`${out}/89-resident-restored.png`});await resident.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'hands') {
    const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'hands-browser',overworld:true})},p=corePlayer(fixture),s=fixture.s
    s.creatures=[p];s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:34,y:18};p.nextAct=s.time;p.hp=95;p.age=undefined;p.background=undefined;p.traits=[];p.traumas=[];p.abilities=[];p.effects=[];p.thoughts=[];p.equip={};p.bag=[];p.body.wounds=[];p.body.missing=[];p.body.blood=p.body.bloodMax;p.stats={str:10,agi:10,per:13,vit:10,wil:10};p.skills={medicine:50};p.hands={kind:'dirty',at:s.time/100}
    Object.assign(p.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:10,wetness:0,ash:0})
    for(let y=15;y<=21;y++)for(let x=31;x<=38;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    s.map.lights=[{pos:{x:34,y:18},radius:8,kind:'campfire'}]
    const water=makeItem(fixture,'Item.WaterBottle'),kit=makeItem(fixture,'Item.MedicalBag');assert.equal(addToBag(fixture,p,water),0);assert.equal(addToBag(fixture,p,kit),0);const cut=addWound(fixture,p,{def:'Wound.Cut',part:'LeftForearm',severity:1,source:'손 씻기 검증'}).wound
    const hands=await browser.newPage({viewport:{width:1440,height:900}});hands.on('pageerror',(e)=>errors.push(e.message));hands.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await hands.goto('http://localhost:4317/?debug');await hands.fill('[data-testid=seed]','hands-browser');await hands.click('[data-testid=start]');await hands.waitForSelector('[data-testid=map] canvas');await hands.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    await hands.keyboard.press('.');await hands.keyboard.press('Shift+KeyJ');await hands.getByRole('button',{name:'생존',exact:true}).click();assert.match(await hands.textContent('[data-testid=hand-hygiene]')??'',/피·흙 묻음/);await hands.screenshot({path:`${out}/81-hands-dirty.png`})
    const before=await hands.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return{time:s.time,hygiene:p.needs.hygiene,blood:p.body.blood}})
    await hands.click('[data-testid=wash-hands]');await hands.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return !s.simulationPending&&p.hands?.kind==='washed'})
    const washed=await hands.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return{time:s.time,hygiene:p.needs.hygiene,blood:p.body.blood,water:p.bag.find((it)=>it.def==='Item.WaterBottle')!.uses}})
    assert.equal(washed.time,before.time+300);assert.equal(washed.hygiene,before.hygiene);assert.equal(washed.water,4);assert.ok(washed.blood<before.blood);await hands.screenshot({path:`${out}/82-hands-washed.png`})
    await hands.keyboard.press('Escape');await hands.keyboard.press('Shift+KeyB');await hands.getByRole('button',{name:'붕대',exact:true}).click();await hands.waitForFunction((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return !s.simulationPending&&!!p.body.wounds.find((wd)=>wd.id===id)?.bandage},cut.id)
    assert.equal(await hands.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.creatures.find((c)=>c.id===s.playerId)!.hands?.kind}),'dirty');await hands.keyboard.press('Escape');await hands.keyboard.press('Shift+KeyJ');assert.match(await hands.textContent('[data-testid=hand-hygiene]')??'',/피·흙 묻음/);await hands.screenshot({path:`${out}/83-hands-after-treatment.png`})
    const saved=await hands.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,player:s.creatures.find((c)=>c.id===s.playerId)})})
    await hands.getByRole('button',{name:'타이틀',exact:true}).click();await hands.reload();await hands.click('[data-testid=continue]');await hands.waitForSelector('[data-testid=map] canvas');assert.equal(await hands.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,player:s.creatures.find((c)=>c.id===s.playerId)})}),saved)
    await hands.keyboard.press('Shift+KeyJ');await hands.screenshot({path:`${out}/84-hands-restored.png`});await hands.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'inn') {
    const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'inn-browser',overworld:true})},p=corePlayer(fixture),s=fixture.s,site=s.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!
    s.overworld!.currentRegion=site.id;s.overworld!.position={...site.cell};s.creatures=[p];s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0}
    for(let y=12;y<=24;y++)for(let x=24;x<=40;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    p.pos={x:29,y:18};p.age=undefined;p.traits=[];p.traumas=[];p.background=undefined;p.abilities=[];p.effects=[];p.thoughts=[];p.body.wounds=[];p.body.missing=[];p.body.blood=p.body.bloodMax;p.money=100
    Object.assign(p.needs,{kcal:3000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:75,sleepDebt:0,wetness:0,ash:0})
    initializeSettlement(fixture);for(const c of s.creatures)c.nextAct=c.id===p.id?s.time:1e12
    s.map.lights=[{pos:{x:30,y:18},radius:10,kind:'campfire'}]
    const inn=await browser.newPage({viewport:{width:1440,height:900}});inn.on('pageerror',(e)=>errors.push(e.message));inn.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await inn.goto('http://localhost:4317/?debug');await inn.fill('[data-testid=seed]','inn-browser');await inn.click('[data-testid=start]');await inn.waitForSelector('[data-testid=map] canvas');await inn.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    await inn.keyboard.press('.');await inn.keyboard.press('n');await inn.waitForSelector('[data-testid=inn-panel]');assert.equal(await inn.locator('[data-testid^=inn-rent-]').count(),2)
    await inn.screenshot({path:`${out}/77-inn-beds.png`})
    const before=await inn.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return{money:p.money!,cash:s.overworld!.markets![s.overworld!.currentRegion!]!.money,time:s.time}})
    await inn.click('[data-testid=inn-rent-0]');await inn.waitForSelector('[data-testid=inn-lease]');assert.equal(await inn.locator('[data-testid=inn-rent-1]').isDisabled(),true)
    const paid=await inn.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return{money:p.money!,cash:s.overworld!.markets![s.overworld!.currentRegion!]!.money,time:s.time,bed:s.map.innBeds![0],pos:p.pos}})
    assert.equal(paid.money,before.money-8);assert.equal(paid.cash,before.cash+8);assert.equal(paid.time,before.time+100);assert.equal(paid.bed.lease!.until,before.time/100+28800);assert.deepEqual(paid.pos,{x:29,y:18});assert.deepEqual(paid.bed.pos,{x:28,y:16})
    await inn.screenshot({path:`${out}/78-inn-rented.png`});await inn.keyboard.press('Escape');await inn.keyboard.press('k');await inn.keyboard.press('y')
    assert.deepEqual(await inn.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.creatures.find((c)=>c.id===s.playerId)!.pos}),paid.bed.pos)
    await inn.keyboard.press('Shift+KeyJ');await inn.getByRole('button',{name:'생존',exact:true}).click();assert.match(await inn.textContent('[data-testid=win-journal]')??'',/나무 침대/);await inn.screenshot({path:`${out}/79-inn-bed-recovery.png`});await inn.keyboard.press('Escape')
    const fatigue=await inn.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.creatures.find((c)=>c.id===s.playerId)!.needs.fatigue})
    await inn.keyboard.press('z');await inn.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return p.asleep&&p.activity?.kind==='sleep'&&s.visible.length===0});await inn.click('[data-testid=stop-activity]');await inn.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return !s.simulationPending&&!p.activity&&!p.asleep&&s.visible.length>0});await inn.screenshot({path:`${out}/85-sleep-manual-wake.png`})
    await inn.keyboard.press('z');await inn.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return p.asleep&&p.activity?.kind==='sleep'&&s.visible.length===0});await inn.screenshot({path:`${out}/86-sleep-eyes-closed.png`});await inn.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!;return !s.simulationPending&&!p.activity&&!p.asleep&&s.visible.length>0},null,{timeout:60000})
    assert.ok(await inn.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return s.creatures.find((c)=>c.id===s.playerId)!.needs.fatigue})<fatigue)
    const saved=await inn.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,beds:s.map.innBeds,markets:s.overworld!.markets,player:s.creatures.find((c)=>c.id===s.playerId)})})
    await inn.getByRole('button',{name:'타이틀',exact:true}).click();await inn.reload();await inn.click('[data-testid=continue]');await inn.waitForSelector('[data-testid=map] canvas')
    assert.equal(await inn.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,beds:s.map.innBeds,markets:s.overworld!.markets,player:s.creatures.find((c)=>c.id===s.playerId)})}),saved)
    await inn.keyboard.press('Shift+KeyJ');await inn.screenshot({path:`${out}/80-inn-restored.png`});await inn.close()
  }
  if (!process.env.SMOKE_SECTION || process.env.SMOKE_SECTION === 'clinic') {
    const {db:content}=loadDb(),fixture={db:content,s:newGame(content,{seed:'clinic-browser',overworld:true})},p=corePlayer(fixture),s=fixture.s,site=s.overworld!.sites.find((t)=>t.kind==='settlement'&&t.faction==='coalition')!
    s.overworld!.currentRegion=site.id;s.overworld!.position={...site.cell};s.creatures=[p];s.time=14*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};initializeSettlement(fixture)
    const doctor=s.creatures.find((c)=>content.creature(c.def).clinic)!
    p.pos={x:34,y:18};p.nextAct=s.time;p.age=undefined;p.traits=[];p.traumas=[];p.background=undefined;p.abilities=[];p.effects=[];p.thoughts=[];p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.hp=95;p.body.wounds=[];p.body.missing=[];p.body.blood=p.body.bloodMax;p.skills={};p.money=1000
    Object.assign(p.needs,{kcal:2000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,stress:0,bodyTemp:37,fatigue:20,wetness:0,ash:0})
    doctor.nextAct=s.time;doctor.age=undefined;Object.assign(doctor.needs,{kcal:2000,waterDeficit:0,fatigue:10,bodyTemp:37,wetness:0,stress:0})
    for(const c of s.creatures)if(c.id!==p.id&&c.id!==doctor.id)c.nextAct=1e12
    for(let y=15;y<=21;y++)for(let x=31;x<=38;x++)Object.assign(coreTile(fixture,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
    s.map.lights=[{pos:{x:34,y:18},radius:6,kind:'campfire'}]
    const wd=addWound(fixture,p,{def:'Wound.Cut',part:'LeftForearm',severity:2,source:'진료 검증',contam:30}).wound
    const clinic=await browser.newPage({viewport:{width:1440,height:900}})
    clinic.on('pageerror',(e)=>errors.push(e.message));clinic.on('console',(m)=>{if(m.type()==='error')errors.push(m.text())})
    await clinic.goto('http://localhost:4317/?debug');await clinic.fill('[data-testid=seed]','clinic-browser');await clinic.click('[data-testid=start]');await clinic.waitForSelector('[data-testid=map] canvas')
    await clinic.evaluate((state)=>{((window as unknown as Hook).__ashveil.world().s = state)},s)
    const settleDoctor = async () => {
      await clinic.keyboard.press('Escape')
      for(let n=0;n<10;n++){
        const busy=await clinic.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),d=s.creatures.find((c)=>c.def==='Creature.SettlementDoctor')!;return d.activity?.kind==='washHands'||d.hands?.kind==='dirty'})
        if(!busy)break
        await clinic.keyboard.press('.')
      }
      await clinic.keyboard.press('n');await clinic.waitForSelector('[data-testid=clinic-panel]')
    }
    await clinic.keyboard.press('.');await clinic.keyboard.press('n');await clinic.waitForSelector('[data-testid=clinic-panel]')
    await clinic.click(`[data-testid="clinic-bandage-${wd.id}"]`);assert.match(await clinic.textContent('[data-testid=clinic-quote]')??'',/예상 Q 87/);await clinic.screenshot({path:`${out}/64-clinic-quote.png`})
    const before=await clinic.evaluate(()=>{const {s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,d=s.creatures.find((c)=>c.def==='Creature.SettlementDoctor')!;return{time:s.time,money:p.money!,blood:p.body.blood,bag:d.bag.find((i)=>i.def==='Item.MedicalBag')!.uses!,ready:d.nextAct}})
    await clinic.click('[data-testid=clinic-confirm]');await clinic.waitForFunction((id)=>{const {s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!!s.creatures.find((c)=>c.id===s.playerId)!.body.wounds.find((x)=>x.id===id)?.bandage},wd.id)
    const after=await clinic.evaluate(()=>{const {s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,d=s.creatures.find((c)=>c.def==='Creature.SettlementDoctor')!;return{time:s.time,money:p.money!,blood:p.body.blood,bag:d.bag.find((i)=>i.def==='Item.MedicalBag')!.uses!,q:p.body.wounds[0].bandage!.quality,doctorMoney:d.money}})
    assert.equal(after.time,before.ready+500);assert.equal(after.money,before.money-8);assert.equal(after.doctorMoney,8);assert.equal(after.bag,before.bag-1);assert.equal(after.q,87);assert.ok(after.blood<before.blood)
    await clinic.screenshot({path:`${out}/65-clinic-bandaged.png`});await settleDoctor()
    await clinic.click(`[data-testid="clinic-suture-${wd.id}"]`);assert.equal(await clinic.locator('[data-testid=clinic-confirm]').isEnabled(),true);await clinic.click('[data-testid=clinic-confirm]')
    await clinic.waitForFunction(()=>{const {s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!!s.creatures.find((c)=>c.id===s.playerId)!.body.wounds[0].suture})
    await clinic.screenshot({path:`${out}/66-clinic-sutured.png`});await settleDoctor()
    await clinic.getByRole('button',{name:'절단 상담 펼치기',exact:true}).click();await clinic.getByRole('button',{name:'왼손',exact:true}).click();assert.equal(await clinic.locator('[data-testid=clinic-confirm]').isEnabled(),false);assert.match(await clinic.textContent('[data-testid=clinic-quote]')??'',/영구적으로/)
    const saved=await clinic.evaluate(()=>{const {s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,clinic:s.map.clinicInitialized})})
    await clinic.getByRole('button',{name:'타이틀',exact:true}).click();await clinic.reload();await clinic.click('[data-testid=continue]');await clinic.waitForSelector('[data-testid=map] canvas')
    assert.equal(await clinic.evaluate(()=>{const {s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({time:s.time,creatures:s.creatures,clinic:s.map.clinicInitialized})}),saved)
    await clinic.keyboard.press('n');await clinic.waitForSelector('[data-testid=clinic-panel]');await clinic.screenshot({path:`${out}/67-clinic-restored.png`})
    const hidden=addWound(fixture,p,{def:'Wound.InternalBleed',part:'Liver',severity:1,internal:true,source:'진찰 검증'}).wound
    await clinic.evaluate((wd)=>{const {s}=(window as unknown as Hook).__ashveil.world();wd.id=s.nextId++;s.creatures.find((c)=>c.id===s.playerId)!.body.wounds.push(wd)},hidden)
    await clinic.click('[data-testid=clinic-diagnose]');await clinic.click('[data-testid=clinic-confirm]')
    await clinic.waitForFunction(()=>{const {s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&s.creatures.find((c)=>c.id===s.playerId)!.medicalReports?.length===1})
    await clinic.keyboard.press('Escape');await clinic.keyboard.press('Shift+KeyJ');await clinic.getByRole('button',{name:'진료',exact:true}).click()
    assert.match(await clinic.textContent('[data-testid=medical-report]')??'',/복부가 단단하다.*내출혈이 의심.*맥을 짚은 소견/s);assert.doesNotMatch(await clinic.textContent('[data-testid=medical-report]')??'',/간:|Liver|[0-9]+ml/)
    await clinic.screenshot({path:`${out}/68-diagnostic-record.png`})
    const report=await clinic.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.faction==='player')!.medicalReports))
    await clinic.getByRole('button',{name:'타이틀',exact:true}).click();await clinic.reload();await clinic.click('[data-testid=continue]');await clinic.waitForSelector('[data-testid=map] canvas')
    assert.equal(await clinic.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s.creatures.find((c)=>c.faction==='player')!.medicalReports)),report)
    await clinic.keyboard.press('Shift+KeyJ');await clinic.getByRole('button',{name:'진료',exact:true}).click();await clinic.screenshot({path:`${out}/69-diagnostic-restored.png`})
    await clinic.keyboard.press('Escape');await clinic.keyboard.press('n');await clinic.waitForSelector('[data-testid=clinic-panel]')
    const drugBefore=await clinic.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,d=s.creatures.find((c)=>c.def==='Creature.SettlementDoctor')!;p.needs.waterDeficit=300;return{money:p.money!,tea:d.bag.find((i)=>i.def==='Item.WillowTea')!.count,time:s.time,ready:d.nextAct}})
    await clinic.click('[data-testid="clinic-drug-Item.WillowTea"]');assert.match(await clinic.textContent('[data-testid=clinic-drug-preview]')??'',/통증 감소 10.0/);await clinic.click('[data-testid=clinic-confirm]')
    await clinic.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&s.creatures.find((c)=>c.id===s.playerId)!.drugs?.active.some((d)=>d.def==='Drug.WillowTea')})
    const teaAfter=await clinic.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,d=s.creatures.find((c)=>c.def==='Creature.SettlementDoctor')!;return{money:p.money!,water:p.needs.waterDeficit,tea:d.bag.find((i)=>i.def==='Item.WillowTea')!.count,doctorDrugs:d.drugs,time:s.time}})
    assert.equal(teaAfter.money,drugBefore.money-12);assert.equal(teaAfter.tea,drugBefore.tea-1);assert.equal(teaAfter.time,Math.max(drugBefore.time,drugBefore.ready)+100);assert.ok(teaAfter.water>=100&&teaAfter.water<=101,JSON.stringify(teaAfter));assert.equal(teaAfter.doctorDrugs,undefined)
    await clinic.click('[data-testid="clinic-drug-Item.PoppyTincture"]');assert.match(await clinic.textContent('[data-testid=clinic-drug-preview]')??'',/호흡 감소 0.10.*의존 위험/s);await clinic.screenshot({path:`${out}/70-clinical-dose-preview.png`});await clinic.click('[data-testid=clinic-confirm]')
    await clinic.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&s.creatures.find((c)=>c.id===s.playerId)!.drugs?.active.some((d)=>d.def==='Drug.PoppyTincture')})
    await clinic.screenshot({path:`${out}/71-clinical-dose-applied.png`})
    await clinic.click(`[data-testid="clinic-topical-${wd.id}-Item.BitterMoss"]`);await clinic.click('[data-testid=clinic-confirm]');await clinic.waitForFunction((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&s.creatures.find((c)=>c.id===s.playerId)!.body.wounds.find((wd)=>wd.id===id)?.topicalDrug?.def==='Drug.BitterMoss'},wd.id);await settleDoctor()
    await clinic.click('[data-testid="clinic-drug-Item.PurificationAmpoule"]');assert.match(await clinic.textContent('[data-testid=clinic-drug-preview]')??'',/전신 감염 진행 70% 감소.*이질 위험 10%/s);await clinic.click('[data-testid=clinic-confirm]')
    await clinic.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&s.creatures.find((c)=>c.id===s.playerId)!.drugs?.active.some((d)=>d.def==='Drug.PurificationAmpoule')})
    await clinic.keyboard.press('Escape');await clinic.keyboard.press('Shift+KeyB');assert.match(await clinic.textContent('[data-testid=win-body]')??'',/정화 앰플|개척 항생/);await clinic.screenshot({path:`${out}/72-clinical-local-systemic.png`})
    const doses=await clinic.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,d=s.creatures.find((c)=>c.def==='Creature.SettlementDoctor')!;return JSON.stringify({time:s.time,drugs:p.drugs,wounds:p.body.wounds,doctorBag:d.bag,money:p.money,doctorMoney:d.money,reports:p.medicalReports})})
    await clinic.getByRole('button',{name:'타이틀',exact:true}).click();await clinic.reload();await clinic.click('[data-testid=continue]');await clinic.waitForSelector('[data-testid=map] canvas')
    assert.equal(await clinic.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,d=s.creatures.find((c)=>c.def==='Creature.SettlementDoctor')!;return JSON.stringify({time:s.time,drugs:p.drugs,wounds:p.body.wounds,doctorBag:d.bag,money:p.money,doctorMoney:d.money,reports:p.medicalReports})}),doses)
    await clinic.keyboard.press('Shift+KeyB');await clinic.screenshot({path:`${out}/73-clinical-drugs-restored.png`})
    const cuts=['RightForearm','LeftHand','RightHand','LeftShin','RightShin','LeftFoot','RightFoot','Chest'].map((part)=>addWound(fixture,p,{def:'Wound.Cut',part,severity:1,source:'재보급 검증'}).wound)
    const extra=await clinic.evaluate((cuts)=>{const{s}=(window as unknown as Hook).__ashveil.world(),p=s.creatures.find((c)=>c.id===s.playerId)!,d=s.creatures.find((c)=>c.def==='Creature.SettlementDoctor')!,market=s.overworld!.markets![d.clinicSite!]!;const ids=cuts.map((wd)=>{wd.id=s.nextId++;p.body.wounds.push(wd);return wd.id});return{ids,doctor:d.id,home:d.home!,cash:d.money!,marketCash:market.money,bandages:market.items.filter((it)=>it.def==='Item.Bandage').reduce((n,it)=>n+it.count,0)}},cuts)
    await clinic.keyboard.press('Escape');await clinic.keyboard.press('n')
    for(const id of extra.ids){await clinic.click(`[data-testid="clinic-bandage-${id}"]`);await clinic.click('[data-testid=clinic-confirm]');await clinic.waitForFunction((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!!s.creatures.find((c)=>c.id===s.playerId)!.body.wounds.find((wd)=>wd.id===id)?.bandage},id);if(id!==extra.ids.at(-1))await settleDoctor()}
    await clinic.screenshot({path:`${out}/74-clinic-supply-low.png`});await clinic.keyboard.press('Escape')
    const visited=[]
    for(let n=0;n<20;n++){await clinic.keyboard.press('.');visited.push(await clinic.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),d=s.creatures.find((c)=>c.id===id)!,trader=s.creatures.find((c)=>c.traderSite===d.clinicSite)!;return{pos:d.pos,shop:Math.max(Math.abs(d.pos.x-trader.pos.x),Math.abs(d.pos.y-trader.pos.y))<=1}},extra.doctor))}
    assert.ok(visited.some((v)=>v.shop),'의사가 상인 곁으로 실제 이동해야 한다')
    const supplied=await clinic.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world(),d=s.creatures.find((c)=>c.id===id)!,market=s.overworld!.markets![d.clinicSite!]!;return{pos:d.pos,cash:d.money,marketCash:market.money,bandages:market.items.filter((it)=>it.def==='Item.Bandage').reduce((n,it)=>n+it.count,0),privateBandages:d.bag.filter((it)=>it.def==='Item.Bandage').reduce((n,it)=>n+it.count,0)}},extra.doctor)
    assert.deepEqual(supplied.pos,extra.home);assert.equal(supplied.privateBandages,4);assert.equal(supplied.bandages,extra.bandages-4);assert.equal(supplied.cash,extra.cash+64-20);assert.equal(supplied.marketCash,extra.marketCash+20)
    await clinic.keyboard.press('n');await clinic.waitForSelector('[data-testid=clinic-panel]');assert.match(await clinic.textContent('[data-testid=clinic-bandage-stock]')??'',/붕대 재료 5회분/);await clinic.screenshot({path:`${out}/75-clinic-supplied.png`})
    const supplySave=await clinic.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({creatures:s.creatures,markets:s.overworld!.markets,time:s.time,nextId:s.nextId})})
    await clinic.getByRole('button',{name:'타이틀',exact:true}).click();await clinic.reload();await clinic.click('[data-testid=continue]');await clinic.waitForSelector('[data-testid=map] canvas')
    assert.equal(await clinic.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.stringify({creatures:s.creatures,markets:s.overworld!.markets,time:s.time,nextId:s.nextId})}),supplySave)
    await clinic.keyboard.press('n');await clinic.screenshot({path:`${out}/76-clinic-supply-restored.png`});await clinic.close()
  }
  const settings = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  settings.on('pageerror', (e) => errors.push(e.message))
  settings.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await settings.goto('http://localhost:4317/?debug')
  await settings.fill('[data-testid=seed]', 'settings-smoke')
  await settings.click('[data-testid=start]')
  await settings.waitForSelector('[data-testid=map] canvas')
  await settings.waitForFunction(() => !!(window as unknown as Hook).__ashveil)
  await settings.keyboard.press('F3')
  await settings.waitForSelector('[data-testid=win-settings]')
  await settings.getByLabel('연출 속도').selectOption('0')
  await settings.getByLabel('상태 색상').selectOption('redgreen')
  await settings.getByLabel('떠오르는 표시').selectOption('large')
  await settings.getByLabel('화면 흔들림', { exact: true }).uncheck()
  await settings.getByLabel('횃불·조명 깜빡임', { exact: true }).uncheck()
  await settings.getByLabel('피격 섬광', { exact: true }).uncheck()
  await settings.getByLabel('위험 경고 맥동', { exact: true }).uncheck()
  await settings.getByLabel('기록 글자 크기').press('Home')
  for (let i = 0; i < 8; i++) await settings.getByLabel('기록 글자 크기').press('ArrowRight')
  // 설정 창에서 방향키를 눌러도 캐릭터가 움직이거나 턴이 흐르지 않는다.
  const beforeSettingsKey = await settings.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
  await settings.getByRole('button', { name: '기본값 복원', exact: true }).focus()
  await settings.keyboard.press('ArrowRight')
  assert.equal(await settings.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time), beforeSettingsKey)
  for (let i = 0; i < 18; i++) await settings.keyboard.press('Tab')
  assert.equal(await settings.evaluate(() => !!document.activeElement?.closest('[data-testid=win-settings]')), true)
  const pulse = settings.locator('.pulse-gold').first()
  if (await pulse.count()) assert.equal(await pulse.evaluate((el) => getComputedStyle(el).animationName), 'none')
  await settings.screenshot({ path: `${out}/15-settings.png` })
  await settings.keyboard.press('Escape')
  await settings.waitForSelector('[data-testid=win-settings]', { state: 'detached' })
  assert.equal(await settings.locator('[data-testid=log]').evaluate((el) => getComputedStyle(el).fontSize), '20px')
  assert.equal(await settings.evaluate(() => document.documentElement.dataset.instant), 'true')
  const timeBeforeMove = await settings.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time)
  await settings.keyboard.press('.')
  assert.ok(await settings.evaluate(() => (window as unknown as Hook).__ashveil.world().s.time) > timeBeforeMove)
  await settings.screenshot({ path: `${out}/16-instant-log.png` })
  await settings.reload()
  await settings.keyboard.press('F3')
  await settings.waitForSelector('[data-testid=win-settings]')
  assert.equal(await settings.getByLabel('연출 속도').inputValue(), '0')
  assert.equal(await settings.getByLabel('상태 색상').inputValue(), 'redgreen')
  assert.equal(await settings.getByLabel('화면 흔들림', { exact: true }).isChecked(), false)
  assert.equal(await settings.getByLabel('기록 글자 크기').inputValue(), '20')
  await settings.close()

} catch (error) {
  console.error('실패 시 콘솔 오류:', errors)
  for (const [i, page] of browser.contexts().flatMap((context) => context.pages()).entries()) {
    await page.screenshot({ path: `${out}/failure-${i}.png` }).catch(() => {})
    writeFileSync(`${out}/failure-${i}.txt`, await page.textContent('body') ?? '')
  }
  throw error
} finally {
  await browser.close()
  // npx 아래 vite 자식까지 그룹으로 종료 (안 그러면 프로세스가 안 끝난다)
  if (server.pid) process.kill(-server.pid)
}
if (errors.length) {
  console.error('콘솔 오류:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('OK')
