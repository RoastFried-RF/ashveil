import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {bodyMemoryNativeFixture,type BodyMemoryPhase} from '../body-memories-fixture'
import {activeThoughts} from '../../src/core/thoughts'
const outDir=process.argv[2]??'test-results/body-memories-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:BodyMemoryPhase[]=['body','face','vain','old','loss','pending'],shots=[
 '684-native-one-real-wait-completes-original-body-wound-and-remembers-new-scar-minus-two-for-five-days',
 '685-native-one-real-wait-completes-original-visible-face-wound-and-remembers-new-scar-minus-five',
 '686-native-vain-new-face-scar-minus-ten-five-day-memory-without-duplicate-permanent-scar-condition',
 '687-native-valid-old-physical-face-scar-does-not-invent-new-memory-or-permanent-mood-penalty',
 '688-native-original-knife-and-tourniquet-actual-seventy-two-turn-amputation-remembers-one-lost-hand',
 '689-native-original-knife-and-incomplete-amputation-seventy-one-more-real-turns-after-save-whole-exact']
 const rows:unknown[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=bodyMemoryNativeFixture(phase);assert.equal(d.proof.actualTurns,phase==='loss'?72:1);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);assert.ok(!before.creatures.find(c=>c.id===before.playerId)!.body.missing.includes('LeftHand'));queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,71);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},thoughts=activeThoughts(w,p),scar=thoughts.find(t=>t.def==='Thought.Scar'),limb=thoughts.find(t=>t.def==='Thought.LostLimb')
  assert.equal(s.nextId,d.s.nextId+(phase==='pending'?1:0));assert.equal(p.alive,true);assert.ok(!thoughts.some(t=>t.def==='Temperament.Scar'));assert.ok(!thoughts.some(t=>t.def==='Thought.Maimed'))
  if(phase==='loss'||phase==='pending'){assert.equal(s.time,d.proof.initialTime+7200);assert.ok(p.body.missing.includes('LeftHand'));assert.ok(limb);assert.equal(limb.mood,-19);assert.equal(limb.count,1);assert.equal(limb.remaining,863999);assert.equal(p.equip.main!.uid,d.proof.knifeUid);assert.equal(p.equip.main!.def,'Item.RustyKnife');assert.equal(p.equip.main!.durability,99);assert.equal(scar,undefined)}
  else{assert.equal(limb,undefined);assert.equal(p.body.scars!.length,1);if(phase==='old'){assert.equal(scar,undefined);assert.equal(p.body.scars![0]!.at,13400)}else{assert.ok(scar);assert.equal(scar.mood,phase==='body'?-2:phase==='face'?-5:-10);assert.equal(scar.count,1);assert.equal(scar.remaining,144000);assert.equal(p.body.scars![0]!.at,14401);assert.equal(p.body.wounds.length,0)}}
  await close(page);const memory=scar??limb;if(memory){await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();await page.getByTestId('thought-'+memory.def).scrollIntoViewIfNeeded()}
  await shot(page,shots[i]!);await restore(page,'same-real-body-memory-'+phase);rows.push({phase,proof:d.proof,scar,limb,actualScars:p.body.scars,actualMissing:p.body.missing,actualKnife:p.equip.main,actualTime:s.time,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,originalKnifeUid:70,actualAmputationTurns:72,actualPendingTurns:71,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six real new-body/face/vain/old-scar/actual-amputation/pending scenes;originalknife70 andtourniquet/actual72T;pending71T whole exact;sixwhole106/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
