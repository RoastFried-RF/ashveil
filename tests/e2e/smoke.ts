// Playwright 스모크: 새 게임 → 이동 → 창(I/C/K/B/M) → 봇으로 던전 진입·전투 → 스크린샷. 콘솔 오류가 있으면 실패.
// 사용: npm run build && node --import tsx tests/e2e/smoke.ts [outDir]
import { chromium, type Page } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? 'test-results'
mkdirSync(out, { recursive: true })
const server = spawn('npx', ['vite', 'preview', '--port', '4317', '--strictPort'], { stdio: 'pipe', detached: true })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const errors: string[] = []

type Hook = { __ashveil: { botSteps(n: number): string; world(): { s: { map: { id: string }; creatures: { faction: string; alive: boolean; ai: { mode: string } }[] } } } }
const bot = (page: Page, n: number) => page.evaluate((k) => (window as unknown as Hook).__ashveil.botSteps(k), n)
const mapId = (page: Page) => page.evaluate(() => (window as unknown as Hook).__ashveil.world().s.map.id)

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:4317/?debug')
  await page.fill('[data-testid=seed]', process.env.SEED ?? 'smoke-1')
  await page.screenshot({ path: `${out}/01-title.png` })
  await page.click('[data-testid=start]')
  await page.waitForSelector('[data-testid=map] canvas')
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${out}/02-surface.png` })
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowUp']) { await page.keyboard.press(k); await page.waitForTimeout(170) }
  await page.keyboard.press('i')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/03-inventory.png` })
  await page.keyboard.press('i')
  await page.keyboard.press('c')
  await page.keyboard.press('K')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/04-char-abil.png` })
  await page.keyboard.press('Escape')
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
  await page.keyboard.press('B')
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
