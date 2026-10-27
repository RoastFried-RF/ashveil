/** Native inputs plus independent Node whole-state comparison; no post-Title state writes. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {characterHistoryFixture} from '../tests/character-history-fixture'
import {playerAct} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {worldAssets} from '../src/client/render/world-assets'
import {atlasPlan,type AtlasManifest} from '../src/client/render/atlas-plan'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View;render_game_assets():View['assets']}
const[out,url,registry='src/client/sprites.json']=process.argv.slice(2);assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true});const manifest=JSON.parse(readFileSync(registry,'utf8'))as AtlasManifest
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});let current='start'
async function compare(w:World,label:string){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(time=>{const h=window as unknown as Hook;return typeof h.render_game_presentation==='function'&&!h.__ashveil.world().s.simulationPending&&h.__ashveil.world().s.time===time&&!!h.render_game_presentation()?.actors.length},w.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)});const view=await page.evaluate(()=>(window as unknown as Hook).render_game_presentation()),r=worldAssets(w),plan=atlasPlan(manifest,r.icons,r.characters);assert.equal(view.assets.loadedSheets,plan.sheets.length);assert.equal(view.assets.estimatedDecodedBytes,plan.estimatedDecodedBytes);return view}
try{
 await page.goto(url)
 for(const[width,height]of[[1440,1080],[1366,768]]){
  current=String(width);const d=characterHistoryFixture(),initial=serialize(d.s),w:World={db:d.w.db,s:deserialize(initial)};writeFileSync(join(out,current+'-initial.json'),initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},initial);await page.reload();await page.getByTestId('continue').click();const first=await compare(w,current+'-loaded');assert.ok(first.actors.some(a=>a.actor===d.legacy.id));await page.screenshot({path:join(out,current+'-surface.png')})
  await page.keyboard.press('Period');assert.equal(playerAct(w,{type:'wait'}),null);await compare(w,current+'-waited')
  await page.getByTestId('stairs').click();assert.equal(playerAct(w,{type:'stairs'}),null);const below=await compare(w,current+'-below');assert.ok(below.actors.some(a=>a.actor===d.crow.id));await page.screenshot({path:join(out,current+'-below.png')})
  await page.keyboard.press('Period');assert.equal(playerAct(w,{type:'wait'}),null);await compare(w,current+'-below-waited');await page.getByTestId('stairs').click();assert.equal(playerAct(w,{type:'stairs'}),null);const returned=await compare(w,current+'-returned')
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor();await page.waitForFunction(()=>(window as unknown as Hook).render_game_assets().loadedSheets===0);await page.getByTestId('continue').click();await compare(w,current+'-continued');runs.push({width,height,firstAssets:first.assets,belowAssets:below.assets,returnedAssets:returned.assets,legacyFrame:d.legacy.sprite,titleReleased:true});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,legacyFrameFixture:true,postTitleWorldWrites:false,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),runs,pairs,errors},null,2));throw error}finally{await browser.close()}
