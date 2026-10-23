/** Finite initial imprint, then actual inputs and read-only frame observations. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from './native-preview'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {makeItem} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize} from '../src/core/save'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={render_game_presentation():View;render_game_to_text():string}
const out=process.argv[2]??'test-results/animation-v322/native';mkdirSync(out,{recursive:true})
const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.map.props=[];s.map.rooms=[];s.map.kind='dungeon';s.map.depth=3;s.map.name='동작 연결 · 유한 초기 방';s.map.ambient=.8;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12;s.fx=[]
for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0,cont:undefined})
p.bag=[makeItem(w,'Item.OatmealBowl',2)];p.facing=4;p.equip={main:makeItem(w,'Item.RustyKnife'),off:makeItem(w,'Item.Torch')};p.equip.off!.lit=true;p.equip.off!.fuel=3000;p.hotbar=Array(10).fill(null);p.hotbar[0]={kind:'item',def:'Item.OatmealBowl'};p.needs.nutritionDay=Math.floor(s.time/(1200*100))
for(const[def,x,y,sleep]of[['Creature.Reaver',21,20,false],['Creature.Settler',18,22,true]]as const){const c=createCreature(w,def,{x,y});c.met=true;c.ai.mode=def==='Creature.Reaver'?'guard':'calm';c.nextAct=s.time+1e9;c.asleep=sleep;c.unconscious=false;s.creatures.push(c)}
s.map.tiles[19*s.map.w+22].items.push(makeItem(w,'Item.Rope'));invalidateLights(w);updatePlayerVision(w,p);const initial=serialize(s);writeFileSync(join(out,'initial.json'),initial)
const server=await startNativePreview(4352),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const observe=()=>page.evaluate(()=>JSON.parse((window as unknown as Hook).render_game_to_text()))
try{
 await page.goto(server.url)
 for(const[width,height]of[[1440,1080],[1366,768]]){
  await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:.5,screenShake:false,torchFlicker:false,mapZoom:3}))},initial)
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!!(window as unknown as Hook).render_game_presentation?.())
  const before=await observe(),steps:unknown[]=[]
  for(const[label,key,duration]of[['north','ArrowUp',550],['crouch','Alt+c',600],['crouch-walk','ArrowDown',800],['stand','Alt+c',550],['north-again','ArrowUp',550],['attack','n',950],['east','ArrowRight',550],['east-again','ArrowRight',550],['left-attack','b',950],['use','1',1600],['pickup','g',800]]as const){
   const recording=page.evaluate(async duration=>{const frames:{at:number;view:View}[]=[],start=performance.now();while(performance.now()-start<duration){await new Promise(resolve=>requestAnimationFrame(resolve));frames.push({at:performance.now()-start,view:(window as unknown as Hook).render_game_presentation()})}return frames},duration)
   await page.keyboard.press(key);await page.waitForTimeout(label.includes('attack')?200:label==='use'?350:100);await page.screenshot({path:join(out,`${width}-${label}.png`)})
   const samples=await recording;if(label==='left-attack')assert.ok(samples.some(sample=>sample.view.frame?.mode==='attack'&&sample.view.frame.scale<0),'actual mirrored left attack');const modes=[...new Set(samples.map(x=>x.view.frame?.mode))];writeFileSync(join(out,`${width}-${label}.json`),JSON.stringify(samples));steps.push({label,key,modes,frames:[...new Set(samples.map(x=>x.view.frame?.key))].length,observation:await observe()})
  }
  const after=await observe(),seen=steps.flatMap(x=>(x as {modes:string[]}).modes);for(const mode of['walk','crouchDown','crouchWalk','stand','attack','use','interact'])assert.ok(seen.includes(mode),`missing actual pose ${mode}: ${seen}`)
  assert.ok(after.timeTU>before.timeTU);assert.deepEqual(after.player.pos,{x:22,y:19});runs.push({width,height,before,after,steps});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Actual inputs for seven body modes, including both attack directions and pickup; no full/world/1000 regression or ranged UI claim.'},null,2));console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
