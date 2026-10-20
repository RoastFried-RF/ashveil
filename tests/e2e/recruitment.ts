import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { activityStep, perform } from '../../src/core/actions'
import { TURNS_PER_DAY, type World } from '../../src/core/ctx'
import { addToBag, makeItem } from '../../src/core/items'
import { feedPrisoner } from '../../src/core/prisoner-care'
import { requestRecruitment } from '../../src/core/recruitment'
import { prisonerFixture } from '../prisoner-fixture'

const out=process.argv[2]??'test-results/recruitment-browser'
mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true})
await new Promise((r)=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[]
page.on('pageerror',(e)=>errors.push(e.message));page.on('console',(e)=>{if(e.type()==='error')errors.push(e.text())})
type Hook={__ashveil:{world():World}}
try{
 const{w,p,target}=prisonerFixture()
 assert.equal(perform(w,p,{type:'prisoner',target:target.id,operation:'bind'}).ok,true);while(p.activity)activityStep(w,p)
 // 처음 두 날짜는 같은 돌봄/대화 규칙을 단위 실행한 제어 자료다. 자연 경과3일 생존을 주장하지 않는다.
 for(let day=0;day<2;day++){
  if(day)w.s.time+=TURNS_PER_DAY*100
  for(const c of w.s.creatures)c.nextAct=w.s.time
  target.needs.waterDeficit=600
  const food=makeItem(w,'Item.Hardtack'),water=makeItem(w,'Item.WaterBottle');addToBag(w,p,food);addToBag(w,p,water)
  assert.equal(feedPrisoner(w,p,target,food.uid).ok,true);assert.equal(feedPrisoner(w,p,target,water.uid).ok,true);assert.equal(requestRecruitment(w,p,target),null)
  for(let i=0;p.activity&&i<10000;i++)activityStep(w,p)
  assert.equal(target.recruitment!.days.length,day+1)
 }
 w.s.time+=TURNS_PER_DAY*100;for(const c of w.s.creatures)c.nextAct=w.s.time
 target.needs.waterDeficit=600;w.s.weather='clear';w.s.weatherUntil=w.s.time+TURNS_PER_DAY*100;w.s.wind={x:0,y:0}
 const meal=makeItem(w,'Item.Hardtack'),water=makeItem(w,'Item.WaterBottle');addToBag(w,p,meal);addToBag(w,p,water)
 const rope=target.captivity!.rope.uid,initial={time:w.s.time,money:[p.money,target.money],xp:p.xp,rep:structuredClone(w.s.overworld!.society!.reputation),id:w.s.nextId}
 await page.goto('http://localhost:4317/?debug');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate((state)=>((window as unknown as Hook).__ashveil.world().s = state),w.s)
 const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find((c)=>c.id===s.playerId)!.activity})
 const read=()=>page.evaluate((id)=>{const{s}=(window as unknown as Hook).__ashveil.world();return{time:s.time,p:s.creatures.find((c)=>c.id===s.playerId)!,target:s.creatures.find((c)=>c.id===id)!,tiles:s.map.tiles,next:s.nextId,rep:s.overworld!.society!.reputation}},target.id)
 await page.keyboard.press('n');const row=page.locator(`[data-prisoner-id="${target.id}"]`)
 assert.equal(await row.locator('[data-prisoner-recruit=talk]').isDisabled(),true);assert.equal(await row.locator('[data-prisoner-recruit=invite]').isDisabled(),true)
 await row.locator(`[data-care-uid="${meal.uid}"]`).click();await idle();await row.locator(`[data-care-uid="${water.uid}"]`).click();await idle();const cared=await read();assert.equal(cared.time-initial.time,200);assert.equal(cared.target.captivity!.care![p.id].kcal,350);assert.equal(cared.target.captivity!.care![p.id].water,200);await page.screenshot({path:`${out}/161-prisoner-recruit-care.png`})
 await row.locator('[data-prisoner-recruit=talk]').click();await idle();const spoken=await read();assert.equal(spoken.time-cared.time,120000);assert.equal(spoken.target.recruitment!.days.length,3);assert.ok(spoken.target.recruitment!.willing!==undefined);assert.equal(spoken.target.companion,undefined);assert.equal(spoken.target.captivity!.rope.uid,rope);await page.screenshot({path:`${out}/162-prisoner-recruit-consent.png`})
 await row.locator('[data-prisoner-recruit=invite]').click();await idle();const joined=await read();assert.equal(joined.time-spoken.time,100);assert.equal(joined.target.captivity,undefined);assert.equal(joined.target.companion!.employer,p.id);assert.equal(joined.target.companion!.order,'follow');assert.equal(joined.target.faction,'reavers');assert.equal(joined.target.companion!.bond!.score,0);assert.deepEqual([joined.p.money,joined.target.money],initial.money);assert.equal(joined.p.xp,initial.xp);assert.deepEqual(joined.rep,initial.rep);assert.equal(joined.next,initial.id);assert.equal(joined.tiles.flatMap((t)=>t.items).filter((i)=>i.uid===rope).length,1);await page.waitForSelector('[data-testid=companion-panel]');await page.screenshot({path:`${out}/163-prisoner-recruited-same-person.png`})
 const saved=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');const restored=await page.evaluate(()=>JSON.stringify((window as unknown as Hook).__ashveil.world().s));writeFileSync(`${out}/recruitment-before.json`,saved);writeFileSync(`${out}/recruitment-restored.json`,restored);assert.deepEqual(JSON.parse(restored),JSON.parse(saved));await page.keyboard.press('n');await page.waitForSelector('[data-testid=companion-panel]');await page.screenshot({path:`${out}/164-prisoner-recruitment-restored.png`})
 assert.deepEqual(errors,[]);console.log('OK: real third-day feeding/hour/conversation/invitation/same person/save')
}catch(error){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});writeFileSync(`${out}/failure.txt`,await page.textContent('body')??'');console.error(errors);throw error}
finally{await browser.close();if(server.pid)process.kill(-server.pid)}
