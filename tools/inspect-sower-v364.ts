/** Declared finite scenes. After Title load, only real keys/pointer; hooks are read-only. */
import {chromium,type Page} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {playerAct} from '../src/core/game'
import {createCreature} from '../src/core/creatures'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {makeItem} from '../src/core/items'
import {initialSowerState} from '../src/core/sower-state'
import {deserialize,serialize,stateHash} from '../src/core/save'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():ReturnType<typeof prisonerFixture>['w']};render_game_presentation():View}
type Kind='route'|'push'|'fall'|'corpse'
const fallOnly=process.argv.includes('--fall-only')
const combatOnly=process.argv.includes('--combat-only')||fallOnly
const out=process.argv[2]??'test-results/autonomy-v364/native-r1';mkdirSync(out,{recursive:true})
function fixture(kind:Kind){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12
 Object.assign(s.map,{layout:undefined,kind:'dungeon',depth:1,ambient:1,lights:[],props:[],rooms:[],links:[],exits:[],name:'파종기 · 유한 경로/밀기/쓰러짐 원문 검토'})
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:true,seen:true,items:[],cont:undefined,placed:undefined,deco:undefined,room:undefined,blood:0,icy:false,snow:0,cultivation:undefined,gatherAt:undefined,gatherStock:undefined})
 p.pos={x:46,y:18};p.bag=[];p.equip={};p.activity=undefined;p.nextAct=s.time;p.needs.nutritionDay=Math.floor(s.time/(100*28800))
 const machine=createCreature(w,'Creature.Sower',{x:47,y:14});machine.home={...machine.pos};machine.met=true;machine.facing=2;machine.nextAct=s.time+1;machine.sowerState={...initialSowerState(w.db.creature(machine.def).sower!),routeIndex:1};s.creatures=[p,machine]
 let victim:number|undefined
 if(kind==='push'){const target=createCreature(w,p.def,{x:48,y:14});target.faction='coalition';target.met=true;target.bag=[];target.equip={};target.nextAct=1e12;target.asleep=false;target.unconscious=false;s.creatures.push(target);victim=target.id}
 if(kind==='fall'){p.pos={x:46,y:14};p.stats.str=30;p.stats.agi=30;p.stats.per=30;p.equip.main=makeItem(w,'Item.Greatsword');machine.hp=1;machine.facing=6;machine.nextAct=1e12;machine.body.machine!.power=0}
 if(kind==='corpse'){machine.alive=false;machine.hp=0;machine.deathTurn=s.time/100-10;machine.deathCause='유한 초기 시체';machine.facing=6;machine.nextAct=1e12}
 s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
 return{kind,initial:serialize(s),machine:machine.id,victim,expected:{db:w.db,s:deserialize(serialize(s))}}
}
const server=await startNativePreview(4384);let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined
const errors:string[]=[],runs:unknown[]=[],pairs:unknown[]=[]
async function settled(){await page!.waitForSelector('[data-testid=map][data-ready=true] canvas');await page!.waitForFunction(()=>{const h=window as unknown as Hook,w=h.__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity&&!h.render_game_presentation().moving})}
async function load(f:ReturnType<typeof fixture>,width:number,height:number){await page!.setViewportSize({width,height});writeFileSync(join(out,`${f.kind}-${width}-initial.json`),f.initial);await page!.evaluate(({initial,speed})=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:speed,screenShake:false,torchFlicker:false,mapZoom:2}))},{initial:f.initial,speed:f.kind==='push'||f.kind==='fall'?0.5:1});await page!.reload();await page!.getByTestId('continue').click();await settled();await page!.getByRole('button',{name:'간략',exact:true}).click()}
async function compare(f:ReturnType<typeof fixture>,phase:string){await settled();f.expected.s.fx.length=0;const actual=await page!.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,`${f.kind}-${phase}-actual.json`),JSON.stringify(actual));assert.equal(stateHash(actual),stateHash(f.expected.s),f.kind+' '+phase);assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(f.expected.s)));pairs.push({kind:f.kind,phase,hash:stateHash(actual)});return actual}
async function sample(id:number,ms=2400){return page!.evaluate(async({id,ms})=>{const rows:{at:number;actor:View['actors'][number]}[]=[],start=performance.now();while(performance.now()-start<ms){await new Promise(resolve=>requestAnimationFrame(resolve));const actor=(window as unknown as Hook).render_game_presentation().actors.find(a=>a.actor===id);if(actor)rows.push({at:performance.now()-start,actor})}return rows},{id,ms})}
async function wait(f:ReturnType<typeof fixture>){const sampling=sample(f.machine,f.kind==='route'?1350:2400);await page!.keyboard.press('Period');assert.equal(playerAct(f.expected,{type:'wait'}),null);await settled();return sampling}
async function title(){await page!.getByRole('button',{name:'타이틀',exact:true}).click();await page!.getByTestId('continue').waitFor()}
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await page.goto(server.url)
 if(!combatOnly){const f=fixture('route');await load(f,1440,1080);const rows:Awaited<ReturnType<typeof sample>>=[],faces=new Set<string>(),workFaces=new Set<string>();let n=0
 for(;n<45;n++){const batch=await wait(f);rows.push(...batch);for(const r of batch){if(r.actor.rig){faces.add(r.actor.direction);if(r.actor.frame.includes('_work_'))workFaces.add(r.actor.direction)}}if(n%8===0)await compare(f,'step-'+n);if(workFaces.size===4&&faces.size===4)break}
 writeFileSync(join(out,'route-samples.json'),JSON.stringify(rows));const final=await compare(f,'route-end');assert.equal(faces.size,4);assert.equal(workFaces.size,4);assert.ok(final.creatures.find(c=>c.id===f.machine)!.sowerState!.seedsSpent>=4);await page.screenshot({path:join(out,'actual-route-and-crops.png')});runs.push({kind:'route',realWaits:n+1,faces:[...faces],workFaces:[...workFaces],observations:rows.length});await title()}
 if(!fallOnly){const push=fixture('push');await load(push,1366,768);const attack=await wait(push);writeFileSync(join(out,'push-samples.json'),JSON.stringify(attack));assert.equal(new Set(attack.filter(r=>r.actor.mode==='attack').map(r=>r.actor.frame)).size,4);await compare(push,'push-end');await page.screenshot({path:join(out,'actual-push.png')});runs.push({kind:'push',realWaits:1,frames:4,victim:push.victim});await title()}
 const fall=fixture('fall');await load(fall,1366,768);const point=await page.evaluate(id=>{const v=(window as unknown as Hook).render_game_presentation(),a=v.actors.find(a=>a.actor===id)!,r=document.querySelector('canvas')!.getBoundingClientRect();return{x:r.left+v.screen.feet.x+(a.feet.x-v.feet.x)*16*v.zoom,y:r.top+v.screen.feet.y+(a.feet.y-v.feet.y)*16*v.zoom-22*v.zoom}},fall.machine)
 const falling=sample(fall.machine,2400);await page.keyboard.down('Control');try{await page.mouse.click(point.x,point.y)}finally{await page.keyboard.up('Control')}assert.equal(playerAct(fall.expected,{type:'attack',target:fall.machine}),null);await settled();const fallRows=await falling;writeFileSync(join(out,'fall-samples.json'),JSON.stringify(fallRows));const fallState=await compare(fall,'fall-end');assert.equal(fallState.creatures.find(c=>c.id===fall.machine)!.alive,false);assert.equal(new Set(fallRows.filter(r=>r.actor.mode==='fall'&&(r.actor.frame.startsWith('av364_sower_fall_')||r.actor.frame==='av366_sower_left_collapsed')).map(r=>r.actor.frame)).size,4);await page.screenshot({path:join(out,'actual-left-collapse.png')});runs.push({kind:'fall',realCtrlPointerAttack:true,frames:4});await title()
 const corpse=fixture('corpse');await load(corpse,1366,768);const corpseRows=await sample(corpse.machine,350);assert.ok(corpseRows.every(r=>r.actor.frame==='av366_sower_left_collapsed'));await compare(corpse,'initial-corpse');await page.screenshot({path:join(out,'loaded-corpse-no-standing-rig.png')});runs.push({kind:'corpse',initialDead:true,standingRigNeverShown:true});await title()
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,combatPresentationSpeed:0.5,runs,pairs,errors,scope:'Default1x route/corpse and ordinary0.5x preference for four-frame combat sampling. Actual game route/work in four facings, right push originals, real pointer attack/left fall, initial corpse display. Exact independent whole-state comparisons. No natural campaign, damaged-limb gait, v1 or release approval.'},null,2)+'\n');console.log(JSON.stringify({runs,pairs:pairs.length,errors}))
}catch(error){writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),runs,pairs,errors},null,2)+'\n');try{await page?.screenshot({path:join(out,'failure.png')})}catch{/* failure may occur before game load */}throw error}finally{await page?.close();await browser?.close();server.stop()}
