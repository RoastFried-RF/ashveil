/** Declared finite original colony/items, then real UI/keys only. */
import {chromium,type Page} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createSwarm} from '../src/core/swarms'
import {makeItem,addToBag} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {bestiaryDef,bestiaryStage} from '../src/core/bestiary-state'
import {startNativePreview} from './native-preview'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():ReturnType<typeof prisonerFixture>['w']};render_game_presentation():View}
const out=process.argv[2]??'test-results/autonomy-v370/native-r1';mkdirSync(out,{recursive:true})
function fixture(){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.creatures=[p];s.fx=[];s.weather='clear';s.weatherUntil=1e12
 Object.assign(s.map,{layout:undefined,kind:'dungeon',ambient:.85,lights:[],props:[],rooms:[],links:[],exits:[],name:'재나방 · 유한 군체/면포/가루/조리'})
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:true,seen:true,items:[],cont:undefined,placed:undefined,deco:undefined,room:undefined,blood:0,icy:false,snow:0,cultivation:undefined,gatherAt:undefined,gatherStock:undefined})
 p.pos={x:20,y:20};p.bag=[];p.equip={};p.activity=undefined;p.nextAct=s.time;p.freeActTurn=undefined;p.crouching=false;p.needs.nutritionDay=Math.floor(s.time/(100*28800))
 const cloth=makeItem(w,'Item.Cloth'),lamp=makeItem(w,'Item.Lantern'),knife=makeItem(w,'Item.RustyKnife');addToBag(w,p,cloth);lamp.lit=true;p.equip.off=lamp;p.equip.main=knife
 const colony=createSwarm(w,'Swarm.Ashmoth',{x:20,y:22});colony.cohesion=100;s.map.swarms=[colony];s.knowledge.bestiary[colony.def]={seen:10,fought:0,killed:0,observeTurns:bestiaryDef(w).observeTurns,encounters:1}
 const fire={x:30,y:20};s.map.tiles[fire.y*s.map.w+fire.x].t='Terrain.Campfire';s.map.lights=[{pos:fire,radius:3,kind:'campfire'}]
 invalidateLights(w);updatePlayerVision(w,p)
 return{initial:serialize(s),colony:colony.uid,cloth:cloth.uid,lamp:lamp.uid,expected:{db:w.db,s:deserialize(serialize(s))}}
}
const server=await startNativePreview(4388);let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,page:Page|undefined
const errors:string[]=[],pairs:unknown[]=[],runs:unknown[]=[]
async function settled(){await page!.waitForSelector('[data-testid=map][data-ready=true] canvas');await page!.waitForFunction(()=>{const h=window as unknown as Hook,w=h.__ashveil.world();return!w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity&&!h.render_game_presentation().moving})}
async function compare(f:ReturnType<typeof fixture>,phase:string){await settled();f.expected.s.fx.length=0;const actual=await page!.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));assert.equal(stateHash(actual),stateHash(f.expected.s),phase);assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(f.expected.s)));pairs.push({phase,hash:stateHash(actual)});return actual}
async function load(f:ReturnType<typeof fixture>,width:number,height:number){await page!.setViewportSize({width,height});writeFileSync(join(out,'initial-'+width+'.json'),f.initial);await page!.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:2}))},f.initial);await page!.reload();await page!.getByTestId('continue').click();await settled();await page!.getByRole('button',{name:'간략',exact:true}).click()}
async function input(f:ReturnType<typeof fixture>,key:string,action:Parameters<typeof playerAct>[1]){await page!.keyboard.press(key);assert.equal(playerAct(f.expected,action),null);await settled()}
async function action(f:ReturnType<typeof fixture>,selector:string,a:Parameters<typeof playerAct>[1]){await page!.locator(selector).click();assert.equal(playerAct(f.expected,a),null);await settled()}
async function observe(ms=1400){return page!.evaluate(async ms=>{const rows:View['swarms'][]=[];const start=performance.now();while(performance.now()-start<ms){await new Promise(resolve=>requestAnimationFrame(resolve));rows.push((window as unknown as Hook).render_game_presentation().swarms)}return rows},ms)}
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await page.goto(server.url)
 for(const[width,height]of [[1440,1080],[1366,768]]){
  const f=fixture();await load(f,width,height);const sampling=observe();await input(f,'Period',{type:'wait'});const rows=await sampling;writeFileSync(join(out,'flight-'+width+'.json'),JSON.stringify(rows));const visible=rows.flat(),frames=new Set(visible.flatMap(s=>s.originalFrames));assert.equal(frames.size,4);assert.equal(new Set(visible.flatMap(s=>s.tracked.filter(b=>b.id===0&&b.visible).map(b=>b.frame))).size,4);assert.ok(visible.some(s=>s.representativeSprites>10));await compare(f,'gathered-'+width);await page.screenshot({path:join(out,'actual-colony-'+width+'.png')})
  await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await action(f,`[data-capture-swarm="${f.colony}"]`,{type:'captureSwarm',target:f.colony,toolUid:f.cloth});const sample=f.expected.s.creatures.find(c=>c.id===f.expected.s.playerId)!.bag.find(i=>i.def==='Item.AshmothBody')!
  await action(f,`[data-study-moths="${sample.uid}"]`,{type:'studyMoths',uid:sample.uid});await action(f,`[data-capture-swarm="${f.colony}"]`,{type:'captureSwarm',target:f.colony,toolUid:f.cloth});const state=await compare(f,'captured-studied-'+width);assert.equal(state.map.swarms![0].members,900);assert.equal(bestiaryStage(f.expected,'Swarm.Ashmoth'),3);await page.screenshot({path:join(out,'actual-capture-study-'+width+'.png')})
  await page.getByTestId('craft-tab-recipes').click();await page.getByTestId('craft-search').fill('날개 가루');await page.getByTestId('Recipe.MothWingDust').getByRole('button',{name:'제작',exact:true}).click();assert.equal(playerAct(f.expected,{type:'craft',id:'Recipe.MothWingDust'}),null);await settled();await compare(f,'actual-pigment-craft-'+width)
  const actor=f.expected.s.creatures.find(c=>c.id===f.expected.s.playerId)!,dust=actor.bag.find(i=>i.def==='Item.MothWingDust')!;assert.ok(dust);await page.getByTestId('craft-tab-field').click();await action(f,`[data-apply-camouflage="${dust.uid}"]`,{type:'applyCamouflage',uid:dust.uid});await compare(f,'actual-coating-'+width);await page.screenshot({path:join(out,'actual-wing-dust-and-coating-'+width+'.png')})
  await page.keyboard.press('Escape');await input(f,'t',{type:'toggleLight',uid:f.lamp});await input(f,'Alt+c',{type:'crouch'});for(let i=0;i<10;i++)await input(f,'Period',{type:'wait'});await compare(f,'real-darkness-disperse-'+width);assert.equal(f.expected.s.map.swarms![0].cohesion,0);assert.equal(f.expected.s.map.swarms![0].members,900);await page.screenshot({path:join(out,'actual-dispersed-'+width+'.png')})
  if(width===1440){for(let i=0;i<9;i++)await input(f,'ArrowRight',{type:'move',dir:2});await page.keyboard.press('F2');await page.getByTestId('craft-tab-recipes').click();await page.getByTestId('craft-search').fill('나방 한 줌');await page.getByTestId('Recipe.RoastedMoths').getByRole('button',{name:'제작',exact:true}).click();assert.equal(playerAct(f.expected,{type:'craft',id:'Recipe.RoastedMoths'}),null);await settled();await compare(f,'actual-roast-'+width);assert.equal(actor.bag.find(i=>i.def==='Item.RoastedMoths')?.count,1);await page.screenshot({path:join(out,'actual-roasted-food-'+width+'.png')});await page.keyboard.press('Escape')}
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(f,'actual-save-continue-'+width);await page.getByRole('button',{name:'타이틀',exact:true}).click();runs.push({width,height,actualInputs:true,flightOriginalPosesObserved:4,captures:2,originalMembers1000:900,realStudyConsumed:1,realPigmentCraft:true,realCoating:true,actualLightOffAndCrouch:true,dispersalWithoutCreatingNewMembers:true,realRoastedMeal:width===1440,actualSaveContinue:true})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,sourceOriginalPNGs:2,runs,pairs,errors,scope:'Two finite actual-game scenes; original cloth/knife/lantern and1000-member colony, existing distant3-radius campfire. Actual F2 collect/study/craft/coating, T lightoff, Alt+C, Period, walk/cook and Title Continue. Node whole JSON/hash equality. Not natural ecology, all devices, Full/World/1000 or release approval.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,wholePairs:pairs.length,errors}))
}catch(error){writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),runs,pairs,errors},null,2)+'\n');try{await page?.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure-body.txt'),await page!.locator('body').innerText())}catch{/* title/network failure */}throw error}finally{await page?.close();await browser?.close();server.stop()}
