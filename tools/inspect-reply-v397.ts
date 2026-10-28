/** Interrupted INITIAL physical work, real cancel/reception/notes/save UI and independent whole Worlds. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {spireFixture} from '../tests/spire-fixture'
import {playerAct} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {fieldDeviceAt} from '../src/core/field-devices'
import type {World} from '../src/core/ctx'
type Hook={__ashveil:{world():World}}
const[out,url]=process.argv.slice(2);assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[];page.setDefaultTimeout(120000);let current='start'
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(w:World,label:string){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(t=>{const s=(window as unknown as Hook).__ashveil.world().s;return!s.simulationPending&&s.time===t},w.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)})}
async function field(){await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click()}
try{
 await page.goto(url)
 for(const[width,height]of[[1366,768],[390,844]]){
  current=String(width);const d=spireFixture();for(const operation of ['repair','transmit'])assert.equal(playerAct(d.w,{type:'deviceWork',pos:d.pos,uid:d.device.uid,operation}),null)
  assert.equal(playerAct(d.w,{type:'deviceWork',pos:d.pos,uid:d.device.uid,operation:'receive'},300000,d.s.time+600),null);assert.equal(playerAct(d.w,{type:'stopActivity'}),null);assert.equal(d.device.work!.progress,7);assert.equal(d.p.activity,undefined)
  const initial=serialize(d.s),w:World={db:d.w.db,s:deserialize(initial)};writeFileSync(join(out,current+'-initial.json'),initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},initial);await page.reload();await page.getByTestId('continue').click();await compare(w,current+'-loaded')
  await field();await page.locator('[data-device-operation=receive]').scrollIntoViewIfNeeded();assert.ok((await page.locator('[data-device-operation=receive]').innerText()).includes('113턴'));assert.ok((await page.locator('[data-device-operation=stop]').innerText()).includes('120턴'));await compare(w,current+'-review');await page.screenshot({path:join(out,current+'-partial.png')});await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,current+'-partial-continued');await field()
  await page.locator('[data-device-cancel]').click();assert.equal(playerAct(w,{type:'deviceCancel',pos:d.pos,uid:d.device.uid}),null);await compare(w,current+'-reservation-cancelled');assert.equal(fieldDeviceAt(w,d.pos)!.energy,70);assert.equal(fieldDeviceAt(w,d.pos)!.work,undefined)
  await page.locator('[data-device-operation=receive]').click();assert.equal(playerAct(w,{type:'deviceWork',pos:d.pos,uid:d.device.uid,operation:'receive'}),null);await page.locator('[data-device-completed=receive]').waitFor();await compare(w,current+'-received');assert.equal(fieldDeviceAt(w,d.pos)!.energy,60);assert.ok(w.s.creatures.find(c=>c.id===w.s.playerId)!.bag.some(i=>i.uid===d.plate.uid&&i.count===1));await page.screenshot({path:join(out,current+'-received.png')});await page.keyboard.press('Escape')
  await page.keyboard.press('Shift+J');await page.getByTestId('win-journal').getByRole('button',{name:'실마리',exact:true}).click();const label=page.getByRole('heading',{name:'자동 상태 회신과 남은 의문',exact:true});await label.scrollIntoViewIfNeeded();await compare(w,current+'-research-readonly');await page.screenshot({path:join(out,current+'-research.png')});await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,current+'-received-continued');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.getByRole('button',{name:'타이틀',exact:true}).click()
  runs.push({width,height,finiteInitialActualInterruptedProgress:7,originalPlateUID:d.plate.uid,actualCancelAndReceive:true,energy:[70,70,60],partialAndCompletedTitleRestore:true,personalResearchReadOnly:true})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,postTitleWorldWrites:false,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),runs,pairs,errors},null,2));writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());throw error}finally{await browser.close()}
