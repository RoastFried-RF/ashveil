/** Declared finite team/tools/wound, actual UI requests/cancel/rest; observation never advances time. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {baseFixture} from '../tests/base-camp-fixture'
import {createCreature} from '../src/core/creatures'
import {enlistRecruit} from '../src/core/companions'
import {addToBag,makeItem} from '../src/core/items'
import {addWound} from '../src/core/body'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,stateHash} from '../src/core/save'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type Hook={__ashveil:{world():World};render_game_presentation():NonNullable<ReturnType<MapRenderer['presentation']>>}
const out=process.argv[2]??'test-results/autonomy-v389/medical-r1';mkdirSync(out,{recursive:true})
function fixture(){
 const {w,s,p,worker}=baseFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.depth=3;s.map.name='처치 도구·지속 동작 유한 초기 방';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[]
 for(const t of s.map.tiles)if(!t.placed)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0})
 worker.skills.medicine=50;worker.facing=0;worker.companion!.order='hold';worker.companion!.anchor={...worker.pos}
 const thread=makeItem(w,'Item.Thread',3),needle=makeItem(w,'Item.Needle');for(const it of[thread,needle])assert.equal(addToBag(w,worker,it),0)
 const patient=createCreature(w,'Creature.SettlementGuard',{x:20,y:22});patient.name='처치를 기다리는 동료';patient.faction='coalition';patient.body.wounds=[];patient.body.missing=[];patient.bag=[];patient.equip={};patient.effects=[];patient.traumas=[];patient.asleep=false;patient.unconscious=false;patient.activity=undefined;s.creatures.push(patient);enlistRecruit(w,patient,1);patient.companion!.order='hold';patient.companion!.anchor={...patient.pos}
 const wound=addWound(w,patient,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:0,source:'선언한 초기 처치 상처'}).wound
 invalidateLights(w);updatePlayerVision(w,p);return{initial:serialize(s),provider:worker.id,patient:patient.id,thread:thread.uid,needle:needle.uid,wound:wound.id}
}
const server=await startNativePreview(4363),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function idle(){await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
async function care(f:ReturnType<typeof fixture>){await page.keyboard.press('Shift+N');await page.locator(`[data-person-id="${f.provider}"]`).click();await page.getByTestId('companion-panel').locator(':scope > summary').click();await page.getByTestId('companion-care-panel').locator(':scope > summary').click();await page.getByTestId('companion-clinical-panel').locator(':scope > summary').click();await page.getByTestId('companion-clinical-patient').selectOption(String(f.patient))}
async function request(f:ReturnType<typeof fixture>){await care(f);await page.getByTestId('companion-clinical-procedures').locator(':scope > summary').click();await page.locator(`[data-clinical-procedure="suture-${f.wound}"]`).click();await page.getByTestId('companion-clinical-confirm').click();await idle();await page.keyboard.press('Escape')}
try{
 await page.goto(server.url)
 for(const[width,height]of[[1440,1080],[1366,768]]as const){
  const f=fixture(),prefix=String(width);writeFileSync(join(out,prefix+'-initial.json'),f.initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},f.initial)
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await request(f)
  await page.waitForFunction(id=>(window as unknown as Hook).render_game_presentation().medical.some(v=>v.actor===id&&v.tools.length===2),f.provider,{timeout:10000})
  const before=await read(),beforeHash=stateHash(before),samples=await page.evaluate(async id=>{const frames:unknown[]=[],start=performance.now();while(performance.now()-start<1700){await new Promise(resolve=>requestAnimationFrame(resolve));const view=(window as unknown as Hook).render_game_presentation().medical.find(v=>v.actor===id);if(view)frames.push(view)}return frames},f.provider) as {frame:string;direction:string;tools:{sprite:string}[]}[],after=await read()
  assert.equal(stateHash(after),beforeHash);assert.equal(after.creatures.find(c=>c.id===f.provider)!.facing,4);assert.ok(new Set(samples.map(v=>JSON.stringify(v.tools))).size>=3);assert.ok(samples.every(v=>v.direction==='down'));assert.ok(samples.some(v=>v.tools.length===2));await page.screenshot({path:join(out,prefix+'-working.png')});writeFileSync(join(out,prefix+'-samples.json'),JSON.stringify(samples));writeFileSync(join(out,prefix+'-partial.json'),JSON.stringify(after))
  await care(f);await page.getByTestId('companion-clinical-cancel').scrollIntoViewIfNeeded();await page.getByTestId('companion-clinical-cancel').click();await idle();await page.keyboard.press('Escape');await page.waitForFunction(id=>!(window as unknown as Hook).render_game_presentation().medical.some(v=>v.actor===id),f.provider)
  const cancelled=await read(),provider=cancelled.creatures.find(c=>c.id===f.provider)!;assert.equal(provider.activity,undefined);assert.equal(provider.bag.find(i=>i.uid===f.thread)!.count,3);assert.ok(!cancelled.creatures.find(c=>c.id===f.patient)!.body.wounds.find(w=>w.id===f.wound)!.suture)
  await request(f);await page.keyboard.press('r');await idle();const end=await read(),doctor=end.creatures.find(c=>c.id===f.provider)!;assert.equal(doctor.bag.find(i=>i.uid===f.thread)!.count,2);assert.ok(doctor.bag.some(i=>i.uid===f.needle));assert.ok(end.creatures.find(c=>c.id===f.patient)!.body.wounds.find(w=>w.id===f.wound)!.suture);assert.equal(doctor.activity,undefined);assert.ok(!(await page.evaluate(()=>(window as unknown as Hook).render_game_presentation())).medical.some(v=>v.actor===f.provider));writeFileSync(join(out,prefix+'-final.json'),JSON.stringify(end));await page.screenshot({path:join(out,prefix+'-finished.png')})
  runs.push({width,height,observationMs:1700,observationWholeStateExact:true,uniqueFrames:new Set(samples.map(v=>v.frame)).size,uniqueToolTransforms:new Set(samples.map(v=>JSON.stringify(v.tools))).size,originalNeedle:f.needle,originalThread:f.thread,actualCancelUnspent:true,actualCompletedThread:2,beforeTU:before.time,afterTU:end.time});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Two real ally suture requests/cancel/restart/completion, read-only presentation interval using composed human body; no gallery views or independent Node action replay. Not every medical procedure or natural occurrence.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* title or gallery */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
