import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {soilWaterNativeFixture} from '../soil-water-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {serialize} from '../../src/core/save'
import {drinkVolume} from '../../src/core/wash-water'
import type {World} from '../../src/core/ctx'
import type {Action} from '../../src/core/actions'
const out=process.argv[2]??'test-results/soil-water-browser-v291';mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],rows:unknown[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
let screenshots=0,roundtrips=0,phases=0
const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
const shot=async(name:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
try{
 for(const legacy of[false,true]){
  const d=soilWaterNativeFixture(),w=d.w,start=w.s.time,initial=JSON.parse(serialize(w.s));if(legacy)initial.version=197
  writeFileSync(join(out,legacy?'legacy197-finite-initial.json':'finite198-initial.json'),JSON.stringify(initial))
  const check=async(phase:string)=>{await idle();w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++}
  const act=async(action:Action,input:()=>Promise<unknown>)=>{assert.equal(playerAct(w,action),null);await input();await idle()}
  const restore=async(phase:string)=>{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(phase);roundtrips++}
  if(!legacy)await page.goto(server.url);else{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.setViewportSize({width:1440,height:1080})}
  await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),JSON.stringify(initial));await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(legacy?'legacy197-version-only-no-past-water-transfer':'title198-original-two-dry-soil-plots-and-finite1000ml')
  await page.keyboard.press('F2');const a=page.locator(`[data-crop="${d.a.x},${d.a.y}"]`),b=page.locator(`[data-crop="${d.b.x},${d.b.y}"]`);await a.waitFor();await b.waitFor();assert.match(await a.innerText(),/관수0ml/);assert.match(await b.innerText(),/관수0ml/)
  await shot(legacy?'1425-native-legacy197-two-dry-plots-no-retrospective-water':'1420-native-two-actual-dry-soil-plots-and-real1000ml-water-rule')
  await act({type:'waterCrop',pos:d.a,uid:d.waterUid,ml:1000},()=>a.locator(`[data-testid=crop-water][data-water-uid="${d.waterUid}"]`).click());await check(legacy?'legacy-actual-one-turn-original1000ml-same990and10':'actual-one-turn-original1000ml-water-divides990and10-on-real-boundary');assert.equal(drinkVolume(w,d.bottle()),0);assert.equal(d.status().waterMl,990);assert.equal(d.status(d.b).waterMl,10);assert.equal(d.status().state.growth,0);assert.equal(d.status(d.b).state.growth,0)
  if(!legacy){
   await shot('1421-native-original1000ml-now990and10-no-created-water');await restore('whole198-restored-same-original-water990and10-and-seed-uids');await act({type:'rest',turns:200},()=>page.keyboard.press('r'));await check('actual200turn-water-now980and20-no-growth-or-rain-or-evaporation');assert.equal(d.status().waterMl,980);assert.equal(d.status(d.b).waterMl,20);await page.keyboard.press('F2');await shot('1422-native-actual200turn-slow-soil-water980and20');await restore('whole198-restored-same980and20-and-original-three-crop-items');await page.setViewportSize({width:1366,height:768});await page.keyboard.press('F2');await check('small-viewport-observation-whole-world-unchanged');await shot('1423-native-small-screen-real-soil-water-rule-and-original980and20');await close();await page.keyboard.press('i');await check('actual-inventory-observation-original-seed-bag-root-and-whitecap');await shot('1424-native-three-original-crop-item-icons-and-original-empty-bottle');assert.equal(w.s.time-start,20100)
  }else{
   await restore('whole198-restored-legacy197-real-water-input990and10');await page.keyboard.press('F2');await shot('1426-native-legacy197-real-input198-restored990and10');assert.equal(w.s.time-start,100)
  }
  rows.push({legacy,initialTime:start,finalTime:w.s.time,actualInputTU:w.s.time-start,seedUid:d.seedsUid,originalWaterUid:d.waterUid,rootUid:d.root.uid,whitecapUid:d.whitecap.uid,sourceWaterMl:d.status().waterMl,targetWaterMl:d.status(d.b).waterMl,ownBottleMl:drinkVolume(w,d.bottle())})
 }
 assert.equal(screenshots,7);assert.equal(roundtrips,3);assert.equal(phases,10);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,actualInputTU:20200,rows,errors,source:'Finite two actual same-batch-seed plots placed through publicCore, roof/light0 to isolate water/no growth/evaporation/rain, declared time199-of200 and matching nextAct/lastAt not a past weather replay, original1000ml bottle/one remaining seed/root/whitecap. Actual TitleContinue/F2 water1T/whole198restore/rest200T/smallviewport/inventory. Legacy197 compatibility header on same finite fixture isolates version-only migration, not an original historical user save.10 independent WHOLE Node comparisons/3whole198restores; no post-load world/material/time/RNG injection.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU:20200,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
