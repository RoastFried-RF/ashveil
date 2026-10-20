import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {activeThoughts} from '../../src/core/thoughts'
import {runUntilInput} from '../../src/core/game'
import {SAVE_VERSION} from '../../src/core/game'
import {symptomNativeFixture,type SymptomPhase} from '../symptom-thoughts-fixture'
import {cheb} from '../../src/core/geom'
const outDir=process.argv[2]??'test-results/symptom-thoughts-browser';mkdirSync(outDir,{recursive:true})
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
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save91 drift; before/after files saved');return after}


async function journal(p:Page){await close(p);await p.getByRole('button',{name:/일지/}).click();await p.getByTestId('win-journal').waitFor()}
let page:Page|undefined
try{
 const phases:SymptomPhase[]=['dizzy','festering','fever','tourniquet','frostbite','fire','rain','drug','loner','neat'],ids=['Thought.Dizzy','Thought.Festering','Thought.Fever','Thought.TourniquetNumb','Thought.Frostbite','Thought.FireRest','Thought.AshRain','Thought.DrugHaze','Temperament.Alone','Temperament.Neat'],moods=[-4,-6,-5,-4,-5,3,-2,3,0,-3],shots=[
 '588-native-real-blood-loss-over-fifteen-percent-feels-dizzy-minus-four',
 '589-native-original-open-wound-with-visible-pus-shows-minus-six',
 '590-native-original-infection-stage-sixty-fever-shows-minus-five-without-hidden-infection-leak',
 '591-native-original-tourniquet-passes-two-real-hours-by-one-turn-and-feels-numb-minus-four',
 '592-native-original-present-hand-frostbite-grade-one-shows-minus-five',
 '593-native-actual-finite-campfire-two-cells-and-ongoing-real-rest-show-plus-three-before-pending-resume',
 '594-native-real-surface-ash-rain-exposure-without-roof-shows-minus-two',
 '595-native-original-poppy-bottle-actually-consumed-active-dose-grants-plus-three-with-existing-side-effect-preserved',
 '596-native-loner-really-walks-to-three-cells-from-another-faction-human-and-no-alone-bonus',
 '597-native-original-equipped-knife-edge-fifty-five-is-below-canonical-sixty-and-neat-shows-minus-three']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=symptomNativeFixture(phase);assert.equal(d.proof.actualTurns,1);page=await initial(d.w)
  let s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s};const thought=activeThoughts(w,p).find(t=>t.def===ids[i])
  if(phase==='loner'){assert.equal(thought,undefined);const other=s.creatures.find(c=>c.id===d.proof.neighborId)!;assert.notEqual(other.faction,p.faction);assert.equal(cheb(p.pos,other.pos),3);assert.ok(p.traits.includes('Trait.Loner'))}
  else{assert.ok(thought);assert.equal(thought.mood,moods[i]);assert.equal(thought.count,1);assert.equal(thought.remaining,undefined)}
  if(phase==='drug'){assert.equal(p.bag.some(it=>it.uid===d.proof.itemUid),false);assert.ok(p.drugs?.active.some(a=>a.def==='Drug.PoppyTincture'));assert.ok(p.thoughts.some(t=>t.def==='Thought.Constipation'))}
  if(phase==='neat'){const knife=Object.values(p.equip).find(it=>it?.uid===d.proof.itemUid)!;assert.equal(knife.edge,55)}
  assert.equal(s.nextId,d.s.nextId);await journal(page)
  if(phase==='loner'){assert.equal(await page.getByTestId('thought-Temperament.Alone').count(),0);await page.getByTestId('sleep-detail').scrollIntoViewIfNeeded()}
  else{const row=page.getByTestId('thought-'+ids[i]);await row.scrollIntoViewIfNeeded();await row.getByText((moods[i]!>0?'+':'')+moods[i],{exact:true}).waitFor()}
  await shot(page,shots[i]!)
  let queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(phase==='fire'){
   assert.ok(s.simulationPending);assert.equal(p.activity?.remaining,18);assert.equal(p.activity?.elapsed,2)
   const expected:World={db:d.w.db,s:structuredClone(s)};queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0)
   writeFileSync(outDir+'/pending-fire-before-save.json',JSON.stringify(s));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await close(page);await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page)
   const after=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(after));assert.deepEqual(after,want);assert.equal(after.time-s.time,1900);const ap=after.creatures.find(c=>c.id===after.playerId)!;assert.equal(ap.activity,undefined);assert.equal(activeThoughts({db:d.w.db,s:after},ap).some(t=>t.def==='Thought.FireRest'),false);s=after;p=ap;w={db:d.w.db,s}
  }
  await restore(page,'same-real-symptom-'+phase);rows.push({phase,thought:ids[i],mood:moods[i],proof:d.proof,actualTime:s.time,actualPendingTurns:queues?19:undefined,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualSymptomTurns:1,actualFirePendingTurns:19,originalDrugBottleConsumed:true,drugSideEffectPreserved:true,onlyActualKnownSymptoms:true,lonerOtherFactionRadius:3,neatActualEdge:55,readOnlyRefreshWholeStateExact:true,pendingBrowserWholeExactAfterRendering:true,wholeRoundtrips:10,screenshots:10,rows,consoleErrors:errors},null,2));console.log('OK: eight real symptom/environment/drug thoughts/two canonical trait boundaries/tenwhole91/ten screens/read-only refresh whole exact/fire pending19TU full exact/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
