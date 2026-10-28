import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {outbreakRumorNativeFixture,type OutbreakRumorPhase} from '../outbreak-rumors-fixture'
import {activeThoughts} from '../../src/core/thoughts'
const outDir=process.argv[2]??'test-results/outbreak-rumors-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:OutbreakRumorPhase[]=['talk','repeat','ordinary','note','beacon','pending'],shots=[
 '647-native-actual-local-quarantine-first-conversation-gives-grey-fever-orphan-six-mood-loss-for-three-days',
 '648-native-second-real-conversation-keeps-original-outbreak-report-and-memory-expiry',
 '649-native-other-background-learns-same-outbreak-source-without-grey-fever-orphan-memory',
 '650-native-original-note-one-real-turn-reading-learns-typed-outbreak-and-retains-original-paper',
 '651-native-explicit-valid-initial-beacon-receipt-becomes-knowledge-and-memory-only-after-real-reading',
 '652-native-pending-known-outbreak-rest-resumes-nineteen-turns-with-same-source-history-memory-and-whole-state']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=outbreakRumorNativeFixture(phase);assert.equal(d.proof.actualTurns,[1,2,1,1,1,2][i]);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},memory=activeThoughts(w,p).find(t=>t.def==='Thought.FeverMemory'),reports=s.knowledge.rumors!.filter(r=>r.kind==='outbreak')
  assert.equal(s.nextId,d.s.nextId);assert.equal(reports.length,1);assert.equal(reports[0]!.id,d.proof.reportId);assert.equal(reports[0]!.regionId,d.proof.site);assert.equal(reports[0]!.outbreak!.disease,'Disease.GreyFever');assert.equal(reports[0]!.hop,1)
  if(phase==='ordinary')assert.equal(memory,undefined);else{assert.ok(memory);assert.equal(memory.mood,-6);assert.equal(memory.count,1);assert.equal(memory.remaining,phase==='pending'?86379:phase==='repeat'?86398:86399)}
  if(phase==='note')assert.equal(p.bag.find(it=>it.uid===d.proof.noteUid)!.def,'Item.Note')
  if(phase==='beacon'){assert.equal(d.proof.initialReceivedRecord,true);assert.ok(reports[0]!.source.includes('수신 기록'));assert.equal(reports[0]!.writtenAt,20403)}
  else if(phase!=='note'){const speaker=s.creatures.find(c=>c.id===d.proof.speakerId)!;assert.equal(s.map.quarantine,true);assert.equal(speaker.knownRumors!.filter(r=>r.kind==='outbreak').length,1);assert.equal(reports[0]!.foundAt,14400);assert.ok(reports[0]!.source.includes('현지 목격'))}
  await close(page);await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor()
  if(phase==='ordinary'||phase==='beacon'){await page.getByRole('button',{name:'소문',exact:true}).click();await page.getByTestId('rumor').filter({hasText:reports[0]!.text}).scrollIntoViewIfNeeded()}
  else await page.getByTestId('thought-Thought.FeverMemory').scrollIntoViewIfNeeded()
  await shot(page,shots[i]!);await restore(page,'same-real-outbreak-rumor-'+phase);rows.push({phase,proof:d.proof,memory,report:reports[0],actualTime:s.time,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualTalkTurns:1,actualNoteReadTurns:1,actualBeaconReadTurns:1,explicitValidInitialBeaconReceipt:true,actualPendingTurns:19,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six actual first/repeated talk,other-background,note,explicit initial beacon receipt read,pending scenes;same source/date;pending19T whole exact;sixwhole100/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
