/** INITIAL actual post-reading imprint; test real hover -> pointerdown across the HUD's empty layout. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {loadDb} from './loadContent'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {player,type World} from '../src/core/ctx'
import {playerAct} from '../src/core/game'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View}
const[out,url,file]=process.argv.slice(2),baseline=process.argv.includes('--baseline');assert.ok(out&&url&&file);assert.ok(!existsSync(out));mkdirSync(out,{recursive:true})
const raw=readFileSync(file,'utf8'),{db,report}=loadDb();assert.deepEqual(report.errors,[])
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[],pairs:{label:string;hash:string}[]=[];page.setDefaultTimeout(60000)
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(w:World,label:string){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(t=>{const s=(window as unknown as Hook).__ashveil.world().s;return s.time===t&&!s.simulationPending&&s.fx.length===0},w.s.time);w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(url)
 for(const width of baseline?[390]:[390,360,1366]){
  const w:World={db,s:deserialize(raw)},p=player(w),corpse=w.s.creatures.find(c=>c.id===132)!;assert.ok(!corpse.alive)
  await page.setViewportSize({width,height:844});await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},raw);await page.reload();await page.getByTestId('continue').click();await compare(w,width+'-loaded')
  await page.getByRole('button',{name:'설정 (F3)',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'? 조작법',exact:true}).click();await page.getByRole('dialog',{name:'조작법',exact:true}).waitFor();await page.keyboard.press('Escape');const toggle=page.getByTestId('expedition-guide').locator('.guide-toggle');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');await compare(w,width+'-controls-readonly')
  const v=await page.evaluate(()=>(window as unknown as Hook).render_game_presentation()),canvas=await page.locator('[data-testid=map] canvas').boundingBox();assert.ok(canvas);const point={x:canvas.x+v.screen.logical.x+(corpse.pos.x-p.pos.x)*16*v.zoom,y:canvas.y+v.screen.logical.y+((corpse.pos.y-p.pos.y)*16-6)*v.zoom}
  await page.getByRole('button',{name:'설정 (F3)',exact:true}).hover();await compare(w,width+'-before-click-readonly');await page.evaluate(()=>{const h=window as unknown as Hook&{__mapPointerDown?:{tag?:string;class?:string}};document.addEventListener('pointerdown',e=>{const el=e.target as Element;h.__mapPointerDown={tag:el.tagName,class:el.getAttribute('class')??''}},{capture:true,once:true})});await page.mouse.click(point.x,point.y);const target=await page.evaluate(()=>(window as unknown as {__mapPointerDown:{tag?:string;class?:string}}).__mapPointerDown);assert.equal(target.tag==='CANVAS',!baseline)
  if(!baseline){assert.equal(playerAct(w,{type:'search',includeEmpty:true,target:corpse.id}),null);await page.getByTestId('dissect-corpse').waitFor()}
  await compare(w,width+'-clicked');await page.screenshot({path:join(out,width+'-clicked.png')});await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,width+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click();runs.push({width,point,target,actualControls:true,hoverWorldUnchanged:true,clicked:baseline?'blocked-by-transparent-parent':'search-original-carcass',corpseUID:corpse.id})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({baseline,initialFromActualPriorReading:true,postTitleWorldWrites:false,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),runs,pairs,errors},null,2));throw error}finally{await browser.close()}
