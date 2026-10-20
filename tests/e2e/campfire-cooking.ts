import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {player,type World} from '../../src/core/ctx'
import {SAVE_VERSION} from '../../src/core/game'
import {cookingNativeFixture} from '../campfire-cooking-fixture'
const out=process.argv[2]??'test-results/campfire-cooking-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);if(w.s.simulationPending){await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');await idle(p)}else{await p.keyboard.press('.');await idle(p)}return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:out+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(out+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(out+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save77 drift; before/after files saved');return after}
async function inventory(p:Page){await close(p);await p.keyboard.press('i');await p.getByTestId('win-inv').waitFor()}
async function tip(p:Page,uid:number){await inventory(p);await p.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').hover();await p.getByTestId('tooltip').waitFor()}
async function journal(p:Page){await close(p);await p.getByRole('button',{name:/일지/}).click();await p.getByTestId('win-journal').waitFor()}

async function crafting(p:Page){await close(p);await p.keyboard.press('F2');await p.getByTestId('win-craft').waitFor()}
let page:Page|undefined
try{
 const d=await cookingNativeFixture();page=await initial(d.w);let s=await read(page),p=player({db:d.w.db,s});const uid=d.raw.uid,next=s.nextId,at=s.time
 await tip(page,uid);await shot(page,'505-native-original-potato-and-actual-fuelled-campfire-before-one-portion-is-placed')
 await inventory(page);await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').click({button:'right'});await page.getByRole('button',{name:/모닥불에 올리기/}).click();await idle(page);s=await read(page);p=player({db:d.w.db,s});let b=s.map.cooking![0]
 assert.equal(s.time-at,100);assert.equal(b.progress,1);assert.equal(b.item.uid,uid);assert.equal(b.item.count,1);assert.equal(b.item.def,'Item.RawPotato');assert.equal(p.bag.some(i=>i.uid===uid),false);assert.equal(s.nextId,next)
 await crafting(page);await page.getByTestId('cooking-panel').waitFor();await shot(page,'506-native-original-one-potato-now-only-on-same-fire-with-real-one-of-two-hundred-turns');await restore(page,'same-original-one-portion-on-actual-fire')
 await crafting(page);await page.locator('[data-cooking-action="wait"]').click();await idle(page);s=await read(page);b=s.map.cooking![0];assert.equal(s.time-at,20000);assert.equal(b.progress,200);assert.equal(b.item.def,'Item.BakedPotato');assert.equal(b.item.foodBurnt,undefined);assert.equal(b.item.foodFrozen??false,false);assert.equal(b.item.foodThawed,true);assert.equal(b.item.contaminantAsh,.4);assert.equal(b.item.foodQ,29);assert.equal(s.nextId,next)
 await crafting(page);await shot(page,'507-native-two-hundred-real-hot-turns-cook-same-original-potato-with-quality-and-thawed-food');await restore(page,'same-original-ready-potato-with-actual-quality')
 await crafting(page);await page.locator('[data-cooking-action="rest"]').click();await idle(page);s=await read(page);b=s.map.cooking![0];assert.equal(s.time-at,40000);assert.equal(b.item.foodBurnt,true);assert.equal(b.item.uid,uid);assert.equal(b.item.count,1);assert.equal(s.nextId,next);await crafting(page);await shot(page,'508-native-default-ten-percent-real-neglect-check-burns-original-potato-after-two-hundred-more-hot-turns');await restore(page,'same-original-burnt-potato-and-real-rng')
 await crafting(page);await page.locator('[data-cooking-action="take"]').click();await idle(page);s=await read(page);p=player({db:d.w.db,s});assert.equal(s.map.cooking!.length,0);const food=p.bag.find(i=>i.uid===uid)!;assert.equal(food.foodBurnt,true);await tip(page,uid);await page.getByTestId('tooltip').getByText(/105 kcal/).waitFor()
 const kcal=p.needs.kcal,vit=p.needs.vitamin;await inventory(page);await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').dblclick();await idle(page);s=await read(page);p=player({db:d.w.db,s});assert.equal(p.bag.some(i=>i.uid===uid),false);assert.ok(p.needs.kcal-kcal>104&&p.needs.kcal-kcal<=105);assert.equal(p.needs.vitamin-vit,4);assert.equal(p.thoughts.find(t=>t.def==='Thought.BurntFood')!.events!.at(-1)!.mood,-4);assert.equal(s.nextId,next)
 await journal(page);await shot(page,'509-native-one-actual-burnt-potato-meal-gives-one-hundred-five-calories-and-real-minus-four-taste');await restore(page,'same-actually-fed-body-and-burnt-food-thought');await page.close()
 const pending=await cookingNativeFixture(true),pendingAt=pending.s.time;page=await initial(pending.w);s=await read(page);b=s.map.cooking![0];assert.equal(s.time-pendingAt,19900);assert.equal(b.item.uid,pending.raw.uid);assert.equal(b.item.def,'Item.BakedPotato');assert.equal(b.progress,200);assert.equal(b.item.count,1);assert.equal(s.nextId,pending.s.nextId)
 await crafting(page);await shot(page,'510-native-continue-finishes-original-pending-cooking-rest-once-with-same-one-portion');await restore(page,'same-original-pending-cooking-completed-once')
 assert.deepEqual(errors,[]);writeFileSync(out+'/audit.json',JSON.stringify({save:SAVE_VERSION,seed:d.s.seed,originalFoodUid:uid,originalFireUid:b.fireUid,actualCookingTurns:200,actualNeglectTurns:200,defaultBurnChance:.1,actualBurntCalories:105,actualBurntMood:-4,wholeRoundtrips:5,screenshots:6,consoleErrors:errors},null,2));console.log('OK: same actual original one potato/fire/fuel200T/real Q29/thawed/default10percent200Tneglect/burn105kcal-4taste/actual take+meal/pending199Tonce/five whole77 restores/six screenshots/console0')
}catch(error){writeFileSync(out+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(out+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
