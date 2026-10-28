/** Finite nonfatal original anatomy/equipment; after Title real keys only and independent whole Node state. */
import{chromium}from'playwright-core'
import assert from'node:assert/strict'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import{prisonerFixture}from'../tests/prisoner-fixture'
import{makeItem}from'../src/core/items'
import{playerAct}from'../src/core/game'
import{serialize,deserialize,stateHash}from'../src/core/save'
import{invalidateLights,updatePlayerVision}from'../src/core/fov'
import{turnOf,type World}from'../src/core/ctx'
import type{Action}from'../src/core/actions'
import type{ProstheticDef}from'../src/core/types'
import type{MapRenderer}from'../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View}
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const fingers=['Thumb','Index','Middle','Ring','Pinky'],toes=['Toe1','Toe2','Toe3','Toe4','Toe5']
const scenes=[{name:'fingers-toes',missing:['LeftIndex','RightToe1']},{name:'right-all-fingers',missing:fingers.map(s=>'Right'+s)},{name:'left-all-toes',missing:toes.map(s=>'Left'+s)},{name:'face',missing:['LeftEye','RightEye','Nose','Jaw','LeftEar','RightEar']},{name:'compound-roots',missing:['LeftUpperArm','RightShin','LeftIndex','RightToe1','Nose']},{name:'glass-eye',missing:['LeftEye'],glass:true},{name:'covered',missing:['LeftThumb','RightToe1'],covered:true}]
const only=process.argv.find(s=>s.startsWith('--only='))?.slice(7),selected=only?scenes.filter(s=>only.split(',').includes(s.name)):scenes;assert.ok(selected.length)
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:unknown[]=[],runs:unknown[]=[]
let current='startup',lastExpected:World|undefined
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(expected:World,label:string,action?:Action){if(action)assert.equal(playerAct(expected,action),null,label);await page.waitForFunction(time=>(window as unknown as Hook).__ashveil.world().s.time===time,expected.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);await page.waitForTimeout(80);expected.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(expected.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)),label);pairs.push({label,hash:stateHash(actual)});return await page.evaluate(()=>(window as unknown as Hook).render_game_presentation())}
try{
 await page.goto(url)
 for(const scene of selected){
  current=scene.name;const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.sources=[];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
  for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]})
  p.bag=[];p.equip={};p.body.missing=[...scene.missing];p.body.prosthetics={};p.facing=4
  if(scene.covered){p.equip.hands=makeItem(w,'Item.Gloves');p.equip.feet=makeItem(w,'Item.Boots')}
  if(scene.glass){const rule=w.db.get<ProstheticDef>('Prosthetic.GlassEye'),item=makeItem(w,rule.item);p.body.prosthetics.LeftEye={def:rule.id,item,installedAt:turnOf(w),servicedAt:turnOf(w)}}
  s.fx=[];invalidateLights(w);updatePlayerVision(w,p);const initial=serialize(s),expected={db:w.db,s:deserialize(initial)};lastExpected=expected;writeFileSync(join(out,current+'-initial.json'),initial)
  await page.setViewportSize(scene.covered?{width:1440,height:1080}:{width:1366,height:768});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false,mapZoom:4}))},initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await compare(expected,current+'-loaded')
  const views:unknown[]=[]
  for(const[direction,key,dir]of[['down','Control+ArrowDown',4],['left','Control+ArrowLeft',6],['right','Control+ArrowRight',2],['up','Control+ArrowUp',0]]as const){
   await page.keyboard.press(key);const row=await compare(expected,current+'-'+direction,{type:'face',dir}),human=row.actors.find(a=>a.actor===p.id)?.human;assert.ok(human,current+' own body remains visible');const marks=human.parts.filter(part=>part.role==='loss-mark')
   if(scene.name==='face')assert.equal(marks.length,direction==='up'?0:direction==='down'?6:4)
   if(scene.name==='right-all-fingers')assert.equal(marks.length,5)
   if(scene.name==='left-all-toes')assert.equal(marks.length,direction==='up'?0:direction==='right'?1:5)
   if(scene.covered)assert.equal(marks.length,0)
   if(scene.name==='compound-roots'){assert.ok(!human.parts.some(p=>p.owner.startsWith('Left')&&p.role==='loss-mark'));assert.ok(!human.parts.some(p=>p.owner.startsWith('RightToe')&&p.role==='loss-mark'));assert.ok(!human.parts.some(p=>['LeftUpperArm','LeftForearm','LeftHand','RightShin','RightFoot'].includes(p.owner)&&p.role==='flesh'))}
   if(scene.glass){assert.ok(!marks.some(p=>p.owner==='LeftEye'));assert.equal(human.parts.filter(p=>p.role==='prosthetic').length,direction==='down'||direction==='left'?1:0)}
   for(const side of['left','right']as const)assert.ok(Math.hypot(human.footSources[side].sole[0]-human.footProjection[side].actual[0],human.footSources[side].sole[1]-human.footProjection[side].actual[1])<1e-7)
   writeFileSync(join(out,current+'-'+direction+'-presentation.json'),JSON.stringify(row));if(direction==='down'||direction==='left')await page.screenshot({path:join(out,current+'-'+direction+'.png')});views.push({direction,marks:marks.map(p=>p.owner),footSources:human.footSources})
  }
  await page.keyboard.press('Period');await compare(expected,current+'-waited',{type:'wait'});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await compare(expected,current+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click();runs.push({scene,views})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostTitleWorldWrites:true,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,pairs:pairs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-actual.json'),serialize(await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)));if(lastExpected)writeFileSync(join(out,'failure-expected.json'),serialize(lastExpected.s))}catch{/* title failure */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({scene:current,error:String(error),runs,pairs,errors},null,2));throw error}finally{await browser.close()}
