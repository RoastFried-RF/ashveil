import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {player,type World} from '../../src/core/ctx'
import {SAVE_VERSION} from '../../src/core/game'
import {boiledMealNativeFixture} from '../boiled-meal-fixture'
import {drinkVolume} from '../../src/core/wash-water'
const out=process.argv[2]??'test-results/boiled-meal-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);if(w.s.simulationPending){await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');await idle(p)}else{await p.keyboard.press('.');await idle(p)}return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:out+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(out+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(out+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save73 drift; before/after files saved');return after}
async function inventory(p:Page){await close(p);await p.keyboard.press('i');await p.getByTestId('win-inv').waitFor()}
async function tip(p:Page,uid:number){await inventory(p);await p.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').hover();await p.getByTestId('tooltip').waitFor()}
async function recipe(p:Page){await close(p);await p.keyboard.press('F2');await p.getByTestId('win-craft').waitFor();const card=p.getByTestId('Recipe.Oatmeal');await card.scrollIntoViewIfNeeded();return card}
let page:Page|undefined
try{
 const d=await boiledMealNativeFixture();page=await initial(d.w);let card=await recipe(page);await card.getByText(/실제 물 220ml/).waitFor();await shot(page,'477-native-original-oats-bowl-and-actual-water-before-twenty-minute-meal');await restore(page,'original-oats-water-bowl-and-finite-fire')
 let s=await read(page),p=player({db:d.w.db,s});const at=s.time,next=s.nextId,uid=d.bowl.uid
 card=await recipe(page);await card.getByRole('button',{name:'제작',exact:true}).click();await idle(page);s=await read(page);p=player({db:d.w.db,s});let bowl=p.bag.find(i=>i.uid===uid)!
 assert.equal(s.time-at,40000);assert.equal(s.nextId,next);assert.equal(bowl.def,'Item.OatmealBowl');assert.equal(bowl.quality,3);assert.equal(bowl.durability,81);assert.equal(bowl.uses,1);assert.equal(bowl.foodSaltGrams,.66);assert.ok(bowl.contaminantAsh!>0);assert.equal(drinkVolume({db:d.w.db,s},p.bag.find(i=>i.uid===d.bottle.uid)!),780);assert.equal(p.bag.find(i=>i.uid===d.oats.uid)!.count,2);assert.ok(p.needs.kcal<0)
 await tip(page,uid);await page.getByTestId('tooltip').getByText(/아직 따뜻함/).waitFor();await shot(page,'478-native-original-bowl-holds-real-hot-oatmeal-after-four-hundred-actual-turns');await restore(page,'same-original-hot-bowl-and-real-water-remainder')
 await tip(page,uid);await page.getByTestId('tooltip').getByText(/원래 물의 소금/).waitFor();await shot(page,'479-native-original-ash-salt-and-actual-warm-meal-are-preserved')
 s=await read(page);p=player({db:d.w.db,s});const kcal=p.needs.kcal,ash=p.needs.ash??0,temperature=p.needs.bodyTemp,water=p.needs.waterDeficit,time=s.time
 await inventory(page);await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').dblclick();await idle(page);s=await read(page);p=player({db:d.w.db,s});bowl=p.bag.find(i=>i.uid===uid)!
 assert.equal(s.time-time,100);assert.equal(bowl.def,'Item.Bowl');assert.equal(bowl.quality,3);assert.equal(bowl.durability,81);assert.equal(bowl.foodSaltGrams,undefined);assert.equal(bowl.foodHeatedAt,undefined);assert.equal(bowl.contaminantAsh,undefined);assert.ok(p.needs.kcal-kcal>299&&p.needs.kcal-kcal<=300);assert.ok((p.needs.ash??0)>ash);assert.ok(p.needs.bodyTemp>=Math.min(temperature+.19,37.19));assert.ok(p.needs.waterDeficit>water-220)
 await tip(page,uid);await shot(page,'480-native-one-real-meal-feeds-and-warms-body-once-leaving-same-original-empty-bowl');await restore(page,'same-original-empty-bowl-after-real-meal');await page.close()
 const short=await boiledMealNativeFixture(false,200);page=await initial(short.w);card=await recipe(page);assert.equal(await card.getByRole('button',{name:'제작',exact:true}).isDisabled(),true);await card.getByText(/실제 물220ml/).waitFor();await shot(page,'481-native-actual-water-shortage-refuses-original-meal-without-consuming-oats-or-bowl');await page.close()
 const pending=await boiledMealNativeFixture(true),pendingTime=pending.s.time;page=await initial(pending.w);s=await read(page);p=player({db:pending.w.db,s});bowl=p.bag.find(i=>i.uid===pending.bowl.uid)!
 assert.equal(s.time-pendingTime,40000);assert.equal(bowl.def,'Item.OatmealBowl');assert.equal(bowl.uses,1);assert.equal(s.nextId,pending.s.nextId);assert.equal(p.bag.find(i=>i.uid===pending.oats.uid)!.count,2);assert.equal(drinkVolume({db:pending.w.db,s},p.bag.find(i=>i.uid===pending.bottle.uid)!),780);await tip(page,bowl.uid);await shot(page,'482-native-continue-finishes-original-pending-meal-once-with-same-bowl-water-oats-and-fire');await restore(page,'same-original-pending-meal-completed-once')
 assert.deepEqual(errors,[]);writeFileSync(out+'/audit.json',JSON.stringify({save:SAVE_VERSION,originalBowl:d.bowl.uid,originalWater:d.bottle.uid,originalOats:d.oats.uid,wholeRoundtrips:4,screenshots:6,actualCookingTurns:400,actualWaterMl:220,consoleErrors:errors},null,2));console.log('OK: original actual oats/220ml water/same finite fire/400 actual turns/same hot bowl/real warm nutrition ash salt/empty same bowl/shortage atomic/pending actual meal/four whole Save73/seven original resources preserved/six screenshots/console0')
}catch(error){writeFileSync(out+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(out+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
