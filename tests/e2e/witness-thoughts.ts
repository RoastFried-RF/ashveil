import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {witnessThoughtNativeFixture,type WitnessThoughtPhase} from '../witness-thoughts-fixture'
import {activeThoughts} from '../../src/core/thoughts'
const outDir=process.argv[2]??'test-results/witness-thoughts-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:WitnessThoughtPhase[]=['sound','pious','silent','death','hidden','pending'],shots=[
 '641-native-real-gardener-low-power-ai-return-step-emits-audible-noise-and-minus-four-mood',
 '642-native-same-real-gardener-noise-is-pious-angels-song-plus-four',
 '643-native-real-silent-gardener-does-not-create-heard-noise-or-mood',
 '644-native-original-actually-paid-companion-dies-from-real-arterial-bleeding-and-witnessed-loss-gives-minus-twenty',
 '645-native-hidden-original-companion-real-bleeding-death-does-not-create-unseen-loss-memory',
 '646-native-original-companion-loss-pending-rest-resumes-nineteen-turns-with-same-cash-body-memory-and-whole-state']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=witnessThoughtNativeFixture(phase);assert.equal(d.proof.actualTurns,1);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},id=['sound','pious','silent'].includes(phase)?'Thought.GardenerSound':'Thought.CompanionDied',memory=activeThoughts(w,p).find(t=>t.def===id)
  assert.equal(s.nextId,d.s.nextId)
  if(phase==='silent'||phase==='hidden')assert.equal(memory,undefined)
  else{assert.ok(memory);assert.equal(memory.mood,phase==='sound'?-4:phase==='pious'?4:-20);assert.equal(memory.count,1);if(phase==='death'||phase==='pending')assert.equal(memory.remaining,phase==='death'?288000:287981)}
  if(d.proof.machineId){const machine=s.creatures.find(c=>c.id===d.proof.machineId)!;assert.equal(machine.alive,true);assert.deepEqual(machine.thoughts,[]);if(phase!=='silent'){assert.ok(s.noiseEvents.some(e=>e.source===machine.id));assert.deepEqual(p.heardThoughts,[{def:id,until:14420}])}else assert.equal(p.heardThoughts,undefined)}
  if(d.proof.companionId){const companion=s.creatures.find(c=>c.id===d.proof.companionId)!;assert.equal(companion.alive,false);assert.equal(companion.deathCause,'과다 출혈');assert.equal(p.money,960);assert.equal(companion.money,40);assert.deepEqual(d.proof.hirePayment,{playerBefore:1000,playerAfter:960,npcBefore:0,npcAfter:40})}
  await close(page);if(memory){await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();await page.getByTestId('thought-'+id).scrollIntoViewIfNeeded()}
  await shot(page,shots[i]!);await restore(page,'same-real-witness-thought-'+phase);rows.push({phase,proof:d.proof,memory,heard:p.heardThoughts,actualTime:s.time,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualFirstTurns:1,actualHireFee:40,actualPendingTurns:19,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six actual audible/pious/silent and witnessed/hidden/pending companion-loss scenes;paidoriginal40;pending19T whole exact;sixwhole99/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
