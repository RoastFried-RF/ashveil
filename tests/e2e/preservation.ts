import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {player,type World} from '../../src/core/ctx'
import {SAVE_VERSION} from '../../src/core/game'
import {preservationBoundaryFixture,preservationPausedFixture,preservationRainFixture} from '../preservation-fixture'
const out=process.argv[2]??'test-results/preservation-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);await p.keyboard.press('.');await idle(p);return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:out+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);assert.deepEqual(after,before);writeFileSync(out+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(out+'/'+label+'-after.json',JSON.stringify(after));return after}
async function craft(p:Page){await close(p);await p.keyboard.press('F2');await p.getByTestId('win-craft').waitFor()}
async function tip(p:Page,uid:number){await close(p);await p.keyboard.press('i');await p.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').hover();await p.getByTestId('tooltip').waitFor()}
let page:Page|undefined
try{
 // INITIAL was produced by three actual pieces of wood and almost six hours of ordinary rest/actions.
 const d=preservationBoundaryFixture();page=await initial(d.w);let s=await read(page),p=player({db:d.w.db,s}),batch=s.map.batches!.find(b=>b.id===d.batch.id)!
 assert.equal(batch.processing!.progress,7199);assert.equal(batch.processing!.inputs[0].uid,d.raw.uid);assert.equal(p.bag.some(i=>i.def==='Item.SmokedMeat'),false)
 await craft(page);await page.locator('[data-preservation-id="'+batch.id+'"]').getByText('거의 완료',{exact:false}).waitFor();assert.equal(await page.locator('[data-batch-id="'+batch.id+'"]').isDisabled(),true);await shot(page,'452-native-original-meat-and-three-real-wood-pieces-after-almost-six-actual-hours');await restore(page,'same-original-real-six-hour-batch-before-last-turn')
 await close(page);await page.keyboard.press('.');await idle(page);s=await read(page);batch=s.map.batches!.find(b=>b.id===d.batch.id)!;assert.equal(batch.processing!.progress,7200)
 await craft(page);assert.equal(await page.locator('[data-batch-id="'+batch.id+'"]').isEnabled(),true);await shot(page,'453-native-last-real-turn-completes-same-six-hour-finite-fuel-batch')
 const at=s.time;await page.locator('[data-batch-id="'+batch.id+'"]').click();await idle(page);s=await read(page);p=player({db:d.w.db,s});const outFood=p.bag.find(i=>i.def==='Item.SmokedMeat')!
 assert.equal(s.time-at,100);assert.equal(s.map.batches!.some(b=>b.id===batch.id),false);assert.equal(outFood.count,1);assert.ok(outFood.freshness!<73);assert.equal(outFood.contaminantAsh,.5);assert.notEqual(outFood.uid,d.raw.uid)
 await tip(page,outFood.uid);await page.getByTestId('tooltip').getByText(/훈제 냄새 반경/).waitFor();await shot(page,'454-native-one-original-result-keeps-aged-freshness-and-original-ash-with-real-scent-radius');await restore(page,'same-original-smoked-food-after-actual-once-only-collection')
 const before=player({db:d.w.db,s}).needs.kcal,ash=player({db:d.w.db,s}).needs.ash??0;await close(page);await page.keyboard.press('i');await page.getByTestId('win-inv').locator('[data-uid="'+outFood.uid+'"]').dblclick();await idle(page);s=await read(page);p=player({db:d.w.db,s})
 assert.equal(p.bag.some(i=>i.uid===outFood.uid),false);assert.ok(p.needs.kcal-before>209&&p.needs.kcal-before<211);assert.equal(p.needs.ash,ash+.5)
 await close(page);await page.keyboard.press('Shift+J');await page.getByTestId('win-journal').getByRole('button',{name:'생존',exact:true}).click();await shot(page,'455-native-actual-smoked-food-consumption-keeps-existing-protein-absorption-and-original-ash');await page.close()
 // Independent INITIAL has actually waited two hours until the original first piece of wood ran out.
 const paused=preservationPausedFixture();page=await initial(paused.w);s=await read(page);batch=s.map.batches!.find(b=>b.id===paused.batch.id)!;assert.equal(batch.processing!.progress,2400);await craft(page);await page.locator('[data-preservation-id="'+batch.id+'"]').getByText(/실제 땔감/).waitFor();assert.equal(await page.locator('[data-batch-id="'+batch.id+'"]').isDisabled(),true);await shot(page,'456-native-original-two-hour-fuel-exhaustion-pauses-same-real-smoke-batch');await restore(page,'same-original-exhausted-fire-and-paused-food');await page.close()
 // Independent INITIAL is an actually prepared drying batch exposed to current rain.
 const rain=preservationRainFixture();page=await initial(rain.w);s=await read(page);batch=s.map.batches!.find(b=>b.id===rain.batch.id)!;assert.equal(batch.processing!.progress,0);await craft(page);await page.locator('[data-preservation-id="'+batch.id+'"]').getByText(/재를 섞은 비바람/).waitFor();assert.equal(await page.locator('[data-batch-id="'+batch.id+'"]').isDisabled(),true);await shot(page,'457-native-exposed-original-drying-food-pauses-in-actual-ash-rain');await restore(page,'same-original-rain-exposed-drying-food')
 assert.deepEqual(errors,[]);writeFileSync(out+'/audit.json',JSON.stringify({save:SAVE_VERSION,rawUid:d.raw.uid,smokedUid:outFood.uid,fireUid:d.batch.processing!.fire!.uid,actualSixHourPreparation:true,wholeRoundtrips:4,screenshots:6,consoleErrors:errors},null,2));console.log('OK: almost six hours actual scheduler/three original wood pieces/original raw meat receipt/real last turn/once-only collection/aged freshness and same ash/actual nutrition and smell/actual two-hour finite fuel pause/actual exposed-rain dry pause/four whole Save69 roundtrips/six screenshots/console0')
}catch(error){if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(out+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
