/** Initial declared depot/goals/wound; actual authorization, rest and crafting UI afterward. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {baseFixture,finishBase} from '../tests/base-camp-fixture'
import {assignBaseTask,startClaimBase,transferBase} from '../src/core/base-camp'
import {setCompanionAid} from '../src/core/companion-aid'
import {addToBag,makeItem} from '../src/core/items'
import {addWound} from '../src/core/body'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize} from '../src/core/save'
import type {World} from '../src/core/ctx'
import {startNativePreview} from './native-preview'
type Hook={__ashveil:{world():World}}
const out=process.argv[2]??'test-results/autonomy-v325/native';mkdirSync(out,{recursive:true})
function fixture(kind:'depot'|'coordination'){
 const d=baseFixture(),{w,s,p,worker}=d;s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.depth=3;s.map.name='의료 보급·제작 협업 유한 초기 방';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[]
 for(const t of s.map.tiles)if(!t.placed)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0})
 startClaimBase(w,p,d.store);finishBase(w,p)
 const cloth=makeItem(w,'Item.Cloth',kind==='depot'?2:4);addToBag(w,p,cloth);transferBase(w,p,'put',cloth.uid)
 let originalBandage:number|undefined,wound:number|undefined,otherId:number|undefined
 if(kind==='depot'){
  const bandage=makeItem(w,'Item.Bandage');addToBag(w,p,bandage);transferBase(w,p,'put',bandage.uid);originalBandage=bandage.uid
  wound=addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:0,source:'선언한 초기 외부 상처'}).wound.id
  assert.equal(setCompanionAid(w,worker,'firstAid'),null);assert.equal(assignBaseTask(w,worker,'craftStock','Recipe.Bandage',1),null)
 }else{
  const other=structuredClone(worker);other.id=s.nextId++;other.name='두 번째 제작 동료';other.pos={x:19,y:20};s.creatures.push(other);otherId=other.id
  for(const actor of[worker,other])assert.equal(assignBaseTask(w,actor,'craftStock','Recipe.Bandage',1),null)
 }
 invalidateLights(w);updatePlayerVision(w,p)
 return{initial:serialize(s),provider:worker.id,name:worker.name,otherId,originalBandage,wound,store:d.store}
}
const server=await startNativePreview(4358),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function idle(){await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
try{
 await page.goto(server.url)
 for(const[kind,width,height]of[['depot',1440,1080],['depot',1366,768],['coordination',1440,1080]]as const){
  const f=fixture(kind),prefix=kind+'-'+width;writeFileSync(join(out,prefix+'-initial.json'),f.initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false,mapZoom:3}))},f.initial)
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!!(window as unknown as Hook).__ashveil?.world());const before=await read()
  if(kind==='depot'){
   await page.keyboard.press('Shift+N');await page.locator(`[data-person-id="${f.provider}"]`).click();await page.getByTestId('companion-panel').locator(':scope > summary').click();await page.getByTestId('companion-care-panel').locator(':scope > summary').click();const button=page.getByTestId('companion-aid-depot-toggle');await button.scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-permission.png')});await button.click();await idle();writeFileSync(join(out,prefix+'-partial-errand.json'),JSON.stringify(await read()));await page.keyboard.press('Escape')
   await page.keyboard.press('r');await idle();await page.keyboard.press('r');await idle()
   const end=await read(),p=end.creatures.find(c=>c.id===end.playerId)!,provider=end.creatures.find(c=>c.id===f.provider)!,stock=end.map.tiles[f.store.y*end.map.w+f.store.x].cont!.items,bandage=stock.find(i=>i.def==='Item.Bandage')!
   assert.ok(p.body.wounds.find(w=>w.id===f.wound)?.bandage);assert.equal(bandage.count,1);assert.notEqual(bandage.uid,f.originalBandage);assert.ok(!stock.some(i=>i.def==='Item.Cloth'));assert.equal(provider.companion!.aid!.suppliesFromBase,true);assert.equal(provider.companion!.aid!.supply,undefined)
   await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await page.screenshot({path:join(out,prefix+'-replenished.png')});writeFileSync(join(out,prefix+'-final.json'),JSON.stringify(end));runs.push({kind,width,height,beforeTU:before.time,afterTU:end.time,originalBandage:f.originalBandage,replenishedBandage:bandage.uid,stock:stock.map(i=>({uid:i.uid,def:i.def,count:i.count})),patient:p.id,provider:provider.id,errors:[]});await page.keyboard.press('Escape')
  }else{
   await page.keyboard.press('Period');await idle();await page.keyboard.press('Period');await idle();const started=await read(),workers=started.creatures.filter(c=>c.id===f.provider||c.id===f.otherId);assert.equal(workers.filter(c=>!!c.workJob).length,1);writeFileSync(join(out,prefix+'-started.json'),JSON.stringify(started));await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await page.screenshot({path:join(out,prefix+'-started.png')});await page.keyboard.press('Escape');await page.keyboard.press('r');await idle()
   const end=await read(),stock=end.map.tiles[f.store.y*end.map.w+f.store.x].cont!.items,all=[...stock,...end.creatures.flatMap(c=>c.bag)]
   assert.equal(all.filter(i=>i.def==='Item.Bandage').reduce((n,i)=>n+i.count,0),1);assert.equal(all.filter(i=>i.def==='Item.Cloth').reduce((n,i)=>n+i.count,0),2)
   await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await page.screenshot({path:join(out,prefix+'-finished.png')});writeFileSync(join(out,prefix+'-final.json'),JSON.stringify(end));runs.push({kind,width,height,beforeTU:before.time,afterTU:end.time,startedJobs:workers.filter(c=>!!c.workJob).length,finishedBandages:1,remainingCloth:2,errors:[]});await page.keyboard.press('Escape')
  }
  await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Two real permission/rest/replenishment runs and one real multi-worker production run. Initial plans are declared; not full regression or natural frequency.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* world may not be loaded */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
