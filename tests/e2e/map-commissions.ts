import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {mapCommissionsNativeFixture,type MapCommissionPhase} from '../map-commissions-fixture'
import {isMapSurvey,mapSurveyDeliveryQuote} from '../../src/core/map-commissions'
const outDir=process.argv[2]??'test-results/map-commissions-browser';mkdirSync(outDir,{recursive:true});mkdirSync(outDir+'/window',{recursive:true})
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
async function shot(p:Page,name:string){await p.waitForTimeout(800);const pane=p.getByTestId('win-society');if(await pane.isVisible())await pane.screenshot({path:outDir+'/window/'+name+'.png',animations:'disabled'});const session=await p.context().newCDPSession(p),capture=await session.send('Page.captureScreenshot',{format:'png',fromSurface:false});writeFileSync(outDir+'/'+name+'.png',Buffer.from(capture.data,'base64'));await session.detach()}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));assert.deepEqual(after,before)}
let page:Page|undefined
let screenshots=0
async function snap(p:Page,name:string){await p.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))});await p.waitForTimeout(1500);await shot(p,name);screenshots++}
function expectAction(w:World,s:World['s'],a?:Parameters<typeof playerAct>[1]){const expected:World={db:w.db,s:structuredClone(s)},before=expected.s.fx.splice(0);if(a)assert.equal(playerAct(expected,a),null);else runUntilInput(expected);return{expected,queues:{before,after:expected.s.fx.splice(0)}}}
async function panel(p:Page,id:number){await close(p);await p.getByRole('button',{name:/주민·세력/}).click();await p.getByTestId('win-society').waitFor();await p.locator('[data-person-id="'+id+'"]').click();const el=p.getByTestId('map-commission-panel');await el.locator('summary').click();await el.scrollIntoViewIfNeeded();return el}
try{
 const phases:MapCommissionPhase[]=['offer','accepted','drawn','delivered','staleReward','pending'],rows:unknown[]=[]
 for(const phase of phases){
  const d=mapCommissionsNativeFixture(phase);assert.equal(d.proof.actualTurns,({offer:0,accepted:1,drawn:61,delivered:62,staleReward:61,pending:2})[phase]);page=await initial(d.w)
  const uiActions:unknown[]=[],renderedQueues:unknown[]=[]
  if(phase==='pending'){
   const before=await read(page),q=expectAction(d.w,before);assert.ok(before.simulationPending);assert.equal((q.expected.s.time-before.time)/100,59);renderedQueues.push(q.queues)
   writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),expected=JSON.parse(JSON.stringify(q.expected.s));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(expected));assert.deepEqual(actual,expected)
  }
  let pane=await panel(page,d.trader.id)
  if(phase==='offer'){
   const offer=d.offer();assert.ok(offer);await pane.getByTestId('map-survey-accept').first().scrollIntoViewIfNeeded();await snap(page,'748-native-visited-region-map-commission-offer-real-market-cash-and-explicit-quality')
   let before=await read(page),a:Parameters<typeof playerAct>[1]={type:'mapSurveyAccept',target:d.trader.id,offer:offer.id,expectedReward:offer.reward},q=expectAction(d.w,before,a);await pane.getByTestId('map-survey-accept').first().click();await idle(page);assert.deepEqual(await read(page),JSON.parse(JSON.stringify(q.expected.s)));renderedQueues.push(q.queues);uiActions.push({action:a,actualTurns:((await read(page)).time-before.time)/100})
   await pane.getByTestId('map-survey-record').scrollIntoViewIfNeeded();await snap(page,'749-native-actual-contract-accept-button-one-turn-escrow20-market300-to280-no-player-payment')
   await close(page);await page.keyboard.press('m');await page.getByTestId('win-map').waitFor();before=await read(page);a=d.action;q=expectAction(d.w,before,a);await page.getByTestId('draw-map-start').click();await idle(page);assert.deepEqual(await read(page),JSON.parse(JSON.stringify(q.expected.s)));renderedQueues.push(q.queues);uiActions.push({action:a,actualTurns:60})
   pane=await panel(page,d.trader.id);await pane.getByTestId('map-survey-deliver').scrollIntoViewIfNeeded();before=await read(page);const record=before.overworld!.contracts!.filter(isMapSurvey)[0]!;a={type:'mapSurveyDeliver',target:d.trader.id,contract:record.id,paperUid:d.paper.uid,expectedReward:record.reward};q=expectAction(d.w,before,a);await pane.getByTestId('map-survey-deliver').click();await idle(page);assert.deepEqual(await read(page),JSON.parse(JSON.stringify(q.expected.s)));renderedQueues.push(q.queues);uiActions.push({action:a,actualTurns:1});await snap(page,'750-native-actual-map-button-and-delivery-button-original-paper-in-market-player1020-bank280')
  }else{
   await pane.getByTestId('map-survey-record').scrollIntoViewIfNeeded()
   if(phase==='accepted')assert.ok(await pane.getByTestId('map-survey-deliver').isDisabled())
   if(phase==='drawn'||phase==='staleReward'||phase==='pending')assert.ok(await pane.getByTestId('map-survey-deliver').isEnabled())
   if(phase==='staleReward')assert.ok(d.proof.refused)
   const shots={accepted:'751-native-accepted-real-escrow-with-original-blank-paper-and-not-yet-deliverable-map',drawn:'752-native-sixty-real-work-turns-original-commissioned-paper-identity-quality-and-delivery-available',delivered:'753-native-original-map-delivered-once-original-market-paper-and-immutable-receipt',staleReward:'754-native-stale-map-reward-refusal-keeps-original-paper-player-money-and-escrow',pending:'755-native-pending-commission-save-fifty-nine-more-real-turns-whole-exact-map-and-real-escrow'}
   await snap(page,shots[phase])
  }
  const actual=await read(page),p=actual.creatures.find(c=>c.id===actual.playerId)!,market=actual.overworld!.markets![d.trader.traderSite!]!,record=actual.overworld!.contracts!.filter(isMapSurvey)[0]!
  assert.ok(p.alive);assert.equal(actual.version,SAVE_VERSION);assert.equal(market.money,280);assert.equal(p.money,phase==='offer'||phase==='delivered'?1020:1000)
  if(phase==='offer'||phase==='delivered'){assert.equal(record.status,'completed');assert.equal(record.escrow,0);assert.ok(!p.bag.some(i=>i.uid===d.paper.uid));const original=market.items.find(i=>i.uid===d.paper.uid)!;assert.ok(original);assert.deepEqual(record.recipient!.document,original.note!.mapDocument)}else{assert.equal(record.status,'active');assert.equal(record.escrow,20);assert.ok(p.bag.some(i=>i.uid===d.paper.uid));if(phase!=='accepted')assert.equal(mapSurveyDeliveryQuote({db:d.w.db,s:actual},p,actual.creatures.find(c=>c.id===d.trader.id)!,record.id).error,null)}
  await restore(page,'same-original-map-commission-'+phase);rows.push({phase,proof:d.proof,record,uiActions,renderedQueues,actualPlayerMoney:p.money,actualMarketMoney:market.money});await page.close();page=undefined
 }
 assert.equal(screenshots,8);assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,wholeRoundtrips:6,screenshots,actualPublicAcceptWriteDeliverTurns:62,actualUiAcceptTurns:1,actualUiWriteTurns:60,actualUiDeliverTurns:1,uiAllWholeExactAfterRendering:true,actualPendingTurns:59,pendingBrowserWholeExactAfterRendering:true,initialPriorExplorationExplicit:true,rows,consoleErrors:errors},null,2));console.log('OK: six map commission scenes/eightscreens/sixwhole117;actualUI1+60+1wholeexact;pending59wholeexact;originalpaper/escrow20;console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
