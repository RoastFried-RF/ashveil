import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {nameRumorNativeFixture,type NameRumorPhase} from '../name-rumors-fixture'
import {activeThoughts} from '../../src/core/thoughts'
const outDir=process.argv[2]??'test-results/name-rumors-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:NameRumorPhase[]=['good','bad','note','unknown','beacon','pending'],shots=[
 '708-native-initial-valid-local-positive-name-report-actual-talk-one-turn-creates-positive-five-day-memory',
 '709-native-initial-valid-local-negative-name-report-actual-talk-one-turn-creates-negative-five-day-memory',
 '710-native-original-readable-note-actual-one-turn-reading-preserves-subject-source-date-and-original-note',
 '711-native-old-reputation-event-without-known-subject-actual-talk-does-not-invent-self-rumor-or-memory',
 '712-native-valid-initial-beacon-receipt-actual-one-turn-reading-creates-negative-self-rumor-memory',
 '713-native-heard-self-rumor-nineteen-more-real-rest-turns-after-save-whole-exact-and-no-repeat-memory']
 const rows:unknown[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=nameRumorNativeFixture(phase);assert.equal(d.proof.actualTurns,[1,1,1,1,1,2][i]);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,thoughts=activeThoughts({db:d.w.db,s},p),memory=thoughts.find(t=>t.def==='Thought.NameRumor'),news=s.knowledge.rumors?.filter(r=>r.kind==='reputation')??[]
  assert.equal(s.nextId,d.s.nextId);assert.equal(p.alive,true)
  if(phase==='unknown'){assert.equal(memory,undefined);assert.equal(news.length,0)}else{
   assert.ok(memory);assert.equal(memory.mood,phase==='bad'||phase==='beacon'?-4:4);assert.equal(memory.count,1);assert.equal(memory.remaining,d.proof.pending?143979:143999);assert.equal(news.length,1);assert.deepEqual(news[0]!.reputation!.subject,{id:p.id,name:p.name,seed:s.seed});assert.equal(news[0]!.id,d.proof.reportId)
  }
  if(phase==='note')assert.equal(p.bag.find(it=>it.uid===d.proof.noteUid)!.def,'Item.Note')
  await close(page);await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();if(memory)await page.getByTestId('thought-Thought.NameRumor').scrollIntoViewIfNeeded()
  await shot(page,shots[i]!);await restore(page,'same-actual-heard-name-rumor-'+phase);rows.push({phase,proof:d.proof,memory,news,actualTime:s.time,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualTalkTurns:1,actualReadTurns:1,actualPendingTurns:19,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,initialReportsExplicit:true,rows,consoleErrors:errors},null,2));console.log('OK: six actual talk/read/beacon/unknown/pending scenes;explicit initial reports;pending19T whole exact;sixwhole110/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
