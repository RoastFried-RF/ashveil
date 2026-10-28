import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {corpseThoughtNativeFixture,type CorpseThoughtPhase} from '../corpse-thoughts-fixture'
import {activeThoughts} from '../../src/core/thoughts'
const outDir=process.argv[2]??'test-results/corpse-thoughts-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:CorpseThoughtPhase[]=['odor','fresh','cold','far','search','scavenger','pending'],shots=[
 '653-native-explicit-valid-initial-old-corpse-really-smelled-within-three-tiles-gives-minus-three-condition',
 '654-native-fresh-original-corpse-does-not-invent-putrefaction-condition',
 '655-native-cold-blooded-trait-exempts-real-nearby-corpse-odor-condition',
 '656-native-original-putrid-corpse-four-tiles-away-is-outside-three-tile-mood-radius',
 '657-native-two-real-turn-original-corpse-search-gives-six-hour-memory-and-preserves-original-loot-and-wallet',
 '658-native-scavenger-really-searches-same-original-corpse-without-looting-guilt-memory',
 '659-native-unfinished-original-corpse-search-continues-two-real-turns-and-preserves-whole-body-loot-wallet-and-memory']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=corpseThoughtNativeFixture(phase);assert.equal(d.proof.actualTurns,[1,1,1,1,2,2,0][i]);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,2);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,corpse=s.creatures.find(c=>c.id===d.proof.corpseId)!,w={db:d.w.db,s},odor=activeThoughts(w,p).find(t=>t.def==='Thought.CorpseOdor'),memory=activeThoughts(w,p).find(t=>t.def==='Thought.SearchedCorpse'),searching=['search','scavenger','pending'].includes(phase)
  assert.equal(s.nextId,d.s.nextId);assert.equal(corpse.alive,false);assert.equal(corpse.money,d.proof.originalMoney)
  assert.deepEqual(corpse.bag.map(it=>[it.uid,it.def,it.count]),d.proof.originalBag.map(it=>[it.uid,it.def,it.count]));assert.deepEqual(Object.entries(corpse.equip).map(([slot,it])=>[slot,it!.uid,it!.def,it!.count]),Object.entries(d.proof.originalEquip).map(([slot,it])=>[slot,it!.uid,it!.def,it!.count]))
  if(phase==='odor'){assert.ok(odor);assert.equal(odor.mood,-3);assert.equal(odor.count,1)}else assert.equal(odor,undefined)
  if(phase==='search'||phase==='pending'){assert.ok(memory);assert.equal(memory.mood,-1);assert.equal(memory.count,1);assert.equal(memory.remaining,7199)}else assert.equal(memory,undefined)
  assert.equal(corpse.searched,searching?true:undefined)
  if(searching){assert.equal(s.loot!.kind,'corpse');assert.equal(s.loot!.id,corpse.id)}
  await close(page);const show=odor??memory;if(show){await page.getByRole('button',{name:/일지/}).click();await page.getByTestId('win-journal').waitFor();await page.getByTestId('thought-'+show.def).scrollIntoViewIfNeeded()}
  await shot(page,shots[i]!);await restore(page,'same-real-corpse-thought-'+phase);rows.push({phase,proof:d.proof,odor,memory,actualTime:s.time,actualCorpseBag:corpse.bag,actualCorpseEquip:corpse.equip,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,explicitValidInitialOldCorpse:true,actualSearchTurns:2,actualPendingTurns:2,originalItemsAndWalletPreserved:true,normalGearAgingPreserved:true,wholeRoundtrips:7,screenshots:7,pendingBrowserWholeExactAfterRendering:true,rows,consoleErrors:errors},null,2));console.log('OK: seven explicit-initial odor/fresh/cold/far and actual two-turn search/scavenger/pending scenes;original items+wallet and normal gear aging;pending2T whole exact;sevenwhole101/sevenscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
