import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {activeThoughts} from '../../src/core/thoughts'
import {runUntilInput} from '../../src/core/game'
import {SAVE_VERSION} from '../../src/core/game'
import {drugMoodNativeFixture,type DrugMoodPhase} from '../drug-mood-stages-fixture'
import {alcoholStage,withdrawalStage} from '../../src/core/drug-state'
const outDir=process.argv[2]??'test-results/drug-mood-stages-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World;refresh():void}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas')
 const check=await p.evaluate(s=>{const h=(window as unknown as Hook).__ashveil;h.world().s=s;const before=JSON.parse(JSON.stringify(h.world().s));h.refresh();const after=JSON.parse(JSON.stringify(h.world().s));return{before,after}},w.s)
 assert.deepEqual(check.before,JSON.parse(JSON.stringify(w.s)));assert.deepEqual(check.after,check.before);await p.waitForTimeout(100);assert.equal((await read(p)).time,w.s.time);return p
}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:outDir+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save93 drift; before/after files saved');return after}


async function journal(p:Page){await close(p);await p.getByRole('button',{name:/일지/}).click();await p.getByTestId('win-journal').waitFor()}
let page:Page|undefined
try{
 const phases:DrugMoodPhase[]=['alcohol1','alcohol2','alcohol3','withdrawal1','withdrawal2','withdrawal3'],moods=[4,6,-2,-10,-18,-25],shots=[
 '604-native-original-five-use-moonshine-one-real-sip-keeps-same-uid-four-uses-and-stage-one-plus-four',
 '605-native-original-moonshine-two-real-sips-keeps-same-uid-three-uses-and-stage-two-plus-six',
 '606-native-original-moonshine-three-real-sips-keeps-same-uid-two-uses-and-stage-three-minus-two',
 '607-native-real-initial-analgesic-dependency-one-actual-turn-shows-stage-one-withdrawal-minus-ten',
 '608-native-real-initial-analgesic-dependency-one-actual-turn-shows-stage-two-withdrawal-minus-eighteen',
 '609-native-pending-actual-dependent-body-rest-resumes-nineteen-turns-with-one-stage-three-minus-twenty-five-and-whole-state']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=drugMoodNativeFixture(phase),isAlcohol=phase.startsWith('alcohol'),id=isAlcohol?'Thought.Drunk':'Thought.Withdrawal';assert.equal(d.proof.actualTurns,isAlcohol?d.proof.stage:1);page=await initial(d.w)
  let queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want);assert.equal(actual.time-before.time,1900)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},thoughts=activeThoughts(w,p).filter(t=>t.def===id),thought=thoughts[0]!
  assert.equal(thoughts.length,1);assert.equal(thought.mood,moods[i]);assert.equal(thought.count,1);assert.equal(thought.remaining,undefined);assert.match(thought.label,new RegExp(d.proof.stage+'단계'));assert.equal(s.nextId,d.s.nextId);assert.equal(isAlcohol?alcoholStage(w,p):withdrawalStage(w,p),d.proof.stage)
  if(isAlcohol){const bottle=p.bag.find(it=>it.uid===d.proof.itemUid)!;assert.equal(bottle.uid,67);assert.equal(bottle.def,'Item.Moonshine');assert.equal(bottle.uses,5-d.proof.stage);assert.equal(p.needs.waterDeficit,d.proof.stage*50);assert.equal(s.time-d.proof.initialTime,d.proof.stage*100);assert.equal(p.thoughts.some(t=>t.def==='Thought.Drunk'),false)}
  else{assert.ok(p.drugs!.addicted.includes('analgesic'));assert.deepEqual(p.drugs!.lastDose,d.p.drugs!.lastDose);assert.equal(s.time-d.proof.initialTime,d.proof.pending?2000:100)}
  await journal(page);const row=page.getByTestId('thought-'+id);await row.scrollIntoViewIfNeeded();await row.getByText((moods[i]!>0?'+':'')+moods[i],{exact:true}).waitFor();await shot(page,shots[i]!);await restore(page,'same-real-drug-mood-'+phase);rows.push({phase,proof:d.proof,thought,actualTime:s.time,remainingOriginalUses:isAlcohol?p.bag.find(it=>it.uid===d.proof.itemUid)?.uses:undefined,actualPendingTurns:queues?19:undefined,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualAlcoholMood:[4,6,-2],actualWithdrawalMood:[-10,-18,-25],originalAlcoholUid:67,originalUses:[4,3,2],noNewBottles:true,noDuplicateCurrentThoughts:true,actualPendingTurns:19,pendingBrowserWholeExactAfterRendering:true,wholeRoundtrips:6,screenshots:6,rows,consoleErrors:errors},null,2));console.log('OK: original moonshine real1/2/3T sips sameUID uses4/3/2 mood4/6/-2;actual dependent bodies moods-10/-18/-25;pending19T whole exact/sixwhole93/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
