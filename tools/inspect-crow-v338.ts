/** Finite declared scenes. Only title load and real keys mutate the game after load. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {killCreature} from '../src/core/combat'
import {bodyTick} from '../src/core/body'
import {calendar} from '../src/core/climate-state'
import {tileAt,turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {makeItem} from '../src/core/items'
import {serialize,stateHash} from '../src/core/save'
import {addEffect} from '../src/core/traits'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():ReturnType<typeof prisonerFixture>['w']};render_game_presentation():View}
type Kind='flight'|'berries'|'carcass'|'eyes'|'covered'
const out=process.argv[2]??'test-results/autonomy-v338/native';mkdirSync(out,{recursive:true})
function fixture(kind:Kind,dir=4){
 const {w,s,p,target}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.map.kind='surface';s.map.depth=0;s.map.ambient=1;s.map.daylightMult=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12;s.map.name='까마귀 실제 동작 · 유한 초기 장면'
 while(calendar(w).season.id!=='Season.Summer')s.time+=28800*100
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:false,seen:true,blood:0,items:[],cont:undefined,placed:undefined,deco:undefined,room:undefined,cultivation:undefined,gatherAt:undefined,gatherStock:undefined,icy:false,snow:0})
 p.pos={x:20,y:20};p.bag=[];p.equip={};s.creatures=[p]
 const positions:{[key:number]:{x:number;y:number}}={4:{x:20,y:23},6:{x:17,y:20},2:{x:23,y:20},0:{x:20,y:17}},bird=createCreature(w,'Creature.AshCrow',kind==='flight'?positions[dir]:{x:30,y:20});bird.met=true;bird.home={...bird.pos};bird.facing=dir;s.creatures.push(bird)
 if(kind==='berries')tileAt(w,bird.pos).t='Terrain.AshBerryBush'
 if(kind==='carcass'){const animal=createCreature(w,'Creature.AshhornStag',{x:30,y:21});s.creatures.push(animal);killCreature(w,animal,'유한 초기 장면에서 실제 생성·사망한 동물')}
 if(kind==='eyes'||kind==='covered'){target.pos={x:31,y:20};target.bag=[];target.equip=kind==='covered'?{head:makeItem(w,'Item.Hood')}:{};target.home={...target.pos};addEffect(target,'stunned',turnOf(w)+500);bodyTick(w,target,false);assert.equal(target.unconscious,true);s.creatures.push(target)}
 for(const c of s.creatures){c.nextAct=s.time;c.age=undefined;c.background=undefined;c.traumas=[];Object.assign(c.needs,{nutritionDay:Math.floor(turnOf(w)/28800),kcal:c.id===bird.id&&['berries','carcass'].includes(kind)?0:1000,waterDeficit:0,fatigue:10,bodyTemp:37,wetness:0,hygiene:100,protein:100,vitamin:100,energy:100,ash:0})}
 if(kind==='flight')bird.nextAct=s.time+1 // A declared1TU initial offset isolates the first real takeoff from the next fly action.
 s.fx=[];invalidateLights(w);updatePlayerVision(w,p);return{initial:serialize(s),bird:bird.id,target:target.id,dir,kind}
}
const server=await startNativePreview(4368),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function waitTurn(){await page.keyboard.press('Period');await page.waitForFunction(()=>!(window as unknown as Hook).__ashveil.world().s.simulationPending)}
async function sample(id:number,mode:string,ms:number){
 await page.waitForFunction(({id,mode})=>(window as unknown as Hook).render_game_presentation().actors.some(a=>a.actor===id&&a.mode===mode),{id,mode},{timeout:15000});await page.waitForTimeout(450)
 const before=stateHash(await read()),frames=await page.evaluate(async({id,mode,ms})=>{const rows:{at:number;actor:View['actors'][number]}[]=[],start=performance.now(),seen=new Set<string>();while(performance.now()-start<Math.max(ms,12000)){await new Promise(resolve=>requestAnimationFrame(resolve));const actor=(window as unknown as Hook).render_game_presentation().actors.find(a=>a.actor===id);if(actor?.mode===mode){rows.push({at:performance.now()-start,actor});seen.add(actor.frame)}if(performance.now()-start>=ms&&seen.size===4)break}return rows},{id,mode,ms});assert.equal(stateHash(await read()),before);assert.equal(new Set(frames.map(r=>r.actor.frame)).size,4);return frames
}
async function load(f:ReturnType<typeof fixture>,width:number,height:number){
 await page.setViewportSize({width,height});writeFileSync(join(out,`${f.kind}-${f.dir}-${width}-initial.json`),f.initial);await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:2}))},f.initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.getByRole('button',{name:'간략',exact:true}).click()
}
try{
 await page.goto(server.url)
 for(const dir of(process.argv[3]==='prey-only'?[]:[4,6,2,0])){
  const f=fixture('flight',dir),width=dir===6||dir===0?1366:1440,height=width===1366?768:1080;await load(f,width,height);await waitTurn();const state=await read(),bird=state.creatures.find(c=>c.id===f.bird)!;assert.ok(bird.flight);await page.waitForFunction(id=>(window as unknown as Hook).render_game_presentation().actors.some(a=>a.actor===id&&a.lift===32),f.bird);const hover=await page.evaluate(id=>{const h=window as unknown as Hook,w=h.__ashveil.world(),v=h.render_game_presentation(),b=w.s.creatures.find(c=>c.id===id)!,p=w.s.creatures.find(c=>c.id===w.s.playerId)!,rect=document.querySelector('canvas')!.getBoundingClientRect();return{x:rect.left+v.screen.feet.x+(b.pos.x-p.pos.x)*16*v.zoom,y:rect.top+v.screen.feet.y+(b.pos.y-p.pos.y)*16*v.zoom-(32+13*.45)*v.zoom}},f.bird);await page.mouse.move(hover.x,hover.y);await page.getByTestId('hover').filter({hasText:'비행 중 · 지상 2칸 높이'}).waitFor();await page.screenshot({path:join(out,`flight-${dir}-${width}-hover.png`)});await page.mouse.move(5,5);const samples=await sample(f.bird,'flight',1000);assert.ok(samples.every(r=>r.actor.altitude===2&&r.actor.lift===32));assert.equal(samples[0].actor.direction,({4:'down',6:'left',2:'right',0:'up'}as Record<number,string>)[dir]);await page.screenshot({path:join(out,`flight-${dir}-${width}.png`)});writeFileSync(join(out,`flight-${dir}-${width}-samples.json`),JSON.stringify(samples));await waitTurn();const after=await read();assert.notDeepEqual(after.creatures.find(c=>c.id===f.bird)!.pos,bird.pos);writeFileSync(join(out,`flight-${dir}-${width}-final.json`),JSON.stringify(after));runs.push({kind:'flight',dir,width,height,realWaits:2,sourceFrames:4,observationWholeStateExact:true,actualMovement:true,declaredInitialTakeoffOffsetTU:1,observedDirection:samples[0].actor.direction,actualPointerRecognizesAirborneBody:true});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 for(const kind of(process.argv[3]==='flight-only'?[]:process.argv[3]==='prey-only'?['eyes','covered']:['berries','carcass','eyes','covered'])as Exclude<Kind,'flight'>[]){
  const f=fixture(kind),width=kind==='berries'||kind==='eyes'?1440:1366,height=width===1440?1080:768;await load(f,width,height);const before=await read();let waits=0,workObserved=false
  while(waits<35){await waitTurn();waits++;const s=await read(),bird=s.creatures.find(c=>c.id===f.bird)!,floor=s.map.tiles[bird.pos.y*s.map.w+bird.pos.x]
   if(kind==='berries'&&bird.activity?.animalForage&&!workObserved){const samples=await sample(f.bird,'work',2100);writeFileSync(join(out,'berries-work-samples.json'),JSON.stringify(samples));await page.screenshot({path:join(out,'berries-work.png')});workObserved=true}
   if(kind==='berries'&&s.map.tiles[20*s.map.w+30].gatherStock?.remaining===4)break
   if(kind==='carcass'&&floor.items.some(i=>i.def==='Item.CarrionMorsel'&&i.count<20))break
   if(kind==='eyes'&&s.creatures.find(c=>c.id===f.target)!.body.wounds.some(wd=>['LeftEye','RightEye'].includes(wd.part)))break
   if(kind==='covered'&&waits===8)break
  }
  const after=await read(),bird=after.creatures.find(c=>c.id===f.bird)!
  if(kind==='berries'){assert.ok(workObserved);assert.equal(after.map.tiles[20*after.map.w+30].gatherStock?.remaining,4);assert.ok(bird.needs.kcal>30)}
  if(kind==='carcass'){const corpse=after.creatures.find(c=>c.def==='Creature.AshhornStag')!;assert.equal(corpse.carcassStock!['Item.RawMeat'].remaining,corpse.carcassStock!['Item.RawMeat'].original-1);assert.ok(after.map.tiles.some(t=>t.items.some(i=>i.def==='Item.CarrionMorsel'&&i.count===19)))}
  if(kind==='eyes'){assert.equal(await page.getByText('눈앞에 적 1명',{exact:true}).count(),1)}
  if(kind==='eyes')assert.ok(after.creatures.find(c=>c.id===f.target)!.body.wounds.some(wd=>['LeftEye','RightEye'].includes(wd.part)))
  if(kind==='covered')assert.deepEqual(after.creatures.find(c=>c.id===f.target)!.body.wounds,before.creatures.find(c=>c.id===f.target)!.body.wounds)
  await page.waitForTimeout(800);const hash=stateHash(await read());await page.waitForTimeout(600);assert.equal(stateHash(await read()),hash);await page.screenshot({path:join(out,kind+'-final.png')});writeFileSync(join(out,kind+'-final.json'),JSON.stringify(after));runs.push({kind,width,height,actualWaits:waits,observationWholeStateExact:true,workOriginalFrames:workObserved?4:undefined});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Four actual threat takeoffs and one subsequent flight step, four source wing phases per direction, real partial berry work and eating, finite animal carcass separation/eating, physical unconscious prey and actual hood protection. Not a natural forest playthrough, full flight ecology or World regression.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* title */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
