import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {cartographyNativeFixture,type CartographyPhase} from '../cartography-fixture'
import {knownMapDocuments,mapClaims} from '../../src/core/cartography'
const outDir=process.argv[2]??'test-results/cartography-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:CartographyPhase[]=['unread','read','conflict','verified','contradicted','pending'],shots=[
 '734-native-original-unread-map-note-does-not-create-unvisited-floor-knowledge',
 '735-native-original-map-note-actual-one-turn-reading-shows-unvisited-floor-author-date-reliability-and-error',
 '736-native-two-original-map-notes-real-two-turn-reading-retains-both-different-location-claims-and-conflict',
 '737-native-original-map-claim-agrees-with-explicit-initial-direct-exploration-record',
 '738-native-original-map-claim-differs-from-explicit-initial-direct-exploration-record-without-rewriting-source',
 '739-native-original-read-map-nineteen-more-real-rest-turns-after-save-whole-exact-with-unchanged-paper-claims']
 const rows:unknown[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=cartographyNativeFixture(phase);assert.equal(d.proof.actualTurns,[0,1,2,1,1,2][i]);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},docs=knownMapDocuments(w,d.proof.mapId),map=s.map.id===d.proof.mapId?s.map:undefined,claims=mapClaims(w,d.proof.mapId,map)
  assert.ok(p.alive);assert.ok(p.bag.some(it=>it.uid===d.proof.noteUid));assert.equal(s.nextId,d.s.nextId)
  if(phase==='unread'){assert.equal(docs.length,0);assert.equal(claims.length,0)}else{assert.equal(docs.length,phase==='conflict'?2:1);assert.equal(docs[0]!.document.writtenAt,0);assert.equal(docs[0]!.document.reliability,60);assert.equal(docs[0]!.document.error,2);assert.deepEqual(docs[0]!.document,d.proof.initialDocument);assert.equal(docs[0]!.document.author,'이전 조사자')}
  if(phase==='conflict'){assert.equal(claims.length,2);assert.ok(claims.every(c=>c.conflict&&c.status==='unverified'))}
  if(phase==='verified')assert.equal(claims[0]!.status,'verified');if(phase==='contradicted')assert.equal(claims[0]!.status,'contradicted')
  if(phase==='read'||phase==='conflict'||phase==='pending')assert.equal(s.maps.crypt2,undefined)
  await close(page);await page.keyboard.press('m');await page.getByTestId('win-map').waitFor()
  if(d.proof.mapId==='crypt2'&&phase!=='unread')await page.getByTestId('win-map').getByRole('button',{name:'지하 2층 (지도)',exact:true}).click()
  if(phase==='unread')assert.equal(await page.getByTestId('win-map').getByRole('button',{name:'지하 2층 (지도)',exact:true}).count(),0)
  else{await page.getByTestId('map-document-initial-surveyor-map').waitFor();assert.ok((await page.getByTestId('map-documents').textContent())!.includes('신뢰도 60'))}
  await shot(page,shots[i]!);await restore(page,'same-original-map-document-'+phase);rows.push({phase,proof:d.proof,docs,claims,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualReadTurns:1,actualConflictReadTurns:2,actualPendingTurns:19,wholeRoundtrips:6,screenshots:6,pendingBrowserWholeExactAfterRendering:true,initialPriorExplorationExplicit:true,rows,consoleErrors:errors},null,2));console.log('OK: six original unread/read/conflicting/direct-verified/direct-contradicted/pending map scenes;unvisited terrain notgenerated;remaining19T whole exact;sixwhole115/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
