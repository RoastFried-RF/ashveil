import { chromium, type Page } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { activityStep, perform } from '../../src/core/actions'
import { aiDecide } from '../../src/core/ai'
import { faint } from '../../src/core/body'
import { killCreature } from '../../src/core/combat'
import { enlistRecruit } from '../../src/core/companions'
import { type World } from '../../src/core/ctx'
import { createCreature } from '../../src/core/creatures'
import { SAVE_VERSION } from '../../src/core/game'
import { cheb } from '../../src/core/geom'
import { addToBag, makeItem } from '../../src/core/items'
import { prisonerFixture } from '../prisoner-fixture'

const out=process.argv[2]??'test-results/freed-recruitment-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true})
await new Promise((r)=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const errors:string[]=[]
type Hook={__ashveil:{world():World}}
async function open(w:World){const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())});await page.goto('http://localhost:4317/?debug');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((state)=>((window as unknown as Hook).__ashveil.world().s = state),w.s);return page}
const idle=(page:Page)=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})
const read=(page:Page,id:number)=>page.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,p:s.creatures.find((c)=>c.id===s.playerId)!,target:s.creatures.find((c)=>c.id===id)!,tiles:s.map.tiles,events:s.overworld!.society!.events,rep:s.overworld!.society!.reputation,next:s.nextId}},id)
function fixture(buddy=false){
 const data=prisonerFixture(),{w,p,rope}=data,captor=data.target,victim=createCreature(w,'Creature.SettlementGuard',{x:22,y:20})
 victim.faction='coalition';victim.home={x:25,y:20};victim.money=17;victim.age=undefined;victim.traits=[];victim.background=undefined;victim.traumas=[];victim.effects=[];victim.body.wounds=[];victim.body.missing=[];victim.body.blood=victim.body.bloodMax;victim.stats={str:10,agi:10,per:10,vit:10,wil:10};victim.nextAct=w.s.time;Object.assign(victim.needs,{kcal:1000,waterDeficit:600,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0,protein:100,vitamin:100,ash:0});w.s.creatures.push(victim)
 if(buddy)enlistRecruit(w,victim,1)
 p.bag=p.bag.filter((i)=>i.uid!==rope.uid);delete rope.gx;delete rope.gy;addToBag(w,captor,rope);captor.ai.mode='guard';p.pos={x:3,y:3};faint(w,victim,'충격으로')
 const action=aiDecide(w,captor);assert.equal(action.type,'prisoner');assert.equal(perform(w,captor,action).ok,true);while(captor.activity)activityStep(w,captor);assert.equal(victim.captivity!.rope.uid,rope.uid)
 // 포박은 같은 NPC/실제 밧줄로 실행했다. 사망한 포박자 자료는 전투 승리의 증거로 사용하지 않는다.
 killCreature(w,captor,'검사용 사망');p.pos={x:21,y:21};p.money=buddy?20:0;for(const c of w.s.creatures)c.nextAct=w.s.time
 const food=makeItem(w,'Item.Hardtack'),water=makeItem(w,'Item.WaterBottle');addToBag(w,p,food);addToBag(w,p,water)
 return{...data,captor,victim,food,water}
}
try{
 const d=fixture(),{w,p,victim,rope,food,water}=d,page=await open(w);await page.keyboard.press('Shift+n');const row=page.locator(`[data-prisoner-id="${victim.id}"]`)
 await row.locator('[data-prisoner-action=release]').click();await idle(page);let state=await read(page,victim.id)
 assert.equal(state.target.unconscious,true);assert.equal(state.target.captivity,undefined)
 await page.keyboard.press('Escape')
 for(let i=0;state.target.unconscious&&i<150;i++){await page.keyboard.press('Numpad5');await idle(page);state=await read(page,victim.id)}
 assert.equal(state.target.unconscious,false);assert.ok(cheb(state.p.pos,state.target.pos)<=1)
 await page.keyboard.press('Shift+n');await row.locator(`[data-care-uid="${food.uid}"]`).click();await idle(page);await row.locator(`[data-care-uid="${water.uid}"]`).click();await idle(page)
 const cared=await read(page,victim.id);assert.equal(cared.target.rescue!.acknowledged,true);assert.equal(cared.target.rescue!.care![p.id].kcal,350);assert.ok(cared.target.rescue!.care![p.id].water>=200)
 const talk=row.locator('[data-prisoner-recruit=talk]'),invite=row.locator('[data-prisoner-recruit=invite]');assert.match(await talk.textContent()??'',/0\/1일/);assert.equal(await talk.isEnabled(),true);assert.equal(await invite.isEnabled(),false)
 await page.screenshot({path:`${out}/173-freed-awake-real-care-consent.png`})
 await talk.click();await idle(page);const agreed=await read(page,victim.id)
 assert.ok(agreed.time-cared.time>=120000);assert.equal(agreed.target.captivity,undefined);assert.equal(agreed.target.companion,undefined);assert.equal(agreed.target.recruitment!.profile,'Recruitment.Rescue');assert.deepEqual(agreed.target.recruitment!.days,[0]);assert.deepEqual(agreed.target.pos,cared.target.pos);assert.equal(await invite.isEnabled(),true)
 await page.screenshot({path:`${out}/174-freed-hour-of-mutual-talk.png`})
 await invite.click();await idle(page);const joined=await read(page,victim.id)
 assert.equal(joined.target.id,victim.id);assert.equal(joined.target.captivity,undefined);assert.equal(joined.target.companion!.status,'employed');assert.equal(joined.target.companion!.paidUntil,joined.target.companion!.hiredAt+28800);assert.equal(joined.target.companion!.trialUntil,joined.target.companion!.paidUntil);assert.ok(joined.target.companion!.hiredAt>=Math.floor(agreed.time/100)&&joined.target.companion!.hiredAt<=Math.floor(joined.time/100));assert.deepEqual([joined.p.money,joined.target.money],[cared.p.money,cared.target.money]);assert.equal(joined.p.xp,cared.p.xp);assert.equal(joined.next,cared.next);assert.equal(joined.tiles.flatMap((t)=>t.items).filter((i)=>i.uid===rope.uid).length,1)
 const panel=page.locator('[data-testid=companion-panel]');assert.match(await panel.locator('summary').first().textContent()??'',/시험 동행/);await page.screenshot({path:`${out}/175-freed-npc-joins-same-body-and-rope.png`})
 await panel.locator('summary').first().click();await panel.locator('[data-testid=companion-dismiss]').click();await idle(page);const dismissed=await read(page,victim.id);assert.equal(dismissed.target.companion!.status,'dismissed')
 assert.equal(await invite.isEnabled(),true);await invite.click();await idle(page);const rejoined=await read(page,victim.id)
 assert.equal(rejoined.target.companion!.paidUntil,joined.target.companion!.paidUntil);assert.equal(rejoined.target.companion!.trialUntil,joined.target.companion!.trialUntil);assert.equal(rejoined.target.companion!.hiredAt,joined.target.companion!.hiredAt);assert.deepEqual([rejoined.p.money,rejoined.target.money],[joined.p.money,joined.target.money]);await page.screenshot({path:`${out}/176-returning-companion-keeps-original-deadlines.png`})
 const saved=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));assert.equal(JSON.parse(saved).version,SAVE_VERSION);await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');const restored=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));writeFileSync(`${out}/before.json`,saved);writeFileSync(`${out}/restored.json`,restored);assert.deepEqual(JSON.parse(restored),JSON.parse(saved));await page.keyboard.press('Shift+n');await page.screenshot({path:`${out}/177-freed-recruitment-restored.png`})
 assert.deepEqual(errors,[]);console.log('OK: actual free rescue/wake/care/hour/consent/invite/same body/returning contract/save33')
}catch(error){for(const[i,page]of browser.contexts().flatMap((c)=>c.pages()).entries()){await page.screenshot({path:`${out}/failure-${i}.png`}).catch(()=>{});writeFileSync(`${out}/failure-${i}.txt`,await page.textContent('body')??'')}console.error(errors);throw error}
finally{await browser.close();if(server.pid)process.kill(-server.pid)}
