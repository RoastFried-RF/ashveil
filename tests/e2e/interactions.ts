import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {interactionNativeFixture,type InteractionPhase} from '../interactions-fixture'
import {activeThoughts} from '../../src/core/thoughts'
import {interactionRows} from '../../src/core/interactions'
const outDir=process.argv[2]??'test-results/interactions-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:InteractionPhase[]=['unknown','boil','cloth','book','small','pending'],shots=[
 '714-native-eleven-unknown-interaction-categories-without-leaked-labels-formulas-or-quote-reward',
 '715-native-original-water-and-real-wood-two-hundred-turn-boiling-unlocks-source-and-current-rule',
 '716-native-original-cloth-filter-and-water-actual-completion-unlocks-different-pathogen-and-ash-rule',
 '717-native-original-survival-book-real-complete-reading-unlocks-five-described-rules-without-XP',
 '718-native-original-three-hardtack-stack-real-two-turn-consumption-crosses-small-eater-1500-threshold',
 '719-native-one-real-boiling-turn-save-remaining-199-real-turns-whole-exact-and-only-completion-discovers']
 const rows:unknown[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=interactionNativeFixture(phase);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);assert.deepEqual(before.knowledge.interactions,[]);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,199);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},known=s.knowledge.interactions??[],items=interactionRows(w,p),insight=activeThoughts(w,p).find(t=>t.def==='Thought.Insight'),overate=activeThoughts(w,p).find(t=>t.def==='Thought.Overate'),original=p.bag.find(it=>it.uid===d.proof.item.uid)!
  assert.ok(p.alive);assert.equal(p.xp,d.proof.initialXp)
  if(phase==='unknown'){assert.equal(d.proof.actualTurns,0);assert.equal(known.length,0);assert.ok(items.every(r=>r.label==='???'&&r.formula===undefined));assert.equal(insight,undefined)}
  if(phase==='boil'||phase==='pending'){assert.equal(known.length,1);assert.equal(known[0]!.id,'Interaction.WaterBoil');assert.equal(known[0]!.method,'experience');assert.equal(original.water!.pathogen,0);assert.equal(original.uses,d.proof.item.uses);assert.ok(insight);if(phase==='boil')assert.equal(d.proof.actualTurns,200)}
  if(phase==='cloth'){assert.equal(known.length,1);assert.equal(known[0]!.id,'Interaction.WaterCloth');assert.equal(original.water!.pathogen,.64);assert.ok(insight)}
  if(phase==='book'){assert.equal(known.length,5);assert.ok(known.every(r=>r.method==='book'));assert.ok(p.booksRead!.includes('Item.SurvivalGuide'));assert.equal(original.def,'Item.SurvivalGuide');assert.ok(insight)}
  if(phase==='small'){assert.equal(d.proof.actualTurns,2);assert.equal(original.count,2);assert.ok(p.needs.kcal>1500&&p.needs.kcal<3000);assert.ok(p.effects.some(e=>e.kind==='overfull'));assert.equal(overate!.mood,-2);assert.equal(overate!.remaining,2398)}
  await close(page);await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor()
  if(phase==='small')await page.getByTestId('thought-Thought.Overate').scrollIntoViewIfNeeded();else{await page.getByTestId('win-journal').getByRole('button',{name:'상호작용',exact:true}).click();await page.getByTestId('interaction-Interaction.WaterBoil').waitFor();if(phase==='cloth')await page.getByTestId('interaction-Interaction.WaterCloth').scrollIntoViewIfNeeded()}
  await shot(page,shots[i]!);await restore(page,'same-actual-interaction-'+phase);rows.push({phase,proof:d.proof,known,insight,overate,original,actualTime:s.time,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualBoilTurns:200,actualSmallEaterTurns:2,actualPendingTurns:199,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: six actual unknown/boil/filter/book/small-eater/pending scenes;200T/2T;remaining199T whole exact;sixwhole111/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
