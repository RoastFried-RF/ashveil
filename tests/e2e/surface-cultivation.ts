import {chromium} from 'playwright-core'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {isDeepStrictEqual} from 'node:util'
import {startNativePreview} from '../../tools/native-preview'
import {surfaceCultivationFixture} from '../surface-cultivation-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {player,type World} from '../../src/core/ctx'
import {serialize,deserialize} from '../../src/core/save'
import type {Action} from '../../src/core/actions'

const out=process.argv[2],width=Number(process.argv[3]??1440),height=width===1366?768:1080
if(!out||existsSync(out))throw Error('Fresh output directory required')
mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width,height}})
type Hook={__ashveil:{world():World};render_game_to_text():string}
const images:string[]=[],checks:string[]=[],actions:{name:string;action:Action;tu:number}[]=[],errors:string[]=[],fixtures:unknown[]=[]
let w!:World,restores=0
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function check(name:string){
 await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0},{},{timeout:90000})
 w.s.fx=[]
 const actual=await page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s))),expected=JSON.parse(serialize(w.s))
 writeFileSync(join(out,name+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,name+'-expected.json'),JSON.stringify(expected))
 assert.ok(isDeepStrictEqual(actual,expected),'Entire world mismatch: '+name);checks.push(name);console.log('PASS',name)
}
async function close(){for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
async function shot(name:string,keepHover=false){if(!keepHover)await page.mouse.move(100,40);await page.waitForTimeout(300);await page.screenshot({path:join(out,name+'.png')});images.push(name+'.png')}
async function initial(world:World,proof:unknown,name:string,raw=serialize(world.s)){
 w=world;fixtures.push(proof);writeFileSync(join(out,name+'-declared-initial.json'),raw)
 await page.goto(server.url);await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.removeItem('ashveil.preferences.v1')},raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(name)
}
async function restore(name:string){await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(name);restores++}
async function input(name:string,action:Action,fn:()=>Promise<unknown>){const start=w.s.time;assert.equal(playerAct(w,action,300000),null);await fn();await page.waitForFunction(tu=>(window as unknown as Hook).__ashveil.world().s.time===tu,w.s.time,{timeout:90000});await check(name);actions.push({name,action,tu:w.s.time-start})}
async function farm(){await close();await page.keyboard.press('F2');await page.getByTestId('cultivation-panel').waitFor();await page.getByTestId('cultivation-panel').scrollIntoViewIfNeeded()}
try{
 const d=surfaceCultivationFixture(true)
 await initial(d.w,d.proof,'declared-original-thirty-growth-turns-left');await farm();await page.getByTestId('surface-crop-away-rule').waitFor();await shot('2500-original-finite-crop-and-away-rule')
 await close();await page.getByTestId('map').focus();await input('step-on-source-stairs',{type:'move',dir:4},()=>page.keyboard.press('ArrowDown'));await input('actual-departure-records-local-weather',{type:'stairs'},()=>page.keyboard.press('Enter'))
 const frozen=structuredClone(d.crop().state),record=structuredClone(w.s.maps[d.sourceId].surfaceCultivation);assert.ok(record);await shot('2501-original-cellar-and-physical-torch')
 await input('actual-two-hundred-turns-away',{type:'rest',turns:200},()=>page.keyboard.press('r'));assert.deepEqual(d.crop().state,frozen);await page.keyboard.press('F2');await page.getByTestId('win-craft').waitFor();assert.equal(await page.getByTestId('cultivation-panel').count(),0);await close();await shot('2502-away-does-not-disclose-hidden-crop');await restore('away206-full-restore-keeps-unsettled-original-crop');assert.deepEqual(w.s.maps[d.sourceId].surfaceCultivation,record)
 await page.getByTestId('map').focus();await input('actual-return-settles-original-sun-and-water',{type:'stairs'},()=>page.keyboard.press('Enter'));assert.equal(d.crop().ready,true);assert.equal(d.crop().state.seedUid,d.seedsUid);assert.ok(d.crop().state.waterUnits<frozen.waterUnits);assert.deepEqual(d.crop().state.irrigation,frozen.irrigation);assert.equal(player(w).bag.some(i=>i.def==='Item.Oats'),false);await farm();await shot('2503-returned-mature-original-crop-no-free-harvest');await restore('returned206-full-restore-no-double-growth')
 await farm();await input('actual-twelve-turn-harvest-after-return',{type:'gather',pos:d.pos},()=>page.getByTestId('crop-harvest').click());const grain=player(w).bag.find(i=>i.def==='Item.Oats')!;assert.equal(grain.count,5);assert.equal(grain.foodWater!.quality.pathogen,60);assert.ok(Math.abs(grain.contaminantAsh!-.04)<1e-12);await close();await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor();await page.getByTestId('win-inv').locator('[data-uid="'+grain.uid+'"]').hover();await shot('2504-five-original-harvest-grains-and-retained-contamination',true);await restore('harvested206-full-body-items-rng-and-weather-restore');await farm();await shot('2505-harvested-source-plot-and-finite-water')
 const legacy=surfaceCultivationFixture(true);legacy.act({type:'move',dir:4});legacy.act({type:'stairs'});const raw=JSON.parse(serialize(legacy.s));raw.version=205;delete raw.maps[legacy.sourceId].surfaceCultivation;delete raw.maps[legacy.sourceId].tiles[legacy.pos.y*raw.maps[legacy.sourceId].w+legacy.pos.x].cultivation.dormantAt
 const old:World={db:legacy.w.db,s:deserialize(JSON.stringify(raw))};assert.equal(old.s.version,SAVE_VERSION);await initial(old,{...legacy.proof,declaredMarkerless205:true,notHistoricalUserFile:true},'markerless205-initial-away',JSON.stringify(raw));const source=()=>old.s.map.id===legacy.sourceId?old.s.map:old.s.maps[legacy.sourceId],crop=()=>source().tiles[legacy.pos.y*source().w+legacy.pos.x].cultivation!;const before=structuredClone(crop())
 await page.getByTestId('map').focus();await input('old205-actual-two-hundred-turns-away',{type:'rest',turns:200},()=>page.keyboard.press('r'));assert.deepEqual(crop(),before);await restore('old205-away-to206-full-restore');await input('old205-actual-return-without-invented-history',{type:'stairs'},()=>page.keyboard.press('Enter'));assert.ok(crop().growth>=before.growth&&crop().growth-before.growth<=1);assert.equal(old.s.map.surfaceCultivation,undefined);assert.equal(crop().dormantAt,undefined);await farm();assert.equal(await page.getByTestId('crop-harvest').count(),0);await shot('2510-old205-only-one-active-return-turn-no-backfill');await restore('old205-returned206-full-restore');await shot('2511-old205-restored-original-crop-and-body')
 assert.deepEqual(errors,[]);const audit={width,height,save:SAVE_VERSION,wholePairs:checks.length,restores,checks,images,actions,fixtures,errors,limits:'Two finite initial scenes via Title Continue. Current scene uses actual move/stairs/rest200/return/harvest12; markerless205 scene declares old shape and is not a historical user file. Independent Node entire-world comparisons and actual restores. No postload body/time/RNG/crop injection; renderer FX consumed normally. NearRipe30growth turns remaining declared, not past5days of farming.'};writeFileSync(join(out,'audit.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify({width,wholePairs:checks.length,restores,images:images.length,tu:actions.reduce((n,a)=>n+a.tu,0),errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
