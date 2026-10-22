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
import { cheb, dirIndex } from '../../src/core/geom'
import { addToBag, makeItem } from '../../src/core/items'
import { prisonerFixture } from '../prisoner-fixture'

const out=process.argv[2]??'test-results/rescue-browser';mkdirSync(out,{recursive:true})
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
 const own=prisonerFixture();own.target.ai.mode='guard';faint(own.w,own.target,'충격으로');const ownPage=await open(own.w);await ownPage.keyboard.press('Shift+n');const ownRow=ownPage.locator(`[data-prisoner-id="${own.target.id}"]`),ownBefore=await read(ownPage,own.target.id)
 await ownPage.screenshot({path:`${out}/165-unconscious-person.png`});await ownRow.locator('[data-prisoner-action=bind]').click();await idle(ownPage);const bound=await read(ownPage,own.target.id);assert.equal(bound.time-ownBefore.time,200);assert.equal(bound.target.unconscious,true);assert.equal(bound.target.captivity!.surrendered,false);assert.equal(bound.target.captivity!.rope.uid,own.rope.uid);await ownPage.screenshot({path:`${out}/166-unconscious-bound-same-rope.png`})
 await ownRow.locator('[data-prisoner-action=release]').click();await idle(ownPage);const freed=await read(ownPage,own.target.id);assert.equal(freed.time-bound.time,100);assert.equal(freed.target.unconscious,true);assert.equal(freed.target.body.blood,ownBefore.target.body.blood);assert.equal(freed.p.xp,ownBefore.p.xp);assert.deepEqual(freed.rep,ownBefore.rep);assert.equal(freed.target.rescue,undefined);assert.equal(freed.tiles.flatMap((t)=>t.items).filter((i)=>i.uid===own.rope.uid).length,1);await ownPage.screenshot({path:`${out}/167-unconscious-release-no-defeat-bonus.png`});await ownPage.close()
 for(const buddy of [false,true]){
  const d=fixture(buddy),{w,p,victim,rope,food,water}=d,page=await open(w);await page.keyboard.press('Shift+n');const row=page.locator(`[data-prisoner-id="${victim.id}"]`),before=await read(page,victim.id),contract=structuredClone(before.target.companion)
  await row.locator('[data-prisoner-action=release]').click();await idle(page);const released=await read(page,victim.id);assert.equal(released.target.unconscious,true);assert.equal(released.target.captivity,undefined);assert.equal(released.target.rescue!.by,p.id);assert.equal(released.target.rescue!.acknowledged,undefined);assert.equal(released.events.length,before.events.length);assert.equal(released.target.body.blood,before.target.body.blood);assert.equal(released.p.xp,before.p.xp);assert.deepEqual([released.p.money,released.target.money],[before.p.money,before.target.money]);const expectedContract=structuredClone(contract);if(expectedContract?.bond)expectedContract.bond.lastTick=Math.floor(released.time/100);assert.deepEqual(released.target.companion,expectedContract);await page.screenshot({path:`${out}/${buddy?'170':'168'}-rescued-still-unconscious.png`})
  await page.keyboard.press('Escape');await page.keyboard.press('r');await idle(page);let state=await read(page,victim.id);assert.equal(state.target.unconscious,false)
  const keys=['ArrowUp','u','ArrowRight','Numpad3','ArrowDown','b','ArrowLeft','y']
  for(let i=0;cheb(state.p.pos,state.target.pos)>1&&i<20;i++){await page.keyboard.press(keys[dirIndex(Math.sign(state.target.pos.x-state.p.pos.x),Math.sign(state.target.pos.y-state.p.pos.y))]);await idle(page);state=await read(page,victim.id)}
  assert.ok(cheb(state.p.pos,state.target.pos)<=1);await page.keyboard.press('Shift+n')
  if(!buddy){
   await row.locator(`[data-care-uid="${food.uid}"]`).click();await idle(page);await row.locator(`[data-care-uid="${water.uid}"]`).click();await idle(page);const cared=await read(page,victim.id);assert.equal(cared.target.rescue!.acknowledged,true);assert.equal(cared.target.rescue!.care![p.id].kcal,350);assert.ok(cared.target.rescue!.care![p.id].water>0&&cared.target.rescue!.care![p.id].water<=200);assert.equal(cared.p.bag.find((i)=>i.uid===water.uid)!.uses,4);assert.equal(cared.target.money,before.target.money);assert.equal(cared.p.xp,before.p.xp);assert.equal(cared.events.filter((e)=>e.target===victim.id).length,1);assert.equal(cared.tiles.flatMap((t)=>t.items).filter((i)=>i.uid===rope.uid).length,1);await page.screenshot({path:`${out}/169-rescued-awake-real-care.png`})
  }else{
   await page.click('[data-testid=talk-person]');await idle(page);const thanked=await read(page,victim.id);assert.equal(thanked.target.companion!.bond!.score,5);assert.equal(thanked.target.companion!.paidUntil,contract!.paidUntil);assert.equal(thanked.target.rescue!.acknowledged,true);const panel=page.locator('[data-testid=companion-panel]');assert.match(await panel.locator('summary').first().textContent()??'',/시험 동행/);assert.doesNotMatch(await panel.locator('summary').first().textContent()??'',/선불/);assert.match(await page.textContent('body')??'',/동료 · 원소속/);await panel.locator('summary').first().click();await panel.locator('[data-testid=companion-pay]').click();await idle(page);const paid=await read(page,victim.id);assert.equal(paid.p.money,14);assert.equal(paid.target.money,23);assert.equal(paid.target.companion!.paidUntil,contract!.paidUntil+28800);assert.equal(paid.target.companion!.trialUntil,contract!.trialUntil);assert.match(await panel.locator('summary').first().textContent()??'',/이후 선불.*24/);await page.screenshot({path:`${out}/171-rescued-companion-trial-and-paid-wage.png`})
  }
  const saved=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');const restored=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));writeFileSync(`${out}/${buddy?'companion':'civilian'}-before.json`,saved);writeFileSync(`${out}/${buddy?'companion':'civilian'}-restored.json`,restored);assert.deepEqual(JSON.parse(restored),JSON.parse(saved));await page.keyboard.press('Shift+n');await page.screenshot({path:`${out}/${buddy?'172':'169b'}-rescue-restored.png`});await page.close()
 }
 assert.deepEqual(errors,[]);console.log('OK: real unconscious binding/release/rescue/natural wake/care/companion/trial/wage/save')
}catch(error){for(const[i,page]of browser.contexts().flatMap((c)=>c.pages()).entries()){await page.screenshot({path:`${out}/failure-${i}.png`}).catch(()=>{});writeFileSync(`${out}/failure-${i}.txt`,await page.textContent('body')??'')}console.error(errors);throw error}
finally{await browser.close();if(server.pid)process.kill(-server.pid)}
