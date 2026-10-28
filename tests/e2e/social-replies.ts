import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {socialReplyNativeFixture,type SocialReplyPhase} from '../social-replies-fixture'
import {activeThoughts} from '../../src/core/thoughts'
const outDir=process.argv[2]??'test-results/social-replies-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:SocialReplyPhase[]=['welcome','insult','ordered','expelled','ordinary','pending'],shots=[
 '702-native-actual-friendly-local-resident-one-turn-welcoming-voice-creates-one-three-day-memory',
 '703-native-real-irritable-break-episode-one-turn-directed-insult-creates-memory-without-positive-chat-duplicate',
 '704-native-original-current-local-guard-one-turn-expulsion-order-without-premature-expelled-memory',
 '705-native-original-guard-order-actual-move-to-real-exit-and-successful-region-departure-creates-one-expelled-memory',
 '706-native-ordinary-local-merchant-at-same-wary-reputation-does-not-create-a-guard-expulsion-order',
 '707-native-original-heard-guard-order-nineteen-more-real-rest-turns-after-save-whole-exact-without-fake-departure']
 const rows:unknown[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=socialReplyNativeFixture(phase);assert.equal(d.proof.actualTurns,[1,1,1,3,1,2][i]);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},thoughts=activeThoughts(w,p),welcome=thoughts.find(t=>t.def==='Thought.Welcomed'),insult=thoughts.find(t=>t.def==='Thought.Insulted'),expelled=thoughts.find(t=>t.def==='Thought.Expelled')
  assert.equal(s.nextId,d.s.nextId);assert.equal(p.alive,true);assert.equal(d.proof.sourceSite,'Region.ShepherdDale')
  if(phase==='welcome'){assert.ok(welcome);assert.equal(welcome.mood,4);assert.equal(welcome.remaining,86399);assert.equal(welcome.count,1)}else assert.equal(welcome,undefined)
  if(phase==='insult'){assert.ok(insult);assert.equal(insult.mood,-4);assert.equal(insult.remaining,57599);assert.equal(insult.count,1);assert.ok(!thoughts.some(t=>t.def==='Thought.Talked'))}else assert.equal(insult,undefined)
  if(phase==='expelled'){assert.ok(expelled);assert.equal(expelled.mood,-7);assert.equal(expelled.remaining,143999);assert.equal(expelled.count,1);assert.equal(p.expulsion!.leftAt,14402);assert.equal(s.overworld!.currentRegion,undefined);assert.ok(s.overworld!.scenes[d.proof.sourceSite!]!.creatures.some(c=>c.id===d.proof.speakerId))}else{assert.equal(expelled,undefined);assert.equal(s.overworld!.currentRegion,d.proof.sourceSite)}
  if(phase==='ordered'||phase==='expelled'||phase==='pending'){assert.equal(p.expulsion!.site,d.proof.sourceSite);assert.equal(p.expulsion!.by,d.proof.speakerId);assert.equal(p.expulsion!.at,14400);if(phase!=='expelled')assert.equal(p.expulsion!.leftAt,undefined)}else assert.equal(p.expulsion,undefined)
  await close(page);const memory=welcome??insult??expelled??thoughts.find(t=>t.def==='Thought.Talked');if(memory){await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();await page.getByTestId('thought-'+memory.def).scrollIntoViewIfNeeded()}else{await page.getByRole('button',{name:/주민·세력/}).click();await page.getByTestId('win-society').waitFor();await page.getByTestId('expulsion-order').waitFor()}
  await shot(page,shots[i]!);await restore(page,'same-real-social-reply-'+phase);rows.push({phase,proof:d.proof,welcome,insult,expelled,actualOrder:p.expulsion,actualTime:s.time,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualOrderTurns:1,actualDepartureTotalTurns:3,actualPendingTurns:19,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six actual local-welcome/irritable-insult/guard-order/real-exit/ordinary/pending scenes;guard81/siteShepherdDale/realdeparture3T;pending19T whole exact;sixwhole109/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
