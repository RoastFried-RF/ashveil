import { chromium, type Page } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { baseDefenseTick, noticeBase } from '../../src/core/base-defense'
import { enlistRecruit } from '../../src/core/companions'
import type { World } from '../../src/core/ctx'
import { createCreature } from '../../src/core/creatures'
import { SAVE_VERSION } from '../../src/core/game'
import { gridAdd, makeItem } from '../../src/core/items'
import { defenseFixture } from '../base-defense-fixture'
const out=process.argv[2]??'test-results/base-defense-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise((r)=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const errors:string[]=[]
type Hook={__ashveil:{world():World}}
const idle=(page:Page)=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})
async function open(w:World){const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())});await page.goto('http://localhost:4317/?debug');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((s)=>((window as unknown as Hook).__ashveil.world().s = s),w.s);return page}
const read=(page:Page)=>page.evaluate(()=>{const{s}=(window as unknown as Hook).__ashveil.world(),base=s.map.baseCamp!;return JSON.parse(JSON.stringify({time:s.time,p:s.creatures.find((c)=>c.id===s.playerId)!,people:s.creatures,base,store:s.map.tiles[base.store.y*s.map.w+base.store.x],next:s.nextId,log:s.log.slice(-12)})) as {time:number;p:World['s']['creatures'][number];people:World['s']['creatures'];base:NonNullable<World['s']['map']['baseCamp']>;store:World['s']['map']['tiles'][number];next:number;log:World['s']['log']}})
async function wait(page:Page){await page.keyboard.press('Numpad5');await idle(page)}
async function restore(page:Page,name:string){const saved=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));assert.equal(JSON.parse(saved).version,SAVE_VERSION);await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');const restored=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));writeFileSync(`${out}/${name}-before.json`,saved);writeFileSync(`${out}/${name}-after.json`,restored);assert.deepEqual(JSON.parse(restored),JSON.parse(saved))}
function setup(){const d=defenseFixture(),{w,party,store}=d,tile=w.s.map.tiles[store.y*w.s.map.w+store.x];tile.cont={items:[],opened:true,kind:'Terrain.Stash'};const stock=[makeItem(w,'Item.Cloth',2),makeItem(w,'Item.Hardtack'),makeItem(w,'Item.IronScrap')];for(const item of stock)gridAdd(w,{items:tile.cont.items,w:12,h:8},item);noticeBase(w,party[0]);w.s.time+=1000;for(const c of w.s.creatures)c.nextAct=w.s.time;baseDefenseTick(w);assert.ok(w.s.map.baseCamp!.raid);return{...d,stock}}
try{
 // 정찰/귀환 보고와 짧은 준비 시간은 제어 DB의 실제 함수로 실행했다. 자연 경과 하루 생존/배포 확률 검증은 아니다.
 const d=setup(),{w,p,party,worker,stock}=d;w.s.creatures=w.s.creatures.filter((c)=>c.id!==worker.id);p.pos={x:20,y:23};for(let x=18;x<=26;x++)w.s.map.tiles[22*w.s.map.w+x].t='Terrain.RuinWall';const page=await open(w)
 await wait(page);await wait(page);let s=await read(page);assert.equal(s.base.raid!.phase,'active');assert.equal(s.base.raidHeard,undefined);assert.equal(s.store.cont!.items.length,3);await page.keyboard.press('F2');assert.equal(await page.locator('[data-testid=base-raid-news]').count(),0);await page.screenshot({path:`${out}/189-unseen-raid-not-announced.png`});await page.keyboard.press('Escape');await restore(page,'marching');await page.screenshot({path:`${out}/190-actual-marching-party-restored.png`})
 for(let i=0;s.base.raid!.phase==='active'&&i<60;i++){await wait(page);s=await read(page)}
 assert.equal(s.base.raid!.phase,'looted');assert.equal(s.base.raidHeard,undefined);assert.ok(s.base.raid!.stolen.length>0);assert.equal(s.people.length,3);assert.equal(s.next,w.s.nextId);const carried=s.people.filter((c)=>party.some((o)=>o.id===c.id)).flatMap((c)=>c.bag);assert.deepEqual([...carried,...s.store.cont!.items].map((i)=>i.uid).sort((a,b)=>a-b),stock.map((i)=>i.uid).sort((a,b)=>a-b));for(const c of s.people.filter((c)=>party.some((o)=>o.id===c.id)))assert.ok(Math.max(Math.abs(c.pos.x-c.home!.x),Math.abs(c.pos.y-c.home!.y))<=1)
 await page.keyboard.press('F2');assert.equal(await page.locator('[data-testid=base-raid-news]').count(),0);await page.screenshot({path:`${out}/191-real-looting-keeps-unwitnessed-outcome-private.png`});await page.keyboard.press('Escape');await restore(page,'looted');await page.close()
 const battle=setup(),bw=battle.w;{
  battle.p.pos={x:20,y:21};battle.worker.pos={x:22,y:20};battle.worker.equip.main=makeItem(bw,'Item.RustyKnife')
  // 같은 주민 Def에서 만든 초기 방어 인원이다. 전투 도중 인원/장비를 추가하지 않는다.
  for(const pos of [{x:20,y:20},{x:21,y:21}]){const c=createCreature(bw,'Creature.SettlementGuard',pos);c.faction='coalition';c.asleep=false;c.unconscious=false;c.activity=undefined;c.age=undefined;c.traits=[];c.background=undefined;c.effects=[];c.traumas=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.nextAct=bw.s.time;Object.assign(c.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0,protein:100,vitamin:100,ash:0});bw.s.creatures.push(c);enlistRecruit(bw,c,1);c.companion!.order='defend';c.companion!.anchor={...battle.store}}
 }
 const bp=await open(bw);let b=await read(bp);for(let i=0;b.base.raid!.phase==='active'&&i<160;i++){await wait(bp);b=await read(bp)}
 assert.equal(b.base.raid!.phase,'repelled');assert.ok(b.people.filter((c)=>battle.party.some((o)=>o.id===c.id)).every((c)=>!c.alive||c.captivity||c.ai.mode==='surrender'||c.ai.mode==='flee'));assert.ok(b.people.some((c)=>c.body.wounds.length>0||!c.alive));assert.equal(b.base.raid!.stolen.length,0);assert.deepEqual(b.store.cont!.items.map((i)=>i.uid).sort((a,b)=>a-b),battle.stock.map((i)=>i.uid).sort((a,b)=>a-b));assert.equal(b.p.alive,true);assert.ok(b.base.raidHeard);await bp.keyboard.press('F2');await bp.screenshot({path:`${out}/192-actual-companions-defend-base.png`});await bp.keyboard.press('Escape');await restore(bp,'defended');await bp.keyboard.press('F2');await bp.screenshot({path:`${out}/193-base-defense-restored.png`});assert.deepEqual(errors,[]);console.log('OK: actual scouting/report/march/save/finite loot/return/private news/real companion combat/save35')
}catch(error){for(const[i,page]of browser.contexts().flatMap((c)=>c.pages()).entries()){await page.screenshot({path:`${out}/failure-${i}.png`}).catch(()=>{});writeFileSync(`${out}/failure-${i}.txt`,await page.textContent('body')??'')}console.error(errors);throw error}
finally{await browser.close();if(server.pid)process.kill(-server.pid)}
