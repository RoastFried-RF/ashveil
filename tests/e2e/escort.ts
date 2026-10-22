import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { activityStep, perform } from '../../src/core/actions'
import { tileAt, type World } from '../../src/core/ctx'
import { cheb, dirIndex } from '../../src/core/geom'
import { addToBag, makeItem } from '../../src/core/items'
import { generateDungeon } from '../../src/core/mapgen'
import { prisonerFixture } from '../prisoner-fixture'

const out=process.argv[2]??'test-results/escort-browser'
mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true})
await new Promise((r)=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[]
page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())})
type Hook={__ashveil:{world():World}}
try{
 const{w,p,target}=prisonerFixture(),link=w.s.map.links.find((l)=>l.to==='crypt1')!,stairs=tileAt(w,link.pos).t
 p.pos={...link.pos};target.pos={x:p.pos.x+1,y:p.pos.y}
 for(let y=p.pos.y-3;y<=p.pos.y+3;y++)for(let x=p.pos.x-3;x<=p.pos.x+3;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
 tileAt(w,link.pos).t=stairs;w.s.map.lights=[{pos:{...p.pos},radius:8,kind:'campfire'}]
 assert.equal(perform(w,p,{type:'prisoner',target:target.id,operation:'bind'}).ok,true);while(p.activity)activityStep(w,p)
 const uid=target.captivity!.rope.uid,bow=makeItem(w,'Item.Bow');addToBag(w,p,bow)
 const gen=generateDungeon(w,1),arrival=gen.map.links.find((l)=>l.to==='surface')!.pos
 for(let y=arrival.y-3;y<=arrival.y+3;y++)for(let x=arrival.x-3;x<=arrival.x+3;x++)if(x>=0&&y>=0&&x<gen.map.w&&y<gen.map.h)gen.map.tiles[y*gen.map.w+x].t='Terrain.Earth'
 w.s.maps.crypt1=gen.map;w.s.offCreatures.crypt1=[]
 await page.goto('http://localhost:4317/?debug');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas')
 await page.evaluate((state)=>((window as unknown as Hook).__ashveil.world().s = state),w.s)
 const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})
 const read=()=>page.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,p:s.creatures.find((c)=>c.id===s.playerId)!,target:s.creatures.find((c)=>c.id===id)!,map:s.map.id,off:s.offCreatures}},target.id)
 await page.keyboard.press('Shift+n');const row=page.locator(`[data-prisoner-id="${target.id}"]`)
 await row.locator('[data-prisoner-action=escort]').click();await idle();const escorted=await read()
 assert.equal(escorted.time-w.s.time,200);assert.deepEqual(escorted.p.leading,{target:target.id,uid,hand:'Left'});assert.equal(escorted.target.captivity!.anklesFree,true);await page.screenshot({path:`${out}/156-prisoner-escort-hand.png`})
 await page.keyboard.press('Escape');await page.keyboard.press('ArrowLeft');await idle();const followed=await read();assert.notDeepEqual(followed.target.pos,target.pos);assert.ok(cheb(followed.p.pos,followed.target.pos)<=1)
 const keys=['ArrowUp','u','ArrowRight','Numpad3','ArrowDown','b','ArrowLeft','y'],toward=keys[dirIndex(followed.target.pos.x-followed.p.pos.x,followed.target.pos.y-followed.p.pos.y)]
 await page.keyboard.press(toward);await idle();const yielded=await read();assert.equal(yielded.time-followed.time,100);assert.deepEqual(yielded.p.pos,followed.p.pos);assert.notDeepEqual(yielded.target.pos,followed.target.pos);assert.deepEqual(yielded.target.body.wounds,followed.target.body.wounds)
 await page.keyboard.press('i');const gearTime=yielded.time;await page.locator('[data-testid="item-Item.Bow"]').dblclick();await idle();assert.match(await page.textContent('body')??'',/호송 밧줄.*양손/);const rejected=await read();assert.equal(rejected.time,gearTime);assert.equal(rejected.p.equip.main,undefined);assert.ok(rejected.p.bag.some((i)=>i.uid===bow.uid));await page.screenshot({path:`${out}/157-prisoner-escort-gear-blocked.png`});await page.keyboard.press('Escape')
 for(let i=0;i<16;i++){const state=await read();if(cheb(state.p.pos,link.pos)===0)break;const key=keys[dirIndex(Math.sign(link.pos.x-state.p.pos.x),Math.sign(link.pos.y-state.p.pos.y))];await page.keyboard.press(key);await idle()}
 assert.deepEqual((await read()).p.pos,link.pos);await page.keyboard.press('Enter');await idle();const arrived=await read();assert.equal(arrived.map,'crypt1');assert.equal(arrived.target.captivity!.rope.uid,uid);assert.ok(cheb(arrived.p.pos,arrived.target.pos)<=2);assert.ok(!arrived.off.surface.some((c)=>c.id===target.id));await page.keyboard.press('Shift+n');await page.screenshot({path:`${out}/158-prisoner-escort-stairs.png`})
 await row.locator('[data-prisoner-action=hold]').click();await idle();const held=await read();assert.equal(held.p.leading,undefined);assert.equal(held.target.captivity!.anklesFree,undefined);assert.equal(held.target.captivity!.rope.uid,uid);await row.locator('[data-prisoner-action=escort]').click();await idle()
 const saved=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');const restored=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));writeFileSync(`${out}/escort-before.json`,saved);writeFileSync(`${out}/escort-restored.json`,restored);assert.deepEqual(JSON.parse(restored),JSON.parse(saved));await page.keyboard.press('Shift+n');await page.screenshot({path:`${out}/159-prisoner-escort-restored.png`})
 const beforeLetGo=await read();await row.locator('[data-prisoner-order=letGo]').click();await idle();const loose=await read();assert.equal(loose.time-beforeLetGo.time,100);assert.equal(loose.p.leading,undefined);assert.equal(loose.target.captivity!.escort,undefined);assert.equal(loose.target.captivity!.anklesFree,true);assert.equal(loose.target.captivity!.rope.uid,uid);await page.screenshot({path:`${out}/160-prisoner-escort-let-go.png`})
 assert.deepEqual(errors,[]);console.log('OK: actual escort/yield/gear/stairs/hold/save/let go')
}catch(error){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});writeFileSync(`${out}/failure.txt`,await page.textContent('body')??'');console.error(errors);throw error}
finally{await browser.close();if(server.pid)process.kill(-server.pid)}
