import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {activeThoughts} from '../../src/core/thoughts'
import {drinkVolume} from '../../src/core/wash-water'
import {runUntilInput} from '../../src/core/game'
import {SAVE_VERSION} from '../../src/core/game'
import {lifeMemoriesNativeFixture} from '../life-memories-fixture'
const outDir=process.argv[2]??'test-results/life-memories-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');const installed=await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);assert.deepEqual(JSON.parse(JSON.stringify(installed)),JSON.parse(JSON.stringify(w.s)));if(w.s.simulationPending){await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');await idle(p)}else{const at=w.s.time;await p.keyboard.press('i');await p.getByTestId('win-inv').waitFor();await p.keyboard.press('Control+s');await p.keyboard.press('Escape');assert.equal((await read(p)).time,at)}return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:outDir+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save88 drift; before/after files saved');return after}


async function journal(p:Page){await close(p);await p.getByRole('button',{name:/일지/}).click();await p.getByTestId('win-journal').waitFor()}
let page:Page|undefined
try{
 const phases=['wash','warmMeal','talk','talkative','innSleep','pendingInn']as const,ids=['Thought.Washed','Thought.WarmMeal','Thought.Talked','Thought.Talked','Thought.InnSleep','Thought.InnSleep'],moods=[3,3,3,6,5,5],durations=[14400,4800,28800,28800,14400,14400],shots=[
 '570-native-actual-two-litre-body-wash-keeps-same-empty-bucket-and-only-completion-grants-three-mood-twelve-hour-memory',
 '571-native-original-bowl-four-hundred-turn-oatmeal-is-actually-eaten-warm-and-grants-three-mood-four-hour-memory',
 '572-native-actual-adjacent-awake-conversation-grants-three-mood-one-day-memory-once',
 '573-native-original-talkative-trait-changes-same-actual-conversation-to-six-mood-one-day-memory',
 '574-native-real-paid-inn-bed-and-one-observed-sleep-turn-grant-five-mood-twelve-hour-memory-with-original-fee',
 '575-native-continue-uses-original-paid-bed-and-real-3997-more-sleep-turns-with-one-memory-and-no-repeat-rent']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i],d=await lifeMemoriesNativeFixture(phase),proof=d.proof as Record<string,unknown>,expected:World|undefined=phase==='pendingInn'?{db:d.w.db,s:structuredClone(d.s)}:undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}={before:[],after:[]}
  if(expected){queues.before=expected.s.fx.splice(0);runUntilInput(expected);queues.after=expected.s.fx.splice(0);assert.equal(expected.s.simulationPending,undefined);writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues))}
  page=await initial(d.w);const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},memory=activeThoughts(w,p).find(t=>t.def===ids[i])!
  assert.ok(memory);assert.equal(memory.mood,moods[i]);assert.equal(memory.count,1);assert.equal(memory.remaining,durations[i]-1);assert.equal(p.thoughts.filter(t=>t.def===ids[i]).length,1);assert.equal(s.nextId,d.s.nextId)
  if(phase==='wash'){assert.equal(proof.actualWashTurns,200);const bucket=p.bag.find(it=>it.uid===proof.bucketUid)!;assert.equal(bucket.def,'Item.WaterBucket');assert.equal(drinkVolume(w,bucket),0)}
  if(phase==='warmMeal'){assert.equal(proof.actualCookTurns,400);assert.equal(p.bag.find(it=>it.uid===proof.foodUid)?.def,'Item.Bowl')}
  if(phase==='talkative')assert.ok(p.traits.includes('Trait.Talkative'))
  if(phase==='innSleep'||phase==='pendingInn'){assert.equal(proof.fee,8);assert.equal(p.money,92);const bed=s.map.innBeds!.find(b=>b.lease?.tenant===p.id)!;assert.ok(bed);assert.deepEqual(p.pos,bed.pos);assert.equal(s.overworld!.markets![s.creatures.find(c=>c.id===bed.keeper)!.traderSite!].money,308)}
  if(expected){const want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(s));assert.deepEqual(s,want);assert.equal(s.time-d.s.time,399700);assert.equal(p.activity,undefined)}
  await journal(page);const row=page.getByTestId('thought-'+ids[i]);await row.scrollIntoViewIfNeeded();await row.getByText('+'+moods[i],{exact:true}).waitFor();await shot(page,shots[i]);await restore(page,'same-real-life-memory-'+phase);rows.push({phase,thought:ids[i],mood:memory.mood,remaining:memory.remaining,count:memory.count,proof,actualTime:s.time,actualPendingTurns:expected?(s.time-d.s.time)/100:undefined,renderedQueues:expected?queues:undefined});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualBodyWashTurns:200,actualBodyWaterMl:2000,actualCookTurns:400,actualInnFee:8,actualPendingSleepTurns:3997,sameOriginalWaterAndMealVessels:true,ordinaryTalkMood:3,talkativeMood:6,bodyWashMood:3,warmMealMood:3,innSleepMood:5,allSingleMemories:true,pendingBrowserWholeExactAfterRendering:true,wholeRoundtrips:6,screenshots:6,rows,consoleErrors:errors},null,2));console.log('OK: real bodywash200T2L+3/12h; original bowl cooked400T and eaten warm+3/4h; real talk3/talkative6/1d; original paid bed fee8/actual1T+5/12h; pending3997T actualsleep one memory and no new fee/sixwhole88/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
