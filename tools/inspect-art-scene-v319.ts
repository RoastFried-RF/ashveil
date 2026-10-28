/** Focused original-art UI diagnosis using a finite initial imprint and actual input. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from './native-preview'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {addToBag,makeItem} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize} from '../src/core/save'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type Hook={render_game_presentation():NonNullable<ReturnType<MapRenderer['presentation']>>;render_game_to_text():string}
const out=process.argv[2]??'test-results/art-scene-v319';mkdirSync(out,{recursive:true})
const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.map.kind='dungeon';s.map.depth=3;s.map.name='원화 검토용 유한 초기 방';s.map.ambient=.72;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12;s.fx=[]
for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],cultivation:undefined,cropResidue:undefined})
p.bag=[];p.facing=4;p.equip={main:makeItem(w,'Item.RustyKnife'),off:makeItem(w,'Item.Torch')};p.equip.off!.lit=true;p.equip.off!.fuel=3000;p.hotbar=Array(10).fill(null);p.needs.nutritionDay=Math.floor(s.time/(1200*100))
const inventory=process.argv.includes('--equipment320')?['Item.LeatherCoat','Item.SteelMail','Item.Hood','Item.Gloves','Item.Lantern','Item.CharcoalFilter','Item.Quiver']:['Item.Pole','Item.Bow','Item.Greatsword','Item.Hatchet','Item.Arrow','Item.Bandage']
for(const id of inventory)assert.equal(addToBag(w,p,makeItem(w,id)),0)
const guard=createCreature(w,'Creature.SettlementGuard',{x:21,y:20},'마라 · 원화 검토 경비');guard.sprite='hero';guard.facing=4;guard.met=true;guard.ai.mode='calm';guard.nextAct=s.time+1e9;s.creatures.push(guard)
for(const[id,x,y,facing]of [['Creature.AshHound',17,20,6],['Creature.BurrowRat',17,23,2],['Creature.TenderDrone',24,21,4],['Creature.Amalgam',25,17,4]]as const){const c=createCreature(w,id,{x,y});c.facing=facing;c.met=true;c.nextAct=s.time+1e9;s.creatures.push(c)}
invalidateLights(w);updatePlayerVision(w,p);const initial=serialize(s);writeFileSync(join(out,'finite-initial.json'),initial)
const server=await startNativePreview(4340),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',error=>errors.push(error.message));page.on('console',entry=>{if(entry.type()==='error')errors.push(entry.text())})
try{
 await page.goto(server.url)
 for(const[width,height]of [[1440,1080],[1366,768]]){
  await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false}))},initial)
  await page.reload();await page.screenshot({path:join(out,`${width}-title.png`)});await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!!(window as unknown as Hook).render_game_presentation?.())
  await page.screenshot({path:join(out,`${width}-scene.png`)});await page.keyboard.press('i');await page.waitForSelector('[data-testid=bag]');await page.screenshot({path:join(out,`${width}-inventory.png`)});await page.keyboard.press('Escape')
  const view=await page.evaluate(()=>(window as unknown as Hook).render_game_presentation()),box=await page.getByTestId('map').boundingBox();assert.ok(box)
  const head={x:box.x+view.screen.logical.x+16*view.zoom,y:box.y+view.screen.logical.y-24*view.zoom}
  await page.mouse.move(head.x,head.y);await page.waitForFunction(()=>document.querySelector('[data-testid=hover]')?.textContent?.includes('마라'))
  const headHover=await page.getByTestId('hover').innerText();await page.screenshot({path:join(out,`${width}-head-hover.png`)})
  // Transparent atlas padding belongs to its ground cell, not the actor's full frame rectangle.
  await page.mouse.move(head.x+11*view.zoom,head.y);await page.waitForFunction(()=>!document.querySelector('[data-testid=hover]')?.textContent?.includes('마라'))
  const transparentHover=await page.getByTestId('hover').innerText()
  await page.mouse.click(head.x,head.y);await page.waitForSelector('[data-testid=win-society]');await page.screenshot({path:join(out,`${width}-head-click-society.png`)})
  const observation=await page.evaluate(()=>JSON.parse((window as unknown as Hook).render_game_to_text()));assert.equal(observation.timeTU,s.time+100);assert.deepEqual(observation.player.pos,p.pos)
  runs.push({width,height,head,headHover,transparentHover,timeCost:observation.timeTU-s.time,playerUnmoved:true});await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Two-size original-art/portrait/inventory and opaque-head selection diagnosis, one actual talk per initial imprint. Not full regression, whole-state comparison or new save compatibility.'},null,2)+'\n');console.log(JSON.stringify({out,runs,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
