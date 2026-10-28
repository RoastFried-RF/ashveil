/** Actual UI surgery exercises the new installed-source loading/unloading path. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {makeItem,addToBag} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize,stateHash} from '../src/core/save'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View}
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.sources=[];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]})
p.bag=[];p.equip={};p.facing=4;p.body.missing=['LeftHand'];p.body.prosthetics={};const hook=makeItem(w,'Item.HookHand');assert.equal(addToBag(w,p,hook),0);s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
const initial=serialize(s),expected:World={db:w.db,s:deserialize(initial)};writeFileSync(join(out,'initial.json'),initial)
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1366,height:768}}),errors:string[]=[],pairs:{label:string;hash:string}[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(label:string){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(t=>!(window as unknown as Hook).__ashveil.world().s.simulationPending&&(window as unknown as Hook).__ashveil.world().s.time===t,expected.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);expected.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(expected.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(expected.s)),label);pairs.push({label,hash:stateHash(actual)});return await page.evaluate(()=>(window as unknown as Hook).render_game_presentation())}
async function waitHardware(present:boolean){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(({id,uid,present})=>{const hook=(window as unknown as Hook);if(typeof hook.render_game_presentation!=='function')return false;const actor=hook.render_game_presentation()?.actors.find(a=>a.actor===id);return!!actor?.human&&actor.human.prostheticJoints.some(j=>j.uid===uid)===present},{id:p.id,uid:hook.uid,present})}
try{
 await page.goto(url);await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:4}))},initial);await page.reload();await page.getByTestId('continue').click();const base=await compare('loaded')
 await page.keyboard.press('Shift+B');await page.getByLabel('설치할 의수족').selectOption(String(hook.uid));await page.getByLabel('의수족 설치 부위').selectOption('LeftHand');await compare('readonly-review')
 await page.getByRole('button',{name:'선택한 의수족 설치',exact:true}).click();assert.equal(playerAct(expected,{type:'prosthetic',operation:'install',part:'LeftHand',uid:hook.uid}),null);await waitHardware(true);const installed=await compare('installed');assert.equal(installed.assets.loadedSheets,base.assets.loadedSheets+1);assert.equal(installed.assets.estimatedDecodedBytes-base.assets.estimatedDecodedBytes,2172*724*4);await page.keyboard.press('Escape');await page.screenshot({path:join(out,'installed.png')})
 await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await waitHardware(true);await compare('installed-continued')
 await page.keyboard.press('Shift+B');await page.getByTestId('prosthetic-panel').getByRole('button',{name:'분리',exact:true}).click();assert.equal(playerAct(expected,{type:'prosthetic',operation:'remove',part:'LeftHand'}),null);await waitHardware(false);const removed=await compare('removed');assert.equal(removed.assets.loadedSheets,base.assets.loadedSheets);assert.equal(removed.assets.estimatedDecodedBytes,base.assets.estimatedDecodedBytes);assert.ok(expected.s.creatures.find(c=>c.id===p.id)!.bag.some(item=>item.uid===hook.uid&&item.count===1));await page.keyboard.press('Escape');await page.screenshot({path:join(out,'removed.png')})
 await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await waitHardware(false);await compare('removed-continued');assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,postTitleWorldWrites:false,actualUIInstallAndRemove:true,originalHookUid:hook.uid,wholePairs:pairs.length,baseAssets:base.assets,installedAssets:installed.assets,removedAssets:removed.assets,pairs,errors},null,2));console.log(JSON.stringify({wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),String(error));throw error}finally{await browser.close()}
