/** Declared finite scenes; after title load, only real keys/pointer inputs change the game. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {bodyTick} from '../src/core/body'
import {createCreature} from '../src/core/creatures'
import {turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {addToBag,makeItem} from '../src/core/items'
import {serialize,stateHash} from '../src/core/save'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():ReturnType<typeof prisonerFixture>['w']};render_game_presentation():View}
type Kind='report'|'flash'|'goggles'
const out=process.argv[2]??'test-results/autonomy-v340/native';mkdirSync(out,{recursive:true})
function fixture(kind:Kind){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.map.kind='surface';s.map.depth=0;s.map.ambient=1;s.map.daylightMult=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12;s.map.name='세 다리 측량기 · 실제 관찰·보호 유한 장면'
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:false,seen:true,items:[],cont:undefined,placed:undefined,deco:undefined,room:undefined,blood:0,icy:false,snow:0,cultivation:undefined,gatherAt:undefined,gatherStock:undefined})
 p.pos=kind==='report'?{x:50,y:20}:{x:51,y:25};p.bag=[];p.equip={};p.activity=undefined;Object.assign(p.needs,{kcal:1000,waterDeficit:0,fatigue:10,protein:100,vitamin:100,bodyTemp:37,energy:100})
 const surveyor=createCreature(w,'Creature.Surveyor',{x:52,y:26});surveyor.home={x:52,y:23};surveyor.met=true;surveyor.nextAct=s.time+1;s.creatures=[p,surveyor]
 let gogglesUid:number|undefined
 if(kind==='goggles'){const goggles=makeItem(w,'Item.OpticalGoggles');gogglesUid=goggles.uid;assert.equal(addToBag(w,p,goggles),0);surveyor.body.machine!.shutdownUntil=turnOf(w)+4;bodyTick(w,surveyor,false);assert.equal(surveyor.unconscious,true)}
 s.fx=[];invalidateLights(w);updatePlayerVision(w,p);return{kind,initial:serialize(s),surveyor:surveyor.id,gogglesUid}
}
const server=await startNativePreview(4370),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function idle(){await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
async function waitTurn(){await page.keyboard.press('Period');await idle()}
async function load(f:ReturnType<typeof fixture>,width:number,height:number){
 await page.setViewportSize({width,height});writeFileSync(join(out,`${f.kind}-${width}-initial.json`),f.initial);await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:2}))},f.initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.getByRole('button',{name:'간략',exact:true}).click()
}
async function observeWork(id:number,width:number){
 await page.waitForFunction(id=>(window as unknown as Hook).render_game_presentation().actors.some(c=>c.actor===id&&c.mode==='work'),id);await page.waitForTimeout(450);const before=stateHash(await read()),samples=await page.evaluate(async id=>{const seen=new Set<string>(),rows:{at:number;actor:View['actors'][number]}[]=[],start=performance.now();while(performance.now()-start<12000){await new Promise(resolve=>requestAnimationFrame(resolve));const actor=(window as unknown as Hook).render_game_presentation().actors.find(c=>c.actor===id);if(actor?.mode==='work'){seen.add(actor.frame);rows.push({at:performance.now()-start,actor})}if(performance.now()-start>=1600&&seen.size===4)break}return rows},id);assert.equal(new Set(samples.map(r=>r.actor.frame)).size,4);assert.ok(samples.every(r=>r.actor.workCycle===1200));assert.equal(stateHash(await read()),before);writeFileSync(join(out,`report-${width}-samples.json`),JSON.stringify(samples))
 const point=await page.evaluate(id=>{const h=window as unknown as Hook,v=h.render_game_presentation(),c=v.actors.find(c=>c.actor===id)!,r=document.querySelector('canvas')!.getBoundingClientRect();return{x:r.left+v.screen.feet.x+(c.feet.x-v.feet.x)*16*v.zoom,y:r.top+v.screen.feet.y+(c.feet.y-v.feet.y)*16*v.zoom-24*v.zoom}},id);const hover=page.getByTestId('hover').filter({hasText:'안테나 보고 중'});for(const[dx,dy]of[[0,0],[-4,0],[4,0],[0,4],[0,-4],[-4,4],[4,4],[-4,-4],[4,-4]]){await page.mouse.move(point.x+dx*2,point.y+dy*2);await page.waitForTimeout(80);if(await hover.isVisible())break}await hover.waitFor();await page.screenshot({path:join(out,`report-${width}-working.png`)});await page.mouse.move(5,5)
}
try{
 await page.goto(server.url)
 for(const[width,height]of[[1440,1080],[1366,768]]as const){
  const f=fixture('report');await load(f,width,height);await waitTurn();const working=await read();assert.equal(working.creatures.find(c=>c.id===f.surveyor)!.surveyState!.progress,1);assert.equal(working.map.gardenAlert,undefined);await observeWork(f.surveyor,width);await waitTurn();await waitTurn();const after=await read(),c=after.creatures.find(c=>c.id===f.surveyor)!;assert.equal(after.map.gardenAlert!.level,1);assert.equal(after.map.gardenAlert!.events.length,1);assert.equal(c.body.machine!.attacks??0,0);assert.equal(c.activity,undefined);await page.screenshot({path:join(out,`report-${width}-complete.png`)});writeFileSync(join(out,`report-${width}-final.json`),JSON.stringify(after));runs.push({kind:'report',width,height,realWaits:3,declaredInitialNPCOffsetTU:1,actualReportOnce:true,bodyFramesObserved:4,wholeStateObservationExact:true,actualPointerReportProgress:true});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 {
  const f=fixture('flash');await load(f,1440,1080);const before=await read();await waitTurn();const exposed=await read(),p=exposed.creatures.find(c=>c.id===exposed.playerId)!;assert.ok(p.effects.some(e=>e.kind==='sensorFlash'&&e.untilTurn>exposed.time/100));assert.ok(exposed.visible.length<before.visible.length/3);await page.getByTestId('status-chips').getByText('눈부심',{exact:true}).waitFor();await page.screenshot({path:join(out,'flash-exposed.png')});await waitTurn();const restored=await read();assert.ok(restored.visible.length>exposed.visible.length*3);await page.screenshot({path:join(out,'flash-expired.png')});writeFileSync(join(out,'flash-final.json'),JSON.stringify(restored));runs.push({kind:'flash',width:1440,height:1080,realWaits:2,actualSightReduced:true,originalSightReturnedAtExpiry:true,physicalWoundsAdded:restored.creatures.find(c=>c.id===restored.playerId)!.body.wounds.length});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 {
  const f=fixture('goggles');await load(f,1366,768);await page.keyboard.press('i');await page.getByTestId('bag').getByRole('button',{name:/차광 고글/}).dblclick();await idle();let s=await read(),p=s.creatures.find(c=>c.id===s.playerId)!;assert.equal(p.equip.head?.uid,f.gogglesUid);assert.ok(!p.equip.head?.half);await page.screenshot({path:join(out,'goggles-actually-equipped.png')});await page.keyboard.press('Escape');let waits=0
  while(waits<7){s=await read();if(s.creatures.find(c=>c.id===f.surveyor)!.surveyState?.flashAt!==undefined)break;await waitTurn();waits++}
  const after=await read();p=after.creatures.find(c=>c.id===after.playerId)!;const c=after.creatures.find(c=>c.id===f.surveyor)!;assert.ok(c.surveyState?.flashAt!==undefined);assert.ok(!p.effects.some(e=>e.kind==='sensorFlash'&&e.untilTurn>after.time/100));assert.equal(p.equip.head?.uid,f.gogglesUid);assert.ok(after.log.some(e=>e.text.includes('눈 보호구가 측량기의 섬광을 막았다')));await page.screenshot({path:join(out,'goggles-flash-blocked.png')});writeFileSync(join(out,'goggles-final.json'),JSON.stringify(after));runs.push({kind:'goggles',width:1366,height:768,actualDoubleClickDress:true,originalEquippedUid:f.gogglesUid,declaredInitialMachineShutdownTurns:4,realWaits:waits,realWakeAndFlash:true,noOpticalExposure:true,originalGogglesNotConsumed:true});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Two finite clear-ground report scenes, actual3turn antenna work/pointer/progress,4source work phases, actual unprotected optical exposure/expiry, actual inventory dressing before a declared initially4turn stopped machine wakes and flashes. Not a natural garden playthrough, every damage pose, long-term ecology, full regression or worn-clothing mesh approval.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* title */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
