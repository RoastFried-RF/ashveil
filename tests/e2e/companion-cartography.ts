import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {companionCartographyNativeFixture,type CompanionCartographyPhase} from '../companion-cartography-fixture'
const outDir=process.argv[2]??'test-results/companion-cartography-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World;refresh():void}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas')
 const check=await p.evaluate(s=>{const h=(window as unknown as Hook).__ashveil;h.world().s=s;const before=JSON.parse(JSON.stringify(s));h.refresh();return{before,after:JSON.parse(JSON.stringify(h.world().s))}},w.s)
 assert.deepEqual(check.before,JSON.parse(JSON.stringify(w.s)));assert.deepEqual(check.after,check.before);await p.waitForTimeout(300);return p
}
async function restore(p:Page,label:string){const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));assert.deepEqual(after,before)}
let page:Page|undefined,screenshots=0
async function close(p:Page){for(let i=0;i<8&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function panel(p:Page){await close(p);await p.keyboard.press('n');await p.getByTestId('win-society').waitFor();const details=p.getByTestId('companion-panel');if(!await details.evaluate(e=>(e as HTMLDetailsElement).open))await details.locator('summary').first().click();await p.getByTestId('companion-cartography').scrollIntoViewIfNeeded()}
async function shot(p:Page,name:string,kind:'companion'|'map'|'inventory'='companion'){await p.waitForTimeout(600);await p.getByTestId(kind==='companion'?'companion-cartography':kind==='map'?'win-map':'win-inv').screenshot({path:outDir+'/'+name+'.png',animations:'disabled'});screenshots++}
try{
 const rows:unknown[]=[]
 for(const phase of ['quote','stopped','pending']as CompanionCartographyPhase[]){
  const d=companionCartographyNativeFixture(phase);page=await initial(d.w);let queues:unknown,actualUiRequestTurns:number|undefined,actualUiWorkWaitTurns:number|undefined,actualUiResumeTurns:number|undefined,actualUiResumeWaitTurns:number|undefined,actualPendingTurns:number|undefined
  if(phase==='quote'||phase==='stopped'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[]as World['s']['fx']};await panel(page);await shot(page,phase==='quote'?'799-native-companion-original-personal-observation-and-own-paper-ink':'804-native-companion-fifty-remaining-real-turns-original-draft-and-materials');assert.deepEqual(await read(page),before)
   assert.equal(playerAct(expected,{type:'companionMap',target:d.npc.id,operation:'start',paperUid:d.paper.uid,inkUid:d.ink.uid}),null);q.after.push(...expected.s.fx.splice(0));await page.getByTestId('companion-map-start').click();await idle(page);let actual=await read(page);assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));if(phase==='quote')actualUiRequestTurns=(actual.time-before.time)/100;else actualUiResumeTurns=(actual.time-before.time)/100
   assert.equal((actual.time-before.time)/100,1);if(phase==='quote')await shot(page,'800-native-actual-n-companion-map-request-one-turn-real-work-starts-no-material-consumption')
   const at=actual.time,remaining=actual.creatures.find(c=>c.id===d.npc.id)!.mapDrawingJob!.remaining;assert.equal(remaining,phase==='quote'?59:49);await close(page)
   for(let i=0;i<remaining;i++){assert.equal(playerAct(expected,{type:'wait'}),null);q.after.push(...expected.s.fx.splice(0));await page.keyboard.press('.');await idle(page)}
   actual=await read(page);assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));if(phase==='quote')actualUiWorkWaitTurns=(actual.time-at)/100;else actualUiResumeWaitTurns=(actual.time-at)/100
   const npc=actual.creatures.find(c=>c.id===d.npc.id)!,paper=npc.bag.find(i=>i.uid===d.paper.uid)!,ink=npc.bag.find(i=>i.uid===d.ink.uid)!;assert.ok(paper.note?.mapDocument);assert.equal(ink.count,2);assert.equal(paper.note.mapDocument.cartographer!.id,d.npc.id);assert.equal(actual.knowledge.rumors!.length,0)
   await panel(page)
   if(phase==='quote'){
    await shot(page,'801-native-companion-sixty-real-work-turns-same-paper-uid-ink-only-on-completion-private-npc-map');assert.equal(playerAct(expected,{type:'companionMap',target:d.npc.id,operation:'collect',paperUid:d.paper.uid}),null);q.after.push(...expected.s.fx.splice(0));await page.getByTestId('companion-map-collect-'+d.paper.uid).click();await idle(page);actual=await read(page);assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));assert.equal(actual.knowledge.rumors!.length,0);assert.ok(actual.creatures.find(c=>c.id===actual.playerId)!.bag.some(i=>i.uid===d.paper.uid));await close(page);await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor();await shot(page,'802-native-actual-one-turn-original-companion-map-handoff-before-player-reading','inventory')
    assert.equal(playerAct(expected,{type:'read',uid:d.paper.uid}),null);q.after.push(...expected.s.fx.splice(0));await page.getByTestId('win-inv').locator('[data-uid="'+d.paper.uid+'"]').click({button:'right'});await page.getByRole('button',{name:'읽기',exact:true}).click();await idle(page);actual=await read(page);writeFileSync(outDir+'/actual-ui-companion-map-and-read.json',JSON.stringify(actual));writeFileSync(outDir+'/headless-companion-map-and-read.json',JSON.stringify(expected.s));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));assert.deepEqual(actual.knowledge.rumors![0]!.mapDocument,paper.note.mapDocument);await close(page);await page.keyboard.press('m');await page.getByTestId('win-map').waitFor();assert.ok((await page.getByTestId('map-documents').innerText()).includes(d.npc.name));await shot(page,'803-native-actual-inventory-read-one-turn-original-npc-author-date-and-uncertain-map-claim','map')
   }
   queues=q
  }
  if(phase==='pending'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[]as World['s']['fx']};assert.ok(before.simulationPending);runUntilInput(expected);q.after=expected.s.fx.splice(0);queues=q;actualPendingTurns=(expected.s.time-before.time)/100;assert.equal(actualPendingTurns,79);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before))
   await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page);writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(expected.s));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));await panel(page);await shot(page,'805-native-companion-active-draft-and-owner-rest-save-seventy-nine-more-real-turns-whole-exact')
  }
  await close(page);await restore(page,'same-original-companion-map-'+phase);rows.push({phase,proof:d.proof,actualUiRequestTurns,actualUiWorkWaitTurns,actualUiResumeTurns,actualUiResumeWaitTurns,actualPendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.equal(screenshots,7);assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,wholeRoundtrips:3,screenshots,actualUiNpcWorkTurns:60,actualUiWaitAfterRequestTurns:59,actualUiWaitAfterResumeTurns:49,actualUiRequestCollectReadEachTurns:1,actualPendingSeventyNineTurnsWholeExact:true,sameOriginalNpcPaperAndInk:true,noAutomaticPlayerMapKnowledge:true,initialCompanionAndMaterialsExplicit:true,rows,consoleErrors:errors},null,2));console.log('OK: companion-cartography sevenshots/threewhole121;actualNrequest1T/NPCwork60T/ownUIDpaper+ink/resume50T/collect1T/Iread1T/pending79wholeexact/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await page.screenshot({path:outDir+'/failure.png'}).catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
