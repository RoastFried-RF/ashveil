/** Hold one real texture request; only actual UI keys run after finite Title load. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {regionTourFixture} from '../tests/region-tour-fixture'
import {worldAssets} from '../src/client/render/world-assets'
import {atlasPlan,type AtlasManifest} from '../src/client/render/atlas-plan'
import {playerAct} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import type {World} from '../src/core/ctx'
type Hook={__ashveil:{world():World}}
const[out,url]=process.argv.slice(2);assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true});const baseline=process.argv.includes('--baseline'),sizes=baseline?[[1366,768]]:[[1440,1080],[1366,768],[390,844]],manifest=JSON.parse(readFileSync('src/client/sprites.json','utf8'))as AtlasManifest
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[];page.setDefaultTimeout(120000)
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});let current='start',unblock:(()=>void)|undefined
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function compare(w:World,label:string){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(time=>{const s=(window as unknown as Hook).__ashveil.world().s;return!s.simulationPending&&s.time===time},w.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);w.s.fx=[];const actual=await read();writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(url)
 for(const[width,height]of sizes){
  current=String(width);const d=regionTourFixture('Region.ChimneySeven'),initial=serialize(d.s),w:World={db:d.w.db,s:deserialize(initial)},beforeRequest=worldAssets(w),beforePlan=atlasPlan(manifest,beforeRequest.icons,beforeRequest.characters)
  assert.equal(playerAct(w,{type:'enterRegion'}),null);const r=worldAssets(w),afterPlan=atlasPlan(manifest,r.icons,r.characters),source=afterPlan.sheets.find(s=>!beforePlan.sheets.includes(s));assert.ok(source);const path=manifest.sheets[source],gate=new Promise<void>(resolve=>{unblock=resolve});let notify!:()=>void;const intercepted=new Promise<void>(resolve=>{notify=resolve})
  await page.route('**/'+path,async route=>{notify();await gate;await route.continue()})
  writeFileSync(join(out,current+'-initial.json'),initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},initial);await page.reload();await page.getByTestId('continue').click();const outside:World={db:d.w.db,s:deserialize(initial)};await compare(outside,current+'-loaded')
  await page.keyboard.press('m');await page.getByTestId('world-tab').click();await page.getByTestId('enter-region').click();await intercepted;await page.getByTestId('map-loading').waitFor();const frozen=await read();writeFileSync(join(out,current+'-loading-world.json'),serialize(frozen))
  await page.keyboard.press('Escape');if(baseline)assert.equal(await page.getByTestId('win-map').isVisible(),true);else await page.getByTestId('win-map').waitFor({state:'hidden'})
  await page.keyboard.press('Period');await page.keyboard.press('ArrowRight');assert.deepEqual(JSON.parse(serialize(await read())),JSON.parse(serialize(frozen)),current+' loading keys preserve whole World');await page.screenshot({path:join(out,current+'-loading-escape.png')})
  unblock!();await compare(w,current+'-entered');if(baseline){await page.keyboard.press('Escape');await page.getByTestId('win-map').waitFor({state:'hidden'})}
  await page.keyboard.press('Period');assert.equal(playerAct(w,{type:'wait'}),null);await compare(w,current+'-actual-wait');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,current+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.unroute('**/'+path)
  runs.push({width,height,source:path,escapeClosedWhileLoading:!baseline,loadingWaitAndMoveWholeStateExact:true,actualWaitAfterReady:true})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({baseline,finiteOutsideSitePosition:true,postTitleWorldWrites:false,actualRequestHeld:true,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),runs,pairs,errors},null,2));throw error}finally{unblock?.();await browser.close()}
