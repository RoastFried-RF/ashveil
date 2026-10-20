import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {consumptionThoughtNativeFixture,type ConsumptionThoughtPhase} from '../consumption-thoughts-fixture'
import {activeThoughts} from '../../src/core/thoughts'
const outDir=process.argv[2]??'test-results/consumption-thoughts-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:ConsumptionThoughtPhase[]=['bland','spoiled','overate','hangover','bite','pending'],shots=[
 '690-native-original-hardtack-stack-three-to-two-actual-two-turn-meal-remembers-bland-food-four-hours',
 '691-native-original-spoiled-apple-stack-three-to-two-actual-one-turn-meal-remembers-spoiled-food-without-stale-duplicate',
 '692-native-original-hardtack-actual-overfull-threshold-preserves-calorie-cap-and-existing-effect-with-two-hour-memory',
 '693-native-valid-active-alcohol-course-actually-ends-next-real-tick-with-one-twelve-hour-hangover',
 '694-native-valid-initial-healed-bite-current-latent-physical-ache-is-a-vague-minus-two-thought-without-diagnosis',
 '695-native-active-alcohol-actually-ends-during-nineteen-more-real-rest-turns-after-save-whole-exact']
 const rows:unknown[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=consumptionThoughtNativeFixture(phase);assert.equal(d.proof.actualTurns,[2,1,2,1,1,1][i]);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},thoughts=activeThoughts(w,p),id=phase==='bland'?'BlandFood':phase==='spoiled'?'SpoiledFood':phase==='overate'?'Overate':phase==='bite'?'BiteAche':'Hangover',memory=thoughts.find(t=>t.def==='Thought.'+id)!
  assert.equal(s.nextId,d.s.nextId);assert.equal(p.alive,true);assert.ok(memory);assert.equal(memory.count,1);assert.equal(memory.mood,phase==='spoiled'||phase==='hangover'?-5:phase==='pending'?-4:-2)
  if(phase!=='bite')assert.equal(memory.remaining,phase==='bland'?4798:phase==='spoiled'?14399:phase==='overate'?2398:phase==='pending'?14390:14400)
  if(d.proof.itemUid!==undefined){const it=p.bag.find(i=>i.uid===d.proof.itemUid)!;assert.equal(d.proof.itemUid,68);assert.equal(d.proof.beforeCount,3);assert.ok(it);assert.equal(it.count,2);assert.equal(it.def,phase==='spoiled'?'Item.DriedApple':'Item.Hardtack')}
  if(phase==='spoiled')assert.ok(!thoughts.some(t=>t.def==='Thought.StaleFood'))
  if(phase==='overate'){assert.ok(p.effects.some(e=>e.kind==='overfull'&&e.untilTurn>s.time/100));assert.equal(p.needs.kcal,2999.81)}
  if(phase==='hangover'||phase==='pending')assert.equal(p.drugs!.active.length,0)
  if(phase==='bite'){assert.equal(memory.label,'물린 자리가 쑤신다');assert.ok(!memory.label.includes('거품'));assert.equal(p.body.scars![0]!.part,'LeftForearm');assert.ok(p.diseases![0]!.incubatesUntil>s.time/100)}
  await close(page);await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();await page.getByTestId('thought-'+memory.def).scrollIntoViewIfNeeded()
  await shot(page,shots[i]!);await restore(page,'same-real-consumption-thought-'+phase);rows.push({phase,proof:d.proof,memory,actualBag:p.bag,actualTime:s.time,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,originalFoodUid:68,originalFoodBefore:3,actualFoodAfter:2,actualPendingTurns:19,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six real bland/spoiled/overate/alcohol-end/current-bite/pending scenes;originalfood68 stack3to2;pending19T whole exact;sixwhole107/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
