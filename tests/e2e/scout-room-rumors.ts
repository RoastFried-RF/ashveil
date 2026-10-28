import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {scoutRoomNativeFixture,type ScoutRoomPhase} from '../scout-room-rumors-fixture'
import {mapClaims} from '../../src/core/cartography'
const outDir=process.argv[2]??'test-results/scout-room-rumors-browser';mkdirSync(outDir,{recursive:true})
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
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function mapOpen(p:Page){await close(p);await p.keyboard.press('m');await p.getByTestId('win-map').waitFor()}
async function shot(p:Page,name:string){await p.waitForTimeout(600);await p.getByTestId('win-map').screenshot({path:outDir+'/'+name+'.png',animations:'disabled'});screenshots++}
try{
 const rows:unknown[]=[]
 for(const phase of ['returned','conflict','pending']as ScoutRoomPhase[]){
  const d=scoutRoomNativeFixture(phase);assert.equal(d.proof.actualTurns,({returned:36,conflict:37,pending:38}as const)[phase as 'returned'|'conflict'|'pending']);assert.equal(d.proof.playerStillNotDiscovered,true);page=await initial(d.w);let queues:unknown,actualUiTalkTurns:number|undefined,actualPendingTurns:number|undefined
  if(phase==='returned'){
   const before=await read(page);assert.equal(before.knowledge.rumors!.length,0);await mapOpen(page);assert.ok(!(await page.getByTestId('win-map').innerText()).includes(d.room.name));await shot(page,'806-native-actual-distant-scout-returned-by-normal-walk-but-room-not-public-before-talk');assert.deepEqual(await read(page),before);await close(page)
   const expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[]as World['s']['fx']};assert.equal(playerAct(expected,{type:'talk',target:d.npc.id}),null);q.after=expected.s.fx.splice(0);queues=q;await page.keyboard.press('Shift+n');await page.getByTestId('win-society').waitFor();await page.getByTestId('talk-person').click();await idle(page);const actual=await read(page);writeFileSync(outDir+'/actual-ui-scout-talk.json',JSON.stringify(actual));writeFileSync(outDir+'/headless-scout-talk.json',JSON.stringify(expected.s));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));actualUiTalkTurns=(actual.time-before.time)/100;assert.equal(actualUiTalkTurns,1);const report=actual.knowledge.rumors!.find(r=>r.roomIdx===d.roomIndex)!;assert.equal(report.hop,0);assert.equal(report.writtenAt,d.proof.actualRoomObservationAt);assert.equal(report.mapDocument,undefined);assert.equal(actual.map.rooms[d.roomIndex]!.discovered,false);assert.equal(actual.creatures.find(c=>c.id===d.npc.id)!.bag.length,0);await mapOpen(page);const claim=page.getByTestId('map-claim').filter({hasText:d.room.name});assert.ok((await claim.innerText()).includes('전해 들은 위치 (미확인)'));assert.ok((await claim.innerText()).includes('직접 정찰'));assert.ok((await claim.innerText()).includes('기록'));await shot(page,'807-native-actual-n-talk-one-turn-original-eyewitness-room-time-amber-unverified-report-no-paper-or-remote-truth')
  }
  if(phase==='conflict'){
   await mapOpen(page);const claims=page.getByTestId('map-claim').filter({hasText:d.room.name});assert.equal(await claims.count(),2);for(const t of await claims.allTextContents())assert.ok(t.includes('위치 기록끼리 충돌'));await shot(page,'808-native-old-original-map-and-real-returned-scout-different-location-both-unverified-conflict')
  }
  if(phase==='pending'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[]as World['s']['fx']};assert.ok(before.simulationPending);runUntilInput(expected);q.after=expected.s.fx.splice(0);queues=q;actualPendingTurns=(expected.s.time-before.time)/100;assert.equal(actualPendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before))
   await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page);writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(expected.s));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));await mapOpen(page);await shot(page,'809-native-actual-scout-report-pending-save-nineteen-more-real-turns-whole-exact')
  }
  const actual=await read(page),claims=mapClaims({db:d.w.db,s:actual},actual.map.id,actual.map).filter(c=>c.roomIndex===d.roomIndex);assert.equal(actual.map.rooms[d.roomIndex]!.discovered,false);assert.ok(claims.every(c=>c.status==='unverified'));await close(page);await restore(page,'same-original-scout-report-'+phase);rows.push({phase,proof:d.proof,actualUiTalkTurns,actualPendingTurns,claims,renderedQueues:queues});await page.close();page=undefined
 }
 assert.equal(screenshots,4);assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,wholeRoundtrips:3,screenshots,actualReturnPublicTurnsBeforeTalk:36,netNpcReturnDistance:35,includesActualPlayerApproachOneTurn:true,actualUiTalkOneTurnWholeExact:true,realEyewitnessTimePreserved:true,playerRoomNotDiscoveredByRumor:true,noNewPaperInkOrCurrentRemoteTruth:true,actualPendingNineteenTurnsWholeExact:true,initialDistantCompanionAndOldMapExplicit:true,rows,consoleErrors:errors},null,2));console.log('OK: scout-room fourMwindowshots/threewhole121;real36Treturn+approach/actualNtalk1T/eyewitness-time/noPaper/noDirectExplore/map-reportconflict/pending19wholeexact/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await page.screenshot({path:outDir+'/failure.png'}).catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
