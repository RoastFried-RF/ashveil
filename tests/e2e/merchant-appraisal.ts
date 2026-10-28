import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {merchantAppraisalNativeFixture,type MerchantAppraisalPhase} from '../merchant-appraisal-fixture'
import {activeThoughts} from '../../src/core/thoughts'
const outDir=process.argv[2]??'test-results/merchant-appraisal-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:MerchantAppraisalPhase[]=['quote','lie','refuted','honest','staleFee','pending'],shots=[
 '696-native-real-appraisal-panel-button-pays-original-three-fee-and-preserves-owned-pill-stack-whole-equal-to-public-headless-action',
 '697-native-real-default-policy-paid-false-merchant-claim-stays-likely-without-premature-tricked-memory',
 '698-native-original-paid-claim-refuted-by-actual-six-turn-own-identification-creates-one-three-day-tricked-memory',
 '699-native-real-default-policy-honest-merchant-claim-and-own-identification-pay-same-fee-without-tricked-memory',
 '700-native-stale-appraisal-fee-request-is-atomic-with-original-money-pill-stack-time-and-knowledge',
 '701-native-original-paid-claim-and-incomplete-identification-five-more-real-turns-after-save-whole-exact']
 const rows:unknown[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=await merchantAppraisalNativeFixture(phase);assert.equal(d.proof.actualTurns,[0,1,7,7,0,2][i]);assert.equal(d.proof.fee,3);page=await initial(d.w)
  let pendingTurns:number|undefined,actualUiTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(phase==='quote'){
   await page.getByRole('button',{name:/주민·세력/}).click();await page.getByTestId('win-society').waitFor();await page.locator('[data-person-id="'+d.trader.id+'"]').click();await page.getByTestId('appraisal-panel').waitFor();const button=page.getByTestId('appraise-'+d.pill.uid);await button.scrollIntoViewIfNeeded();assert.ok(await button.isEnabled())
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};queues={before:expected.s.fx.splice(0),after:[]};assert.equal(playerAct(expected,{type:'merchantIdentify',target:d.trader.id,uid:d.pill.uid,expectedFee:3}),null);queues.after=expected.s.fx.splice(0);await button.click();await page.waitForFunction(t=>(window as unknown as Hook).__ashveil.world().s.time>t,before.time);await idle(page);await page.waitForTimeout(300);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/actual-ui-appraisal-expected.json',JSON.stringify(want));writeFileSync(outDir+'/actual-ui-appraisal-world.json',JSON.stringify(actual));assert.deepEqual(actual,want);actualUiTurns=(actual.time-before.time)/100;assert.equal(actualUiTurns,1)
  }
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,5);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},memory=activeThoughts(w,p).find(t=>t.def==='Thought.Tricked'),pill=p.bag.find(i=>i.uid===d.pill.uid)!,receipts=s.knowledge.appraisalReceipts,market=s.overworld!.markets![s.creatures.find(c=>c.id===d.trader.id)!.traderSite!]!
  assert.equal(s.nextId,d.s.nextId);assert.deepEqual(pill,JSON.parse(JSON.stringify(d.proof.originalPill)));assert.equal(pill.count,3);assert.equal(pill.def,'Item.PillBlack');assert.equal(pill.uid,phase==='honest'?107:108)
  assert.equal(p.money,d.proof.initialMoney!-(phase==='staleFee'?0:3));assert.equal(market.money,d.proof.initialMarketMoney+(phase==='staleFee'?0:3))
  if(phase==='staleFee'){assert.equal(receipts,undefined);assert.ok(d.proof.refused);assert.equal(s.time,d.proof.initialTime)}else{assert.equal(receipts!.length,1);assert.equal(receipts![0]!.paid,3);assert.equal(receipts![0]!.item,pill.uid);assert.equal(receipts![0]!.merchant,d.trader.id);assert.equal(receipts![0]!.belief,phase==='honest'?'Pill.Vitamin':'Pill.Toxin')}
  if(phase==='refuted'||phase==='pending'){assert.ok(memory);assert.equal(memory.mood,-3);assert.equal(memory.count,1);assert.equal(memory.remaining,86399);assert.equal(receipts![0]!.refutedAt,14406)}else assert.equal(memory,undefined)
  if(phase==='refuted'||phase==='honest'||phase==='pending')assert.equal(s.knowledge.pillKnown[d.appearance],'Pill.Vitamin');else assert.equal(s.knowledge.pillKnown[d.appearance],undefined)
  if(phase!=='quote'){await close(page);if(memory){await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();await page.getByTestId('thought-'+memory.def).scrollIntoViewIfNeeded()}else if(phase==='lie'||phase==='staleFee'){await page.getByRole('button',{name:/주민·세력/}).click();await page.getByTestId('win-society').waitFor();await page.locator('[data-person-id="'+d.trader.id+'"]').click();await page.getByTestId('appraisal-panel').scrollIntoViewIfNeeded()}}
  await shot(page,shots[i]!);await restore(page,'same-real-merchant-appraisal-'+phase);rows.push({phase,proof:d.proof,memory,receipts,actualPill:pill,actualMoney:p.money,actualMarketMoney:market.money,actualTime:s.time,actualUiTurns,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualFee:3,originalPillCount:3,actualUiTurns:1,uiAppraisalWholeExactAfterRendering:true,actualPendingTurns:5,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six real UI-paid/likely-lie/actual-confirmed-refutation/honest/stale-fee/pending scenes;originalpill108or107 stack3 preserved/fee3;actualUI1T andpending5T whole exact;sixwhole108/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
