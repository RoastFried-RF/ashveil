import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {player,type World} from '../../src/core/ctx'
import {SAVE_VERSION} from '../../src/core/game'
import {pineTeaNativeFixture} from '../pine-tea-fixture'
import {drinkVolume} from '../../src/core/wash-water'
const out=process.argv[2]??'test-results/pine-tea-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);if(w.s.simulationPending){await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');await idle(p)}else{await p.keyboard.press('.');await idle(p)}return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:out+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(out+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(out+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save72 drift; before/after files saved');return after}
async function inventory(p:Page){await close(p);await p.keyboard.press('i');await p.getByTestId('win-inv').waitFor()}
async function tip(p:Page,uid:number){await inventory(p);await p.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').hover();await p.getByTestId('tooltip').waitFor()}
async function craft(p:Page){await close(p);await p.keyboard.press('F2');await p.getByTestId('win-craft').waitFor();await p.getByTestId('tea-panel').scrollIntoViewIfNeeded()}
let page:Page|undefined
try{
 const d=await pineTeaNativeFixture();page=await initial(d.w);await craft(page);await page.getByTestId('tea-panel').getByText(/실제 1000ml/).waitFor();await shot(page,'470-native-real-pine-original-water-leaves-and-finite-fire-before-tea');await restore(page,'original-water-leaves-and-finite-fire')
 let s=await read(page),p=player({db:d.w.db,s}),leaf=p.bag.find(i=>i.uid===d.leaves.uid)!;const beforeGather=s.time
 await craft(page);await page.locator('[data-tea-action=gather]').click();await idle(page);s=await read(page);p=player({db:d.w.db,s});leaf=p.bag.find(i=>i.uid===d.leaves.uid)!
 assert.equal(s.time-beforeGather,2000);assert.equal(leaf.count,10);assert.equal(p.bag.filter(i=>i.def==='Item.PineNeedles').reduce((n,i)=>n+i.count,0),14)
 assert.ok(s.map.tiles[d.pine.y*s.map.w+d.pine.x].needleGatherAt!>s.time/100);await craft(page);await shot(page,'471-native-actual-twenty-turn-pine-harvest-regrows-with-original-wood-unchanged')
 const time=s.time,next=s.nextId,uid=d.bottle.uid
 await page.locator('[data-tea-action=brew]').click();await idle(page);s=await read(page);p=player({db:d.w.db,s});let bottle=p.bag.find(i=>i.uid===uid)!
 assert.equal(s.time-time,20000);assert.equal(bottle.def,'Item.PineTeaBottle');assert.equal(drinkVolume({db:d.w.db,s},bottle),1000);assert.equal(bottle.water!.pathogen,0);assert.equal(bottle.water!.ash,.22);assert.equal(bottle.water!.salinity,3);assert.equal(bottle.quality,3);assert.equal(bottle.durability,81);assert.equal(s.nextId,next);assert.equal(p.bag.filter(i=>i.def==='Item.PineNeedles').reduce((n,i)=>n+i.count,0),10)
 await tip(page,uid);await page.getByTestId('tooltip').getByText(/300ml당 비타민 6/).waitFor();await shot(page,'472-native-original-one-litre-bottle-boiled-ten-minutes-with-real-vitamin-tea');await restore(page,'same-original-brewed-tea-and-body')
 for(let n=0;n<3;n++){await inventory(page);await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').dblclick();await idle(page)}
 s=await read(page);p=player({db:d.w.db,s});bottle=p.bag.find(i=>i.uid===uid)!;assert.equal(drinkVolume({db:d.w.db,s},bottle),100);assert.equal(p.needs.vitamin,18);await tip(page,uid);await page.getByTestId('tooltip').getByText(/남은 물 100ml/).waitFor();await shot(page,'473-native-three-real-cups-leave-original-final-hundred-millilitres');await restore(page,'original-partial-tea-final-hundred-ml')
 const vitamin=player({db:d.w.db,s:await read(page)}).needs.vitamin
 await inventory(page);await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').dblclick();await idle(page);s=await read(page);p=player({db:d.w.db,s});bottle=p.bag.find(i=>i.uid===uid)!;assert.equal(bottle.def,'Item.WaterBottle');assert.equal(bottle.uses,0);assert.equal(p.needs.vitamin-vitamin,2);assert.equal(bottle.water,undefined);assert.equal(bottle.freshness,undefined);await tip(page,uid);await shot(page,'474-native-final-hundred-ml-gives-two-vitamin-and-the-same-empty-water-bottle');await restore(page,'original-empty-water-bottle-after-real-last-cup');await page.close()
 const noFire=await pineTeaNativeFixture();noFire.s.map.lights=noFire.s.map.lights.filter(l=>l.sourceUid===undefined);page=await initial(noFire.w);await craft(page);assert.equal(await page.locator('[data-tea-action=brew]').isDisabled(),true);await page.getByTestId('tea-panel').getByText(/직접 피운 실제 장작불/).waitFor();await shot(page,'475-native-static-free-fire-cannot-replace-actual-wood-fire-for-tea');await page.close()
 const pending=await pineTeaNativeFixture(true),pendingTime=pending.s.time;page=await initial(pending.w);s=await read(page);p=player({db:pending.w.db,s});bottle=p.bag.find(i=>i.uid===pending.bottle.uid)!;assert.equal(bottle.def,'Item.PineTeaBottle');assert.equal(s.time-pendingTime,19900);assert.equal(drinkVolume({db:pending.w.db,s},bottle),1000);assert.equal(p.bag.find(i=>i.uid===pending.leaves.uid)!.count,6);assert.equal(s.nextId,pending.s.nextId);await tip(page,bottle.uid);await shot(page,'476-native-continue-finishes-original-pending-tea-once-with-same-water-leaves-and-fire');await restore(page,'same-original-pending-tea-completed-once')
 assert.deepEqual(errors,[]);writeFileSync(out+'/audit.json',JSON.stringify({save:SAVE_VERSION,originalBottle:d.bottle.uid,originalLeaves:d.leaves.uid,wholeRoundtrips:5,screenshots:7,actualGatherTurns:20,actualBrewTurns:200,finalPartialMl:100,consoleErrors:errors},null,2));console.log('OK: actual pine harvest/original 1L water and leaves/finite same fire/200 actual turns/300+300+300+100ml exact vitamin20/same empty bottle/five whole Save72 restores/seven screenshots/console0')
}catch(error){writeFileSync(out+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(out+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
