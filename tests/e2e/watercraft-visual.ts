import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {SAVE_VERSION} from '../../src/core/game'
import {watercraftFixture} from '../watercraft-fixture'
const out=process.argv[2]??'test-results/watercraft-visual-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);if(w.s.simulationPending){await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.getByTestId('continue').waitFor();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');await idle(p)}else{await p.keyboard.press('.');await idle(p)}return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:`${out}/${name}.png`})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);assert.deepEqual(after,before);writeFileSync(`${out}/${label}-before.json`,JSON.stringify(before));writeFileSync(`${out}/${label}-after.json`,JSON.stringify(after));return after}
async function panel(p:Page){await close(p);await p.keyboard.press('F2');const panel=p.getByTestId('marine-panel');await panel.scrollIntoViewIfNeeded();return panel}
let page:Page|undefined
try{
 const d=watercraftFixture(),lamp=d.add('Item.Lantern');d.p.bag=d.p.bag.filter(i=>i.uid!==lamp.uid);d.p.equip.off=lamp;lamp.lit=true;page=await initial(d.w);await close(page);await shot(page,'350-actual-saline-shore-uses-water-properties-and-water-textures');const view=await panel(page);await view.locator(`[data-boat-launch="${d.hull.uid}"]`).click();await idle(page);let s=await read(page);assert.equal(s.map.vessel!.hull.uid,d.hull.uid);assert.equal(s.map.tiles[6*16+8].t,'Terrain.BoatDeck');assert.equal(s.map.tiles[3*16+8].t,'Terrain.SeaDeep');await close(page);await shot(page,'348-unobscured-original-wooden-deck-and-real-deep-sea-in-lantern-light');await restore(page,'rendered-deck');s=await read(page);assert.equal(s.map.vessel!.hull.uid,d.hull.uid);await close(page);await shot(page,'349-whole-save54-keeps-wooden-deck-and-water-rendering-after-native-continue');assert.deepEqual(errors,[]);console.log('OK: native original hull launch/unobscured property-based saline water+wooden deck rendering/one whole Save54 roundtrip/console0')
}catch(error){if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(`${out}/failure-state.json`,JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
