// Playwright 스모크: 새 게임 → 이동/휴식 → 패널 전환 → 스크린샷. 콘솔 오류가 있으면 실패.
// 사용: pnpm build && node --import tsx tests/e2e/smoke.ts [outDir]
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? 'test-results'
mkdirSync(out, { recursive: true })
const server = spawn('npx', ['vite', 'preview', '--port', '4317', '--strictPort'], { stdio: 'pipe' })
await new Promise((r) => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const errors: string[] = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:4317/?debug')
  await page.fill('[data-testid=seed]', 'smoke-1')
  await page.screenshot({ path: `${out}/01-title.png` })
  await page.click('[data-testid=start]')
  await page.waitForSelector('[data-testid=map] canvas')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/02-start.png` })
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowRight']) {
    await page.keyboard.press(k)
    await page.waitForTimeout(60)
  }
  await page.keyboard.press('1')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/03-status.png` })
  await page.keyboard.press('3')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/04-inventory.png` })
  await page.keyboard.press('R')
  await page.waitForTimeout(800)
  await page.keyboard.press('2')
  await page.mouse.move(700, 400)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/05-after-rest.png` })
  // 봇으로 진행해 전투·부상 화면 확보
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => (window as unknown as { __ashveil: { botSteps(n: number): string; world(): { s: { creatures: { faction: string; body: { wounds: unknown[] } }[] } } } }).__ashveil.botSteps(25))
    const wounded = await page.evaluate(() => (window as unknown as { __ashveil: { world(): { s: { creatures: { faction: string; body: { wounds: unknown[] } }[] } } } }).__ashveil.world().s.creatures.find((c) => c.faction === 'player')!.body.wounds.length)
    if (st === 'over' || wounded > 1) break
  }
  await page.keyboard.press('2')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/06-bot-body.png` })
  if (await page.$('[data-testid=report]')) await page.screenshot({ path: `${out}/07-report.png` })
  const logText = await page.textContent('[data-testid=log]')
  console.log('log tail:', (logText ?? '').slice(-400))
} finally {
  await browser.close()
  server.kill()
}
if (errors.length) {
  console.error('콘솔 오류:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('OK')
