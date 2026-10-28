import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {transactionThreatNativeFixture,type TransactionThreatPhase} from '../transaction-threat-fixture'
import {activeThoughts} from '../../src/core/thoughts'
const outDir=process.argv[2]??'test-results/transaction-threat-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World;refresh():void}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas')
 const check=await p.evaluate(s=>{const h=(window as unknown as Hook).__ashveil;h.world().s=s;const before=JSON.parse(JSON.stringify(h.world().s));h.refresh();return{before,after:JSON.parse(JSON.stringify(h.world().s))}},w.s)
 assert.deepEqual(check.before,JSON.parse(JSON.stringify(w.s)));assert.deepEqual(check.after,check.before);await p.waitForTimeout(100);assert.equal((await read(p)).time,w.s.time);return p
}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:outDir+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));assert.deepEqual(after,before)}
let page:Page|undefined
try{
 const phases:TransactionThreatPhase[]=['trade','quote','ordinary','surrounded','two','pending'],shots=[
 '666-native-real-one-turn-bargain-and-one-turn-transaction-buy-original-apple-for-eighteen-instead-of-nineteen-and-give-three-mood',
 '667-native-actual-bargain-and-price-quote-without-transaction-do-not-move-wallet-or-create-good-trade-memory',
 '668-native-real-undiscounted-nineteen-price-purchase-moves-original-apple-without-good-trade-memory',
 '669-native-three-real-visible-reachable-adjacent-awake-hostiles-give-minus-six-surrounded-condition',
 '670-native-only-two-real-adjacent-hostiles-do-not-give-surrounded-condition',
 '671-native-pending-original-negotiated-transaction-rest-resumes-nineteen-turns-with-same-apple-wallet-market-and-memory']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=transactionThreatNativeFixture(phase);assert.equal(d.proof.actualTurns,[2,1,1,1,1,3][i]);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},good=activeThoughts(w,p).find(t=>t.def==='Thought.GoodTrade'),surrounded=activeThoughts(w,p).find(t=>t.def==='Thought.Surrounded'),proof=d.proof.purchase
  assert.equal(s.nextId,d.s.nextId)
  if(phase==='trade'||phase==='pending'){assert.ok(good);assert.equal(good.mood,3);assert.equal(good.count,1);assert.equal(good.remaining,phase==='pending'?57579:57599)}else assert.equal(good,undefined)
  if(phase==='surrounded'){assert.ok(surrounded);assert.equal(surrounded.mood,-6);assert.equal(d.proof.enemies!.length,3)}else assert.equal(surrounded,undefined)
  if(proof){assert.equal(proof.original.uid,1099511627777);assert.equal(proof.original.count,12);assert.equal(proof.original.def,'Item.DriedApple');const bought=p.bag.find(i=>i.uid===proof.expectedUid),market=s.overworld!.markets![s.creatures.find(c=>c.id===47)!.traderSite!]!,stock=market.items.find(i=>i.uid===proof.original.uid)!;assert.equal(stock.count,proof.purchased?11:12);assert.equal(p.money,phase==='quote'?1000:phase==='ordinary'?981:982);assert.equal(market.money,phase==='quote'?300:phase==='ordinary'?319:318);assert.equal(proof.quoted,phase==='ordinary'?19:18);assert.equal(proof.undiscounted,19);assert.equal(proof.expectedUid,85);if(proof.purchased){assert.ok(bought);assert.equal(bought.def,'Item.DriedApple');assert.equal(bought.count,1)}else assert.equal(bought,undefined)}
  await close(page);const show=good??surrounded;if(show){await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();await page.getByTestId('thought-'+show.def).scrollIntoViewIfNeeded()}else if(proof){await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor()}
  await shot(page,shots[i]!);await restore(page,'same-real-transaction-threat-'+phase);rows.push({phase,proof:d.proof,good,surrounded,actualTime:s.time,actualBag:p.bag,actualMoney:p.money,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,originalStockUid:1099511627777,originalStockBefore:12,actualPurchasedSplitUid:85,actualStockAfter:11,actualBargainTurns:1,actualPurchaseTurns:1,actualUndiscountedPrice:19,actualNegotiatedPrice:18,actualPendingTurns:19,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six actual negotiated purchase/quote/undiscounted and three/two threats/pending scenes;original stock12to11/split85/cash982market318;pending19T whole exact;sixwhole103/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
