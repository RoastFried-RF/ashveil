import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {activeThoughts} from '../../src/core/thoughts'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {sleepMemoryNativeFixture,type SleepMemoryPhase} from '../sleep-memories-fixture'
const outDir=process.argv[2]??'test-results/sleep-memories-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:SleepMemoryPhase[]=['well','ground','wet','poor','noise','pending'],shots=[
 '610-native-one-real-warm-bed-sleep-turn-wakes-with-quality-one-plus-four',
 '611-native-one-real-ground-sleep-turn-with-minus-three-and-no-false-good-sleep',
 '612-native-real-wet-ground-sleep-under-roof-keeps-minus-six-and-minus-three',
 '613-native-cold-bed-low-fatigue-does-not-invent-good-sleep',
 '614-native-real-noise-interrupts-observed-bed-sleep-once',
 '615-native-pending-sleep-keeps-real-observations-through-title-and-identical-natural-wake']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=sleepMemoryNativeFixture(phase);assert.equal(d.proof.actualTurns,d.proof.pending?1:2);assert.equal(d.proof.observation!.turns,1);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want);assert.ok(pendingTurns>1000)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},thoughts=activeThoughts(w,p).filter(t=>['Thought.SleptWell','Thought.GroundSleep','Thought.SleptRough'].includes(t.def)),wanted=phase==='poor'?[]:phase==='wet'?[['Thought.GroundSleep',-3],['Thought.SleptRough',-5]]:phase==='ground'?[['Thought.GroundSleep',-3]]:[['Thought.SleptWell',4]]
  assert.deepEqual(thoughts.map(t=>[t.def,t.mood]).sort(),wanted.sort());if(phase==='wet'){const event=p.thoughts.find(t=>t.def==='Thought.SleptRough')!.events![0]!;assert.equal(event.at,d.proof.initialTime/100+1);assert.equal(s.time/100-event.at,1);assert.equal(event.untilTurn-event.at,12000)}assert.equal(p.sleepObservation,undefined);assert.equal(p.asleep,false);assert.equal(s.nextId,d.s.nextId);for(const t of thoughts){assert.equal(t.count,1);assert.ok(t.remaining!>0)}
  await close(page);await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();for(const t of thoughts)await page.getByTestId('thought-'+t.def).waitFor();if(thoughts.length)await page.getByTestId('thought-'+thoughts.at(-1)!.def).scrollIntoViewIfNeeded();await shot(page,shots[i]!);await restore(page,'same-real-sleep-'+phase);rows.push({phase,proof:d.proof,thoughts,actualTime:s.time,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualSleepObservation:true,noInventedPastSleep:true,readOnlyRefreshWholeExact:true,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six real sleep/wake scenes;quality/ground/wet/poor/noise;pending natural wake whole exact; sixwhole94/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
