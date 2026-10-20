import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {animalFearNativeFixture,type AnimalFearPhase} from '../animal-fear-fixture'
import {animalFearPenalty} from '../../src/core/animal-fear'
import {canSee} from '../../src/core/fov'
const outDir=process.argv[2]??'test-results/animal-fear-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:AnimalFearPhase[]=['retreat','pack','remember','wall','expired','pending'],shots=[
 '628-native-original-torch-lit-one-real-turn-makes-ash-hound-retreat-and-remember-person',
 '629-native-same-pack-directly-witnesses-torch-retreat-and-learns-same-person',
 '630-native-extinguished-original-torch-keeps-learned-person-avoidance',
 '631-native-wall-blocked-torch-does-not-leak-animal-learning',
 '632-native-valid-initial-three-day-memory-expires-at-next-real-turn-without-retroactive-history',
 '633-native-pending-real-pack-avoidance-resumes-nineteen-turns-and-original-torch-fuel-whole-exact']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=animalFearNativeFixture(phase);assert.equal(d.proof.actualTurns,[1,1,2,1,1,2][i]);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,wolf=s.creatures.find(c=>c.id===d.proof.wolfId)!,w={db:d.w.db,s},torch=p.equip.main!,learned=!['wall','expired'].includes(phase);assert.equal(torch.uid,67);assert.equal(torch.def,'Item.Torch');assert.equal(torch.fuel,[3599,3599,3599,3599,3600,3579][i]);assert.equal(torch.lit,!['remember','expired'].includes(phase));assert.deepEqual(wolf.thoughts,[]);assert.equal(wolf.breakdown,undefined);assert.equal(wolf.npcPsyche,undefined);assert.equal(animalFearPenalty(w,wolf),learned?10:0);assert.equal(s.nextId,d.s.nextId)
  if(learned){assert.deepEqual(wolf.animalFear,[{actor:p.id,until:100800}]);assert.equal(wolf.ai.mode,'flee')}else assert.equal(wolf.animalFear,undefined)
  if(d.proof.mateId){const mate=s.creatures.find(c=>c.id===d.proof.mateId)!;assert.deepEqual(mate.animalFear,[{actor:p.id,until:100800}]);assert.deepEqual(mate.thoughts,[])}
  if(phase==='wall')assert.equal(canSee(w,p,wolf.pos),false)
  if(phase==='expired')assert.equal(s.time/100,d.proof.initialTime/100+1)
  await close(page);await shot(page,shots[i]!);await restore(page,'same-real-animal-fear-'+phase);rows.push({phase,proof:d.proof,originalTorch:{uid:torch.uid,fuel:torch.fuel,lit:torch.lit},learned:wolf.animalFear,mateLearned:d.proof.mateId?s.creatures.find(c=>c.id===d.proof.mateId)!.animalFear:undefined,actualPenalty:animalFearPenalty(w,wolf),actualTime:s.time,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,originalTorchUid:67,actualOriginalFuel:[3599,3599,3599,3599,3600,3579],actualTorchRetreat:true,actualWitnessedPackLearning:true,noHumanThoughtsForAnimals:true,noWallLearning:true,initialPastExpiryExplicit:true,actualPendingTurns:19,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six actual torch/pack/remembered-person/wall/expiry scenes;original torch67 fuel preserved;pending19T whole exact;sixwhole97/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
