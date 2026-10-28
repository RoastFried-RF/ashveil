/** Fresh real creation, settings language changes and save/load; no injected world. */
import assert from 'node:assert/strict'
import {existsSync, mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {chromium, type Page} from 'playwright-core'
import {loadDb} from './loadContent'
import {startNativePreview} from './native-preview'
import {newGame, playerAct, runUntilInput} from '../src/core/game'
import {serialize, stateHash} from '../src/core/save'
import type {World} from '../src/core/ctx'

const out = process.argv[2]
assert.ok(out && !existsSync(out), 'Use a new output directory')
mkdirSync(out, {recursive:true})
const server = await startNativePreview()
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH ?? chromium.executablePath(), args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const rows:unknown[] = [], errors:string[] = []
type Hook = {__ashveil:{world():World}}
let currentPage:Page|undefined
try {
  const {db,report} = loadDb()
  assert.deepEqual(report.errors,[])
  for (const [width,height] of [[1366,768],[390,844]]) {
    const context = await browser.newContext({viewport:{width,height}}), page = await context.newPage()
    currentPage = page
    page.setDefaultTimeout(60000)
    page.on('pageerror',error=>errors.push(error.message))
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text())})
    const seed = 'ashveil-locale-v400', expected:World = {db,s:newGame(db,{seed,background:'Bg.Deserter',mods:db.loadedMods,characterRoll:0,overworld:true,legacyResidents:[]})}
    runUntilInput(expected)
    async function compare(label:string) {
      await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
      await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending && s.fx.length===0})
      const actual = await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
      expected.s.fx = []
      assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)),label)
      const layout = await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,lang:document.documentElement.lang,dialogs:[...document.querySelectorAll<HTMLElement>('.window-shell')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,reachable:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}})}))
      assert.equal(layout.overflow,false,label+' document overflow')
      assert.ok(layout.dialogs.every(dialog=>dialog.reachable),label+' dialog unreachable')
      rows.push({label,width,height,hash:stateHash(actual),time:actual.time,layout})
      await page.screenshot({path:join(out,width+'-'+label+'.png')})
    }
    await page.goto(server.url)
    await page.getByTestId('seed').fill(seed)
    await page.getByRole('button',{name:/탈영 경비병/}).click()
    const personName = await page.locator('.title-passport h3').innerText()
    await page.getByTestId('title-language').selectOption('en')
    assert.match(await page.getByTestId('start').innerText(),/^Enter the Highlands/)
    assert.equal(await page.locator('.title-passport h3').innerText(),personName)
    assert.equal(await page.getByTestId('seed').inputValue(),seed)
    await page.getByTestId('title-language').scrollIntoViewIfNeeded()
    await page.screenshot({path:join(out,width+'-title-en.png')})
    await page.getByTestId('start').click()
    await compare('created-en')
    await page.keyboard.press('F3')
    await page.getByTestId('win-settings').waitFor()
    await compare('settings-en')
    assert.equal(await page.getByTestId('map-zoom').getAttribute('aria-label'),'Map zoom')
    await page.getByTestId('settings-language').selectOption('ko')
    await compare('settings-ko')
    assert.equal(await page.getByTestId('map-zoom').getAttribute('aria-label'),'지도 배율')
    await page.getByTestId('settings-language').selectOption('en')
    await page.getByTestId('keybinding-settings').locator('summary').click()
    assert.equal(await page.getByTestId('key-change-north').getAttribute('aria-label'),'Change key for North')
    await compare('keys-en')
    await page.keyboard.press('Escape')
    assert.equal(await page.getByTestId('win-settings').count(),0)
    await page.keyboard.press('Period')
    assert.equal(playerAct(expected,{type:'wait'}),null)
    await compare('wait-en')
    // Normal autosave/load path. No localStorage/world/clock/seed mutation after creation.
    await page.getByRole('button',{name:'타이틀',exact:true}).click()
    await page.reload()
    assert.equal(await page.getByTestId('title-language').inputValue(),'en')
    await page.getByTestId('continue').click()
    await compare('continued-en')
    await context.close()
  }
  assert.deepEqual(errors,[])
  writeFileSync(join(out,'audit.json'),JSON.stringify({scope:'Fresh real creation and one wait in two viewports. Explicit language/settings changes, translated accessible labels, full independent Node world comparisons and normal autosave/reload. No post-title world injection. English content/log completion is separate.',rows,errors},null,2))
  console.log(JSON.stringify({wholePairs:rows.length,errors}))
} catch (error) {
  await currentPage?.screenshot({path:join(out,'failure.png')}).catch(()=>{})
  writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2))
  throw error
} finally {
  await browser.close()
  server.stop()
}
