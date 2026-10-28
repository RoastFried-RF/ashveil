import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {player,type World} from '../../src/core/ctx'
import {SAVE_VERSION} from '../../src/core/game'
import {eggNativeFixture} from '../eggs-fixture'
const out=process.argv[2]??'test-results/eggs-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);if(w.s.simulationPending){await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');await idle(p)}else{await p.keyboard.press('.');await idle(p)}return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:out+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(out+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(out+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save76 drift; before/after files saved');return after}
async function inventory(p:Page){await close(p);await p.keyboard.press('i');await p.getByTestId('win-inv').waitFor()}
async function tip(p:Page,uid:number){await inventory(p);await p.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').hover();await p.getByTestId('tooltip').waitFor()}

let page:Page|undefined
try{
 const d=await eggNativeFixture();page=await initial(d.w);let s=await read(page),p=player({db:d.w.db,s});const uid=d.egg.uid,next=s.nextId,dropAt=s.time
 await tip(page,uid);await page.getByTestId('tooltip').getByText(/30%/).waitFor();await shot(page,'500-native-three-original-eggs-and-actual-default-thirty-percent-floor-impact-warning');await restore(page,'same-original-three-intact-eggs')
 await inventory(page);await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').click({button:'right'});await page.getByRole('button',{name:'버리기',exact:true}).click();await idle(page);s=await read(page);p=player({db:d.w.db,s});const floor=s.map.tiles[p.pos.y*s.map.w+p.pos.x].items.find(i=>i.uid===uid)!
 assert.equal(s.time,dropAt);assert.equal(s.nextId,next);assert.equal(p.bag.some(i=>i.uid===uid),false);assert.equal(floor.def,'Item.CrackedEgg');assert.equal(floor.count,3);assert.equal(floor.quality,2);assert.equal(floor.durability,81);assert.equal(floor.foodAgedAt,dropAt/100)
 await inventory(page);await page.getByTestId('win-inv').locator('[data-floor-uid="'+uid+'"]').hover();await page.getByTestId('tooltip').waitFor();await shot(page,'501-native-real-floor-impact-cracks-same-original-three-eggs-without-new-uid-or-lost-nutrition');await restore(page,'same-original-cracked-floor-stack-and-actual-noise')
 await inventory(page);await page.getByTestId('win-inv').locator('[data-floor-uid="'+uid+'"]').dblclick();await idle(page);s=await read(page);p=player({db:d.w.db,s});let actual=p.bag.find(i=>i.uid===uid)!;assert.equal(actual.def,'Item.CrackedEgg');assert.equal(actual.count,3);assert.equal(s.nextId,next);await tip(page,uid);await shot(page,'502-native-pickup-preserves-original-cracked-contents-and-six-hour-spoilage');await restore(page,'same-original-picked-up-cracked-contents')
 s=await read(page);p=player({db:d.w.db,s});const kcal=p.needs.kcal,vit=p.needs.vitamin,water=p.needs.waterDeficit,eatAt=s.time
 await inventory(page);await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').dblclick();await idle(page);s=await read(page);p=player({db:d.w.db,s});actual=p.bag.find(i=>i.uid===uid)!
 assert.equal(actual.def,'Item.CrackedEgg');assert.equal(actual.count,2);assert.equal(s.nextId,next+1);assert.equal(s.time-eatAt,100);assert.ok(p.needs.kcal-kcal>79&&p.needs.kcal-kcal<=80);assert.equal(p.needs.vitamin-vit,1);assert.ok(water-p.needs.waterDeficit>44&&water-p.needs.waterDeficit<=45);await tip(page,uid);await shot(page,'503-native-one-real-cracked-egg-meal-feeds-eighty-calories-one-vitamin-and-forty-five-ml-leaving-two-original-eggs');await restore(page,'same-original-two-eggs-and-actually-fed-body')
 await inventory(page);await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').click({button:'right'});const rng=structuredClone((await read(page)).rng);await page.getByRole('button',{name:'버리기',exact:true}).click();await idle(page);s=await read(page);p=player({db:d.w.db,s});assert.deepEqual(s.rng,rng);assert.equal(s.map.tiles[p.pos.y*s.map.w+p.pos.x].items.find(i=>i.uid===uid)!.def,'Item.CrackedEgg')
 await inventory(page);await page.getByTestId('win-inv').locator('[data-floor-uid="'+uid+'"]').hover();await page.getByTestId('tooltip').waitFor();await shot(page,'504-native-redropping-same-two-cracked-eggs-never-restores-shell-or-rerolls-impact');await restore(page,'same-original-redropped-two-eggs-no-reroll')
 assert.deepEqual(errors,[]);writeFileSync(out+'/audit.json',JSON.stringify({save:SAVE_VERSION,seed:d.s.seed,originalEggUid:uid,originalCount:3,remainingCount:2,defaultDropChance:.3,actualMealTurns:1,wholeRoundtrips:5,screenshots:5,consoleErrors:errors},null,2));console.log('OK: default30percent actual original3 eggs/drop/sameUID/cracked6h/pickup/one actual80kcal1vit45ml/two remain/redrop no reroll/five whole76 restores/five screenshots/console0')
}catch(error){writeFileSync(out+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(out+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
