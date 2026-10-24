/** Declared finite wildlife/food/water scene. Real waits/movement; presentation is read-only. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {calendar} from '../src/core/climate-state'
import {serialize,stateHash} from '../src/core/save'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():ReturnType<typeof prisonerFixture>['w']};render_game_presentation():View}
const out=process.argv[2]??'test-results/autonomy-v333/native';mkdirSync(out,{recursive:true})
function fixture(){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.depth=3;s.map.name='숲 동물·실제 섭식 유한 초기 방';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],placed:undefined,deco:undefined,room:undefined,blood:0,icy:false,snow:0,cultivation:undefined,gatherAt:undefined})
 while(calendar(w).season.id==='Season.Summer')s.time+=28800*100
 p.bag=[];p.equip={};p.pos={x:20,y:20};p.nextAct=s.time
 const stag=createCreature(w,'Creature.AshhornStag',{x:30,y:20}),boar=createCreature(w,'Creature.Tuskhog',{x:29,y:24}),hidden=createCreature(w,'Creature.AshhornStag',{x:5,y:40})
 for(const c of[stag,boar,hidden]){c.home={...c.pos};c.met=true;c.facing=4;c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.effects=[];c.traumas=[];c.traits=[];c.background=undefined;c.age=undefined;c.asleep=false;c.unconscious=false;c.activity=undefined;c.nextAct=s.time;Object.assign(c.needs,{kcal:-500,waterDeficit:0,fatigue:10,bodyTemp:37,wetness:0,hygiene:100,protein:100,vitamin:100})}
 s.creatures=[p,stag,boar,hidden];s.map.tiles[21*s.map.w+30].t='Terrain.ShadePlot';s.map.tiles[25*s.map.w+29].t='Terrain.ShadePlot';s.map.tiles[24*s.map.w+29].t='Terrain.Mud'
 invalidateLights(w);updatePlayerVision(w,p);return{initial:serialize(s),stag:stag.id,boar:boar.id,hidden:hidden.id,plots:[21*s.map.w+30,25*s.map.w+29]}
}
const server=await startNativePreview(4365),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function idle(){await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
try{
 await page.goto(server.url)
 for(const[width,height]of[[1440,1080],[1366,768]]as const){
  const f=fixture(),prefix=String(width);writeFileSync(join(out,prefix+'-initial.json'),f.initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:2}))},f.initial)
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.getByRole('button',{name:'간략',exact:true}).click()
  let waits=0
  while(waits<6){const state=await read();if([f.stag,f.boar].every(id=>state.creatures.find(c=>c.id===id)?.activity?.animalForage))break;await page.keyboard.press('Period');await idle();waits++}
  await page.waitForFunction(ids=>{const v=(window as unknown as Hook).render_game_presentation();return ids.every(id=>v.actors.some(c=>c.actor===id&&c.mode==='work'))},[f.stag,f.boar],{timeout:15000})
  await page.waitForTimeout(500)
  const before=await read(),beforeHash=stateHash(before),samples=await page.evaluate(async ids=>{const frames:{at:number;view:View}[]=[],start=performance.now(),seen=new Map<number,Set<string>>(ids.visible.map(id=>[id,new Set()]));while(performance.now()-start<12000){await new Promise(resolve=>requestAnimationFrame(resolve));const view=(window as unknown as Hook).render_game_presentation();if(view.actors.some(c=>c.actor===ids.hidden))throw Error('hidden actor source frame leaked');for(const c of view.actors)if(c.mode==='work')seen.get(c.actor)?.add(c.frame);frames.push({at:performance.now()-start,view});if(performance.now()-start>=2100&&[...seen.values()].every(keys=>keys.size===4))break}return frames},{hidden:f.hidden,visible:[f.stag,f.boar]}),after=await read();assert.equal(stateHash(after),beforeHash)
  writeFileSync(join(out,prefix+'-work-samples.json'),JSON.stringify(samples))
  for(const[id,cycle]of[[f.stag,1800],[f.boar,1900]]as const){const views=samples.flatMap(s=>s.view.actors.filter(c=>c.actor===id));assert.ok(views.length>0);assert.ok(views.every(c=>c.workCycle===cycle));assert.equal(new Set(views.map(c=>c.frame)).size,4)}
  await page.screenshot({path:join(out,prefix+'-grazing.png')});writeFileSync(join(out,prefix+'-work-samples.json'),JSON.stringify(samples));writeFileSync(join(out,prefix+'-working.json'),JSON.stringify(after))
  const wallowRecording=page.evaluate(async id=>{const frames:View['actors']=[],start=performance.now(),seen=new Set<string>();let worldAtStart:string|undefined;while(performance.now()-start<45000){await new Promise(resolve=>requestAnimationFrame(resolve));const hook=window as unknown as Hook,actor=hook.render_game_presentation().actors.find(c=>c.actor===id);if(actor?.mode==='wallow'){frames.push(actor);seen.add(actor.frame);if(!worldAtStart&&!hook.__ashveil.world().s.simulationPending)worldAtStart=JSON.stringify(hook.__ashveil.world().s)}if(seen.size===6)break}return{frames,worldAtStart}},f.boar)
  while(waits<25){const state=await read();if(state.creatures.find(c=>c.id===f.boar)!.wildlifeState?.mudRainRemaining&&f.plots.every(at=>!!state.map.tiles[at].gatherAt))break;await page.keyboard.press('Period');await idle();waits++}
  const fed=await read();for(const id of[f.stag,f.boar])assert.ok(fed.creatures.find(c=>c.id===id)!.needs.kcal>before.creatures.find(c=>c.id===id)!.needs.kcal+400);for(const at of f.plots)assert.ok(fed.map.tiles[at].gatherAt!>0);assert.ok((fed.creatures.find(c=>c.id===f.boar)!.wildlifeState?.mudRainRemaining??0)>0);writeFileSync(join(out,prefix+'-fed.json'),JSON.stringify(fed));await page.screenshot({path:join(out,prefix+'-fed.png')})
  await page.waitForFunction(id=>{const actor=(window as unknown as Hook).render_game_presentation().actors.find(c=>c.actor===id);return actor?.mode==='wallow'&&/[23]$/.test(actor.frame)},f.boar,{timeout:15000});await page.screenshot({path:join(out,prefix+'-wallow.png')})
  const wallowCapture=await wallowRecording,wallowSamples=wallowCapture.frames;writeFileSync(join(out,prefix+'-wallow-capture.json'),JSON.stringify(wallowCapture));writeFileSync(join(out,prefix+'-wallow-samples.json'),JSON.stringify(wallowSamples));assert.equal(stateHash(await read()),stateHash(fed));assert.ok(wallowCapture.worldAtStart,'Actual wallow pose must start after the real movement arrives');assert.equal(stateHash(JSON.parse(wallowCapture.worldAtStart)),stateHash(fed));assert.equal(new Set(wallowSamples.map(c=>c.frame)).size,6)
  const flightStart=fed.creatures.find(c=>c.id===f.stag)!.pos;for(let n=0;n<5;n++){await page.keyboard.press('ArrowRight');await idle();await page.waitForFunction(()=>!(window as unknown as Hook).render_game_presentation().moving)}
  const end=await read(),stag=end.creatures.find(c=>c.id===f.stag)!;assert.ok(stag.pos.x>flightStart.x||stag.pos.y!==flightStart.y);assert.equal(stag.activity,undefined);writeFileSync(join(out,prefix+'-final.json'),JSON.stringify(end));await page.screenshot({path:join(out,prefix+'-flight.png')});runs.push({width,height,observedMs:samples.at(-1)!.at,presentationSamples:samples.length,observationWholeStateExact:true,wallowOriginalFrames:6,wallowObservationWholeStateExact:true,actualWaitInputs:waits,actualMoveInputs:5,stag:f.stag,boar:f.boar,bothAteOriginalMaturePlants:true,plotsUnavailableAfterward:true,boarWallowedOnOriginalMud:true,hiddenActorNotExposed:true,stagFled:true});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Two identified finite wildlife scenes, actual waits for crop grazing and mud coating, presentation-only interval, real approach and flight. Not a natural forest playthrough, all seasons or World regression.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* title */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
