/** Actual old-imprint review/cancel/accept, then exact current Core transition and a real wait. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {loadDb} from './loadContent'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {applyContentTransition} from '../src/core/content-transition'
import {initializeScriptState,initializeClimate,initializeWorldSimulation,initializeSettlement,initializeFieldDevices,updatePlayerVision,player,type World,playerAct} from '../src/core'
import {startNativePreview} from './native-preview'
const out=process.argv[2],source=process.argv[3];if(!out||!source)throw Error('out old-save.json required');mkdirSync(out,{recursive:true});const raw=readFileSync(source,'utf8'),{db}=loadDb(),w={db,s:deserialize(raw)},original=structuredClone(w.s)
assert.notEqual(w.s.loadHash,db.loadHash);assert.equal(applyContentTransition(w),null);initializeScriptState(w);initializeClimate(w);initializeWorldSimulation(w);initializeSettlement(w);initializeFieldDevices(w);updatePlayerVision(w,player(w))
function physical(state:World['s']){const copy=JSON.parse(serialize(state));for(const key of ['loadHash','gameVersion','defSchemaVersion','contentMods','contentDefinitions','contentItemShapes','contentRecipeContracts','mods','contentChanges','achievementsDisabled'])delete copy[key];return copy}
assert.deepEqual(physical(w.s),physical(original),'content transition must preserve all physical state')
if(process.argv.includes('--preflight')){console.log(JSON.stringify({oldLoadHash:original.loadHash,currentLoadHash:db.loadHash,allPhysicalStateExact:true}));process.exit(0)}
const server=await startNativePreview(4391),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1366,height:768}}),errors:string[]=[],pairs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
type Hook={__ashveil:{world():World}}
async function compare(label:string){await page.waitForFunction(()=>!(window as unknown as Hook).__ashveil.world().s.simulationPending);w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);assert.equal(stateHash(actual),stateHash(w.s));pairs.push({label,hash:stateHash(actual)});writeFileSync(join(out,label+'-actual.json'),serialize(actual))}
try{
 await page.goto(server.url);await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false}))},raw);await page.reload();await page.getByTestId('continue').click();await page.getByTestId('content-change-review').waitFor();await page.screenshot({path:join(out,'review.png')});assert.ok((await page.getByTestId('content-change-review').innerText()).includes('기존 세계는 새로 만들지 않는다'))
 await page.getByTestId('content-change-cancel').click();assert.equal(await page.getByTestId('map').count(),0);await page.getByTestId('continue').click();await page.getByTestId('content-change-accept').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await compare('accepted');assert.equal(w.s.time,original.time);assert.equal(w.s.nextId,original.nextId);assert.equal(w.s.achievementsDisabled,true)
 await page.keyboard.press('Period');assert.equal(playerAct(w,{type:'wait'}),null);await compare('one-real-turn');await page.screenshot({path:join(out,'loaded.png')});assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({oldVersion:original.version,currentVersion:w.s.version,oldLoadHash:original.loadHash,currentLoadHash:db.loadHash,cancelStayedAtTitle:true,originalActors:original.creatures.map(c=>c.id),originalUidAllocationPreservedOnLoad:true,allOtherPhysicalStateExactAtLoad:true,actualInputs:true,pairs,errors},null,2)+'\n');console.log(JSON.stringify({pairs:pairs.length,errors}))
}catch(e){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());throw e}finally{await browser.close();server.stop()}
