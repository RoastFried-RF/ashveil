/** Declared initial wounds/supplies. After Title, use real input and read-only world observations. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {carePlanFixture} from '../tests/companion-care-plan-fixture'
import {companionCarePlanQuote} from '../src/core/companion-care-plan'
import {playerAct} from '../src/core/game'
import {addToBag,makeItem} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import type {Action} from '../src/core/actions'
import type {World} from '../src/core/ctx'
import {startNativePreview} from './native-preview'
type Hook={__ashveil:{world():World}}
const out=process.argv[2]??'test-results/autonomy-v385/native-r1';mkdirSync(out,{recursive:true})
const server=await startNativePreview(4393),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:unknown[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function idle(){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil?.world();return !!w&&!w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
async function compare(w:World,phase:string){await idle();w.s.fx.length=0;const s=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(s));assert.deepEqual(JSON.parse(serialize(s)),JSON.parse(serialize(w.s)),phase);assert.equal(stateHash(s),stateHash(w.s));pairs.push({phase,hash:stateHash(s)});return s}
async function load(initial:string,width:number,height:number){await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:2}))},initial);await page.reload();await page.getByTestId('continue').click();await idle()}
async function care(id:number){await page.keyboard.press('Shift+N');await page.locator(`[data-person-id="${id}"]`).click();await page.getByTestId('companion-panel').locator(':scope > summary').click();await page.getByTestId('companion-care-panel').locator(':scope > summary').click();await page.getByTestId('companion-clinical-panel').locator(':scope > summary').click()}
async function act(w:World,selector:string,a:Action){await page.locator(selector).click();assert.equal(playerAct(w,a),null);await idle()}
async function draft(f:ReturnType<typeof carePlanFixture>){
 await care(f.worker.id);await page.getByTestId('companion-clinical-diagnose').click();await page.getByTestId('companion-care-plan-add').click()
 await page.locator(`[data-clinical-topical="${f.wound.id}-${f.drug.uid}"]`).click();await page.getByTestId('companion-care-plan-add').click()
 await page.getByTestId('companion-clinical-procedures').locator(':scope > summary').click();await page.locator(`[data-clinical-procedure="suture-${f.wound.id}"]`).click();await page.getByTestId('companion-care-plan-add').click()
 await page.locator(`[data-clinical-procedure="bandage-${f.wound.id}"]`).click();await page.getByTestId('companion-care-plan-add').click()
}
try{
 await page.goto(server.url)
 for(const [width,height] of [[1440,1080],[1366,768]]){
  const f=carePlanFixture(),initial=serialize(f.s),w:World={db:f.w.db,s:deserialize(initial)},doctor=w.s.creatures.find(c=>c.id===f.worker.id)!,prefix='care-'+width
  writeFileSync(join(out,prefix+'-initial.json'),initial);await load(initial,width,height);await compare(w,prefix+'-loaded');await draft(f)
  await page.getByTestId('companion-care-plan-draft').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-draft.png')});await compare(w,prefix+'-review-readonly')
  const q=companionCarePlanQuote(w,doctor,f.requests);assert.equal(q.error,null)
  await act(w,'[data-testid=companion-care-plan-start]',{type:'companionCarePlan',target:doctor.id,requests:f.requests,expected:q.signature});await compare(w,prefix+'-complete')
  assert.equal(doctor.companion!.carePlan!.status,'complete');assert.equal(doctor.companion!.carePlan!.cursor,4)
  await page.keyboard.press('Escape');await care(doctor.id);await page.getByTestId('companion-care-plan-status').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-complete.png')})
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,prefix+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click();runs.push({width,height,patient:f.p.id,doctor:doctor.id,steps:4,initialTU:f.s.time,finalTU:w.s.time,originalUIDs:{drug:f.drug.uid,thread:f.thread.uid,needle:f.needle.uid,bandage:f.bandage.uid}})
 }
 // Independent finite inventory fixture; all six original items are inspected through the real inventory.
 const f=carePlanFixture(),ids=['PegLeg','ArticulatedLeg','HookHand','GlassEye','PioneerArm','GardenerLimb'];f.p.body.wounds=[];f.p.bag=[]
 const items=ids.map(id=>makeItem(f.w,'Item.'+id));for(const it of items)assert.equal(addToBag(f.w,f.p,it),0)
 const initial=serialize(f.s),w={db:f.w.db,s:deserialize(initial)};writeFileSync(join(out,'prosthetics-initial.json'),initial);await load(initial,1440,1080);await page.keyboard.press('i')
 const icons=[];for(const it of items){const node=page.getByTestId('item-'+it.def);await node.waitFor();assert.equal(await node.getAttribute('data-uid'),String(it.uid));icons.push({uid:it.uid,def:it.def,sprite:f.w.db.item(it.def).sprite,html:await node.innerHTML()})}
 await page.screenshot({path:join(out,'prosthetics-inventory.png')});writeFileSync(join(out,'prosthetic-icons.json'),JSON.stringify(icons,null,2));await compare(w,'prosthetics-readonly');await page.keyboard.press('Escape')
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,afterTitle:'real keyboard/pointer only; debug read-only',animationSpeed:1,runs,pairs,prosthetics:items.map(i=>({uid:i.uid,def:i.def})),errors,scope:'Two actual four-step self-patient sequences, unchanged review state, real saved continuation and six inventory icon bindings. Unit checks separately cover ally care, cancellation and future UID loss. No Full/World/long-run test.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,pairs:pairs.length,icons:icons.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)))}catch{/* title may not be loaded */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
