/** Finite declared maps; after title load, only real buttons and keys change the world. */
import {chromium,type Page} from 'playwright-core'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,stateHash} from '../src/core/save'
import {worldAssets} from '../src/client/render/world-assets'
import {atlasPlan,type AtlasManifest} from '../src/client/render/atlas-plan'
import type {MapRenderer} from '../src/client/render/MapRenderer'
import {startNativePreview} from './native-preview'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():ReturnType<typeof prisonerFixture>['w']};render_game_presentation():View;render_game_assets?:()=>View['assets']}
const out=resolve(process.argv[2]??'test-results/autonomy-v343/native'),root=resolve(process.argv[3]??'.'),baseline=process.argv.includes('--baseline')
mkdirSync(out,{recursive:true})
const manifest=JSON.parse(readFileSync('src/client/sprites.json','utf8'))as AtlasManifest
function fixture(){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.weather='clear';s.weatherUntil=1e12;s.fx=[]
 Object.assign(s.map,{id:'surface',layout:undefined,kind:'surface',depth:0,ambient:1,daylightMult:1,lights:[],props:[],rooms:[],exits:[],links:[{pos:{x:20,y:20},to:'crypt1',toPos:{x:20,y:20},label:'까마귀 장면'}],name:'원화 로딩 · 세 다리 측량기'})
 for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.Earth',roof:false,seen:true,items:[],cont:undefined,placed:undefined,deco:undefined,room:undefined,blood:0,icy:false,snow:0,cultivation:undefined,gatherAt:undefined,gatherStock:undefined})
 s.map.tiles[20*s.map.w+20].t='Terrain.StairsDown';p.pos={x:20,y:20};p.mapId='surface';p.bag=[];p.equip={};p.activity=undefined
 const surveyor=createCreature(w,'Creature.Surveyor',{x:24,y:22});surveyor.mapId='surface';surveyor.met=true;surveyor.home={...surveyor.pos};surveyor.nextAct=s.time+1
 const crow=createCreature(w,'Creature.AshCrow',{x:27,y:20});crow.mapId='crypt1';crow.met=true;crow.home={...crow.pos};crow.nextAct=s.time+1
 s.creatures=[p,surveyor]
 const below=structuredClone(s.map);Object.assign(below,{id:'crypt1',depth:1,kind:'dungeon',name:'원화 로딩 · 잿빛 까마귀',links:[{pos:{x:20,y:20},to:'surface',toPos:{x:20,y:20},label:'측량기 장면'}]});below.tiles[20*below.w+20].t='Terrain.StairsUp';s.maps.crypt1=below;s.offCreatures.crypt1=[crow]
 invalidateLights(w);updatePlayerVision(w,p)
 const initial=serialize(s),request=worldAssets(w),surface=atlasPlan(manifest,request.icons,request.characters)
 const other={db:w.db,s:{...s,map:below,creatures:[p,crow]}},second=worldAssets(other),crypt=atlasPlan(manifest,second.icons,second.characters)
 return{initial,surface,crypt,surveyor:surveyor.id,crow:crow.id,failedPath:manifest.sheets[manifest.frames[manifest.chars[request.characters.find(k=>k!==surveyor.sprite)!].walk.down[0]][0]]}
}
const f=fixture();writeFileSync(join(out,'initial.json'),f.initial)
const server=await startNativePreview(4373,root)
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined
const runs:unknown[]=[],errors:string[]=[]
const read=(page:Page)=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function ready(page:Page){await page.waitForSelector('[data-testid=map][data-ready=true] canvas',{timeout:120000});await page.waitForFunction(()=>{const h=window as unknown as Hook,w=h.__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity&&!!h.render_game_presentation()&&!h.render_game_presentation().moving},{},{timeout:60000})}
async function load(page:Page,width:number,height:number){await page.setViewportSize({width,height});await page.goto(server.url);await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:2}))},f.initial);await page.reload()}
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const[width,height]of[[1440,1080],[1366,768]]as const){
  const page=await browser.newPage(),network=new Set<string>();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});page.on('request',r=>{if(r.url().endsWith('.png'))network.add(new URL(r.url()).pathname.replace(/^\//,''))})
  try{
   await load(page,width,height);const started=performance.now();await page.getByTestId('continue').click();await ready(page);const firstLoadMs=performance.now()-started;await page.getByRole('button',{name:'간략',exact:true}).click()
   const states:{phase:string;hash:string;assets:View['assets']|null}[]=[]
   async function capture(phase:string,expected:typeof f.surface){
    await ready(page);const s=await read(page),v=await page.evaluate(()=>(window as unknown as Hook).render_game_presentation());assert.ok(v.frame&&v.frame.sourceWidth>0);if(!baseline){assert.equal(v.assets.loadedSheets,expected.sheets.length);assert.equal(v.assets.estimatedDecodedBytes,expected.estimatedDecodedBytes)}
    states.push({phase,hash:stateHash(s),assets:v.assets??null});writeFileSync(join(out,`${width}-${phase}-state.json`),JSON.stringify(s));await page.screenshot({path:join(out,`${width}-${phase}.png`)})
   }
   await capture('surface',f.surface)
   for(let i=0;i<3;i++){await page.keyboard.press('Period');await ready(page)}
   await page.keyboard.press('ArrowUp');await ready(page);await page.keyboard.press('ArrowDown');await capture('walked',f.surface)
   await page.getByTestId('stairs').click();await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.map.id==='crypt1');await capture('crypt',f.crypt)
   await page.keyboard.press('Period');await ready(page);await page.getByTestId('stairs').click();await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.map.id==='surface');await capture('returned',f.surface)
   await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor()
   if(!baseline)await page.waitForFunction(()=>(window as unknown as Hook).render_game_assets?.().loadedSheets===0)
   await page.getByTestId('continue').click();await capture('reopened',f.surface)
   assert.equal(states[3].hash,states[4].hash)
   const oldSheets=Object.keys(manifest.sheets).filter(k=>!manifest.characterSheetHistory?.includes(k)),oldEstimated=oldSheets.reduce((n,k)=>{const [w,h]=manifest.sheetSizes![k];return n+w*h*4},0)
   runs.push({width,height,states,firstLoadMs,requestedPngs:network.size,oldLoadedSheets:oldSheets.length,oldEstimatedDecodedBytes:oldEstimated,estimatedByteScope:'whole owned original sheet width × height × 4; excludes CSS copies, fallback images, GPU overhead and caches; not RSS',actualStairsRoundtrip:true,titleFreedOwnedSheets:!baseline,reopenWholeStateExact:true})
  }finally{await page.close()}
 }
 assert.equal(errors.length,0,errors.join('\n'))
 let retry:unknown=null
 if(!baseline){
  const page=await browser.newPage(),expectedErrors:string[]=[];let fail=true
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')expectedErrors.push(e.text())})
  try{
   await page.route('**/'+f.failedPath,async route=>{if(fail)await route.abort('failed');else await route.continue()});await load(page,1366,768);await page.getByTestId('continue').click();await page.getByTestId('map-retry').waitFor({timeout:120000});const before=stateHash(await read(page));await page.keyboard.press('Period');await page.keyboard.press('ArrowRight');assert.equal(stateHash(await read(page)),before);await page.screenshot({path:join(out,'failure-real-input-blocked.png')});fail=false;await page.getByTestId('map-retry').click();await ready(page);assert.equal(stateHash(await read(page)),before);await page.keyboard.press('Period');await ready(page);assert.notEqual(stateHash(await read(page)),before);await page.screenshot({path:join(out,'retry-real-input-resumed.png')});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.waitForFunction(()=>(window as unknown as Hook).render_game_assets?.().loadedSheets===0);retry={deliberatelyAbortedSource:f.failedPath,realBlockedKeys:['Period','ArrowRight'],wholeStateWhileBlockedExact:true,wholeStateAfterRetryExact:true,realWaitAfterRetryAdvanced:true,ownedSourcesFreed:true,expectedNetworkConsoleErrors:expectedErrors}
  }finally{await page.close()}
 }
 assert.equal(errors.length,0,errors.join('\n'))
 writeFileSync(join(out,'audit.json'),JSON.stringify({baseline,root,finiteInitial:true,noPostLoadWorldWrites:true,runs,retry,errors,scope:'Two finite clear-ground maps and actual3wait/2walk/2stairs/title/reopen at two sizes; whole state compare, owned source counts, one forced network failure/retry. No full game or World approval; load milliseconds are local observations, not a performance guarantee.'},null,2)+'\n');console.log(JSON.stringify({baseline,runs:runs.length,retry:!!retry,errors}))
}finally{await browser?.close();server.stop()}
