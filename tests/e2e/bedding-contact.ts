import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { startClaimBase } from '../../src/core/base-camp'
import type { World } from '../../src/core/ctx'
import { perform } from '../../src/core/actions'
import { SAVE_VERSION } from '../../src/core/game'
import { addToBag, makeItem } from '../../src/core/items'
import { baseFixture, finishBase } from '../base-camp-fixture'
const out=process.argv[2]??'test-results/bedding-contact-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise((r)=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())})
type Hook={__ashveil:{world():World}}
const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})
async function wait(){await page.keyboard.press('Numpad5');await idle()}
async function restore(name:string){const before=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));assert.equal(JSON.parse(before).version,SAVE_VERSION);await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');const after=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));writeFileSync(`${out}/${name}-before.json`,before);writeFileSync(`${out}/${name}-after.json`,after);assert.deepEqual(JSON.parse(after),JSON.parse(before))}
try{
 const{w,p,worker,store}=baseFixture();startClaimBase(w,p,store);finishBase(w,p);for(const l of w.s.map.lights)l.off=true;w.s.weather='clear';w.s.weatherUntil=1e12;w.s.wind={x:0,y:0};worker.needs.fatigue=90
 const bed=makeItem(w,'Item.Bedroll');bed.wetness={torso:100};addToBag(w,p,bed);assert.equal(perform(w,p,{type:'place',uid:bed.uid,dir:6}).ok,true)
 const read=()=>page.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();return JSON.parse(JSON.stringify({time:s.time,p:s.creatures.find((c)=>c.id===s.playerId)!,worker:s.creatures.find((c)=>c.id===id)!,base:s.map.baseCamp!,bed:s.map.tiles[20*s.map.w+19],next:s.nextId})) as {time:number;p:typeof p;worker:typeof worker;base:NonNullable<typeof s.map.baseCamp>;bed:typeof s.map.tiles[number];next:number}},worker.id)
 await page.goto('http://localhost:4317/?debug');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((s)=>((window as unknown as Hook).__ashveil.world().s = s),w.s);await page.keyboard.press('F2');const base=page.locator('[data-testid=base-camp-panel]'),row=base.locator(`[data-base-worker="${worker.id}"]`);await row.getByLabel(`${worker.name} 침구`,{exact:true}).selectOption(String(bed.uid));await row.locator('[data-base-bed=assign]').click();await idle();let s=await read();const next=s.next;await page.screenshot({path:`${out}/214-real-wet-bed-assigned.png`});await page.keyboard.press('Escape')
 for(let i=0;!s.worker.asleep&&i<20;i++){await wait();s=await read()}
 assert.equal(s.worker.asleep,true);for(let i=0;i<20;i++)await wait();s=await read();assert.ok(s.worker.needs.wetness>0&&s.worker.needs.wetness<5);assert.ok(s.bed.placed!.item.wetness!.torso!<100);assert.equal(s.bed.placed!.item.uid,bed.uid);assert.equal(s.next,next);await page.screenshot({path:`${out}/215-actual-contact-progress-before-waking.png`});await restore('contact')
 for(let i=0;s.worker.asleep&&i<12;i++){await page.keyboard.press('r');await idle();s=await read()}
 assert.equal(s.worker.asleep,false);assert.ok(s.worker.needs.wetness>=19.9);assert.ok(s.worker.needs.bodyTemp>=35);assert.ok(s.worker.needs.waterDeficit<500);assert.ok(s.worker.needs.fatigue>25);assert.ok(s.time>w.s.time+300*100);assert.equal(s.bed.placed!.item.uid,bed.uid);assert.equal(s.next,next);assert.deepEqual([s.p.money,s.worker.money],[p.money,worker.money]);await page.keyboard.press('F2');await page.screenshot({path:`${out}/216-real-wetness-woke-same-body-and-bed.png`});await page.keyboard.press('Escape');await restore('wet-waking');assert.deepEqual(errors,[]);console.log('OK: actual wet bed/real assignment and walking/gradual contact/body-driven wet waking/same UID/whole save39')
}catch(error){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});writeFileSync(`${out}/failure.txt`,await page.textContent('body')??'');console.error(errors);throw error}
finally{await browser.close();if(server.pid)process.kill(-server.pid)}
