/** Declared finite plants / near-regrowth edge and a real generated Blackwood map. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {blackwoodFixture} from '../tests/blackwood-fixture'
import {calendar} from '../src/core/climate-state'
import {tileAt,turnOf,type World} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,stateHash} from '../src/core/save'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View}
const out=process.argv[2]??'test-results/autonomy-v336/native';mkdirSync(out,{recursive:true})
function fixture(kind:'grid'|'forest'){
 const d=kind==='forest'?blackwoodFixture():prisonerFixture(),{w,p}=d,s=w.s
 p.bag=[];p.equip={};p.activity=undefined;p.asleep=false;p.unconscious=false;p.body.wounds=[];p.body.missing=[];p.traits=[];p.effects=[];p.age=undefined;p.nextAct=s.time;Object.assign(p.needs,{kcal:3000,waterDeficit:0,fatigue:10,bodyTemp:37,protein:100,vitamin:100})
 const target=kind==='grid'?{x:21,y:20}:{x:6,y:6},regrow=kind==='grid'?{x:24,y:21}:{x:10,y:9}
 if(kind==='grid'){
  s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.map.name='자연 군락·16영역 유한 초기 방';s.fx=[];p.pos={x:20,y:20}
  while(calendar(w).season.id!=='Season.Summer')s.time+=28800*100
  for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:true,seen:true,observed:undefined,items:[],placed:undefined,room:undefined,deco:undefined,icy:false,blood:0,cultivation:undefined,gatherAt:undefined})
  for(let n=0;n<4;n++)for(const[terrain,y]of[['Terrain.WildShadeRoots',20],['Terrain.AshBerryBush',24]]as const){Object.assign(tileAt(w,{x:21+n*3,y}),{t:terrain,v:n});Object.assign(tileAt(w,{x:21+n*3,y:y+1}),{t:terrain,v:n,gatherAt:turnOf(w)+1000})}
 }else{p.pos={x:5,y:6};s.weather='clear';s.weatherUntil=s.time+1e9;s.fx=[]}
 p.nextAct=s.time;Object.assign(p.needs,{nutritionDay:Math.floor(turnOf(w)/28800),protein:100,vitamin:100,hygiene:100,scurvy:0});s.storyteller.budget=-1e9;s.weather='clear';s.weatherUntil=s.time+1e9;tileAt(w,regrow).gatherAt=turnOf(w)+1;invalidateLights(w);updatePlayerVision(w,p)
 return{initial:serialize(s),target,regrow,kind}
}
const server=await startNativePreview(4367),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
const view=()=>page.evaluate(()=>(window as unknown as Hook).render_game_presentation())
async function idle(){await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
try{
 await page.goto(server.url)
 for(const[kind,width,height]of[['grid',1440,1080],['forest',1366,768]]as const){
  const f=fixture(kind);writeFileSync(join(out,kind+'-initial.json'),f.initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},f.initial)
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.getByRole('button',{name:'간략',exact:true}).click()
  const before=await read(),initial=await view(),root=initial.forage.find(c=>c.pos.x===f.target.x&&c.pos.y===f.target.y)!;assert.ok(root?.visible);assert.equal(root.state,'mature');if(kind==='grid'){assert.equal(initial.forage.filter(c=>c.visible).length,16);assert.equal(new Set(initial.forage.map(c=>c.frame)).size,16)}
  await page.screenshot({path:join(out,kind+'-initial.png')});await page.keyboard.press('Period');await idle()
  const grown=await view();if(kind==='grid'){const source=grown.forage.find(c=>c.pos.x===f.regrow.x&&c.pos.y===f.regrow.y)!;assert.equal(source.state,'mature');assert.equal(source.variant,initial.forage.find(c=>c.pos.x===f.regrow.x&&c.pos.y===f.regrow.y)!.variant)}
  await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await page.getByRole('button',{name:'그늘뿌리 채집 (12턴)',exact:true}).click();await idle();await page.keyboard.press('Escape');await page.waitForFunction(pos=>(window as unknown as Hook).render_game_presentation().forage.some(c=>c.pos.x===pos.x&&c.pos.y===pos.y&&c.state==='spent'),f.target)
  const after=await read(),finished=await view(),spent=finished.forage.find(c=>c.pos.x===f.target.x&&c.pos.y===f.target.y)!;assert.equal(spent.variant,root.variant);assert.equal(spent.scale,root.scale);assert.ok(after.map.tiles[f.target.y*after.map.w+f.target.x].gatherAt!>after.time/100);const player=after.creatures.find(c=>c.id===after.playerId)!;assert.equal(player.bag.filter(i=>i.def==='Item.ShadeRoot').reduce((n,i)=>n+i.count,0),2)
  const observationHash=stateHash(after);await page.waitForTimeout(1200);assert.equal(stateHash(await read()),observationHash);await page.screenshot({path:join(out,kind+'-harvested.png')});writeFileSync(join(out,kind+'-final.json'),JSON.stringify(after));writeFileSync(join(out,kind+'-presentation.json'),JSON.stringify({initial,finished},null,2))
  runs.push({kind,width,height,actualInputs:['Period','F2','original root gather button','Escape'],postLoadWorldWrites:false,initialOriginalFrames:kind==='grid'?16:undefined,beforeTU:before.time,afterTU:after.time,originalRootUid:player.bag.find(i=>i.def==='Item.ShadeRoot')!.uid,rootYield:2,sameVariantAndScale:true,observationWholeStateExact:true,originalRegrowthEdgeInput:kind==='grid',actualForestGenerated:kind==='forest',forestLightAndTerrainUntouched:kind==='forest'});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,runs,errors,scope:'16 source regions in a declared bright grid plus actual generated forest terrain/light with a declared player position and original clump near-regrowth edge. Actual wait and root gathering; no post-load clock/resource/world writes. No natural long-season playthrough.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* title */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
