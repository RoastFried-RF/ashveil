import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {brainRecoveryNativeFixture,type BrainRecoveryPhase} from '../brain-recovery-fixture'
import {hpMax} from '../../src/core/body'
const outDir=process.argv[2]??'test-results/brain-recovery-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:BrainRecoveryPhase[]=['injured','healed','mild','legacy','pending'],shots=[
 '729-native-original-severe-brain-wound-real-one-turn-still-unhealed-and-without-premature-stat-loss',
 '730-native-same-recorded-brain-injury-real-final-healing-turn-one-perception-loss-and-personal-history',
 '731-native-original-mild-brain-wound-real-final-healing-turn-without-severe-injury-loss',
 '732-native-original-old-brain-wound-without-known-injury-episode-heals-without-invented-past-severity',
 '733-native-original-recorded-brain-injury-save-nineteen-more-real-rest-turns-whole-exact-one-loss-at-real-healing']
 const rows:unknown[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=brainRecoveryNativeFixture(phase);assert.equal(d.proof.actualTurns,1);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);const p=before.creatures.find(c=>c.id===before.playerId)!;assert.equal(p.permanentChanges,undefined);assert.equal(p.body.brainRecovery!.length,1);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,changes=p.permanentChanges??[],history=p.history.filter(h=>h.kind==='permanentLoss'),wounds=p.body.wounds.filter(w=>w.part==='Brain')
  assert.ok(p.alive);assert.equal(s.nextId,d.s.nextId);assert.equal(d.proof.woundId,67)
  if(phase==='healed'||phase==='pending'){assert.equal(wounds.length,0);assert.equal(p.body.brainRecovery,undefined);assert.equal(changes.length,1);assert.equal(history.length,1);assert.equal(p.stats.per,9);assert.equal(p.stats.wil,10);assert.equal(changes[0]!.source,'brain:67');assert.equal(changes[0]!.at,phase==='pending'?14408:14401)}else{assert.equal(changes.length,0);assert.equal(history.length,0);assert.deepEqual(p.stats,d.proof.initialStats);if(phase==='injured'){assert.equal(wounds.length,1);assert.equal(wounds[0]!.id,67);assert.equal(p.body.brainRecovery!.length,1)}else assert.equal(wounds.length,0)}
  assert.ok(p.hp<=hpMax({db:d.w.db,s},p));if(phase==='injured')assert.ok(p.hp<100);else assert.equal(p.hp,hpMax({db:d.w.db,s},p));await close(page)
  if(history.length){await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();await page.getByTestId('win-journal').getByRole('button',{name:'연대기',exact:true}).click();assert.ok((await page.getByTestId('win-journal').textContent())!.includes('뇌 손상 회복 후유증'))}
  else{await page.getByRole('button',{name:/캐릭터/}).click();await page.getByTestId('win-char').waitFor()}
  await shot(page,shots[i]!);await restore(page,'same-original-brain-recovery-'+phase);rows.push({phase,proof:d.proof,actualStats:p.stats,episode:p.body.brainRecovery,wounds,changes,history,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualHealingTurns:1,actualPendingTurns:19,wholeRoundtrips:5,screenshots:5,pendingBrowserWholeExactAfterRendering:true,initialHealingStateExplicit:true,rows,consoleErrors:errors},null,2));console.log('OK: five original severe/mild/legacy/actual-healing/pending brain scenes;one actual per9/source67;remaining19T whole exact;fivewhole114/fivescreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
