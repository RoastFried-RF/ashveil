/** Declared actual belt stock; after Title only real keys and read-only observations. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {makeItem,addToBag,supplyItems} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View}
type Scene={name:string;missing?:boolean;instant?:boolean;bagFirst?:boolean;half?:boolean;broken?:boolean;facing?:number}
const out=process.argv[2],url=process.argv[3],baseline=process.argv.includes('--baseline');assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const available:Scene[]=baseline?[{name:'pocket-last-food'}]:[{name:'pocket-last-food'},...[0,2,4,6].map(facing=>({name:'left-only-'+facing,missing:true,facing})),{name:'bag-then-pocket',bagFirst:true},{name:'instant',instant:true},{name:'half-belt',half:true},{name:'broken-belt',broken:true}]
const only=process.argv.find(s=>s.startsWith('--only='))?.slice(7),scenes=only?available.filter(s=>only.split(',').includes(s.name)):available;assert.ok(scenes.length)
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[]
let current='startup',lastExpected:World|undefined
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(expected:World,label:string){expected.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(expected.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)),label);pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(url)
 for(const scene of scenes){
  current=scene.name
  const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.sources=[];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
  for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]})
  p.bag=[];p.equip={};p.body.missing=scene.missing?['RightUpperArm']:[];p.facing=scene.facing??4;p.needs.waterDeficit=1200
  const bagWater=scene.bagFirst?makeItem(w,'Item.WaterBottle'):undefined;const food=makeItem(w,'Item.Jerky'),water=makeItem(w,'Item.WaterBottle'),belt=makeItem(w,'Item.LeatherBelt');food.gx=0;food.gy=0;water.gx=1;water.gy=0;water.uses=1;belt.contents=[food,water];if(scene.half)belt.half=true;if(scene.broken)belt.durability=0;p.equip.belt=belt;p.hotbar[2]={kind:'item',def:water.def};p.hotbar[3]={kind:'item',def:food.def}
  if(bagWater){assert.ok(bagWater.uid<water.uid);bagWater.uses=1;assert.equal(addToBag(w,p,bagWater),0)}
  s.fx=[];invalidateLights(w);updatePlayerVision(w,p);const initial=serialize(s),expected={db:w.db,s:deserialize(initial)};lastExpected=expected;writeFileSync(join(out,current+'-initial.json'),initial)
  await page.setViewportSize(scene.missing?{width:1440,height:1080}:{width:1366,height:768})
  await page.evaluate(({initial,speed})=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:speed,screenShake:false,torchFlicker:false,mapZoom:4}))},{initial,speed:scene.instant?0:.5})
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await compare(expected,current+'-loaded')
  const useRows:unknown[]=[]
  for(const item of [...(bagWater?[bagWater]:[]),water,food]){
   const blocked=!!scene.half||!!scene.broken,label=current+'-'+item.uid
   const recording=page.evaluate(async()=>{const rows:View[]=[],start=performance.now();while(performance.now()-start<1800){await new Promise(resolve=>requestAnimationFrame(resolve));rows.push((window as unknown as Hook).render_game_presentation())}return rows})
   await page.keyboard.press(item.def===water.def?'3':'4')
   if(!blocked)assert.equal(playerAct(expected,{type:'consume',uid:item.uid}),null)
   if(item.uid===food.uid&&!blocked)await page.screenshot({path:join(out,current+'-food.png')})
   const samples=await recording;writeFileSync(join(out,label+'-samples.json'),JSON.stringify(samples));await compare(expected,label+'-used')
   const use=samples.filter(row=>row.action?.kind==='use'),visible=use.filter(row=>row.actionProp.visible)
   if(blocked||scene.instant)assert.equal(visible.length,0)
   else if(baseline){assert.ok(use.length);assert.equal(visible.length,0,'baseline pocket item consumed without its actual prop')}
   else{assert.ok(visible.length,label+' actual item visible');for(const row of visible){assert.equal(row.action!.propUid,item.uid);assert.equal(row.action!.propDef,item.def);assert.equal(row.action!.propHand,scene.missing?1:0);const grip=row.actors.find(a=>a.actor===p.id)!.human!.grips[scene.missing?'left':'right'];assert.ok(Math.hypot(grip[0]-row.actionProp.x,grip[1]-row.actionProp.y)<1e-7)}}
   useRows.push({uid:item.uid,def:item.def,visible:visible.length,use:use.length,blocked})
  }
  const ep=expected.s.creatures[0];if(!scene.half&&!scene.broken){assert.ok(!supplyItems(ep).some(i=>i.uid===food.uid));assert.equal(ep.equip.belt!.contents!.find(i=>i.uid===water.uid)!.uses,0)}
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await compare(expected,current+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click();runs.push({scene,foodUid:food.uid,waterUid:water.uid,beltUid:belt.uid,bagWaterUid:bagWater?.uid,useRows})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({baseline,finiteInitial:true,noPostTitleWorldWrites:true,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({baseline,scenes:runs.length,pairs:pairs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-actual.json'),serialize(await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)));if(lastExpected)writeFileSync(join(out,'failure-expected.json'),serialize(lastExpected.s))}catch{/* title failure */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({scene:current,error:String(error),runs,pairs,errors},null,2));throw error}finally{await browser.close()}
