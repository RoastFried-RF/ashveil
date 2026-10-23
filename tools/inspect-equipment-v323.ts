/** Finite initial gear; only real keyboard inputs after title load. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {makeItem} from '../src/core/items'
import {perform,activityStep} from '../src/core/actions'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize} from '../src/core/save'
import {startNativePreview} from './native-preview'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={render_game_presentation():View;render_game_to_text():string}
const out=process.argv[2]??'test-results/motion-v323/native';mkdirSync(out,{recursive:true})
const cases=[['knife-slash','Item.RustyKnife','slash','right','slash'],['knife-thrust','Item.RustyKnife','stab','left','thrust'],['axe','Item.Hatchet','slash','down','chop'],['greatsword','Item.Greatsword','slash','up','slash'],['spear','Item.RebarSpear','stab','right','thrust'],['hammer','Item.StoneHammer','blunt','left','smash'],['bow','Item.Bow','stab','right','shoot'],['crossbow','Item.LightCrossbow','bolt','left','shoot']]as const
function fixture(row:typeof cases[number]){
 const{w,s,p,target}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.depth=3;s.map.name='무기 동작 · 유한 초기 방';s.map.ambient=.8;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0})
 const vector={right:{x:1,y:0},left:{x:-1,y:0},up:{x:0,y:-1},down:{x:0,y:1}}[row[3]],range=row[4]==='shoot'?2:1
 target.pos={x:20+vector.x*range,y:20+vector.y*range};target.ai.mode='guard';target.nextAct=s.time+1e9;target.met=true;target.asleep=false
 p.bag=[];p.equip={main:makeItem(w,row[1])};p.attackMode=row[2];p.facing={right:2,left:6,up:0,down:4}[row[3]];p.hotbar=Array(10).fill(null);p.needs.nutritionDay=Math.floor(s.time/(1200*100))
 if(row[1]==='Item.RustyKnife'){p.equip.off=makeItem(w,'Item.Torch');p.equip.off.lit=true;p.equip.off.fuel=3000}
 if(row[4]==='shoot'){p.bag.push(makeItem(w,row[1]==='Item.Bow'?'Item.Arrow':'Item.Bolt',3));if(row[1]==='Item.LightCrossbow'){assert.ok(perform(w,p,{type:'reload',uid:p.equip.main!.uid}).ok);for(let n=0;p.activity&&n<100;n++)activityStep(w,p);assert.equal(p.equip.main!.loadedAmmo,'Item.Bolt')}}
 invalidateLights(w);updatePlayerVision(w,p);return serialize(s)
}
const server=await startNativePreview(4355),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 await page.goto(server.url)
 for(const row of cases){
  const initial=fixture(row);writeFileSync(join(out,row[0]+'-initial.json'),initial);await page.setViewportSize(row[0]==='knife-thrust'||row[0]==='crossbow'?{width:1366,height:768}:{width:1440,height:1080})
  await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:4}))},initial)
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!!(window as unknown as Hook).render_game_presentation?.())
  await page.screenshot({path:join(out,row[0]+'-held.png')})
  const record=page.evaluate(async()=>{const frames:{at:number;view:View}[]=[],start=performance.now();while(performance.now()-start<1800){await new Promise(resolve=>requestAnimationFrame(resolve));frames.push({at:performance.now()-start,view:(window as unknown as Hook).render_game_presentation()})}return frames})
  if(row[4]==='shoot'){await page.keyboard.press('f');await page.keyboard.press('f')}else await page.keyboard.press({right:'ArrowRight',left:'ArrowLeft',up:'ArrowUp',down:'ArrowDown'}[row[3]])
  await page.waitForFunction(style=>(window as unknown as Hook).render_game_presentation().action?.style===style,row[4]);await page.waitForTimeout(110);await page.screenshot({path:join(out,row[0]+'-action.png')})
  const frames=await record,active=frames.filter(f=>f.view.action?.style===row[4]);assert.ok(active.length>0,row[0]);assert.ok(active.some(f=>f.view.equipment[0].visible));const rotations=active.map(f=>f.view.equipment[0].rotation)
  if(row[4]!=='shoot')assert.ok(Math.max(...rotations)-Math.min(...rotations)>.1,'weapon rotation: '+row[0])
  const observation=await page.evaluate(()=>JSON.parse((window as unknown as Hook).render_game_to_text()));writeFileSync(join(out,row[0]+'-samples.json'),JSON.stringify(frames));runs.push({name:row[0],item:row[1],direction:row[3],style:row[4],stages:[...new Set(active.map(f=>f.view.action?.stage))],rotationRange:[Math.min(...rotations),Math.max(...rotations)],observation});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Eight actual attack inputs on finite imprints; not full/world regression or every gear permutation.'},null,2));console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
