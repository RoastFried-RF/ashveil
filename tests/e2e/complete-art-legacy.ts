import {chromium} from 'playwright-core'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {loadDb} from '../../tools/loadContent'
import {deserialize,serialize} from '../../src/core/save'
import {applyContentTransition} from '../../src/core/content-transition'
import {playerAct} from '../../src/core/game'
import {player,type World} from '../../src/core/ctx'
import {updatePlayerVision} from '../../src/core/fov'
import {initializeFieldDevices} from '../../src/core/field-devices'
import {initializeClimate} from '../../src/core/climate'
import {initializeWorldSimulation} from '../../src/core/world-simulation'
import {initializeSettlement} from '../../src/core/settlements'

const out=process.argv[2]??'test-results/complete-art-legacy-browser-v302';mkdirSync(out,{recursive:true})
// Pass a local finite v301 fixture; full debug worlds are not published with source.
const input=process.argv[3];if(!input)throw Error('Specify the local v301 originalMaterialsFixture JSON as the third argument')
const raw=readFileSync(input,'utf8'),{db}=loadDb(),w:World={db,s:deserialize(raw)},old=JSON.parse(raw)
assert.equal(applyContentTransition(w),null);initializeClimate(w);initializeWorldSimulation(w);initializeSettlement(w);initializeFieldDevices(w);updatePlayerVision(w,player(w))
assert.equal(w.s.achievementsDisabled,true);assert.equal(w.s.contentChanges?.length,(old.contentChanges?.length??0)+1)
const strip=(s:Record<string,unknown>)=>{const copy=JSON.parse(JSON.stringify(s));for(const key of ['loadHash','contentChanges','achievementsDisabled'])delete copy[key];for(const mod of copy.contentMods)delete mod.hash;return copy}
assert.deepEqual(strip(JSON.parse(serialize(w.s))),strip(old))
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
let phases=0
const check=async(name:string)=>{await page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0});w.s.fx=[];const actual=await page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s))),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,name+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,name+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++}
try{
 await page.goto(server.url);await page.evaluate(s=>localStorage.setItem('ashveil.imprint.v1',s),raw);await page.reload();await page.getByTestId('continue').click();await page.getByTestId('content-change-review').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('ashveil.imprint.v1')),raw)
 await page.screenshot({path:join(out,'1610-actual-v301-content-change-review.png')});await page.getByTestId('content-change-accept').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check('actual-reviewed-v301-transition')
 await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor();await page.screenshot({path:join(out,'1611-same-v301-original-stacks-with-new-ui.png')});await page.keyboard.press('Escape')
 const at=w.s.time;assert.equal(playerAct(w,{type:'wait'}),null);await page.keyboard.press('Period');await check('one-real-wait-after-v301-review');assert.equal(w.s.time-at,100)
 await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check('actual-v302-save-restored');await page.screenshot({path:join(out,'1612-restored-reviewed-v301-world.png')});assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({oldSource:'Exact finite originalMaterialsFixture from immutable v302-art-before, main301 3f2622418b606bcb33a1adc76956c60b114360af',save:204,phases,screenshots:3,roundtrips:1,actualInputTU:100,allOriginalWorldFieldsExactBeforeRealInputExceptContentTracking:true,reviewLeavesStoredOldBytesUntouched:true,existingContentPolicy:'Existing generic content-change confirmation records the new hash and disables achievements. This art batch does not change that policy.',errors},null,2));console.log(JSON.stringify({phases,screenshots:3,roundtrips:1,actualInputTU:100,errors}))
}finally{await page.close();await browser.close();server.stop()}
