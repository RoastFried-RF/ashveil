import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {npcAgeNativeFixture,type NpcAgePhase} from '../npc-age-fixture'
import {hpMax} from '../../src/core/body'
const outDir=process.argv[2]??'test-results/npc-age-browser';mkdirSync(outDir,{recursive:true})
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
 const phases:NpcAgePhase[]=['before','birthday','loss','pending'],shots=[
 '720-native-original-generated-resident-before-valid-initial-birthday-real-one-turn-remains-in-twenties',
 '721-native-same-original-resident-real-one-turn-birthday-crossing-personal-record-and-thirties-display',
 '722-native-original-resident-default-seeded-sixtieth-birthday-natural-vitality-loss-and-immediate-HP-cap',
 '723-native-original-resident-birthday-after-save-nineteen-more-real-rest-turns-whole-exact-and-forties-display']
 const rows:unknown[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=npcAgeNativeFixture(phase);assert.equal(d.proof.actualTurns,1);page=await initial(d.w)
  let pendingTurns:number|undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(d.proof.pending){const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);assert.equal(before.creatures.find(c=>c.id===d.proof.traderId)!.age!.years,39);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0);pendingTurns=(expected.s.time-before.time)/100;assert.equal(pendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want)}
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,npc=s.creatures.find(c=>c.id===d.proof.traderId)!,birthdays=npc.history.filter(h=>h.kind==='birthday'),expectedAge=[29,30,60,40][i]!,bracket=Math.floor(expectedAge/10)*10
  assert.ok(p.alive&&npc.alive);assert.equal(npc.id,64);assert.equal(npc.age!.years,expectedAge);assert.deepEqual(npc.bag.map(it=>it.uid),d.proof.initialItems);assert.equal(s.nextId,d.s.nextId)
  if(phase==='before'){assert.equal(birthdays.length,0);assert.deepEqual(npc.stats,d.proof.initialStats)}else{assert.equal(birthdays.length,1);assert.equal(birthdays[0]!.turn,d.proof.initialAge.nextBirthday);assert.equal(npc.age!.nextBirthday,d.proof.initialAge.nextBirthday+90*28800)}
  if(phase==='loss'){assert.equal(npc.stats.vit,9);assert.equal(d.proof.initialStats.vit,10);assert.equal(npc.hp,hpMax({db:d.w.db,s},npc));assert.equal(npc.hp,95)}
  assert.ok(!s.log.some(e=>e.text.includes('세가 되었다')))
  await close(page);await page.getByRole('button',{name:/주민·세력/}).click();await page.getByTestId('win-society').waitFor();await page.locator('[data-person-id="'+npc.id+'"]').click();const age=page.getByTestId('resident-age');await age.waitFor();assert.ok((await age.textContent())!.includes(bracket+'대'));await age.scrollIntoViewIfNeeded()
  await shot(page,shots[i]!);await restore(page,'same-original-aging-resident-'+phase);rows.push({phase,proof:d.proof,actualAge:npc.age,actualStats:npc.stats,hp:npc.hp,birthdays,pendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualBirthdayTurns:1,actualPendingTurns:19,wholeRoundtrips:4,screenshots:4,pendingBrowserWholeExactAfterRendering:true,initialNearBirthdayStateExplicit:true,rows,consoleErrors:errors},null,2));console.log('OK: four original resident64 near-birthday initial scenes;real1T/no premature birthday/default60-vit9-HP95;pending19T whole exact;fourwhole112/fourscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
