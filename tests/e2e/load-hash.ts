import { chromium, type Page } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import type { World } from '../../src/core/ctx'
import { SAVE_VERSION } from '../../src/core/game'
import { loadDb } from '../../tools/loadContent'

const out=process.argv[2]??'test-results/load-hash-browser'
mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true})
await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors:string[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
type Hook={__ashveil:{world():World}}
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const scripts=()=>page.evaluate(()=>{const w=(window as unknown as Hook).__ashveil.world();return{loadedMods:w.db.loadedMods,sources:w.db.scriptSources,modules:w.db.scriptModules}})
async function select(id:string){await page.getByTestId('definition-search').fill(id);await page.locator(`[data-definition-id="${id}"]`).click();await page.waitForFunction(id=>document.querySelector('[data-testid="definition-selected"]')?.textContent?.startsWith(id),id)}
async function shot(name:string){await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'})}
async function trap(p:Page){for(let i=0;i<12;i++){await p.keyboard.press(i%3===0?'Shift+Tab':'Tab');assert.equal(await p.evaluate(()=>!!document.activeElement?.closest('[data-testid="definition-inspector"]')),true)}}
try{
 await page.goto('http://localhost:4317/?debug')
 await page.getByTestId('seed').fill('actual-readonly-definition-inspector')
 await page.locator('input[type="checkbox"][value="sample.grim"]').check()
 await page.locator('input[type="checkbox"][value="sample-script-prosthetic"]').check()
 const selectedBefore=await page.locator('input[type="checkbox"]:checked').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value))
 const titleHash=await page.getByTestId('title-load-hash').innerText()
 await page.getByTestId('open-definition-inspector').click()
 const expected=loadDb(['sample.grim','sample-script-prosthetic']).db.loadHash;assert.equal(titleHash,'콘텐츠 로드 해시: '+expected)
 await page.getByTestId('definition-report').locator(':scope > summary').click()
 assert.equal(await page.getByTestId('definition-load-hash').innerText(),'콘텐츠 로드 해시: '+expected)
 await shot('1231-native-selected-browser-and-node-configuration-share-identical-sha256-content-hash')
 await select('Item.PegLeg');await page.getByTestId('definition-fields-tab').click()
 await shot('1232-native-immutable-selected-definitions-remain-readable-with-actual-source-fields')
 await page.getByTestId('definition-search').fill('흰갓');await page.getByTestId('definition-type').selectOption('Item')
 assert.ok(await page.locator('[data-definition-id="Item.Whitecap"]').count())
 await page.getByTestId('definition-search').fill('[');assert.equal(await page.getByTestId('definition-count').innerText(),'0개')
 await trap(page);await page.keyboard.press('Escape');await page.getByTestId('definition-inspector').waitFor({state:'detached'})
 assert.deepEqual(await page.locator('input[type="checkbox"]:checked').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value)),selectedBefore)
 assert.equal(await page.getByTestId('seed').inputValue(),'actual-readonly-definition-inspector')
 await page.getByTestId('start').click();await page.waitForSelector('[data-testid=map] canvas')
 await page.waitForFunction(()=>!!(window as unknown as Hook).__ashveil?.world())
 await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0)
 const before=await read(),scriptsBefore=await scripts();assert.equal(before.version,SAVE_VERSION)
 const immutable=await page.evaluate(()=>{const w=(window as unknown as Hook).__ashveil.world(),terrain=w.db.terrain('Terrain.KtFloor'),ids=w.db.all('Item').map(d=>d.id),copy=w.db.all('Item');copy.reverse();copy.pop();return{hash:w.db.loadHash,frozen:Object.isFrozen(terrain),write:Reflect.set(terrain,'passable',false),hashWrite:Reflect.set(w.db,'loadHash','fake'),idsUnchanged:JSON.stringify(ids)===JSON.stringify(w.db.all('Item').map(d=>d.id))}})
 assert.deepEqual(immutable,{hash:expected,frozen:true,write:false,hashWrite:false,idsUnchanged:true});assert.deepEqual(await read(),before)
 assert.deepEqual(scriptsBefore.loadedMods,['core','sample-script-prosthetic','sample.grim'])
 await page.keyboard.press('F3');await page.getByTestId('open-definition-inspector').click();await select('Item.PegLeg')
 await page.getByTestId('definition-report').locator(':scope > summary').click();assert.equal(await page.getByTestId('definition-load-hash').innerText(),'콘텐츠 로드 해시: '+expected);await trap(page)
 await page.getByTestId('definition-detail').click();for(const key of ['r','.','ArrowRight','i','Enter'])await page.keyboard.press(key)
 assert.deepEqual(await read(),before);assert.deepEqual(await scripts(),scriptsBefore)
 await shot('1233-native-game-rejects-definition-and-hash-writes-preserves-whole177-and-script-state-on-entire-imprint-restore')
 await page.keyboard.press('F3');await page.getByTestId('definition-inspector').waitFor({state:'detached'});assert.ok(await page.getByTestId('win-settings').isVisible())
 await page.keyboard.press('Escape');assert.deepEqual(await read(),before)
 await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas')
 assert.deepEqual(await read(),before);assert.deepEqual(await scripts(),scriptsBefore);assert.deepEqual(errors,[])
 writeFileSync(`${out}/whole-readonly-and-restore.json`,JSON.stringify({before,after:await read(),scriptsBefore,scriptsAfter:await scripts()}))
 writeFileSync(`${out}/audit.json`,JSON.stringify({screenshots:3,wholeRoundtrips:1,save:SAVE_VERSION,selectedModsUnchanged:true,wholeGameUnchanged:true,scriptStateUnchanged:true,errors},null,2))
 console.log(JSON.stringify({screenshots:3,wholeRoundtrips:1,save:SAVE_VERSION,errors}))
}catch(error){writeFileSync(`${out}/failure-body.txt`,await page.locator('body').innerText());await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error}
finally{await page.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* already stopped */}}
