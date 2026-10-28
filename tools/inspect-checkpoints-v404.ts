/** English review/cancel/restore controls with original finite checkpoints and real inputs. */
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {chromium,type Page} from 'playwright-core'
import {startNativePreview} from './native-preview'
import {loadDb} from './loadContent'
import {checkpointFixture} from '../tests/checkpoint-fixture'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {player,type World} from '../src/core/ctx'

const out=process.argv[2];assert.ok(out&&!existsSync(out));mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
type Hook={__ashveil:{world():World}}
const rows:unknown[]=[],fixtures:unknown[]=[],errors:string[]=[];let active:Page|undefined
try{
 const {db,report}=loadDb();assert.deepEqual(report.errors,[])
 for(const [width,height]of [[1440,1080],[1366,768],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  let w:World={db,s:newGame(db,{seed:'ashveil-checkpoints-v404',background:'Bg.Deserter',mods:db.loadedMods,characterRoll:0,overworld:true,saveMode:'SaveMode.Study',legacyResidents:[]})};runUntilInput(w)
  async function compare(label:string,capture=true){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
   await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   rows.push({label,width,height,time:actual.time,hash:stateHash(actual)})
   if(capture)await page.screenshot({path:join(out,width+'-'+label+'.png')})
  }
  async function save(label:string){
   await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await compare(label+'-confirm',false)
   const raw=serialize(w.s);await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();assert.match(await page.getByTestId('checkpoint-save-status').innerText(),/^Checkpoint saved\./)
   await compare(label+'-saved');await page.keyboard.press('Escape');return raw
  }
  async function restore(raw:string,label:string){
   await page.getByTestId('content-change-accept').waitFor()
   assert.match(await page.getByTestId('checkpoint-dialog').getAttribute('aria-label')??'',/^Restore checkpoint$/)
   assert.doesNotMatch(await page.getByTestId('content-change-review').innerText(),/[가-힣]/)
   await compare(label+'-review');await page.getByTestId('content-change-accept').click();await page.getByTestId('checkpoint-dialog').waitFor({state:'detached'});w={db:w.db,s:deserialize(raw)}
   await compare(label+'-restored')
  }
  await page.goto(server.url);await page.getByTestId('seed').fill('ashveil-checkpoints-v404');await page.getByRole('button',{name:/탈영 경비병/}).click();await page.getByTestId('save-mode').selectOption('SaveMode.Study');await page.getByTestId('title-language').selectOption('en');await page.getByTestId('start').click();await compare('new-study')
  await page.keyboard.press('F3');const live=page.getByTestId('live-content-reload');await live.locator('summary').first().click();await page.getByTestId('live-content-review').click();await page.getByTestId('content-change-accept').waitFor();assert.doesNotMatch(await page.getByTestId('content-change-review').innerText(),/[가-힣]/);await compare('live-review-readonly');await page.getByTestId('content-change-cancel').click();await compare('live-cancel-readonly',false);await page.keyboard.press('Escape')
  const originalName=player(w).name,saved=await save('study')
  await page.keyboard.press('Period');assert.equal(playerAct(w,{type:'wait'}),null);await compare('study-wait',false)
  await page.keyboard.press('F3');await page.getByTestId('checkpoint-load').click();await page.getByTestId('content-change-accept').waitFor();await page.keyboard.press('Tab');assert.ok(await page.getByTestId('checkpoint-dialog').evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('ArrowLeft');await page.keyboard.press('Period');await compare('review-blocks-turn',false)
  const dialog=page.getByTestId('checkpoint-dialog');await dialog.locator('details > summary').click();await dialog.locator('input[value="sample-selector"]').check()
  assert.equal(await page.getByTestId('content-change-accept').count(),0);await page.getByTestId('checkpoint-review-mods').click();await page.getByTestId('content-change-accept').waitFor();assert.match(await page.getByTestId('content-change-review').innerText(),/sample-selector/)
  await compare('changed-selection-review');await page.keyboard.press('Escape');await compare('cancel-retains-current',false)
  await page.getByTestId('checkpoint-load').click();await restore(saved,'study')
  assert.equal(player(w).name,originalName);await page.keyboard.press('Escape');await page.getByRole('button',{name:'Title',exact:true}).click();await page.getByTestId('title-checkpoint-SaveMode.Study').waitFor()
  assert.match(await page.getByTestId('title-checkpoints').innerText(),/seed ashveil-checkpoints-v404 · turn /)
  await page.getByTestId('title-checkpoint-SaveMode.Study').click();await restore(saved,'title-study')
  await page.reload();await page.getByTestId('continue').click();await compare('continued-study',false)
  // Explicit finite Waymark scene with its original lit campfire. No past travel is claimed.
  await page.getByRole('button',{name:'Title',exact:true}).click();const f=checkpointFixture('SaveMode.Waymark');w=f.w;fixtures.push({width,mode:'SaveMode.Waymark',initialHP:player(w).hp,initialCampfire:true,lethal:false})
  const raw=serialize(w.s);writeFileSync(join(out,width+'-waymark-initial-world.json'),raw);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('waymark-initial',false)
  const mark=await save('waymark');await page.keyboard.press('ArrowLeft');assert.equal(playerAct(w,{type:'move',dir:6}),null);await page.keyboard.press('ArrowLeft');assert.equal(playerAct(w,{type:'move',dir:6}),null)
  await page.keyboard.press('F3');assert.equal(await page.getByTestId('checkpoint-save').isDisabled(),true);assert.match(await page.getByTestId('checkpoint-unavailable').innerText(),/Leave a waymark beside/);await compare('waymark-away')
  await page.getByTestId('checkpoint-load').click();await restore(mark,'waymark');await page.keyboard.press('Escape')
  await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({scope:'Fresh actual Study creation and save; real wait, modal blocking, changed-mod review revocation, cancellation and original whole-state restoration; Title checkpoint and reload continuation; declared finite Waymark campfire, real movement out of range and restoration. No natural campfire acquisition, death or human evaluation claimed.',postTitleWorldWrites:false,rows,fixtures,errors},null,2));console.log(JSON.stringify({wholePairs:rows.length,errors}))
}catch(error){await active?.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2));throw error}
finally{await browser.close();server.stop()}
