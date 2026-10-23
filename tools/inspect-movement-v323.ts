/** Focused actual-input diagnosis. Finite initial room; no post-load world writes. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from './native-preview'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {makeItem} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize} from '../src/core/save'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={render_game_presentation():View;__ashveil:{world():ReturnType<typeof prisonerFixture>['w']}}
const out=process.argv[2]??'test-results/motion-v323/movement';mkdirSync(out,{recursive:true})
const d=prisonerFixture(),{w,s,p}=d
s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.map.kind='dungeon';s.map.depth=3;s.map.name='이동·광원 유한 초기 방';s.map.ambient=.08;s.map.lights=[{pos:{x:16,y:20},radius:3,kind:'campfire'}];s.weather='clear';s.weatherUntil=1e12
for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],cultivation:undefined,cropResidue:undefined})
p.bag=[];p.facing=4;p.equip={main:makeItem(w,'Item.RustyKnife'),off:makeItem(w,'Item.Torch')};p.equip.off!.lit=true;p.equip.off!.fuel=3000;p.hotbar=Array(10).fill(null);p.needs.nutritionDay=Math.floor(s.time/(1200*100));s.fx=[]
invalidateLights(w);updatePlayerVision(w,p)
const initial=serialize(s);writeFileSync(join(out,'finite-initial.json'),initial)
const server=await startNativePreview(4326),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const sample=()=>page.evaluate(()=>(window as unknown as Hook).render_game_presentation())
try{
 await page.goto(server.url)
 for(const[width,height,speed]of [[1440,1080,1],[1366,768,.5],[1366,768,2],[1440,1080,0]]){
  await page.setViewportSize({width,height})
  await page.evaluate(({initial,speed})=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:speed,screenShake:false,torchFlicker:false}))},{initial,speed})
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
  await page.waitForFunction(()=>!!(window as unknown as Hook).render_game_presentation?.())
  const start=await sample(),destination={x:start.logical.x+7,y:start.logical.y-6},map=await page.getByTestId('map').boundingBox();assert.ok(map)
  await page.screenshot({path:join(out,`${width}-${height}-${speed}-before.png`)})
  if(speed===1){await page.keyboard.press('c');await page.screenshot({path:join(out,'character-window.png')});await page.keyboard.press('Escape')}
  // Recording only reads the public player's presentation once per browser frame.
  const record=page.evaluate(async destination=>{
   const samples:{at:number;view:View}[]=[],begin=performance.now()
   while(performance.now()-begin<45000){await new Promise(resolve=>requestAnimationFrame(resolve));const view=(window as unknown as Hook).render_game_presentation();samples.push({at:performance.now()-begin,view});if(samples.length>3&&view.logical.x===destination.x&&view.logical.y===destination.y&&!view.moving)break}
   return samples
  },destination)
  await page.mouse.click(map.x+start.screen.logical.x+7*16*start.zoom,map.y+start.screen.logical.y-6*16*start.zoom-6*start.zoom)
  const samples=await record,end=await sample()
  writeFileSync(join(out,`${width}-${height}-${speed}-samples.json`),JSON.stringify(samples))
  assert.deepEqual(end.logical,destination);assert.equal(end.moving,false);assert.deepEqual(end.feet,destination)
  let maxStep=0,maxLightError=0,maxQueued=0,movingSamples=0
  for(let i=0;i<samples.length;i++){
   const v=samples[i].view;maxQueued=Math.max(maxQueued,v.queued.length);if(v.moving)movingSamples++
   if(v.light)maxLightError=Math.max(maxLightError,Math.hypot(v.light.x-v.feet.x,v.light.y-v.feet.y))
   if(i)maxStep=Math.max(maxStep,Math.max(Math.abs(v.feet.x-samples[i-1].view.feet.x),Math.abs(v.feet.y-samples[i-1].view.feet.y)))
   if(v.moving)assert.ok(Math.max(Math.abs(v.segment.to.x-v.segment.from.x),Math.abs(v.segment.to.y-v.segment.from.y))<=1)
  }
  if(speed!==0){assert.ok(movingSamples>0);assert.ok(maxStep<1,`unexpected frame jump ${maxStep}`)}
  assert.equal(maxLightError,0);assert.equal(maxQueued,0);assert.ok(end.equipment[0].visible);assert.ok(end.equipment[0].alpha>.9,'equipped weapon stays visible, including animation speed0')
  const staticLight=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s.map.lights[0]);assert.deepEqual(staticLight.pos,{x:16,y:20})
  await page.screenshot({path:join(out,`${width}-${height}-${speed}-after.png`)})
  writeFileSync(join(out,`${width}-${height}-${speed}-samples.json`),JSON.stringify(samples))
  runs.push({width,height,speed,steps:7,frames:samples.length,movingSamples,maxStep,maxLightError,maxQueued,destination,staticLightUnchanged:true})
  await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,input:'actual map click, seven diagonal/cardinal steps',runs,errors,scope:'Focused movement/light/art diagnosis only; full regression/world/save compatibility remain deferred.'},null,2));console.log(JSON.stringify({runs,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
