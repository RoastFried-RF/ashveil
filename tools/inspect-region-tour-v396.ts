/** All generated sites, real entry/wait/Title inputs, independent Node whole-state audit. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {regionTourFixture,regionTourSites} from '../tests/region-tour-fixture'
import {playerAct} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {settlementEntryError} from '../src/core/world-simulation'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type Hook={__ashveil:{world():World};render_game_presentation():ReturnType<MapRenderer['presentation']>}
const[out,url]=process.argv.slice(2);assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true});const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7),sites=regionTourSites.filter(id=>!only||only.split(',').includes(id)),sizes=process.argv.includes('--desktop-only')?[[1440,1080]]:[[1440,1080],[1366,768],[390,844]]
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[];page.setDefaultTimeout(120000)
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});let current='start'
async function compare(w:World,label:string){if(!w.s.over)await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(time=>{const s=(window as unknown as Hook).__ashveil.world().s;return!s.simulationPending&&s.time===time},w.s.time);if(!w.s.over){await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);w.s.fx=[];}const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(url)
 for(const[width,height]of sizes)for(const id of sites){
  current=id.split('.')[1]+'-'+width;const d=regionTourFixture(id),initial=serialize(d.s),w:World={db:d.w.db,s:deserialize(initial)};writeFileSync(join(out,current+'-initial.json'),initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},initial);await page.reload();await page.getByTestId('continue').click();await compare(w,current+'-loaded')
  await page.keyboard.press('m');await page.getByTestId('world-tab').click();const enter=page.getByTestId('enter-region'),gate=settlementEntryError(w,id);assert.equal(await enter.isDisabled(),!!gate);await compare(w,current+'-entry-review')
  if(gate){runs.push({id,width,height,gate,entered:false});continue}
  await enter.click();assert.equal(playerAct(w,{type:'enterRegion'}),null);await compare(w,current+'-entered');await page.keyboard.press('Escape');await page.getByTestId('win-map').waitFor({state:'hidden'});if(width<1000)await page.waitForFunction(()=>{const h=window as unknown as Hook;if(typeof h.render_game_presentation!=='function')return false;const v=h.render_game_presentation();return!!v&&!!document.elementFromPoint(v.screen.feet.x,v.screen.feet.y-30)?.closest('[data-testid=map]')});await page.screenshot({path:join(out,current+'-entry.png')});const view=await page.evaluate(()=>(window as unknown as Hook).render_game_presentation())
  if(!w.s.over){await page.keyboard.press('Period');assert.equal(playerAct(w,{type:'wait'}),null);await compare(w,current+'-waited')}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,current+' horizontal overflow')
  if(!w.s.over){await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,current+'-continued')}
  runs.push({id,width,height,entered:true,map:w.s.map.id,layout:w.s.map.layout,visibleActorCount:view?.actors.length,assets:view?.assets,over:w.s.over?.kind??null,overflow});console.log(JSON.stringify({completed:runs.length,total:sites.length*sizes.length,current,pairs:pairs.length}))
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteOutsideSitePositions:true,postTitleWorldWrites:false,wholePairs:pairs.length,sites:sites.length,sizes,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),runs,pairs,errors},null,2));throw error}finally{await browser.close()}
