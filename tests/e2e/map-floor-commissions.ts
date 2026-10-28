import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {mapFloorCommissionsNativeFixture,type MapFloorPhase} from '../map-floor-commissions-fixture'
import {isMapSurvey,mapSurveyOffers,knownSurveyMaps} from '../../src/core/map-commissions'
const outDir=process.argv[2]??'test-results/map-floor-commissions-browser';mkdirSync(outDir,{recursive:true});mkdirSync(outDir+'/window',{recursive:true})
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
async function panel(p:Page,id:number){await close(p);await p.getByRole('button',{name:/주민·세력/}).click();await p.getByTestId('win-society').waitFor();await p.locator('[data-person-id="'+id+'"]').click();const el=p.getByTestId('map-commission-panel');await el.locator('summary').click();await el.scrollIntoViewIfNeeded();return el}
async function snap(p:Page,name:string){await p.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))});await p.waitForTimeout(1500);await shot(p,name)}
try{
 const phases:MapFloorPhase[]=['unread','read','accepted','pending'],rows:unknown[]=[]
 for(const phase of phases){
  const d=mapFloorCommissionsNativeFixture(phase);assert.equal(d.proof.actualTurns,({unread:0,read:1,accepted:2,pending:3})[phase]);page=await initial(d.w);let queues:unknown,actualUiTurns:number|undefined
  if(phase==='pending'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[] as World['s']['fx']};assert.ok(before.simulationPending);runUntilInput(expected);q.after=expected.s.fx.splice(0);queues=q;assert.equal((expected.s.time-before.time)/100,19)
   writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));assert.deepEqual(actual,want)
  }
  const pane=await panel(page,d.trader.id)
  if(phase==='unread')assert.equal(await pane.getByTestId('map-survey-offer').filter({hasText:'지하 2층'}).count(),0)
  if(phase==='read'){
   const offer=d.floorOffer()!,row=pane.getByTestId('map-survey-offer').filter({hasText:'지하 2층'});assert.equal(await row.count(),1);await row.scrollIntoViewIfNeeded()
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[] as World['s']['fx']};assert.equal(playerAct(expected,{type:'mapSurveyAccept',target:d.trader.id,offer:offer.id,expectedReward:offer.reward}),null);q.after=expected.s.fx.splice(0);queues=q
   await row.getByTestId('map-survey-accept').click();await idle(page);const actual=await read(page);assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));actualUiTurns=(actual.time-before.time)/100;assert.equal(actualUiTurns,1)
  }
  if(phase!=='unread')await pane.getByTestId('map-survey-record').scrollIntoViewIfNeeded()
  const names={unread:'756-native-owned-original-unread-floor-map-does-not-post-unknown-crypt2-survey',read:'757-native-actual-one-turn-read-and-ui-one-turn-floor-accept-without-generating-crypt2',accepted:'758-native-original-crypt2-commission-ledger-original-surveyor-paper-and-real-escrow',pending:'759-native-known-floor-contract-rest-save-nineteen-more-real-turns-whole-exact-no-remote-map-generation'}
  await snap(page,names[phase]);const actual=await read(page),p=actual.creatures.find(c=>c.id===actual.playerId)!,trader=actual.creatures.find(c=>c.id===d.trader.id)!,w={db:d.w.db,s:actual},original=p.bag.find(i=>i.uid===d.report.uid)!
  assert.equal(actual.version,SAVE_VERSION);assert.deepEqual(original.note!.mapDocument,d.proof.originalDocument);assert.equal(actual.maps.crypt2,undefined);assert.equal(actual.overworld!.scenes['Region.GreyCloister']!.maps.crypt2,undefined);assert.ok(!actual.overworld!.scenes['Region.GreyCloister']!.map.id.includes('crypt2'));assert.equal(p.money,d.proof.initialMoney)
  const record=(actual.overworld!.contracts??[]).filter(isMapSurvey)[0]
  if(phase==='unread'){assert.equal(record,undefined);assert.ok(!knownSurveyMaps(w).some(m=>m.mapId==='crypt2'));assert.ok(!mapSurveyOffers(w,p,trader).some(o=>o.mapId==='crypt2'))}else{assert.ok(record);assert.equal(record.mapId,'crypt2');assert.equal(record.region,'Region.GreyCloister');assert.equal(record.status,'active');assert.equal(record.escrow,record.reward);assert.equal(actual.overworld!.markets![d.trader.traderSite!]!.money,d.proof.initialBank-record.reward)}
  await restore(page,'same-original-floor-map-commission-'+phase);rows.push({phase,proof:d.proof,actualUiTurns,record,knownMaps:knownSurveyMaps(w),renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,wholeRoundtrips:4,screenshots:4,actualReadTurns:1,actualUiAcceptTurns:1,uiFloorAcceptWholeExactAfterRendering:true,actualPendingTurns:19,pendingBrowserWholeExactAfterRendering:true,allFourNoRemoteMapGenerated:true,rows,consoleErrors:errors},null,2));console.log('OK: four actualknownfloor contract scenes/fourwhole118/fourscreens;read1/uiaccept1wholeexact/pending19wholeexact;crypt2nevergenerates;console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
