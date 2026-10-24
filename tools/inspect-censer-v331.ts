/** Four finite initial hanging weapons; real attack/drop/empty-hand inputs after load. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {makeItem} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize} from '../src/core/save'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={render_game_presentation():View;__ashveil:{world():ReturnType<typeof prisonerFixture>['w']}}
const out=process.argv[2]??'test-results/autonomy-v331/native';mkdirSync(out,{recursive:true})
function fixture(direction:'up'|'down'|'left'|'right'){
 const {w,s,p,target}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.depth=3;s.map.name='사슬 향로·실물 무기 유한 초기 방';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0})
 const vector={right:{x:1,y:0},left:{x:-1,y:0},up:{x:0,y:-1},down:{x:0,y:1}}[direction];target.pos={x:20+vector.x,y:20+vector.y};target.ai.mode='guard';target.nextAct=s.time+1e9;target.met=true;target.asleep=false
 p.bag=[];p.equip={main:makeItem(w,'Item.WitheredCenser')};p.sprite='withered_priest';p.attackMode='censerSmash';p.facing={right:2,left:6,up:0,down:4}[direction];p.hotbar=Array(10).fill(null);p.needs.nutritionDay=Math.floor(s.time/(1200*100))
 invalidateLights(w);updatePlayerVision(w,p);return{initial:serialize(s),uid:p.equip.main!.uid,player:p.id,direction}
}
const server=await startNativePreview(4364),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
try{
 await page.goto(server.url)
 for(const direction of['right','left','up','down']as const){
  const f=fixture(direction),width=direction==='left'||direction==='down'?1366:1440,height=width===1366?768:1080;writeFileSync(join(out,direction+'-initial.json'),f.initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:4}))},f.initial)
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!!(window as unknown as Hook).render_game_presentation()?.frame);await page.waitForTimeout(250);await page.screenshot({path:join(out,direction+'-held.png')});const before=await read()
  const recording=page.evaluate(async()=>{const frames:{at:number;view:View}[]=[],start=performance.now();while(performance.now()-start<1400){await new Promise(resolve=>requestAnimationFrame(resolve));frames.push({at:performance.now()-start,view:(window as unknown as Hook).render_game_presentation()})}return frames})
  const key={right:'ArrowRight',left:'ArrowLeft',up:'ArrowUp',down:'ArrowDown'}[direction];await page.keyboard.press(key);await page.waitForFunction(()=>(window as unknown as Hook).render_game_presentation().action?.stage==='strike');await page.screenshot({path:join(out,direction+'-strike.png')});const frames=await recording,active=frames.filter(f=>f.view.action?.style==='smash');assert.ok(active.length>0);assert.ok(active.some(f=>f.view.equipment[0].visible));assert.ok(new Set(active.map(f=>f.view.action!.stage)).has('prepare'));const rotations=active.map(f=>f.view.equipment[0].rotation);assert.ok(Math.max(...rotations)-Math.min(...rotations)>.5);writeFileSync(join(out,direction+'-samples.json'),JSON.stringify(frames))
  await page.keyboard.press('i');await page.getByTestId('slot-main').locator('[data-inventory-item]').click({button:'right'});await page.getByRole('button',{name:'바닥에 놓기',exact:true}).click();await page.keyboard.press('Escape');await page.waitForFunction(()=>!(window as unknown as Hook).render_game_presentation().equipment[0].visible)
  const dropped=await read(),p=dropped.creatures.find(c=>c.id===f.player)!;assert.equal(p.equip.main,undefined);assert.equal(dropped.map.tiles[p.pos.y*dropped.map.w+p.pos.x].items.filter(i=>i.uid===f.uid).length,1)
  const bareRecording=page.evaluate(async()=>{const frames:View[]=[],start=performance.now();while(performance.now()-start<1000){await new Promise(resolve=>requestAnimationFrame(resolve));frames.push((window as unknown as Hook).render_game_presentation())}return frames});await page.keyboard.press(key);const bare=await bareRecording;assert.ok(bare.some(v=>v.action?.style==='unarmed'));assert.ok(bare.every(v=>!v.equipment[0].visible));const end=await read();writeFileSync(join(out,direction+'-final.json'),JSON.stringify(end));await page.screenshot({path:join(out,direction+'-empty-hand.png')});runs.push({direction,width,height,uid:f.uid,beforeTU:before.time,afterTU:end.time,stages:[...new Set(active.map(f=>f.view.action!.stage))],rotationRange:[Math.min(...rotations),Math.max(...rotations)],droppedSameUidOnce:true,subsequentAttackUnarmed:true});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 await page.goto(new URL('artbook/motion/',server.url).href);await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('발 기준'));await page.selectOption('#model','patient');await page.selectOption('#weapon','Item.WitheredCenser');await page.selectOption('#offhand','');await page.selectOption('#motion','attack');await page.locator('#play').click();await page.locator('#scrub').press('Home');for(let i=0;i<4;i++)await page.locator('#next').click();await page.waitForTimeout(500);await page.screenshot({path:join(out,'workbench-censer-front.png'),fullPage:true});await page.selectOption('#direction','right');for(let i=0;i<4;i++)await page.locator('#next').click();await page.waitForTimeout(500);await page.screenshot({path:join(out,'workbench-censer-right.png'),fullPage:true})
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Four real attacks/drops/empty-hand attacks with declared patient-model player and original censer. Two gallery source-grip views. Not a natural priest encounter or all garment/hand combinations.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* title */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
