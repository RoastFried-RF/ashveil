import { chromium, type Page } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { activityStep, perform } from '../../src/core/actions'
import { aiDecide } from '../../src/core/ai'
import { faint } from '../../src/core/body'
import { killCreature } from '../../src/core/combat'
import type { World } from '../../src/core/ctx'
import { createCreature } from '../../src/core/creatures'
import { addToBag, makeItem } from '../../src/core/items'
import { prisonerFixture } from '../prisoner-fixture'
const out=process.argv[2]??'test-results/npc-custody-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise((r)=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const errors:string[]=[]
type Hook={__ashveil:{world():World}}
async function open(w:World){const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())});await page.goto('http://localhost:4317/?debug');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((s)=>((window as unknown as Hook).__ashveil.world().s = s),w.s);return page}
const idle=(page:Page)=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})
const read=(page:Page)=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
async function wait(page:Page){await page.keyboard.press('Numpad5');await idle(page)}
async function restore(page:Page,label:string){const before=await read(page);await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');const after=await read(page);writeFileSync(`${out}/${label}-before.json`,JSON.stringify(before));writeFileSync(`${out}/${label}-after.json`,JSON.stringify(after));assert.deepEqual(after,before)}
function guard(w:World,pos:{x:number;y:number}){const c=createCreature(w,'Creature.SettlementGuard',pos);c.faction='coalition';c.age=undefined;c.traits=[];c.background=undefined;c.traumas=[];c.effects=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.asleep=false;c.unconscious=false;c.activity=undefined;c.stats={str:10,agi:10,per:10,vit:10,wil:10};c.bag=[];c.equip={};c.home={...pos};c.nextAct=w.s.time;Object.assign(c.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0,protein:100,vitamin:100,ash:0});w.s.creatures.push(c);return c}
try{
 const d=prisonerFixture(),{w,p,target}=d;target.pos={x:22,y:20};const c=guard(w,{x:21,y:20}),cloth=makeItem(w,'Item.Cloth',2),water=makeItem(w,'Item.WaterBottle'),food=makeItem(w,'Item.Hardtack');for(const i of [cloth,water,food])addToBag(w,c,i);target.needs.waterDeficit=600;target.needs.kcal=0;const page=await open(w)
 for(let i=0;i<10;i++)await wait(page)
 let s=await read(page),a=s.creatures.find((o)=>o.id===c.id)!,t=s.creatures.find((o)=>o.id===target.id)!;assert.equal(a.activity!.kind,'craft');assert.ok(a.workJob!.progress>0&&a.workJob!.progress<20);assert.equal(a.bag.find((i)=>i.uid===cloth.uid)!.count,2);assert.equal(t.captivity,undefined);await page.screenshot({path:`${out}/178-npc-real-cloth-work.png`})
 await restore(page,'craft');await page.screenshot({path:`${out}/179-npc-partial-work-restored.png`})
 for(let i=0;!t.captivity&&i<35;i++){await wait(page);s=await read(page);a=s.creatures.find((o)=>o.id===c.id)!;t=s.creatures.find((o)=>o.id===target.id)!}
 assert.equal(t.captivity!.captor,c.id);assert.equal(t.captivity!.rope.def,'Item.Rope');assert.notEqual(t.captivity!.rope.uid,d.rope.uid);assert.equal(a.bag.some((i)=>i.uid===cloth.uid),false);const rope=t.captivity!.rope.uid
 for(let i=0;(!t.captivity!.care?.[c.id]?.water||!t.captivity!.care?.[c.id]?.kcal)&&i<8;i++){await wait(page);s=await read(page);a=s.creatures.find((o)=>o.id===c.id)!;t=s.creatures.find((o)=>o.id===target.id)!}
 assert.equal(t.captivity!.care![c.id].water,200);assert.equal(t.captivity!.care![c.id].kcal,350);assert.equal(t.captivity!.care![p.id],undefined);assert.equal(a.bag.find((i)=>i.uid===water.uid)!.uses,4);assert.equal(a.bag.some((i)=>i.uid===food.uid),false);assert.equal(t.captivity!.rope.uid,rope)
 await page.keyboard.press('Numpad3');await idle(page);await page.keyboard.press('n');await page.screenshot({path:`${out}/180-npc-crafted-rope-and-real-care.png`});await restore(page,'care');await page.close()
 const rescue=prisonerFixture(),rw=rescue.w,enemy=rescue.target,victim=guard(rw,{x:22,y:20});victim.needs.waterDeficit=600;rescue.p.bag=rescue.p.bag.filter((i)=>i.uid!==rescue.rope.uid);delete rescue.rope.gx;delete rescue.rope.gy;addToBag(rw,enemy,rescue.rope);enemy.ai.mode='guard';rescue.p.pos={x:3,y:3};faint(rw,victim,'충격으로');const bind=aiDecide(rw,enemy);assert.equal(bind.type,'prisoner');perform(rw,enemy,bind);while(enemy.activity)activityStep(rw,enemy)
 // 실제 포박 뒤 사망한 포박자 자료를 사용한다. 이 검사는 전투 승리나 무작위 납치 사건의 증거가 아니다.
 killCreature(rw,enemy,'검사용 사망');rescue.p.pos={x:20,y:21};const ally=guard(rw,{x:21,y:21}),xp=rescue.p.xp,rep=structuredClone(rw.s.overworld!.society!.reputation),blood=victim.body.blood;for(const o of rw.s.creatures)o.nextAct=rw.s.time
 const rp=await open(rw);await wait(rp);await wait(rp);const freed=await read(rp),v=freed.creatures.find((o)=>o.id===victim.id)!;assert.equal(v.captivity,undefined);assert.equal(v.rescue!.by,ally.id);assert.equal(v.rescue!.acknowledged,undefined);assert.equal(v.unconscious,true);assert.equal(v.body.blood,blood);assert.equal(freed.creatures.find((o)=>o.id===rescue.p.id)!.xp,xp);assert.deepEqual(freed.overworld!.society!.reputation,rep);assert.equal(freed.map.tiles.flatMap((tile)=>tile.items).filter((i)=>i.uid===rescue.rope.uid).length,1);await rp.screenshot({path:`${out}/181-npc-frees-same-ally-without-healing.png`});await restore(rp,'npc-rescue');await rp.screenshot({path:`${out}/182-npc-rescue-restored.png`});assert.deepEqual(errors,[]);console.log('OK: real NPC craft/partial save/bind/care/finite supplies/autonomous rescue/save')
}catch(error){for(const[i,page]of browser.contexts().flatMap((c)=>c.pages()).entries()){await page.screenshot({path:`${out}/failure-${i}.png`}).catch(()=>{});writeFileSync(`${out}/failure-${i}.txt`,await page.textContent('body')??'')}console.error(errors);throw error}
finally{await browser.close();if(server.pid)process.kill(-server.pid)}
