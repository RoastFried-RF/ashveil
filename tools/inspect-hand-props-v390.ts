/** Finite declared anatomy/stock. After Title: real input and read-only diagnostics only. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {makeItem,addToBag} from '../src/core/items'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View}
type Scene={name:string;missing:string[];hand:0|1|null;facing?:number;replacement?:'hook'|'powered'|'unpowered';instant?:boolean;secondBottle?:boolean}
const out=process.argv[2],url=process.argv[3],baseline=process.argv.includes('--baseline')
assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const availableScenes:Scene[]=baseline?[{name:'right-arm-missing',missing:['RightUpperArm'],hand:1}]:[
 {name:'intact',missing:[],hand:0},
 ...[0,2,4,6].map(facing=>({name:'right-arm-missing-'+facing,missing:['RightUpperArm'],hand:1 as const,facing})),
 {name:'right-forearm-missing',missing:['RightForearm'],hand:1},
 {name:'right-hand-missing',missing:['RightHand'],hand:1},
 {name:'right-fingers-missing',missing:['RightThumb','RightIndex','RightMiddle','RightRing','RightPinky'],hand:1},
 {name:'right-hook',missing:['RightHand'],hand:1,replacement:'hook'},
 {name:'right-unpowered',missing:['RightHand'],hand:1,replacement:'unpowered'},
 {name:'right-powered-only',missing:['RightHand','LeftUpperArm'],hand:0,replacement:'powered'},
 {name:'left-arm-missing',missing:['LeftUpperArm'],hand:0},
 {name:'no-hands',missing:['RightHand','LeftHand'],hand:null},
 {name:'same-sprite-new-uid',missing:['RightUpperArm'],hand:1,secondBottle:true},
 {name:'right-arm-instant',missing:['RightUpperArm'],hand:1,instant:true},
]
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7),scenes=only?availableScenes.filter(scene=>scene.name===only):availableScenes;assert.ok(scenes.length)
let lastExpected:World|undefined
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage()
const errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
let current='startup'
async function compare(expected:World,label:string){expected.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(expected.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)),label);pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(url)
 for(const [index,scene]of scenes.entries()){
  current=scene.name
  const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.sources=[];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
  for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]})
  p.bag=[];p.equip={};p.body.missing=[...scene.missing];p.body.prosthetics={};p.facing=scene.facing??4;p.needs.waterDeficit=1200
  if(scene.replacement){const hook=scene.replacement==='hook',item=makeItem(w,hook?'Item.HookHand':'Item.PioneerArm');p.body.prosthetics.RightHand={def:hook?'Prosthetic.HookHand':'Prosthetic.PioneerArm',item,installedAt:s.time/100,servicedAt:s.time/100,...(!hook?{powerUntil:scene.replacement==='powered'?s.time/100+1000:0}:{})}}
  const water=makeItem(w,'Item.WaterBottle'),food=makeItem(w,'Item.Jerky');assert.equal(addToBag(w,p,water),0);assert.equal(addToBag(w,p,food),0);p.hotbar[2]={kind:'item',def:water.def};p.hotbar[3]={kind:'item',def:food.def}
  const secondWater=scene.secondBottle?makeItem(w,'Item.WaterBottle'):undefined;if(secondWater){water.uses=1;secondWater.uses=1;assert.equal(addToBag(w,p,secondWater),0)}
  s.fx=[];invalidateLights(w);updatePlayerVision(w,p);const initial=serialize(s),expected={db:w.db,s:deserialize(initial)};writeFileSync(join(out,current+'-initial.json'),initial);lastExpected=expected
  await page.setViewportSize(index%2?{width:1440,height:1080}:{width:1366,height:768})
  await page.evaluate(({initial,instant})=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:instant?0:1,screenShake:false,torchFlicker:false,mapZoom:4}))},{initial,instant:!!scene.instant})
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForTimeout(250);await compare(expected,current+'-loaded')
  const sampling=page.evaluate(async()=>{const rows:View[]=[];const start=performance.now();while(performance.now()-start<1200){await new Promise(resolve=>requestAnimationFrame(resolve));rows.push((window as unknown as Hook).render_game_presentation())}return rows})
  await page.keyboard.press('3')
  assert.equal(playerAct(expected,{type:'consume',uid:water.uid}),null)
  if(!scene.instant&&!baseline)await page.waitForFunction(uid=>(window as unknown as Hook).render_game_presentation().action?.propUid===uid,water.uid)
  if(secondWater){assert.equal(await page.getByTestId('hotbar-count-2').innerText(),'1');await page.keyboard.press('3');assert.equal(playerAct(expected,{type:'consume',uid:secondWater.uid}),null);await page.waitForFunction(uid=>(window as unknown as Hook).render_game_presentation().action?.propUid===uid,secondWater.uid);assert.equal(await page.getByTestId('hotbar-count-2').innerText(),'0')}
  if(scene.hand!==null){await page.keyboard.press('4');assert.equal(playerAct(expected,{type:'consume',uid:food.uid}),null);await page.screenshot({path:join(out,current+'-food.png')})}
  else await page.screenshot({path:join(out,current+'-water.png')})
  const samples=await sampling;writeFileSync(join(out,current+'-samples.json'),JSON.stringify(samples))
  await page.waitForFunction(time=>(window as unknown as Hook).__ashveil.world().s.time===time,expected.s.time);await compare(expected,current+'-consumed')
  if(secondWater){await page.keyboard.press('3');await compare(expected,current+'-empty-no-op')}
  const use=samples.filter(row=>row.action?.kind==='use'&&row.action.prop)
  if(!baseline&&!scene.instant){
   assert.ok(use.length,current+' use was observed');for(const row of use){assert.equal(row.action!.propHand,scene.hand);assert.ok(row.action!.propUid===water.uid||!!secondWater&&row.action!.propUid===secondWater.uid||row.action!.propUid===food.uid);if(row.action!.propUid===food.uid&&row.actionProp.visible)assert.ok(Math.max(row.actionProp.width,row.actionProp.height)<=4.000001);if(row.actionProp.visible){assert.notEqual(scene.hand,null);const human=row.actors.find(a=>a.actor===p.id)!.human!,grip=human.grips[scene.hand===1?'left':'right'];assert.ok(Math.hypot(row.actionProp.x-grip[0],row.actionProp.y-grip[1])<1e-7);const mouth=human.sourceLandmarks.mouth;if(mouth&&row.action!.consuming&&row.action!.phase>.4&&row.action!.phase<.6){const bite=[row.actionProp.x+(.5-row.actionProp.anchor.x)*row.actionProp.width,row.actionProp.y+((row.action!.propUid===food.uid ? .35 : 0)-row.actionProp.anchor.y)*row.actionProp.height];assert.ok(Math.hypot(bite[0]-mouth[0],bite[1]-mouth[1])<2,current+' observed consumption contact')}}}
   if(scene.hand===null)assert.ok(use.every(row=>!row.actionProp.visible));else{assert.ok(use.some(row=>row.actionProp.visible&&row.action!.propUid===water.uid),current+' water in chosen hand');assert.ok(use.some(row=>row.actionProp.visible&&row.action!.propUid===food.uid),current+' new original food replaced water');assert.ok(!expected.s.creatures[0].bag.some(item=>item.uid===food.uid))}
  }else if(scene.instant){assert.ok(samples.every(row=>!row.actionProp.visible))}
  if(secondWater){assert.ok(use.some(row=>row.action?.propUid===secondWater.uid&&row.actionProp.visible));assert.equal(expected.s.creatures[0].bag.find(item=>item.uid===water.uid)?.uses,0)}
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForTimeout(200);await compare(expected,current+'-continued')
  runs.push({scene,waterUid:water.uid,secondWaterUid:secondWater?.uid,foodUid:food.uid,samples:samples.length,observedUse:use.length,viewport:page.viewportSize()});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({baseline,finiteInitial:true,noPostTitleWrites:true,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,pairs:pairs.length,errors,baseline}))
}catch(error){try{writeFileSync(join(out,'failure-actual.json'),serialize(await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)));if(lastExpected)writeFileSync(join(out,'failure-expected.json'),serialize(lastExpected.s))}catch{/* title/load failure */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({scene:current,error:String(error),runs,pairs,errors},null,2));writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());throw error}finally{await browser.close()}
