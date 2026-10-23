/** Finite initial medical supplies/body. All consultations use actual UI after title load. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {baseFixture} from '../tests/base-camp-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {addWound} from '../src/core/body'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize} from '../src/core/save'
import type {World} from '../src/core/ctx'
import {startNativePreview} from './native-preview'
type Hook={__ashveil:{world():World}}
const out=process.argv[2]??'test-results/autonomy-v326/native';mkdirSync(out,{recursive:true})
function fixture(){
 const {w,s,p,worker}=baseFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.depth=3;s.map.name='동료 진찰·투약 유한 초기 방';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[]
 for(const t of s.map.tiles)if(!t.placed)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0})
 worker.skills.medicine=50
 const drug=makeItem(w,'Item.BitterMoss',2);assert.equal(addToBag(w,worker,drug),0)
 const wound=addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:30,source:'선언한 초기 외부 상처'}).wound
 invalidateLights(w);updatePlayerVision(w,p)
 return{initial:serialize(s),provider:worker.id,drug:drug.uid,wound:wound.id}
}
const server=await startNativePreview(4359),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function idle(){await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
async function care(id:number){await page.keyboard.press('Shift+N');await page.locator(`[data-person-id="${id}"]`).click();await page.getByTestId('companion-panel').locator(':scope > summary').click();await page.getByTestId('companion-care-panel').locator(':scope > summary').click();await page.getByTestId('companion-clinical-panel').locator(':scope > summary').click()}
try{
 await page.goto(server.url)
 for(const[width,height]of[[1440,1080],[1366,768]]){
  const f=fixture(),prefix='consult-'+width;writeFileSync(join(out,prefix+'-initial.json'),f.initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false,mapZoom:3}))},f.initial)
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!!(window as unknown as Hook).__ashveil?.world());const before=await read(),initialMoney=before.creatures.filter(c=>c.id===f.provider||c.id===before.playerId).map(c=>c.money)
  await care(f.provider);await page.getByTestId('companion-clinical-diagnose').click();await page.getByTestId('companion-clinical-confirm').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-diagnose-review.png')});await page.getByTestId('companion-clinical-confirm').click();await idle()
  const examined=await read(),p=examined.creatures.find(c=>c.id===examined.playerId)!;assert.equal(p.medicalReports?.at(-1)?.examinerId,f.provider);assert.ok(examined.time>before.time);writeFileSync(join(out,prefix+'-examined.json'),JSON.stringify(examined))
  // A completed action refreshes the people UI; reopen via actual inputs.
  await page.keyboard.press('Escape');await care(f.provider);const topical=page.locator(`[data-clinical-topical="${f.wound}-${f.drug}"]`);await topical.click();await page.getByTestId('companion-clinical-confirm').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-dose-review.png')});await page.getByTestId('companion-clinical-confirm').click();await idle()
  const end=await read(),patient=end.creatures.find(c=>c.id===end.playerId)!,provider=end.creatures.find(c=>c.id===f.provider)!;assert.equal(provider.bag.find(i=>i.uid===f.drug)?.count,1);assert.equal(patient.body.wounds.find(w=>w.id===f.wound)?.topicalDrug?.def,'Drug.BitterMoss');assert.deepEqual(end.creatures.filter(c=>c.id===f.provider||c.id===end.playerId).map(c=>c.money),initialMoney)
  await page.keyboard.press('Escape');await care(f.provider);await page.getByTestId('companion-clinical-report').locator(':scope > summary').click();await page.getByTestId('companion-clinical-report').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-report.png')});writeFileSync(join(out,prefix+'-final.json'),JSON.stringify(end));runs.push({width,height,beforeTU:before.time,afterTU:end.time,examiner:f.provider,originalDrug:f.drug,remainingDoses:1,report:patient.medicalReports?.at(-1),errors:[]});await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Two explicit diagnosis/topical dose UI runs. Initial supplies and wound are declared; not full regression or every drug/body permutation.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* title may not be loaded */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
