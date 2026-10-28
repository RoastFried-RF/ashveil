import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {bloodObservationNativeFixture,type BloodObservationPhase} from '../blood-observation-fixture'
import {activeThoughts} from '../../src/core/thoughts'
const outDir=process.argv[2]??'test-results/blood-observation-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:BloodObservationPhase[]=['blood','bloodlust','hidden','internal','attack','pending'],shots=[
 '678-native-one-real-wait-observes-original-external-arterial-wound-once-with-two-hour-minus-two-memory',
 '679-native-bloodlust-patch-reverses-real-observed-blood-to-plus-four-without-changing-existing-blood-condition',
 '680-native-original-bleeding-source-behind-real-wall-does-not-create-invisible-blood-memory',
 '681-native-internal-bleeding-is-not-observed-as-external-blood',
 '682-native-original-knife-real-hit-observes-new-external-wound-before-secondary-effects',
 '683-native-original-bleeding-wound-nineteen-more-real-turns-after-save-preserves-first-observation-and-whole-state']
 const rows:unknown[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=bloodObservationNativeFixture(phase);assert.equal(d.proof.actualTurns,1);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,enemy=s.creatures.find(c=>c.id===d.proof.sourceId)!,w={db:d.w.db,s},memory=activeThoughts(w,p).find(t=>t.def==='Thought.SawBlood'),originalWound=enemy.body.wounds.find(w=>w.id===d.proof.woundId)!
  assert.equal(s.nextId,d.s.nextId);assert.equal(p.equip.main!.uid,d.knife.uid);assert.equal(p.equip.main!.def,'Item.RustyKnife');assert.equal(enemy.alive,true)
  if(phase==='hidden'||phase==='internal'){assert.equal(memory,undefined);assert.ok(!originalWound.bloodSeenBy?.includes(p.id))}
  else{assert.ok(memory);assert.equal(memory.mood,phase==='bloodlust'?4:-2);assert.equal(memory.count,1);assert.equal(memory.remaining,phase==='pending'?2381:phase==='attack'?2399:2400);assert.equal(originalWound.bloodSeenBy!.filter(id=>id===p.id).length,1)}
  if(phase==='attack')assert.ok(enemy.body.wounds.some(w=>w.sourceId===p.id&&w.bloodSeenBy?.includes(p.id)))
  await close(page);if(memory){await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();await page.getByTestId('thought-'+memory.def).scrollIntoViewIfNeeded()}
  await shot(page,shots[i]!);await restore(page,'same-real-blood-observation-'+phase);rows.push({phase,proof:d.proof,memory,originalWound,actualTime:s.time,actualEnemyAlive:enemy.alive,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,originalKnifeUid:70,actualPendingTurns:19,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six real external-blood/bloodlust/wall/internal/new-hit/pending scenes;originalknife70/one-observation;pending19T whole exact;sixwhole105/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
