import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {restorationNativeFixture,type RestorationPhase} from '../restoration-fixture'
import {activeThoughts} from '../../src/core/thoughts'
import {maintenanceError} from '../../src/core/crafting'
const outDir=process.argv[2]??'test-results/restoration-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:RestorationPhase[]=['bandage','low','suture','machine','relic','broken','pending'],shots=[
 '634-native-real-five-turn-quality55-bandage-consumes-original-bandage-and-gives-patient-two-mood',
 '635-native-real-five-turn-quality38-bandage-consumes-original-bandage-without-good-treatment-memory',
 '636-native-real-eleven-turn-quality64-suture-consumes-one-thread-and-one-original-needle-durability',
 '637-native-real-thirty-turn-machine-repair-consumes-original-actuator-heals-ten-severity-and-gives-scavenger-four-mood',
 '638-native-original-relic-appraised-thirty-turns-and-repaired-two-hundred-turns-with-two-actuators-and-four-mood',
 '639-native-real-failed-relic-repair-consumes-two-actuators-and-permanently-breaks-same-original-relic',
 '640-native-pending-original-relic-repair-resumes-199-turns-with-same-inputs-result-rng-memory-and-whole-state']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=restorationNativeFixture(phase);assert.equal(d.proof.actualTurns,[5,5,11,30,230,230,31][i]);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,199);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},memory=activeThoughts(w,p).find(t=>t.def===(['bandage','low','suture'].includes(phase)?'Thought.Treated':'Thought.RepairedRelic')),relic=p.bag.find(x=>x.uid===d.proof.relicUid),parts=p.bag.find(x=>x.uid===d.proof.partsUid)
  assert.equal(s.nextId,d.s.nextId)
  if(phase==='low'||phase==='broken')assert.equal(memory,undefined);else{assert.ok(memory);assert.equal(memory.mood,['bandage','suture'].includes(phase)?2:4);assert.equal(memory.count,1);assert.equal(memory.remaining,28799)}
  if(phase==='bandage'||phase==='low'||phase==='suture'){
   const wd=p.body.wounds.find(x=>x.id===d.proof.woundId)!;assert.equal(phase==='suture'?wd.suture!.quality:wd.bandage!.quality,phase==='suture'?64:phase==='bandage'?55:38)
   if(phase==='suture'){assert.equal(p.bag.find(x=>x.uid===d.proof.medicalUid)!.count,2);assert.equal(p.bag.find(x=>x.uid===d.proof.needleUid)!.durability,99)}else assert.equal(p.bag.some(x=>x.uid===d.proof.medicalUid),false)
  }else if(phase==='machine'){
   const machine=s.creatures.find(x=>x.id===d.proof.machineId)!;assert.equal(machine.body.wounds.find(x=>x.id===d.proof.woundId)!.healed,10);assert.equal(parts,undefined);assert.deepEqual(machine.thoughts,[])
  }else{
   assert.ok(relic);assert.equal(relic.uid,d.proof.relicUid);assert.equal(relic.appraisal,2);assert.equal(parts!.count,1);assert.equal(relic.durability,phase==='broken'?0:62);assert.equal(relic.maxDurability,phase==='broken'?undefined:92);assert.equal(relic.brokenRelic,phase==='broken'?true:undefined);assert.equal(d.proof.appraisalTurns,30)
   if(phase==='broken')assert.ok(maintenanceError(w,p,'repair',relic.uid)?.includes('영구 파손'))
  }
  await close(page)
  if(memory){await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();await page.getByTestId('thought-'+memory.def).scrollIntoViewIfNeeded()}
  else if(phase==='broken'){await page.getByRole('button',{name:/제작/}).click();await page.getByTestId('win-craft').waitFor();await page.getByRole('button',{name:'수리·분해',exact:true}).click();await page.getByTestId('gear-Item.PioneerArm').scrollIntoViewIfNeeded();await page.getByText('수리: 영구 파손된 유물은 수리할 수 없다',{exact:true}).waitFor()}
  await shot(page,shots[i]!);await restore(page,'same-real-restoration-'+phase);rows.push({phase,proof:d.proof,memory,actualTime:s.time,relic,parts,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualBandageTurns:5,actualSutureTurns:11,actualMachineRepairTurns:30,actualAppraisalTurns:30,actualRelicRepairTurns:200,originalPartsConsumed:2,actualPendingTurns:199,wholeRoundtrips:7,screenshots:7,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: seven actual good/low bandage,suture,machine,relic success/failure/pending scenes;original inputs;pending199T whole exact;sevenwhole98/sevenscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
