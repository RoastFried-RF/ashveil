/** Real gameplay inputs in three viewports, with independent full-world expectations. */
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {chromium,type Page} from 'playwright-core'
import {loadDb} from './loadContent'
import {startNativePreview} from './native-preview'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {serialize,stateHash} from '../src/core/save'
import type {World} from '../src/core/ctx'

const out=process.argv[2]
assert.ok(out&&!existsSync(out),'Use a new output directory')
mkdirSync(out,{recursive:true})
const server=await startNativePreview()
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const rows:unknown[]=[],errors:string[]=[]
type Hook={__ashveil:{world():World}}
let active:Page|undefined
try {
  const {db,report}=loadDb();assert.deepEqual(report.errors,[])
  for(const [width,height] of [[1440,1080],[1366,768],[390,844]]) {
    const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page
    page.setDefaultTimeout(60000)
    page.on('pageerror',error=>errors.push(error.message))
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
    const seed='ashveil-locale-v401',expected:World={db,s:newGame(db,{seed,background:'Bg.Deserter',mods:db.loadedMods,characterRoll:0,overworld:true,legacyResidents:[]})}
    runUntilInput(expected)
    async function compare(label:string) {
      await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
      await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0})
      const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
      expected.s.fx=[] // The normal renderer has consumed presentation-only FX in the browser.
      assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)),label)
      const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,lang:document.documentElement.lang,dialogs:[...document.querySelectorAll<HTMLElement>('.window-shell')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,reachable:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}}),hud:(()=>{const r=document.querySelector('[data-testid=hud]')!.getBoundingClientRect();return {x:r.x,right:r.right,bottom:r.bottom}})()}))
      assert.equal(layout.overflow,false,label+' document overflow')
      assert.ok(layout.dialogs.every(dialog=>dialog.reachable),label+' window unreachable')
      assert.ok(layout.hud.x>=0&&layout.hud.right<=width+1&&layout.hud.bottom<=height+1,label+' HUD unreachable')
      rows.push({label,width,height,hash:stateHash(actual),time:actual.time,layout})
      await page.screenshot({path:join(out,width+'-'+label+'.png')})
    }
    await page.goto(server.url)
    await page.getByTestId('seed').fill(seed)
    await page.getByRole('button',{name:/탈영 경비병/}).click()
    const name=await page.locator('.title-passport h3').innerText()
    await page.getByTestId('title-language').selectOption('en')
    await page.getByTestId('start').click()
    await compare('created-en')
    assert.match(await page.getByTestId('hp-bar').innerText(),/^Health /)
    assert.equal(await page.getByTestId('sidebars').getAttribute('aria-label'),'Survival status')
    assert.match(await page.getByTestId('need-hunger').innerText(),/Hunger/)
    assert.equal(await page.locator('.hud-name').innerText(),name)
    await page.getByTestId('btn-char').click()
    assert.equal(await page.getByTestId('win-char').getAttribute('aria-label'),'Character')
    assert.match(await page.getByTestId('win-char').innerText(),/Deserter/)
    await compare('character-en')
    await page.keyboard.press('Escape')
    await page.getByTestId('btn-abil').click()
    assert.equal(await page.getByTestId('win-abil').getAttribute('aria-label'),'Abilities')
    await page.keyboard.down('Shift')
    await page.getByTestId('ab-Ab.Blunt.Shove').hover()
    assert.match(await page.getByTestId('tooltip').innerText(),/Knockdown 50%/)
    await compare('locked-formula-en')
    await page.keyboard.up('Shift')
    await page.getByTestId('ab-Ab.Survival.Breath').click()
    assert.equal(playerAct(expected,{type:'learn',id:'Ab.Survival.Breath'}),null)
    await compare('learned-en')
    assert.match(await page.getByTestId('ab-Ab.Survival.Breath').getAttribute('aria-label')??'',/Catch Breath.*Learned/)
    await page.keyboard.press('ArrowDown')
    await compare('window-focus-en')
    await page.keyboard.press('Escape')
    await page.keyboard.press('F3')
    await page.getByTestId('settings-language').selectOption('ko')
    await page.keyboard.press('Escape')
    assert.match(await page.getByTestId('hp-bar').innerText(),/^체력 /)
    await page.getByTestId('btn-char').click()
    assert.equal(await page.getByTestId('win-char').getAttribute('aria-label'),'캐릭터')
    assert.equal(await page.locator('.hud-name').innerText(),name)
    await compare('character-ko')
    await page.keyboard.press('Escape')
    await page.getByTestId('btn-abil').click()
    assert.match(await page.getByTestId('ab-Ab.Survival.Breath').getAttribute('aria-label')??'',/^숨 고르기/)
    await compare('abilities-ko')
    await page.keyboard.press('Escape')
    await page.keyboard.press('F3')
    await page.getByTestId('settings-language').selectOption('en')
    await page.keyboard.press('Escape')
    await page.getByRole('button',{name:'? Controls',exact:true}).click()
    assert.ok(await page.getByRole('dialog',{name:'Controls',exact:true}).isVisible())
    assert.doesNotMatch(await page.getByRole('dialog',{name:'Controls',exact:true}).innerText(),/[가-힣]/)
    await compare('help-en')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Period')
    assert.equal(playerAct(expected,{type:'wait'}),null)
    await compare('wait-en')
    await page.getByTestId('btn-crouch').click()
    assert.equal(playerAct(expected,{type:'crouch'}),null)
    assert.match(await page.getByTestId('btn-crouch').getAttribute('aria-label')??'',/Current posture: Crouched/)
    await compare('crouch-en')
    await page.getByRole('button',{name:'Title',exact:true}).click()
    await page.getByTestId('title-language').waitFor()
    await page.reload()
    assert.equal(await page.getByTestId('title-language').inputValue(),'en')
    await page.getByTestId('continue').click()
    await compare('continued-en')
    assert.equal(await page.locator('.hud-name').innerText(),name)
    assert.equal(await page.getByTestId('hotbar').getByRole('button',{name:/Catch Breath/}).count(),1)
    await context.close()
  }
  assert.deepEqual(errors,[])
  writeFileSync(join(out,'audit.json'),JSON.stringify({scope:'Fresh creation; actual character/ability/help/settings input, ability learning, focus suppression, wait, crouch and normal autosave/load in three viewports. Independent Node whole-state expectations. No post-title world injection. Remaining windows/logs/content are separate.',rows,errors},null,2))
  console.log(JSON.stringify({wholePairs:rows.length,errors}))
} catch(error) {
  await active?.screenshot({path:join(out,'failure.png')}).catch(()=>{})
  writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2))
  throw error
} finally {await browser.close();server.stop()}
