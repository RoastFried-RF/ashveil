import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {player,type World} from '../../src/core/ctx'
import {SAVE_VERSION} from '../../src/core/game'
import {db} from '../helpers'
import {fermentationBoundaryFixture} from '../fermentation-boundary-fixture'
const out=process.argv[2]??'test-results/fermentation-browser';mkdirSync(out,{recursive:true})
// A supplied INITIAL file must have been produced by the actual finite-supply fourteen-day controller.
const initialPath=process.argv[3],prepared=initialPath?undefined:fermentationBoundaryFixture()
const initialState=initialPath?JSON.parse(readFileSync(initialPath,'utf8')) as World['s']:prepared!.s
const originalBatch=initialState.map.batches!.find(b=>b.recipe==='Recipe.FermentCabbage')!,jarUid=originalBatch.processing!.vessel!.uid
assert.equal(originalBatch.processing!.progress,403198)
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(s:World['s']){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),s);await p.keyboard.press('.');await idle(p);return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:out+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(out+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(out+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save70 drift: full before/after files saved');return after}
async function craft(p:Page){await close(p);await p.keyboard.press('F2');await p.getByTestId('win-craft').waitFor()}
async function tip(p:Page,uid:number){await close(p);await p.keyboard.press('i');await p.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').hover();await p.getByTestId('tooltip').waitFor()}
async function eat(p:Page,uid:number){await close(p);await p.keyboard.press('i');await p.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').dblclick();await idle(p)}
let page:Page|undefined
try{
 page=await initial(initialState);let s=await read(page),p=player({db,s}),batch=s.map.batches!.find(b=>b.id===originalBatch.id)!
 assert.equal(batch.processing!.progress,403199);assert.equal(batch.processing!.vessel!.uid,jarUid);assert.equal(p.bag.some(i=>i.uid===jarUid),false)
 await craft(page);assert.equal(await page.locator('[data-batch-id="'+batch.id+'"]').isDisabled(),true);await shot(page,'458-native-original-jar-after-almost-fourteen-actual-days-with-finite-food-water-and-sleep');await restore(page,'original-jar-and-actual-survivor-before-last-fermentation-turn')
 await close(page);await page.keyboard.press('.');await idle(page);s=await read(page);batch=s.map.batches!.find(b=>b.id===originalBatch.id)!;assert.equal(batch.processing!.progress,403200);await craft(page);assert.equal(await page.locator('[data-batch-id="'+batch.id+'"]').isEnabled(),true);await shot(page,'459-native-last-actual-turn-completes-original-fourteen-day-fermentation')
 const next=s.nextId;await page.locator('[data-batch-id="'+batch.id+'"]').click();await idle(page);s=await read(page);p=player({db,s});let jar=p.bag.find(i=>i.uid===jarUid)!;assert.equal(jar.def,'Item.PickledCabbageJar');assert.equal(jar.uses,5);assert.equal(jar.quality,2);assert.equal(jar.durability,71);assert.equal(s.nextId,next);assert.equal(s.map.batches!.some(b=>b.id===batch.id),false)
 await tip(page,jarUid);await page.getByTestId('tooltip').getByText(/남은 음식 5\/5회분/).waitFor();await shot(page,'460-native-same-original-jar-five-servings-keeps-original-quality-durability-and-vitamin');await restore(page,'same-original-filled-jar-after-once-only-collection')
 s=await read(page);p=player({db,s});const vitamin=p.needs.vitamin,kcal=p.needs.kcal,water=p.needs.waterDeficit,ash=p.needs.ash??0;await eat(page,jarUid);s=await read(page);p=player({db,s});jar=p.bag.find(i=>i.uid===jarUid)!
 assert.equal(jar.uses,4);assert.equal(p.needs.vitamin,Math.min(100,vitamin+8));assert.ok(p.needs.kcal-kcal>39&&p.needs.kcal-kcal<=40);assert.ok(p.needs.waterDeficit<=Math.max(0,water-159));assert.ok(Math.abs((p.needs.ash??0)-ash-.1)<1e-9);await tip(page,jarUid);await page.getByTestId('tooltip').getByText(/남은 음식 4\/5회분/).waitFor();await shot(page,'461-native-actual-first-portion-transfers-only-one-meal-and-keeps-four-in-original-open-jar');await restore(page,'same-original-open-jar-after-one-real-portion')
 for(let i=0;i<4;i++)await eat(page,jarUid);s=await read(page);p=player({db,s});jar=p.bag.find(i=>i.uid===jarUid)!
 assert.equal(jar.def,'Item.CeramicJar');assert.equal(jar.uses,undefined);assert.equal(jar.foodVesselDef,undefined);assert.equal(jar.contaminantAsh,undefined);assert.equal(jar.quality,2);assert.equal(jar.durability,71);assert.equal(s.nextId,next);assert.equal(p.bag.filter(i=>i.uid===jarUid).length,1);assert.ok(Math.abs((p.needs.ash??0)-ash-.5)<1e-9)
 await tip(page,jarUid);await page.getByTestId('tooltip').getByText('빈 도기 항아리',{exact:true}).waitFor();await shot(page,'462-native-last-fifth-portion-leaves-only-the-same-original-empty-jar-without-new-uid');await restore(page,'same-original-empty-jar-after-all-five-real-portions')
 await close(page);await page.keyboard.press('Shift+J');await page.getByTestId('win-journal').getByRole('button',{name:'생존',exact:true}).click();await shot(page,'463-native-actual-survivor-keeps-real-vitamin-water-food-history-and-empty-original-vessel-after-continue')
 assert.deepEqual(errors,[]);writeFileSync(out+'/audit.json',JSON.stringify({save:SAVE_VERSION,originalJar:jarUid,actualFourteenDayPreparation:true,wholeRoundtrips:4,screenshots:6,consoleErrors:errors},null,2));console.log('OK: actual finite-supply fourteen day survivor/original same jar/real final fermentation turn/once-only collection/all five physical portions/original vitamin and ash/same empty vessel quality durability and uid/four whole Save70 roundtrips/six screenshots/console0')
}catch(error){if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(out+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
