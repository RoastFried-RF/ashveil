/** Finite initial companions, wounds and stock; actual UI/keyboard actions after title load. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {baseFixture,finishBase} from '../tests/base-camp-fixture'
import {startClaimBase,transferBase} from '../src/core/base-camp'
import {addWound} from '../src/core/body'
import {addToBag,makeItem} from '../src/core/items'
import {createCreature} from '../src/core/creatures'
import {enlistRecruit} from '../src/core/companions'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize} from '../src/core/save'
import type {World} from '../src/core/ctx'
import {startNativePreview} from './native-preview'
const out=process.argv[2]??'test-results/autonomy-v324/native';mkdirSync(out,{recursive:true})
type Hook={__ashveil:{world():World}}
function fixture(kind:'aid'|'rescue'|'queue'){
 const d=baseFixture(),{w,s,p,worker}=d
 s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.depth=3;s.map.name='동료 작업 · 유한 초기 방';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[]
 for(const t of s.map.tiles)if(!t.placed)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0})
 let patient:number|undefined,wound:number|undefined,material:number|undefined
 if(kind==='aid'){const bandage=makeItem(w,'Item.Bandage',2);addToBag(w,worker,bandage);material=bandage.uid;wound=addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:0,source:'명시한 초기 외부 상처'}).wound.id}
 if(kind==='rescue'){
  worker.pos={x:19,y:20};const person=createCreature(w,'Creature.SettlementGuard',{x:17,y:20});person.name='쓰러진 동료';person.faction='coalition';person.age=undefined;person.traits=[];person.background=undefined;person.traumas=[];person.effects=[];person.bag=[];person.equip={};person.body.wounds=[];person.asleep=false;person.unconscious=true;person.cond={faintUntil:Math.floor(s.time/100)+150};Object.assign(person.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0});s.creatures.push(person);enlistRecruit(w,person,1);person.companion!.order='hold';patient=person.id
 }
 if(kind==='queue'){assert.equal(startClaimBase(w,p,d.store),null);finishBase(w,p);const cloth=makeItem(w,'Item.Cloth',4);addToBag(w,p,cloth);assert.equal(transferBase(w,p,'put',cloth.uid),null);material=cloth.uid}
 invalidateLights(w);updatePlayerVision(w,p)
 return{initial:serialize(s),provider:worker.id,name:worker.name,patient,wound,material,store:d.store}
}
const server=await startNativePreview(4357),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function idle(){await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
try{
 await page.goto(server.url)
 for(const[kind,width,height]of[['aid',1440,1080],['rescue',1366,768],['queue',1440,1080],['queue',1366,768]]as const){
  const f=fixture(kind),prefix=kind+'-'+width;writeFileSync(join(out,prefix+'-initial.json'),f.initial);await page.setViewportSize({width,height})
  await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false,mapZoom:3}))},f.initial)
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!!(window as unknown as Hook).__ashveil?.world())
  const before=await read()
  if(kind==='queue'){
   await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();const row=page.locator(`[data-base-worker="${f.provider}"]`)
   await row.getByLabel(f.name+' 제작법',{exact:true}).selectOption('Recipe.Rope');await row.locator('[data-base-order=craft]').click();await idle()
   const details=row.locator(`[data-base-queue="${f.provider}"]`);await details.locator(':scope > summary').click();await row.getByLabel(f.name+' 제작법',{exact:true}).selectOption('Recipe.Bandage');await details.getByTestId('base-queue-add').click();await idle();await details.locator('li').first().scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-queued.png')})
   await page.keyboard.press('Escape');await page.keyboard.press('r');await idle()
   const end=await read(),stock=end.map.tiles[f.store.y*end.map.w+f.store.x].cont!.items
   assert.equal(stock.find(i=>i.def==='Item.Rope')?.count,1);assert.equal(stock.find(i=>i.def==='Item.Bandage')?.count,1);assert.ok(!stock.some(i=>i.def==='Item.Cloth'))
   await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await page.screenshot({path:join(out,prefix+'-finished.png')});runs.push({kind,width,height,beforeTU:before.time,afterTU:end.time,stock:stock.map(i=>({uid:i.uid,def:i.def,count:i.count})),queue:end.map.baseCamp!.queues??{},errors:[]});await page.keyboard.press('Escape')
  }else{
   await page.keyboard.press('Shift+N');await page.locator(`[data-person-id="${f.provider}"]`).click();await page.getByTestId('companion-panel').locator(':scope > summary').click();await page.getByTestId('companion-care-panel').locator(':scope > summary').click();await page.screenshot({path:join(out,prefix+'-policy.png')})
   await page.getByTestId(kind==='aid'?'companion-aid-first':'companion-aid-rescue').click();await idle();await page.keyboard.press('Escape')
   if(kind==='rescue'){await page.keyboard.press('r');await idle()}
   const end=await read(),provider=end.creatures.find(c=>c.id===f.provider)!,p=end.creatures.find(c=>c.id===end.playerId)!,patient=f.patient&&end.creatures.find(c=>c.id===f.patient)
   if(kind==='aid'){assert.ok(p.body.wounds.find(w=>w.id===f.wound)?.bandage);assert.equal(provider.bag.find(i=>i.uid===f.material)?.count,1)}
   else{assert.ok(patient);assert.equal(Math.max(Math.abs(patient.pos.x-20),Math.abs(patient.pos.y-20)),1);assert.equal(end.creatures.filter(c=>c.id===f.patient).length,1);assert.ok(end.log.some(l=>l.text.includes('집결지 쪽으로 한 칸')))}
   await page.screenshot({path:join(out,prefix+'-after.png')});writeFileSync(join(out,prefix+'-final.json'),JSON.stringify(end));runs.push({kind,width,height,beforeTU:before.time,afterTU:end.time,provider:provider.id,patient:patient?{id:patient.id,pos:patient.pos}:p.id,mode:provider.companion!.aid!.mode,errors:[]})
  }
  await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Real policy/queue UI and real rest input on declared initial wounds/companions/claimed store. Full regression and natural frequency remain deferred.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* title may not have a world */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
