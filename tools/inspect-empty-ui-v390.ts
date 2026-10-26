/** Empty panels and native bag scrolling via real input; every UI step preserves whole state. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {World} from '../src/core/ctx'
type Hook={__ashveil:{world():World}}
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const{w,s,p}=prisonerFixture();s.creatures=[p];s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.fx=[];p.bag=[];p.equip={};s.map.ambient=1;s.map.lights=[]
for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]})
invalidateLights(w);updatePlayerVision(w,p);s.log=[];const initial=serialize(s),expected={db:w.db,s:deserialize(initial)};writeFileSync(join(out,'finite-empty-initial.json'),initial)
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],rows:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function check(label:string){expected.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)),label);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(expected.s));const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,dialogs:[...document.querySelectorAll<HTMLElement>('.window-shell')].map(el=>{const r=el.getBoundingClientRect();return{label:el.getAttribute('aria-label'),reachable:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}})}));assert.equal(layout.overflow,false);assert.ok(layout.dialogs.every(d=>d.reachable));rows.push({label,hash:stateHash(actual),layout});await page.screenshot({path:join(out,label+'.png')})}
try{
 await page.goto(url)
 for(const[width,height]of [[390,844],[1440,1080]]){
  await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false,mapZoom:'vision'}))},initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(width+'-loaded')
  await page.keyboard.press('i');const region=page.getByTestId('bag-viewport');await region.waitFor();await page.waitForTimeout(100)
  const dimensions=await region.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,left:el.scrollLeft}));assert.equal(dimensions.scrollWidth>dimensions.width,width===390);assert.equal(await page.getByTestId('bag-scroll-hint').count(),width===390?1:0);await check(width+'-bag')
  if(width===390){for(let n=0;n<40;n++){await page.keyboard.press('Tab');if(await region.evaluate(el=>document.activeElement===el))break}assert.equal(await region.evaluate(el=>document.activeElement===el),true);for(let n=0;n<12;n++)await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);const left=await region.evaluate(el=>el.scrollLeft);assert.ok(left>dimensions.left);await check(width+'-bag-right');for(let n=0;n<12;n++)await page.keyboard.press('ArrowLeft');await page.waitForTimeout(250);assert.ok(await region.evaluate(el=>el.scrollLeft)<left);await check(width+'-bag-left')}
  await page.keyboard.press('Escape');await page.keyboard.press('Shift+J');await page.getByTestId('win-journal').getByRole('button',{name:'기록',exact:true}).click();await page.getByTestId('journal-log-empty').waitFor();await check(width+'-empty-log');await page.keyboard.press('Escape')
  await page.keyboard.press('F2');await page.getByTestId('craft-tab-maintenance').click();await page.getByTestId('maintenance-empty').waitFor();await check(width+'-empty-maintenance');await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(width+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostTitleWrites:true,wholePairs:rows.length,rows,errors},null,2));console.log(JSON.stringify({wholePairs:rows.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),String(error)+'\n'+await page.locator('body').innerText());throw error}finally{await browser.close()}
