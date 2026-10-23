/** Comparable actual-browser art scenes. Finite initial imprints, no post-load writes. */
import {mkdirSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {makeItem} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize} from '../src/core/save'
import {startNativePreview} from './native-preview'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type Hook={render_game_presentation():NonNullable<ReturnType<MapRenderer['presentation']>>;render_game_to_text():string}
const output=process.argv[2]??'test-results/art-quality-v321/final',previewRoot=resolve(process.argv[3]??'.'),baseline=process.argv.includes('--baseline')
const characterOnly=process.argv.includes('--character-only')
const boatOnly=process.argv.includes('--boat-only')
mkdirSync(output,{recursive:true})
function fixture(kind:'room'|'field'|'torch'){
 const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.map.props=[];s.map.rooms=[];s.map.kind=kind==='field'?'surface':'dungeon';s.map.depth=kind==='field'?0:3;s.map.name=kind==='field'?'잿빛 고원의 길 · 원화 검토':kind==='torch'?'폐허의 횃불 · 원화 검토':'폐수도원 석실 · 원화 검토';s.map.ambient=kind==='torch'?.09:.8;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12;s.fx=[]
 for(const tile of s.map.tiles)Object.assign(tile,{t:kind==='field'?'Terrain.Earth':'Terrain.KtFloor',roof:kind!=='field',seen:true,items:[],cultivation:undefined,cropResidue:undefined,deco:undefined,room:undefined,blood:0,cont:undefined})
 const set=(x:number,y:number,t:string)=>{s.map.tiles[y*s.map.w+x].t=t}
 if(kind==='field'){
  for(let x=7;x<35;x++)for(let y=20;y<=21;y++)set(x,y,'Terrain.Path')
  for(let x=22;x<=26;x++)for(let y=24;y<=27;y++)set(x,y,'Terrain.Mud')
  for(const[x,y]of [[14,17],[15,17],[14,18],[15,18],[16,18]])set(x,y,'Terrain.ShallowWater')
  for(const[x,y]of [[15,14],[25,14],[29,23],[13,24]])set(x,y,'Terrain.Tree')
  if(boatOnly)set(20,18,'Terrain.BoatFrame')
 }else{
  for(let x=14;x<=28;x++){set(x,13,'Terrain.KtWall');set(x,26,'Terrain.KtWall')}
  for(let y=14;y<26;y++){set(14,y,'Terrain.KtWall');set(28,y,'Terrain.KtWall')}
  set(21,26,'Terrain.DoorOpen');set(16,14,'Terrain.Brazier')
 }
 p.bag=[];p.facing=4;p.equip={main:makeItem(w,'Item.RustyKnife'),off:makeItem(w,'Item.Torch')};p.equip.off!.lit=kind==='torch';p.equip.off!.fuel=3000;p.hotbar=Array(10).fill(null);p.needs.nutritionDay=Math.floor(s.time/(1200*100))
 const people=[['Creature.SettlementGuard',22,20],['Creature.Settler',18,21],['Creature.SettlementDoctor',18,18],['Creature.SettlementTrader',22,22],['Creature.Reaver',24,21],['Creature.Withered',17,23],['Creature.AshHound',17,19],['Creature.TenderDrone',24,24],['Creature.Amalgam',25,17],['Creature.BurrowRat',17,25],['Creature.MurkLeech',23,26],['Creature.SporeMan',26,23]]as const
 for(const[id,x,y]of people){const c=createCreature(w,id,{x,y});c.facing=id==='Creature.AshHound'?6:4;c.met=true;c.ai.mode='calm';c.asleep=false;c.unconscious=false;c.nextAct=s.time+1e9;s.creatures.push(c)}
 invalidateLights(w);updatePlayerVision(w,p);return serialize(s)
}
const server=await startNativePreview(baseline?4346:4345,previewRoot),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 await page.goto(server.url)
 for(const kind of (boatOnly?['field']:characterOnly?['room']:['room','field','torch'])as ('room'|'field'|'torch')[]){
  const initial=fixture(kind);writeFileSync(join(output,kind+'-initial.json'),initial)
  for(const[width,height]of characterOnly||boatOnly?[[1440,1080]]:[[1440,1080],[1366,768]]){
   await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},initial)
   await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!!(window as unknown as Hook).render_game_presentation?.());await page.waitForTimeout(250)
   const before=await page.evaluate(()=>JSON.parse((window as unknown as Hook).render_game_to_text())),presentation=await page.evaluate(()=>(window as unknown as Hook).render_game_presentation()),name=kind+'-'+width+'.png'
   await page.mouse.move(5,height-5);await page.screenshot({path:join(output,name)});writeFileSync(join(output,kind+'-'+width+'-observation.json'),JSON.stringify(before,null,2)+'\n')
   let movement:unknown
   if(!baseline&&kind==='room'&&width===1440){
    await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>!(window as unknown as Hook).render_game_presentation().moving)
    const after=await page.evaluate(()=>JSON.parse((window as unknown as Hook).render_game_to_text()));assert.deepEqual(after.player.pos,{x:21,y:20});assert.equal(after.timeTU-before.timeTU,100)
    await page.keyboard.press('c');await page.screenshot({path:join(output,'character-window.png')});await page.keyboard.press('Escape');movement={actualKey:'ArrowRight',costTU:100,from:before.player.pos,to:after.player.pos}
   }
   runs.push({kind,width,height,name,time:before.timeTU,visible:before.visibleCreatures.length,presentation,movement});await page.getByRole('button',{name:'타이틀',exact:true}).click()
  }
 }
 assert.deepEqual(errors,[]);writeFileSync(join(output,'audit.json'),JSON.stringify({baseline,previewRoot,finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Art comparison and one actual step only; not full/world/save regression.'},null,2)+'\n');console.log(JSON.stringify({output,runs:runs.length,errors}))
}catch(error){writeFileSync(join(output,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(output,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
