/** Same real click on a north-adjacent carcass, beneath the player's tall body; hover remains informational. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {specimenFixture} from '../tests/research-specimens-fixture'
import {playerAct} from '../src/core/game'
import {updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize,stateHash} from '../src/core/save'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View}
const[out,url]=process.argv.slice(2),baseline=process.argv.includes('--baseline');assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:unknown[]=[],runs:unknown[]=[];page.setDefaultTimeout(60000)
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(w:World,label:string){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(t=>{const s=(window as unknown as Hook).__ashveil.world().s;return!s.simulationPending&&s.time===t},w.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(url)
 for(const[width,height]of(baseline?[[1366,768]]:[[1366,768],[390,844]])){
  const key=String(width),d=specimenFixture();d.s.creatures=[d.p,d.corpse];updatePlayerVision(d.w,d.p);const raw=serialize(d.s),w:World={db:d.w.db,s:deserialize(raw)};assert.equal(d.corpse.pos.x,d.p.pos.x);assert.equal(d.corpse.pos.y,d.p.pos.y-1);writeFileSync(join(out,key+'-initial.json'),raw);await page.setViewportSize({width,height});await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},raw);await page.reload();await page.getByTestId('continue').click();await compare(w,key+'-loaded')
  const v=await page.evaluate(()=>(window as unknown as Hook).render_game_presentation()),point={x:v.screen.logical.x,y:v.screen.logical.y-22*v.zoom};await page.mouse.move(v.screen.logical.x,v.screen.logical.y);await page.waitForFunction(name=>document.body.innerText.includes(name+' (당신)'),d.p.name);await page.mouse.move(point.x,point.y);await page.waitForFunction(({name,baseline})=>document.body.innerText.includes(name+' (당신)')===baseline,{name:d.p.name,baseline});await compare(w,key+'-hover-readonly');await page.screenshot({path:join(out,key+'-hover.png')});await page.mouse.click(point.x,point.y)
  assert.equal(playerAct(w,baseline?{type:'wait'}:{type:'search',includeEmpty:true,target:d.corpse.id}),null);await compare(w,key+'-clicked');if(baseline)assert.equal(await page.getByTestId('dissect-corpse').count(),0);else{await page.getByTestId('dissect-corpse').waitFor();assert.equal(w.s.loot?.id,d.corpse.id)}
  await page.screenshot({path:join(out,key+'-clicked.png')});await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,key+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click();runs.push({width,height,baseline,initialConditions:{...d.proof,isolatedPlayerAndDeclaredCarcass:true},actualSameNorthTileClick:true,selfHoverStillWorks:true,clickAction:baseline?'wait':'search-original-carcass',carcassUID:d.corpse.id})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({baseline,finiteInitial:true,postTitleWorldWrites:false,wholePairs:pairs.length,runs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),pairs,runs,errors},null,2));throw error}finally{await browser.close()}
