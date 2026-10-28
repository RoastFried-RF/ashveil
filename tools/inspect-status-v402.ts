/** Declared low-HP fixture; actual acknowledgment, language controls, movement and load. */
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {chromium,type Page} from 'playwright-core'
import {loadDb} from './loadContent'
import {startNativePreview} from './native-preview'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {player,terrainAt,type World} from '../src/core/ctx'
import {DIRS} from '../src/core/geom'
import {serialize,stateHash} from '../src/core/save'

const out=process.argv[2];assert.ok(out&&!existsSync(out),'Use a new output directory');mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const rows:unknown[]=[],errors:string[]=[]
type Hook={__ashveil:{world():World}}
let active:Page|undefined
try {
  const {db,report}=loadDb();assert.deepEqual(report.errors,[])
  for(const [width,height] of [[1440,1080],[1366,768],[390,844]]) {
    const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
    const w:World={db,s:newGame(db,{seed:'ashveil-status-v402',background:'Bg.Deserter',mods:db.loadedMods,characterRoll:0,overworld:true,legacyResidents:[]})};runUntilInput(w)
    // Controlled initial condition only. No wound history or prior low-HP play is claimed.
    const p=player(w);p.hp=10
    const raw=serialize(w.s);writeFileSync(join(out,width+'-initial-world.json'),raw)
    const keys=['ArrowUp','PageUp','ArrowRight','PageDown','ArrowDown','End','ArrowLeft','Home']
    const dir=DIRS.findIndex((d,i)=>{if(i%2)return false;const pos={x:p.pos.x+d.x,y:p.pos.y+d.y};return terrainAt(w,pos).passable&&!w.s.creatures.some(c=>c.alive&&c.pos.x===pos.x&&c.pos.y===pos.y)})
    assert.ok(dir>=0);assert.ok([0,2,4,6].includes(dir),'Use a cardinal key binding in this fixture')
    async function compare(label:string) {
      await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
      await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0})
      const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
      assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      rows.push({label,width,height,time:actual.time,hash:stateHash(actual),pos:player({db,s:actual}).pos})
      await page.getByRole('button',{name:/^(설정|Settings) \(F3\)$/}).hover()
      await page.screenshot({path:join(out,width+'-'+label+'.png')})
    }
    await page.goto(server.url)
    await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw)
    await page.reload();await page.getByTestId('continue').click()
    await compare('loaded-critical-ko')
    assert.match(await page.getByTestId('banners').innerText(),/HP 10 — 위독/)
    assert.match(await page.getByTestId('mini-body').getAttribute('aria-label')??'',/^신체 상태:/)
    await page.keyboard.press(keys[dir]) // First movement only acknowledges the existing fatal warning.
    await compare('acknowledged-ko')
    await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption('en');await page.keyboard.press('Escape')
    assert.match(await page.getByTestId('banners').innerText(),/HP 10 — critical/)
    assert.match(await page.getByTestId('status-strip').innerText(),/Day 1 /)
    assert.match(await page.getByTestId('mini-body').getAttribute('aria-label')??'',/^Body status:/)
    await compare('critical-en')
    // A language change must not create another acknowledgment barrier.
    await page.keyboard.press(keys[dir]);assert.equal(playerAct(w,{type:'move',dir}),null)
    await compare('moved-once-en')
    await page.getByRole('button',{name:'Title',exact:true}).click();await page.getByTestId('title-language').waitFor();await page.reload();await page.getByTestId('continue').click()
    await compare('continued-en')
    await context.close()
  }
  assert.deepEqual(errors,[])
  writeFileSync(join(out,'audit.json'),JSON.stringify({declaredFixture:'Fresh original world with only initial player HP set to 10. No past injury/play claimed.',postTitleWorldWrites:false,rows,errors},null,2))
  console.log(JSON.stringify({wholePairs:rows.length,errors}))
} catch(error) {await active?.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2));throw error}
finally {await browser.close();server.stop()}
