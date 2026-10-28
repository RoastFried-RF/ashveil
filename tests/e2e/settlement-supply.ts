import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {settlementSupplyNativeFixture} from '../settlement-supply-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {serialize} from '../../src/core/save'
import {localSettlementSupply} from '../../src/core/settlement-supply'
import type {World} from '../../src/core/ctx'

const out=process.argv[2]??'test-results/settlement-supply-browser-v297';mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],rows:unknown[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
let screenshots=0,roundtrips=0,phases=0,actualInputTU=0
const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
const shot=async(name:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
const panel=async()=>{await close();await page.keyboard.press('Shift+n');await page.getByTestId('resident-depot').waitFor();await page.getByTestId('resident-depot').scrollIntoViewIfNeeded()}
const check=async(w:World,name:string)=>{await idle();w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,name+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,name+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++}
const restore=async(w:World,name:string)=>{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(w,name);roundtrips++;await panel()}
try{
 await page.goto(server.url)
 for(const mode of['shortage','normal','legacy200']as const){
  const d=settlementSupplyNativeFixture(mode!=='normal'),w=d.w,start=w.s.time,initial=JSON.parse(serialize(w.s));if(mode==='legacy200')initial.version=200
  writeFileSync(join(out,mode+'-finite-initial.json'),JSON.stringify(initial))
  if(mode!=='shortage'){await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.setViewportSize({width:1440,height:1080})}
  await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),JSON.stringify(initial));await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await panel();await check(w,mode+'-actual-title-no-retroactive-ledger')
  assert.match(await page.getByTestId('depot-supply-unrecorded').innerText(),/기록/)
  await shot(mode==='shortage'?'1470-native-low-original-food-reserve-and-separate-market-before-real-day':mode==='normal'?'1473-native-full-actual-town-food-and-no-retrospective-ledger':'1475-native-legacy200-same-finite-low-food-no-retrospective-ledger')
  if(mode==='shortage')await check(w,'shortage-quote-and-public-observation-whole-state-pure')
  await close();assert.equal(playerAct(w,{type:'wait'}),null);await page.keyboard.press('Period');await check(w,mode+'-actual-one-turn-daily-supply');await panel()
  const view=localSettlementSupply(w)!,line=view.lastSupply!.commodities.Food!
  assert.equal(d.market.items.find(i=>i.uid===d.proof.originalUncountedEggs.uid)?.count,d.proof.originalUncountedEggs.count)
  assert.equal(view.lastSupply!.day,0);assert.equal(w.s.time-start,100);assert.equal(line.requested,Math.floor(180-d.proof.actualResidentCredit+d.proof.actualConsumptionCarry+1e-9));assert.equal(line.residentUsed,d.proof.actualResidentCredit)
  if(mode==='normal'){assert.equal(line.produced,368);assert.equal(line.unmet,0);assert.equal(line.supplied,line.requested);assert.equal(view.status,'full');await page.getByTestId('depot-food-met').waitFor()}
  else{assert.equal(line.produced,0);assert.equal(line.supplied,1.67);assert.ok(Math.abs(line.unmet-(line.requested-1.67))<1e-8);assert.equal(view.status,'empty');assert.equal(view.food,0);assert.equal(view.marketRationFood,0);await page.getByTestId('depot-food-unmet').waitFor()}
  await shot(mode==='shortage'?'1471-native-actual-empty-food-and-recorded-unmet-demand':mode==='normal'?'1474-native-actual-autumn-production-and-resident-credit-supply-ledger':'1476-native-legacy200-actual-first201-ledger-original-finite-food-consumed')
  await restore(w,mode+'-whole201-restored-same-actual-supply-and-original-items')
  if(mode!=='normal'){await page.setViewportSize({width:1366,height:768});await panel();await check(w,mode+'-small-same-public-supply');await shot(mode==='shortage'?'1472-native-small-whole201-restored-empty-basket-and-actual-unmet-ledger':'1477-native-small-legacy200-to201-restored-same-finite-food-ledger')}
  rows.push({...d.proof,mode,finalView:view,actualInputTU:100,hardtackUid:d.hardtack.uid,hardtackRemaining:d.market.items.find(i=>i.uid===d.hardtack.uid)?.count??0});actualInputTU+=100
 }
 assert.equal(screenshots,8);assert.equal(roundtrips,3);assert.equal(phases,12);assert.equal(actualInputTU,300);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,actualInputTU,rows,errors,source:'Three finite actualgeneratedtown/depot/shop scenes, declared shortage reserve/stock/production, actual initialresidentcredit. ActualTitleContinue/n/quote/Period1T/whole201restores/small,12independentNodewholepairs. Legacy200header is same currentfinite shortage scene, not historical userfile. No postloadworld/time/RNG/material injection; nofamine/migration/deathclaim.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
