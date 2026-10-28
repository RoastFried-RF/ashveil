import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {activeThoughts} from '../../src/core/thoughts'
import {runUntilInput} from '../../src/core/game'
import {SAVE_VERSION} from '../../src/core/game'
import {fatigueNativeFixture,type FatiguePhase} from '../fatigue-state-fixture'
import {fatigueBand} from '../../src/core/fatigue-state'
const outDir=process.argv[2]??'test-results/fatigue-physics-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');const installed=await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);assert.deepEqual(JSON.parse(JSON.stringify(installed)),JSON.parse(JSON.stringify(w.s)));if(w.s.simulationPending){await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');await idle(p)}else{const at=w.s.time;await p.keyboard.press('i');await p.getByTestId('win-inv').waitFor();await p.keyboard.press('Control+s');await p.keyboard.press('Escape');assert.equal((await read(p)).time,at)}return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:outDir+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save90 drift; before/after files saved');return after}


async function journal(p:Page){await close(p);await p.getByRole('button',{name:/일지/}).click();await p.getByTestId('win-journal').waitFor()}
let page:Page|undefined
try{
 const phases:FatiguePhase[]=['normal','tired','weary','exhausted','debt','pending'],moods=[0,-3,-8,-14,-14,-8],turns=[6,7,7,8,8,7],shots=[
 '582-native-normal-rest-stage-original-bandage-six-actual-turns-and-no-fatigue-mood',
 '583-native-tired-rest-stage-original-bandage-seven-actual-turns-with-one-point-zero-five-time-and-three-percent-consciousness',
 '584-native-weary-rest-stage-original-bandage-seven-actual-turns-with-one-point-one-five-time-and-eight-percent-consciousness',
 '585-native-exhausted-rest-stage-original-bandage-eight-actual-turns-with-wake-three-and-deep-sleep-thirty',
 '586-native-original-positive-sleep-debt-forces-same-exhausted-eight-turn-physics-despite-low-fatigue',
 '587-native-pending-original-bandage-resumes-seven-actual-turns-on-same-wound-spends-once-and-whole-state-matches']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=fatigueNativeFixture(phase),expected:World|undefined=phase==='pending'?{db:d.w.db,s:structuredClone(d.s)}:undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}={before:[],after:[]}
  assert.equal(d.proof.plannedTurns,turns[i]);assert.equal(d.proof.actualTurns,expected?0:turns[i]);assert.equal(d.s.nextId,69)
  if(expected){assert.ok(d.p.bag.some(it=>it.uid===d.proof.bandageUid));queues.before=expected.s.fx.splice(0);runUntilInput(expected);queues.after=expected.s.fx.splice(0);assert.equal(expected.s.simulationPending,undefined);writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues))}
  page=await initial(d.w);const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},rule=fatigueBand(w,p),thoughts=activeThoughts(w,p).filter(t=>d.w.db.thought(t.def).replaceGroup==='fatigue'),wd=p.body.wounds.find(wd=>wd.id===d.proof.woundId)!
  assert.deepEqual(rule,d.proof.rule);assert.equal(thoughts.length,moods[i]?1:0);if(moods[i])assert.equal(thoughts[0]?.mood,moods[i]);assert.ok(wd.bandage);assert.equal(wd.bandage.at,d.proof.initialTime/100+turns[i]!-1);assert.equal(p.bag.some(it=>it.uid===d.proof.bandageUid),false);assert.equal(s.nextId,69);assert.equal(s.time-d.proof.initialTime,turns[i]!*100)
  if(expected){const want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(s));assert.deepEqual(s,want);assert.equal(s.time-d.s.time,700);assert.equal(p.activity,undefined)}
  await journal(page);const row=page.getByTestId('fatigue-physics');await row.scrollIntoViewIfNeeded();assert.match(await row.innerText(),new RegExp(rule.label));assert.ok((await row.innerText()).includes('행동 시간 ×'+rule.multiTurn));await shot(page,shots[i]!);await restore(page,'same-real-fatigue-'+phase);rows.push({phase,mood:moods[i],rule,proof:d.proof,actualTime:s.time,actualPendingTurns:expected?(s.time-d.s.time)/100:undefined,renderedQueues:expected?queues:undefined});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualBandageTurns:turns,originalBandageUids:68,originalWoundIds:67,allSpentOnce:true,debtForcesExhausted:true,pendingBrowserWholeExactAfterRendering:true,wholeRoundtrips:6,screenshots:6,rows,consoleErrors:errors},null,2));console.log('OK: actual6/7/7/8/8/7T original bandages and same wounds/all fatigue physics UI/debt exhausted/pending7T whole exact/sixwhole90/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
