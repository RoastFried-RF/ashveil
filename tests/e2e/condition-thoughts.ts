import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {activeThoughts} from '../../src/core/thoughts'
import {runUntilInput} from '../../src/core/game'
import {SAVE_VERSION} from '../../src/core/game'
import {conditionThoughtsNativeFixture,type ConditionThoughtPhase} from '../condition-thoughts-fixture'
const outDir=process.argv[2]??'test-results/condition-thoughts-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');const installed=await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);assert.deepEqual(JSON.parse(JSON.stringify(installed)),JSON.parse(JSON.stringify(w.s)));if(w.s.simulationPending){await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');await idle(p)}else{const at=w.s.time;await p.keyboard.press('i');await p.getByTestId('win-inv').waitFor();await p.keyboard.press('Control+s');await p.keyboard.press('Escape');assert.equal((await read(p)).time,at)}return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:outDir+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save89 drift; before/after files saved');return after}


async function journal(p:Page){await close(p);await p.getByRole('button',{name:/일지/}).click();await p.getByTestId('win-journal').waitFor()}
let page:Page|undefined
try{
 const phases:ConditionThoughtPhase[]=['cold','hot','wet','dirty','pain','fatigue'],ids=['Thought.Freezing','Thought.Hot','Thought.Wet','Thought.Dirty','Thought.ModeratePain','Thought.Weary'],moods=[-12,-5,-4,-3,-5,-8],shots=[
 '576-native-real-cold-body-turn-shows-canonical-minus-twelve-without-old-minus-eight',
 '577-native-real-hot-body-turn-shows-canonical-minus-five-above-thirty-seven-point-five',
 '578-native-real-inner-wetness-turn-shows-canonical-minus-four-from-actual-layers',
 '579-native-real-hygiene-below-twenty-shows-canonical-minus-three-and-no-invented-memory',
 '580-native-real-original-wound-pain-stage-two-shows-canonical-minus-five',
 '581-native-pending-rest-resumes-twenty-actual-turns-with-one-minus-eight-weary-stage-and-whole-state']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=await conditionThoughtsNativeFixture(phase),expected:World|undefined=phase==='fatigue'?{db:d.w.db,s:structuredClone(d.s)}:undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}={before:[],after:[]}
  assert.equal(d.proof.actualFirstTurns,phase==='fatigue'?0:1)
  if(expected){queues.before=expected.s.fx.splice(0);runUntilInput(expected);queues.after=expected.s.fx.splice(0);assert.equal(expected.s.simulationPending,undefined);writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues))}
  page=await initial(d.w);const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},thought=activeThoughts(w,p).find(t=>t.def===ids[i])!
  assert.ok(thought);assert.equal(thought.mood,moods[i]);assert.equal(thought.count,1);assert.equal(thought.remaining,undefined);assert.equal(p.thoughts.filter(t=>d.w.db.thought(t.def).condition).length,0);assert.equal(s.nextId,d.s.nextId)
  if(expected){const want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(s));assert.deepEqual(s,want);assert.equal(s.time-d.s.time,2000);assert.equal(p.activity,undefined)}
  await journal(page);const row=page.getByTestId('thought-'+ids[i]);await row.scrollIntoViewIfNeeded();await row.getByText(String(moods[i]),{exact:true}).waitFor();await shot(page,shots[i]!);await restore(page,'same-real-condition-'+phase);rows.push({phase,thought:ids[i],mood:thought.mood,count:thought.count,proof:d.proof,actualTime:s.time,actualPendingTurns:expected?(s.time-d.s.time)/100:undefined,renderedQueues:expected?queues:undefined});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,conditionsHaveNoStoredMemories:true,pendingBrowserWholeExactAfterRendering:true,wholeRoundtrips:6,screenshots:6,rows,consoleErrors:errors},null,2));console.log('OK: six canonical condition families actual turns/sixwhole89/sixscreens/no past condition memories/pending20T whole exact/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
