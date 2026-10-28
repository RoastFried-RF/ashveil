#!/usr/bin/env node
// Project compatibility adapter for the archived OpenAI web-game client.
// See tools/vendor/openai-web-game/PROVENANCE.md. The upstream bytes stay intact.
// Inputs are real UI events; presentation frames never advance ASHVEIL turns.
import {accessSync, constants, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync} from 'node:fs'
import {basename, dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const actionDir = join(root, 'tools/game-actions')
const aliases = {up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', enter: 'Enter', space: 'Space', a: 'a', b: 'b'}
const help = `ASHVEIL quick game harness (existing server; fresh browser context)
  node tools/game-harness.mjs --list
  node tools/game-harness.mjs --scenario smoke --check
  node tools/game-harness.mjs --url http://localhost:4317/?debug --scenario smoke --width 1440
  --actions-file PATH | --actions-json JSON  Alternative to --scenario
  --height 1080 --out NEW_DIRECTORY --timeout-ms 20000 --headless false
  --executable-path PATH  Otherwise CHROMIUM_PATH, workspace shim, installed Chromium
Whole-world deterministic and release checks remain separate.`

function integer(value, name, min, max) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw Error(`${name} must be an integer in ${min}..${max}`)
  return n
}

function options(argv) {
  const args = {width: 1440, height: 1080, timeout: 20000, headless: true}
  const flags = new Set(['--help', '--list', '--check'])
  const valued = new Set(['--url', '--scenario', '--actions-file', '--actions-json', '--width', '--height', '--out', '--timeout-ms', '--headless', '--executable-path'])
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flags.has(flag)) { args[flag.slice(2)] = true; continue }
    if (!valued.has(flag)) throw Error(`Unknown argument: ${flag}`)
    const value = argv[++i]
    if (value === undefined || value.startsWith('--')) throw Error(`Missing value for ${flag}`)
    if (flag === '--width' || flag === '--height') args[flag.slice(2)] = integer(value, flag, 320, 7680)
    else if (flag === '--timeout-ms') args.timeout = integer(value, flag, 100, 60000)
    else if (flag === '--headless') {
      if (!['true', 'false', '1', '0'].includes(value)) throw Error('--headless expects true/false or 1/0')
      args.headless = value === 'true' || value === '1'
    } else args[flag.slice(2)] = value
  }
  if (['scenario', 'actions-file', 'actions-json'].filter(k => args[k] !== undefined).length > 1) throw Error('Choose one of --scenario, --actions-file, --actions-json')
  return args
}

function named(value, field) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(value)) throw Error(`${field} must contain only letters, numbers, hyphens and underscores`)
  return value
}

function keyName(key) {
  if (typeof key !== 'string' || !key.length) throw Error('press requires a key')
  const parts = key.split('+')
  const keyPart = parts.pop()
  if (parts.some(p => !['Control', 'Shift', 'Alt', 'Meta', 'ControlOrMeta'].includes(p))) throw Error(`Unknown key modifier: ${key}`)
  if (!(keyPart.length === 1 || /^(Arrow(Up|Down|Left|Right)|Escape|Enter|Tab|Space|Period|Comma|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Backquote|Quote|Slash|Backslash|Minus|Equal|BracketLeft|BracketRight|Semicolon|CapsLock|Control|Shift|Alt|Meta|F([1-9]|1[0-2])|Key[A-Z]|Digit[0-9]|Numpad([0-9]|Enter|Add|Subtract|Multiply|Divide|Decimal))$/.test(keyPart))) throw Error(`Unknown key: ${key}`)
  return key
}

function text(value, field) {
  if (typeof value !== 'string' || !value.length) throw Error(`${field} must be a nonempty string`)
  return value
}

function validateStep(step, index) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) throw Error(`Invalid step ${index}`)
  if ((step.action === undefined || step.action === 'buttons') && Array.isArray(step.buttons)) {
    for (const button of step.buttons) if (!Object.hasOwn(aliases, button)) throw Error(`Unknown upstream button '${button}' at step ${index}; use an explicit press or selector click`)
    return {action: 'buttons', buttons: [...step.buttons], frames: integer(step.frames ?? 1, 'frames', 1, 120)}
  }
  switch (step.action) {
    case 'press': return {action: 'press', key: keyName(step.key)}
    case 'fill': return {action: 'fill', selector: text(step.selector, 'selector'), value: typeof step.value === 'string' ? step.value : text(null, 'fill value')}
    case 'click': {
      const button = step.button ?? 'left'
      if (!['left', 'right', 'middle'].includes(button)) throw Error(`Unknown mouse button: ${button}`)
      return {action: 'click', selector: text(step.selector, 'selector'), button}
    }
    case 'waitFor': {
      const state = step.state ?? 'visible'
      if (!['attached', 'detached', 'visible', 'hidden'].includes(state)) throw Error(`Unknown waitFor state: ${state}`)
      return {action: 'waitFor', selector: text(step.selector, 'selector'), state}
    }
    case 'frames': return {action: 'frames', frames: integer(step.frames, 'frames', 1, 120)}
    case 'snapshot': {
      const name = named(step.name, 'snapshot name')
      if (name === 'final' || name === 'failure') throw Error(`Reserved snapshot name: ${name}`)
      return {action: 'snapshot', name}
    }
    default: throw Error(`Unknown action '${step.action}' at step ${index}`)
  }
}

function scenario(args) {
  const name = named(args.scenario ?? (args['actions-file'] ? basename(args['actions-file']).replace(/\.json$/, '') : args['actions-json'] ? 'inline' : 'smoke'), 'scenario name')
  const raw = args['actions-json'] ?? readFileSync(resolve(args['actions-file'] ?? join(actionDir, `${name}.json`)), 'utf8')
  const payload = JSON.parse(raw)
  const steps = Array.isArray(payload) ? payload : payload.steps
  if (!Array.isArray(steps) || !steps.length || steps.length > 500) throw Error('Actions need 1..500 steps')
  const normalized = steps.map(validateStep)
  const snapshots = normalized.filter(s => s.action === 'snapshot').map(s => s.name)
  if (new Set(snapshots).size !== snapshots.length) throw Error('Snapshot names must be unique')
  return {name, description: payload.description ?? '', steps: normalized}
}

function browserPath(args) {
  const explicit = args['executable-path'] ?? process.env.CHROMIUM_PATH
  const candidates = explicit ? [resolve(explicit)] : ['/workspace/.ashveil-tools/chromium', chromium.executablePath()]
  for (const candidate of candidates) {
    try { accessSync(candidate, constants.X_OK); return candidate } catch { /* Try the next existing browser, never download one. */ }
  }
  throw Error(`Chromium executable unavailable. Set CHROMIUM_PATH to an installed browser or shim. Checked: ${candidates.join(', ')}`)
}

async function settle(page) {
  // Read-only observation. In particular, this does not call act/botSteps/advanceTime.
  await page.waitForFunction(() => {
    const raw = window.render_game_to_text?.()
    const observation = typeof raw === 'string' ? JSON.parse(raw) : raw
    const w = window.__ashveil?.world?.()
    if (observation?.mode === 'title') return true
    if (observation?.mode === 'game' || observation?.mode === 'report') {
      if (!w || document.querySelector('[data-testid=map]')?.dataset.ready !== 'true') return false
    }
    if (!w) return true
    const p = w.s.creatures.find(c => c.id === w.s.playerId)
    return !w.s.simulationPending && !p?.activity && w.s.fx.length === 0
  })
  await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))))
}

async function presentationFrames(page, frames) {
  await page.evaluate(async count => {
    for (let i = 0; i < count; i++) await new Promise(resolveFrame => requestAnimationFrame(resolveFrame))
  }, frames)
}

async function state(page) {
  return page.evaluate(() => {
    if (typeof window.render_game_to_text !== 'function') throw Error('Missing render_game_to_text. Use a current ASHVEIL build and a URL with ?debug.')
    const raw = window.render_game_to_text()
    const view = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!view || typeof view !== 'object' || Array.isArray(view)) throw Error('render_game_to_text must return JSON object data')
    const w = window.__ashveil?.world?.()
    return {view, world: w ? JSON.parse(JSON.stringify(w.s)) : null}
  })
}

async function capture(page, out, name, artifacts) {
  await settle(page)
  await page.waitForFunction(() => document.fonts.status === 'loaded' && [...document.images].every(img => img.complete))
  const missing = await page.evaluate(() => [...document.images].filter(img => !img.naturalWidth).map(img => img.currentSrc || img.src))
  if (missing.length) throw Error(`Image failed to load: ${missing.join(', ')}`)
  const snapshot = await state(page)
  writeFileSync(join(out, `${name}-state.json`), JSON.stringify(snapshot.view, null, 2))
  writeFileSync(join(out, `${name}-world.json`), JSON.stringify(snapshot.world, null, 2))
  const layout = await page.evaluate(() => {
    const start = document.querySelector('[data-testid=start]')
    if (!start) return null
    const rect = start.getBoundingClientRect(), x = (rect.left + rect.right) / 2, y = (rect.top + rect.bottom) / 2
    const atCenter = document.elementFromPoint(x, y)
    return {viewport: {width: innerWidth, height: innerHeight}, start: {left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, fullyInViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight, centerIsClickable: !!atCenter && start.contains(atCenter)}, scrolledElements: [...document.querySelectorAll('*')].filter(el => el.scrollTop || el.scrollLeft).map(el => ({tag: el.tagName, class: el.className, top: el.scrollTop, left: el.scrollLeft}))}
  })
  if (layout) writeFileSync(join(out, `${name}-layout.json`), JSON.stringify(layout, null, 2))
  await page.screenshot({path: join(out, `${name}.png`), fullPage: true, animations: 'disabled'})
  artifacts.push(name)
}

async function run(args, selected) {
  if (!args.url) throw Error('--url is required; start the existing Vite server separately')
  const url = new URL(args.url)
  if (!['http:', 'https:'].includes(url.protocol) || !url.searchParams.has('debug')) throw Error('--url must be an HTTP(S) ASHVEIL URL with ?debug')
  const executablePath = browserPath(args)
  let out
  if (args.out) {
    out = resolve(args.out)
    if (existsSync(out) && readdirSync(out).length) throw Error(`Output directory is not empty; preserve earlier evidence and choose a new --out: ${out}`)
    mkdirSync(out, {recursive: true})
  } else {
    const base = join(root, 'test-results/game-harness')
    mkdirSync(base, {recursive: true})
    out = mkdtempSync(join(base, `${selected.name}-${args.width}-`))
  }
  const errors = [], artifacts = []
  const audit = {scenario: selected.name, url: url.href, viewport: {width: args.width, height: args.height}, executablePath, startedAt: new Date().toISOString(), completedSteps: 0, artifacts, errors, status: 'running'}
  const saveAudit = () => {
    writeFileSync(join(out, 'run.json'), JSON.stringify(audit, null, 2))
    writeFileSync(join(out, 'errors.json'), JSON.stringify(errors, null, 2))
  }
  writeFileSync(join(out, 'actions.json'), JSON.stringify(selected, null, 2))
  saveAudit()
  let browser, page
  try {
    browser = await chromium.launch({executablePath, headless: args.headless, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']})
    const context = await browser.newContext({viewport: audit.viewport})
    page = await context.newPage()
    page.setDefaultTimeout(args.timeout)
    page.on('console', msg => { if (msg.type() === 'error') errors.push({type: 'console.error', text: msg.text()}) })
    page.on('pageerror', error => errors.push({type: 'pageerror', text: error.message}))
    page.on('requestfailed', request => errors.push({type: 'requestfailed', url: request.url(), text: request.failure()?.errorText}))
    page.on('response', response => { if (response.status() >= 400) errors.push({type: 'http', status: response.status(), url: response.url()}) })
    await page.goto(url.href, {waitUntil: 'domcontentloaded', timeout: args.timeout})
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function')
    for (const step of selected.steps) {
      if (step.action === 'press') await page.keyboard.press(step.key)
      else if (step.action === 'fill') await page.locator(step.selector).fill(step.value)
      else if (step.action === 'click') await page.locator(step.selector).click({button: step.button})
      else if (step.action === 'waitFor') await page.locator(step.selector).waitFor({state: step.state})
      else if (step.action === 'frames') await presentationFrames(page, step.frames)
      else if (step.action === 'buttons') {
        for (const button of step.buttons) await page.keyboard.press(aliases[button])
        await presentationFrames(page, step.frames)
      } else await capture(page, out, step.name, artifacts)
      if (step.action !== 'snapshot') await settle(page)
      audit.completedSteps++
      if (errors.length) throw Error(`Browser reported ${errors.length} error(s); see errors.json`)
    }
    await capture(page, out, 'final', artifacts)
    if (errors.length) throw Error(`Browser reported ${errors.length} error(s); see errors.json`)
    audit.status = 'passed'
    console.log(JSON.stringify({status: audit.status, out, completedSteps: audit.completedSteps, artifacts}))
  } catch (error) {
    audit.status = 'failed'
    audit.failure = error instanceof Error ? error.message : String(error)
    if (page) {
      await page.screenshot({path: join(out, 'failure.png'), fullPage: true}).catch(() => {})
      await state(page).then(snapshot => {
        writeFileSync(join(out, 'failure-state.json'), JSON.stringify(snapshot.view, null, 2))
        writeFileSync(join(out, 'failure-world.json'), JSON.stringify(snapshot.world, null, 2))
      }).catch(() => {})
    }
    throw Error(`${audit.failure}\nArtifacts: ${out}`, {cause: error})
  } finally {
    try { if (browser) await browser.close() }
    finally { audit.finishedAt = new Date().toISOString(); saveAudit() }
  }
}

async function main() {
  const args = options(process.argv.slice(2))
  if (args.help) { console.log(help); return }
  if (args.list) {
    const list = readdirSync(actionDir).filter(name => name.endsWith('.json')).sort().map(file => {
      const payload = JSON.parse(readFileSync(join(actionDir, file), 'utf8'))
      return {name: basename(file, '.json'), description: payload.description, viewports: payload.viewports}
    })
    console.log(JSON.stringify(list, null, 2)); return
  }
  const selected = scenario(args)
  if (args.check) { console.log(JSON.stringify({status: 'valid', scenario: selected.name, steps: selected.steps.length, browserStarted: false})); return }
  await run(args, selected)
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
