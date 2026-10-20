import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput} from '../../src/core/game'
import {SAVE_VERSION} from '../../src/core/game'
import {infectionNativeFixture,type InfectionPhase} from '../infection-state-fixture'
import {infectionSystemic} from '../../src/core/infection-state'
import {consciousness,painTotal} from '../../src/core/body'
import {drugEffects} from '../../src/core/drug-state'
import {thermalState,temperatureDelta} from '../../src/core/thermal'
const outDir=process.argv[2]??'test-results/infection-physics-browser';mkdirSync(outDir,{recursive:true})
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
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save92 drift; before/after files saved');return after}


async function journal(p:Page){await close(p);await p.getByRole('button',{name:/일지/}).click();await p.getByTestId('win-journal').waitFor()}
let page:Page|undefined
try{
 const phases:InfectionPhase[]=['inflamed','pus','fever','chill','willow','pending'],progress=[20,40,60,80,80,60],cons=[1,1,.95,.85,.85,.95],pain=[6.8,11.8,11.8,11.8,1.8,11.8],shots=[
 '598-native-original-inflamed-wound-adds-flat-five-pain-and-still-heals',
 '599-native-original-pus-stage-stops-healing-and-targets-mild-fever-thirty-seven-point-eight',
 '600-native-original-febrile-infection-adds-five-percent-consciousness-and-one-five-hundred-ml-daily-water-burden',
 '601-native-original-chills-stage-adds-fifteen-percent-consciousness-and-point-six-sleep-quality',
 '602-native-original-willow-tea-consumed-and-two-hundred-real-rest-turns-cool-same-infected-body-from-39-point-four-to-39-point-three',
 '603-native-pending-original-febrile-wound-resumes-399-real-turns-with-same-body-and-whole-state']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i]!,d=await infectionNativeFixture(phase);assert.equal(d.proof.progress,progress[i]);assert.equal(d.proof.actualTurns,phase==='willow'?201:1);page=await initial(d.w)
  let queues:{before:World['s']['fx'];after:World['s']['fx']}|undefined
  if(phase==='pending'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)};assert.ok(before.simulationPending);queues={before:expected.s.fx.splice(0),after:[]};runUntilInput(expected);queues.after=expected.s.fx.splice(0)
   writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page)
   const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want);assert.equal(actual.time-before.time,39900)
  }
  const s=await read(page),p=s.creatures.find(c=>c.id===s.playerId)!,w={db:d.w.db,s},rule=infectionSystemic(w,p),wd=p.body.wounds.find(wd=>wd.id===d.proof.woundId)!
  assert.deepEqual(rule,d.proof.rule);assert.equal(wd.infection?.progress,progress[i]);assert.ok(Math.abs(consciousness(w,p)-cons[i]!)<1e-8);assert.ok(Math.abs(painTotal(w,p)-pain[i]!)<.001);assert.equal(s.nextId,d.s.nextId)
  if(rule.healing)assert.ok(wd.healed>0);else assert.equal(wd.healed,0)
  if(phase==='willow'){assert.equal(d.proof.itemUid,68);assert.equal(p.bag.some(it=>it.uid===d.proof.itemUid),false);assert.equal(drugEffects(w,p).febrileCooling,.5);assert.equal(p.needs.bodyTemp,39.3);assert.equal(d.proof.initialTemp,39.4);assert.ok(temperatureDelta(p,thermalState(w,p))<0);assert.equal(s.time-d.proof.initialTime,20100)}
  if(phase==='pending'){assert.equal(s.time-d.proof.initialTime,40000);assert.equal(p.needs.bodyTemp,37.2);assert.equal(p.activity,undefined)}
  await journal(page);const row=page.getByTestId('infection-physics');await row.scrollIntoViewIfNeeded();const text=await row.innerText();assert.ok(text.includes(rule.label));assert.ok(text.includes('의식 부담 '+Math.round(rule.consciousness*100)+'%'));assert.ok(text.includes('수면 질 ×'+rule.sleep));assert.ok(text.includes((rule.metabolicFever?500:0)+'ml/일'));await shot(page,shots[i]!);await restore(page,'same-real-infection-'+phase);rows.push({phase,proof:d.proof,rule,actualTime:s.time,actualBodyTemp:p.needs.bodyTemp,actualConsciousness:consciousness(w,p),actualPain:painTotal(w,p),actualPendingTurns:queues?399:undefined,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,allSameOriginalWounds:true,actualLocalPainBands:[5,10,10,10],actualConsciousness:[0,0,.05,.15],singleSystemicBurden:true,actualWillowUid:68,actualWillowTurns:201,actualWillowCooling:[39.4,39.3],actualPendingTurns:399,pendingBrowserWholeExactAfterRendering:true,wholeRoundtrips:6,screenshots:6,rows,consoleErrors:errors},null,2));console.log('OK: original wound local/systemic stages actual turns/pain and consciousness/healing/500ml once/sleep point6/original willow201T real cooling/pending399T WHOLEexact/sixwhole92/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
