import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {seasonalProductionNativeFixture} from '../seasonal-production-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {serialize} from '../../src/core/save'
import type {World} from '../../src/core/ctx'
const out=process.argv[2]??'test-results/seasonal-production-browser-v294';mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],rows:unknown[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
let screenshots=0,roundtrips=0,phases=0,actualInputTU=0
const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
const shot=async(name:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
try{
 for(const mode of['autumn','winter','legacy198']as const){
  const d=seasonalProductionNativeFixture(mode!=='autumn'),w=d.w,start=w.s.time,original=d.food(),initial=JSON.parse(serialize(w.s));if(mode==='legacy198')initial.version=198
  writeFileSync(join(out,mode+'-finite-initial.json'),JSON.stringify(initial))
  const check=async(phase:string)=>{await idle();w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++}
  const society=async()=>{await close();await page.keyboard.press('Shift+n');await page.getByTestId('win-society').waitFor();await page.locator('[data-person-id="'+d.trader.id+'"]').click();await page.getByTestId('seasonal-food-production').waitFor();assert.match(await page.getByTestId('seasonal-food-production').innerText(),mode==='autumn'?/가을.*×2\.3/:/겨울.*×0\.2/);await page.getByTestId('seasonal-food-production').scrollIntoViewIfNeeded()}
  const restore=async(phase:string)=>{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(phase);roundtrips++}
  if(mode==='autumn')await page.goto(server.url);else{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.setViewportSize({width:1440,height:1080})}
  await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),JSON.stringify(initial));await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await society();await check(mode+'-title-initial-original-stock-not-refilled-or-retroproduced')
  if(mode==='autumn'){
   await shot('1441-native-autumn-village-food-policy-original-finite-shop');await close();await page.keyboard.press('i');await shot('1442-native-original-hunting-bow64-and-spare-bow-string32-in-actual-bag')
   await page.getByTestId('item-Item.Bow').click({button:'right'});assert.equal(playerAct(w,{type:'equip',uid:d.bow.uid}),null);await page.getByRole('button',{name:'장착',exact:true}).click();await check('autumn-actual-bow-equip-one-turn-crosses-real-daily-production');await shot('1443-native-actual-original-bow-equipped-and-original-spare-string-preserved');await restore('autumn-whole199-restored-same-original-items-and-food');await society();await shot('1444-native-autumn-after-actual-day-production-and-original-resident-credit')
  }else{
   await shot(mode==='winter'?'1445-native-winter-village-food-policy-original-finite-stock':'1448-native-legacy198-same-finite-winter-stock-without-retrospective-production');await close();assert.equal(playerAct(w,{type:'wait'}),null);await page.keyboard.press('Period');await check(mode+'-actual-one-turn-completed-winter-day-original-finite-food');if(mode==='winter'){await page.setViewportSize({width:1366,height:768});await society();await shot('1446-native-small-winter-after-actual-finite-day-summary')}
   await restore(mode+'-whole199-restored-same-winter-food-and-original-items');if(mode==='winter'){await page.keyboard.press('i');await shot('1447-native-small-whole199-restored-original-bow64-and-spare-string32')}else{await society();await shot('1449-native-legacy198-actual-winter-day-and-whole199-restoration')}
  }
  assert.equal(w.s.time-start,100);actualInputTU+=100;assert.ok(Math.abs(d.food()-original-d.expectedFoodDelta)<1e-7);assert.equal(d.p.money,1000)
  rows.push({...d.proof,mode,expectedFoodDelta:d.expectedFoodDelta,actualFoodAfter:d.food(),actualFoodDelta:d.food()-original,regionalPriceFactorAfter:d.price(),actualInputTU:100,bowUid:d.bow.uid,stringUid:d.string.uid})
 }
 assert.equal(screenshots,9);assert.equal(roundtrips,3);assert.equal(phases,9);assert.equal(actualInputTU,300);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,actualInputTU,rows,errors,source:'Finite actualnewGame/leave+enterRegionoriginaltown/shop/player/bow/string withdeclarednear-day-boundary day0or11/pausedNPCs/light; originalactualresidentconsumption ledger retained, not prior11days/weather/travel replay. ActualTitleContinue/society/inventory/equip1T orPeriod1T/whole199restores/small. Legacy198header on same currentfinitewinterfixture isolatesversiononlycompatibility, not historicaluser-save.9independentNodewholecomparisons; nopostloadworld/material/time/RNG injection. Tradepolicy+actualreserve/marketFood conservation, no literalprice-rounding-change promise.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
