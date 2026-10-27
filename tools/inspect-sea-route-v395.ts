/** Actual chart clicks and sailing; finite INITIAL channel only, then read-only observations. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {seaRouteFixture} from '../tests/sea-route-fixture'
import {playerAct,runUntilInput} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {seaRouteForecast} from '../src/core/marine-forecast'
import type {World} from '../src/core/ctx'
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
type Hook={__ashveil:{world():World}}
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});let current='start'
async function compare(w:World,label:string){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(time=>{const s=(window as unknown as Hook).__ashveil.world().s;return!s.simulationPending&&s.time===time},w.s.time,{timeout:300000});await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-expected.json'),serialize(w.s));writeFileSync(join(out,label+'-actual.json'),serialize(actual));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(url)
 for(const[width,height]of[[1440,1080],[1366,768],[390,844]])for(const mode of ['wind','storm','unknown']as const){
  current=mode+'-'+width;const d=seaRouteFixture(mode),initial=serialize(d.s),w:World={db:d.w.db,s:deserialize(initial)},forecast=seaRouteForecast(w,d.from,d.to)
  writeFileSync(join(out,current+'-initial.json'),initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:4}))},initial);await page.reload();await page.getByTestId('continue').click();await compare(w,current+'-loaded')
  await page.keyboard.press('m');await page.getByTestId('world-tab').click();await page.getByTestId('world-map').waitFor();const canvas=page.getByTestId('world-map').locator('canvas');await canvas.click({position:{x:(d.to.x+.5)*5,y:(d.m.h-d.to.y-.5)*5}})
  if(forecast){const minutes=Math.ceil(forecast.hours*60);assert.ok((await page.getByTestId('world-route-estimate').innerText()).includes(`${Math.floor(minutes/60)}시간 ${minutes%60}분`));assert.ok((await page.getByTestId('world-route-estimate').innerText()).includes('현재 이곳 날씨'))}else assert.equal(await page.getByTestId('world-route-estimate').count(),0)
  await page.getByTestId('world-travel').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,current+'-chart.png')});await compare(w,current+'-readonly-chart');const begin=w.s.time
  await page.getByTestId('world-travel').click();assert.equal(playerAct(w,{type:'travel',target:d.to}),null);for(let i=0;w.s.simulationPending&&i<100;i++)runUntilInput(w,300000);assert.ok(!w.s.simulationPending);assert.ok(!w.s.over);await compare(w,current+'-sailed');assert.deepEqual(w.s.overworld!.position,d.to);assert.equal(w.s.map.vessel!.hull.uid,d.hull.uid);assert.equal(w.s.time-begin,d.route.hours*1200*100)
  await page.keyboard.press('Escape');await page.screenshot({path:join(out,current+'-arrived.png')});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,current+'-continued');const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false)
  runs.push({mode,width,height,forecastCells:forecast?.cells.length??null,actualCells:d.route.cells.length,elapsedTU:w.s.time-begin,hullUID:d.hull.uid,overflow});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,postTitleWorldWrites:false,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),runs,pairs,errors},null,2));throw error}finally{await browser.close()}
