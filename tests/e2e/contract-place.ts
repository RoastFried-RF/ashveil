import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {excavationContractsFixture} from '../excavation-contracts-fixture'
import {SAVE_VERSION} from '../../src/core/game'
import type {World} from '../../src/core/ctx'
const out=process.argv[2]??'test-results/contract-place-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[],rows:unknown[]=[]
type Hook={__ashveil:{world():World;refresh():void}}
let page:Page|undefined,screenshots=0,wholeRoundtrips=0
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s))as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return w&&!w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:300000})
async function close(p:Page){for(let i=0;i<8&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1050}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.getByTestId('start').click();await p.waitForSelector('[data-testid=map] canvas');const check=await p.evaluate(s=>{const h=(window as unknown as Hook).__ashveil;h.world().s=s;const before=JSON.parse(JSON.stringify(s));h.refresh();return{before,after:JSON.parse(JSON.stringify(h.world().s))}},w.s);assert.deepEqual(check.before,JSON.parse(JSON.stringify(w.s)));assert.deepEqual(check.after,check.before);return p}
async function shot(p:Page,name:string,selector='[data-testid^="win-"]:visible'){await p.waitForTimeout(300);await p.locator(selector).last().screenshot({path:out+'/'+name+'.png',animations:'disabled'});screenshots++}
async function restore(p:Page,name:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.getByTestId('continue').click();await p.waitForSelector('[data-testid=map] canvas');await idle(p);const actual=await read(p);assert.deepEqual(actual,before);writeFileSync(out+'/'+name+'-restore.json',JSON.stringify({before,actual}));wholeRoundtrips++}

async function board(p:Page,id:number){await close(p);await p.keyboard.press('n');await p.getByTestId('win-society').waitFor();await p.locator(`[data-person-id="${id}"]`).click();const panel=p.getByTestId('excavation-contract-panel');if(!await panel.evaluate(el=>(el as HTMLDetailsElement).open))await panel.locator(':scope > summary').click();await panel.scrollIntoViewIfNeeded()}
const panelSelector='[data-testid="excavation-contract-panel"]'
async function journal(p:Page){await close(p);await p.getByTestId('btn-journal').click();await p.getByTestId('win-journal').waitFor();await p.getByRole('button',{name:'계약',exact:true}).click()}
try{
 for(const[phase,index]of[['offer',1100],['accepted',1101],['field',1102]]as const){const d=excavationContractsFixture(phase);page=await initial(d.w);const before=await read(page);if(phase==='offer')await board(page,d.trader.id);else await journal(page);const selector=phase==='offer'?panelSelector:'[data-testid="win-journal"]',text=await page.locator(selector).innerText();assert(text.includes('검은 숲 정비구 / 비상 종자 금고'));assert(!text.includes('Region.ShadeGrove'));assert(!text.includes('seed-vault'));assert.deepEqual(await read(page),before);await shot(page,index+'-native-authored-korean-contract-place-'+phase,selector);await restore(page,'actual-authored-place-'+phase+'-zero-turns-whole-exact');rows.push({...d.proof,actualUiTurns:0,koreanPlace:'검은 숲 정비구 / 비상 종자 금고'});await page.close();page=undefined}
 assert.equal(screenshots,3);assert.equal(wholeRoundtrips,3);assert.deepEqual(errors,[]);writeFileSync(out+'/audit.json',JSON.stringify({rows,screenshots,wholeRoundtrips,errors,save:SAVE_VERSION,actualUiTurns:0},null,2));console.log(JSON.stringify({screenshots,wholeRoundtrips,errors,save:SAVE_VERSION,actualUiTurns:0},null,2))
}catch(error){if(page){writeFileSync(out+'/failure-body.txt',await page.locator('body').innerText());await page.screenshot({path:out+'/failure.png'}).catch(()=>{});writeFileSync(out+'/failure-state.json',JSON.stringify(await read(page).catch(()=>undefined)))}throw error}finally{await page?.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* already stopped */}}
