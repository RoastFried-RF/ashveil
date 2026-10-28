/** Finite initial scenes; after Title, actual keys/pointer and read-only observations only. */
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { thermalFixture } from '../tests/thermal-fixture'
import { tileAt, turnOf, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { invalidateLights, updatePlayerVision } from '../src/core/fov'
import { playerAct } from '../src/core/game'
import { equip, makeItem, addToBag } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { thermalGuidance } from '../src/client/thermal-guidance'
import { startNativePreview } from './native-preview'

const out=process.argv[2];assert.ok(out);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const only=process.argv.find(s=>s.startsWith('--only='))?.slice(7)
const server=process.argv[3]?.startsWith('http')?{url:process.argv[3],stop(){}}:await startNativePreview(4421)
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[]
type Hook={__ashveil:{world():World}}
const scenes=['fire','wind','wet','bed','no-fire','moving','critical','deep-water'].filter(s=>!only||only.split(',').includes(s))
let current='startup'
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function idle(){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!(window as unknown as Hook).__ashveil.world().s.simulationPending)}
async function compare(w:World,label:string){await idle();w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(server.url)
 for(const[width,height]of[[1440,1080],[1366,768],[390,844]])for(const name of scenes){
  current=`${name}-${width}`;const f=thermalFixture(),{w,s,p,fire}=f
  if(name==='wind')s.wind={x:4,y:0}
  if(name==='wet'){
   s.weather='ashrain';s.wind={x:2,y:0};p.needs.wetness=100
   for(const id of ['Item.LeatherCoat','Item.Boots']){const it=makeItem(w,id);it.quality=3;assert.equal(addToBag(w,p,it),0);assert.equal(equip(w,p,it.uid),null);it.wetness=Object.fromEntries(['torso','arms','legs','head','hands','feet'].map(r=>[r,100]))}
  }
  if(name==='bed'){s.time=8*TURNS_PER_HOUR*100;p.nextAct=s.time;tileAt(w,p.pos).roof=true;tileAt(w,p.pos).t='Terrain.Bedroll'}
  if(name==='no-fire')Object.assign(fire,{off:true})
  if(name==='moving'){s.time=8*TURNS_PER_HOUR*100;p.nextAct=s.time;p.movedTurn=turnOf(w);p.needs.bodyTemp=36.6}
  if(name==='critical')p.needs.bodyTemp=31.5
  if(name==='deep-water')tileAt(w,p.pos).t='Terrain.DeepFenWater'
  invalidateLights(w);updatePlayerVision(w,p);s.fx=[]
  const initial=serialize(s);writeFileSync(join(out,current+'-initial.json'),initial)
  await page.setViewportSize({width,height})
  await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:4}))},initial)
  await page.reload();await page.getByTestId('continue').click();await idle()
  const expected:World={db:w.db,s:deserialize(initial)};await compare(expected,current+'-loaded')
  const guidance=thermalGuidance(expected)
  let tabSteps=0
  if(guidance.notice){
   const chip=page.getByTestId('thermal-guidance-chip');await chip.waitFor();assert.equal(await chip.innerText(),guidance.notice);await page.screenshot({path:join(out,current+'-map.png')})
   while(!await chip.evaluate(el=>el===document.activeElement)&&tabSteps<40){await page.keyboard.press('Tab');tabSteps++}
   assert.equal(await chip.evaluate(el=>el===document.activeElement),true,current+' actual Tab reaches warning')
   await page.keyboard.press('Enter')
  }
  else await page.keyboard.press('Shift+J')
  await page.getByTestId('thermal-forecast').waitFor();await page.getByTestId('thermal-forecast').scrollIntoViewIfNeeded()
  assert.equal(await page.getByTestId('thermal-rest').innerText(),guidance.format(guidance.rest))
  assert.equal(await page.getByTestId('thermal-sleep').innerText(),guidance.format(guidance.sleep))
  assert.equal(await page.getByTestId('thermal-warm').innerText(),guidance.warm===undefined?'불가':guidance.format(guidance.warm))
  assert.equal(await page.getByTestId('thermal-advice').innerText(),guidance.advice)
  assert.equal(await page.getByTestId('warm-by-fire').isDisabled(),!!guidance.warmError)
  await page.screenshot({path:join(out,current+'-forecast.png')});await compare(expected,current+'-readonly-forecast')
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,current+' horizontal overflow')
  let action='observe'
  if(['fire','wind','wet'].includes(name)){
   const before=expected.s.creatures.find(c=>c.id===expected.s.playerId)!.needs.bodyTemp
   await page.getByTestId('warm-by-fire').click();assert.equal(playerAct(expected,{type:'warmByFire'}),null);await compare(expected,current+'-actual-warm')
   const after=expected.s.creatures.find(c=>c.id===expected.s.playerId)!.needs.bodyTemp
   if(name==='fire')assert.ok(after>before);if(name==='wind')assert.ok(after<before)
   action='warmByFire'
  }
  await page.keyboard.press('Escape')
  if(['bed','no-fire','moving'].includes(name)){
   const rest=name==='bed';await page.keyboard.press(rest?'r':'Period');assert.equal(playerAct(expected,rest?{type:'rest',turns:200}:{type:'wait'}),null);await compare(expected,current+'-actual-'+(rest?'rest':'wait'));action=rest?'rest':'wait'
  }
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(expected,current+'-continued')
  runs.push({name,width,height,initialTemperature:p.needs.bodyTemp,forecast:{current:guidance.current,rest:guidance.rest,sleep:guidance.sleep,warm:guidance.warm,warmError:guidance.warmError,notice:guidance.notice},action,tabSteps,overflow})
  await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,postTitleWorldWrites:false,wholePairs:pairs.length,runs,pairs,errors},null,2)+'\n');console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),runs,pairs,errors},null,2));throw error}finally{await browser.close();server.stop()}
