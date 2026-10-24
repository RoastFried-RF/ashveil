/** Finite known deer and real Ctrl+pointer attack; no post-load world writes. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {hostile} from '../src/core/diplomacy'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,stateHash} from '../src/core/save'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type Hook={__ashveil:{world():World};render_game_presentation():NonNullable<ReturnType<MapRenderer['presentation']>>}
const out=process.argv[2]??'test-results/autonomy-v336/hunting';mkdirSync(out,{recursive:true})
function fixture(){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];s.storyteller.budget=-1e9;p.pos={x:20,y:20};p.bag=[];p.equip={};p.activity=undefined;p.body.wounds=[];p.body.missing=[];p.effects=[];p.traits=[];p.asleep=false;p.unconscious=false;p.nextAct=s.time
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:true,seen:true,items:[],placed:undefined,cultivation:undefined,gatherAt:undefined,blood:0,icy:false,deco:undefined,room:undefined})
 const deer=createCreature(w,'Creature.AshhornStag',{x:21,y:20});deer.met=true;deer.body.wounds=[];deer.body.missing=[];deer.traits=[];deer.asleep=false;deer.unconscious=false;deer.nextAct=s.time;deer.home={...deer.pos};s.creatures=[p,deer];for(const c of s.creatures)Object.assign(c.needs,{nutritionDay:Math.floor(s.time/2880000),kcal:3000,waterDeficit:0,fatigue:10,bodyTemp:37,protein:100,vitamin:100,hygiene:100,scurvy:0});invalidateLights(w);updatePlayerVision(w,p);assert.equal(hostile(w,p,deer),false);return{initial:serialize(s),deer:deer.id}
}
const server=await startNativePreview(4368),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
try{
 await page.goto(server.url)
 for(const[width,height]of[[1440,1080],[1366,768]]as const){
  const f=fixture();await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},f.initial);writeFileSync(join(out,width+'-initial.json'),f.initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
  const before=await read(),point=await page.evaluate(id=>{const v=(window as unknown as Hook).render_game_presentation(),a=v.actors.find(c=>c.actor===id)!;return{x:v.screen.feet.x+(a.feet.x-v.feet.x)*16*v.zoom,y:v.screen.feet.y+(a.feet.y-v.feet.y)*16*v.zoom-22*v.zoom}},f.deer)
  await page.mouse.click(point.x,point.y);assert.equal(stateHash(await read()),stateHash(before));assert.ok((await page.locator('body').innerText()).includes('Ctrl+클릭으로 공격'))
  await page.keyboard.down('Control');try{await page.mouse.click(point.x,point.y)}finally{await page.keyboard.up('Control')}
  await page.waitForFunction(id=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&w.s.creatures.find(c=>c.id===id)?.attackedBy?.includes(w.s.playerId)},f.deer)
  const after=await read();assert.ok(after.time>before.time);assert.ok(after.creatures.find(c=>c.id===f.deer)!.attackedBy?.includes(after.playerId));writeFileSync(join(out,width+'-final.json'),JSON.stringify(after));await page.screenshot({path:join(out,width+'-attack.png')});runs.push({width,height,normalClickWholeStateExact:true,actualCtrlPointerAttack:true,beforeTU:before.time,afterTU:after.time,originalKnownDeer:f.deer,provocationRecorded:true,noPostLoadWorldWrites:true});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,runs,errors,scope:'Normal click inspects the known adjacent neutral prey without a turn; actual Ctrl+pointer performs one real barehand attack attempt and records provocation. Not a ranged hunting or every neutral NPC interaction approval.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()));throw error}finally{await page.close();await browser.close();server.stop()}
