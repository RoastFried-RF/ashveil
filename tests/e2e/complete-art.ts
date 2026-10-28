import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {artSceneNames,completeArtFixture} from '../complete-art-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import type {World} from '../../src/core/ctx'
import {serialize} from '../../src/core/save'

const out=process.argv[2]??'test-results/complete-art-browser-v302';mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],rows:unknown[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
let screenshots=0,roundtrips=0,phases=0,actualInputTU=0
const shot=async(name:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
const check=async(w:World,name:string)=>{await idle();w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,name+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,name+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++}
try{
 await page.goto(server.url)
 for(const scene of artSceneNames){
  const d=completeArtFixture(scene),{w}=d,raw=serialize(w.s);writeFileSync(join(out,scene+'-finite-initial.json'),raw)
  await page.evaluate(s=>localStorage.setItem('ashveil.imprint.v1',s),raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(w,scene+'-title-initial')
  if(scene==='inventory'){await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor()}
  await shot('1601-'+scene+'-actual-original-art')
  if(scene==='creatures'){
   for(const[dir,key]of [[0,'Up'],[2,'Right'],[4,'Down'],[6,'Left']]as const){const at=w.s.time;assert.equal(playerAct(w,{type:'face',dir}),null);await page.keyboard.press('Control+Arrow'+key);await check(w,scene+'-real-face-'+dir);actualInputTU+=w.s.time-at}
   await shot('1602-creatures-after-four-real-face-turns')
  }
  if(scene==='inventory')await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(w,scene+'-actual-save-restored');roundtrips++
  if(scene==='inventory'){await page.setViewportSize({width:1366,height:768});await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor();await check(w,'inventory-small-readonly');await shot('1603-small-new-inventory-ui')}
  rows.push(d.proof)
 }
 assert.equal(screenshots,11);assert.equal(roundtrips,9);assert.equal(phases,23);assert.equal(actualInputTU,400);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,actualInputTU,rows,errors,limits:'Nine finite art-only initial scenes; no normal-play acquisition/growth/NPC AI or combat claims. All23 actual/independent expected whole-world pairs exact; four real player face actions, nine actual save restores. Source catalogue separately covers every352 gameplay definition plus26UI.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read().catch(()=>undefined)));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
