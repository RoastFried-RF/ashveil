import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {npcPsycheNativeFixture,type NpcPsychePhase} from '../npc-psyche-fixture'
const outDir=process.argv[2]??'test-results/npc-psyche-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:NpcPsychePhase[]=['witness','fast','refuse','meal','care','pending'],stress=[45,100,100,11,23,23],shots=[
 '622-native-actual-allied-bleeding-death-records-only-witnessed-npc-stress',
 '623-native-stressed-human-npc-actually-enters-food-refusal-after-witnessed-death',
 '624-native-npc-fast-keeps-original-open-ration-untouched-despite-hunger',
 '625-native-npc-eats-own-finite-ration-keeps-same-empty-wrapper-and-no-full-thoughts',
 '626-native-npc-pays-eight-from-own-wallet-original-medical-bag-five-to-four-and-good-bandage',
 '627-native-pending-real-npc-care-resumes-twenty-turns-with-identical-body-cash-material-and-mental-summary']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=npcPsycheNativeFixture(phase),npcId=d.npc.id;assert.equal(d.proof.actualTurns,[2,2,3,1,5,0][i]);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);const old=before.creatures.find(c=>c.id===npcId)!;assert.ok(!old.body.wounds.find(w=>w.id===d.proof.woundId)!.bandage);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,20);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),npc=s.creatures.find(c=>c.id===npcId)!,fast=phase==='fast'||phase==='refuse';assert.equal(npc.needs.stress,stress[i]);assert.deepEqual(npc.thoughts,[]);assert.equal(!!npc.breakdown,fast)
  if(fast)assert.equal(npc.breakdown!.kind,'fast')
  if(d.proof.victimId){const dead=s.creatures.find(c=>c.id===d.proof.victimId)!;assert.equal(dead.alive,false);assert.ok(dead.body.blood<dead.body.bloodMax*.5);assert.ok(npc.npcPsyche!.history.some(e=>e.kind==='allyDeath'&&e.source===dead.id&&e.delta===15))}
  if(d.proof.foodUid){const food=npc.bag.find(it=>it.uid===d.proof.foodUid)!;assert.equal(food.uid,85);assert.equal(food.def,phase==='meal'?'Item.EmptyRationWrapper':'Item.OpenedRationPack');if(phase==='refuse')assert.equal(food.uses,1)}
  if(d.proof.doctorId){const doctor=s.creatures.find(c=>c.id===d.proof.doctorId)!,medical=doctor.bag.find(it=>it.uid===d.proof.medicalUid)!;assert.equal(medical.def,'Item.MedicalBag');assert.equal(medical.uses,d.proof.medicalUses!-1);assert.equal(npc.money,992);assert.equal(d.proof.payment!.patientBefore-d.proof.payment!.patientAfter,8);assert.equal(d.proof.payment!.doctorAfter-d.proof.payment!.doctorBefore,8);assert.equal(npc.body.wounds.find(w=>w.id===d.proof.woundId)!.bandage!.quality,65);assert.equal(npc.npcPsyche!.history.at(-1)!.kind,'treated')}
  await close(page);await page.keyboard.press('N');await page.getByTestId('win-society').waitFor();await page.locator('[data-person-id="'+npcId+'"]').click();if(fast){await page.getByTestId('npc-psyche').waitFor();assert.match((await page.getByTestId('npc-psyche').textContent())!,/단식/)}else assert.equal(await page.getByTestId('npc-psyche').count(),0);await shot(page,shots[i]!);await restore(page,'same-real-npc-psyche-'+phase);rows.push({phase,proof:d.proof,npcStress:npc.needs.stress,npcSummary:npc.npcPsyche,breakdown:npc.breakdown,actualTime:s.time,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualWitnessedDeath:true,actualNpcFoodRefusal:true,originalRationUid:85,originalMedicalBagUid:1099511628316,actualNpcPaidFee:8,actualMedicalUses:[5,4],actualPendingTurns:20,noNpcFullThoughtRecords:true,noPrivateStressInUi:true,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six real NPC event scenes;actual allied bleeding death/fast/refusal/own ration/own eight payment/real medical bag five-to-four;pending20T whole exact;sixwhole96/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
