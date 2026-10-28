/** Finite initial wounds/medicine/placed bedding; after Title, actual keyboard/pointer only. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {carePlanFixture} from '../tests/companion-care-plan-fixture'
import {companionCarePlanQuote} from '../src/core/companion-care-plan'
import {playerAct} from '../src/core/game'
import {tileAt,type World} from '../src/core/ctx'
import {addToBag,makeItem} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {Action} from '../src/core/actions'
import {startNativePreview} from './native-preview'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type Hook={__ashveil:{world():World};render_game_presentation():NonNullable<ReturnType<MapRenderer['presentation']>>}
const out=process.argv[2]??'test-results/autonomy-v387/native-r1';mkdirSync(out,{recursive:true})
const props=['FieldMat','Bedroll','StrawBed','Bed','GoodBed','MedicalBag']
function fixture(){
 const f=carePlanFixture();f.worker.pos={x:19,y:20};const medicalBag=makeItem(f.w,'Item.MedicalBag');assert.equal(addToBag(f.w,f.worker,medicalBag),0)
 const beds=props.slice(0,5).map((id,i)=>{const item=makeItem(f.w,'Item.'+id),pos=i===3?{...f.p.pos}:{x:18+i,y:18},tile=tileAt(f.w,pos);tile.placed={base:tile.t,item};tile.t=f.w.db.item(item.def).place!;return{pos,uid:item.uid,def:item.def}})
 const icons=props.map(id=>makeItem(f.w,'Item.'+id));for(const item of icons.sort((a,b)=>{const x=f.w.db.item(a.def).size!,y=f.w.db.item(b.def).size!;return y[0]*y[1]-x[0]*x[1]}))assert.equal(addToBag(f.w,f.p,item),0)
 const requests=[{...f.requests[1]!,afterTurns:20},{...f.requests[1]!,afterTurns:20},{...f.requests[3]!,afterTurns:0}];invalidateLights(f.w);updatePlayerVision(f.w,f.p)
 return{...f,beds,icons,requests,medicalBag}
}
if(process.argv.includes('--preflight')){
 const f=fixture(),q=companionCarePlanQuote(f.w,f.worker,f.requests);assert.equal(q.error,null);assert.equal(playerAct(f.w,{type:'companionCarePlan',target:f.worker.id,requests:f.requests,expected:q.signature}),null)
 const rows=[];for(let n=0;n<2;n++){assert.equal(playerAct(f.w,{type:'rest',turns:200}),null);rows.push({time:f.s.time,plan:structuredClone(f.worker.companion!.carePlan),remaining:f.worker.bag.find(i=>i.uid===f.drug.uid)?.count??0})}
 console.log(JSON.stringify({icons:f.icons.length,beds:f.beds,rows}));process.exit(0)
}
const server=await startNativePreview(4397),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:unknown[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function idle(){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil?.world();return !!w&&!w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
async function compare(w:World,phase:string){await idle();w.s.fx.length=0;const s=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(s));assert.deepEqual(JSON.parse(serialize(s)),JSON.parse(serialize(w.s)),phase);assert.equal(stateHash(s),stateHash(w.s));pairs.push({phase,hash:stateHash(s)})}
async function input(w:World,key:string,a:Action){await page.keyboard.press(key);assert.equal(playerAct(w,a),null);await idle()}
async function care(id:number){await page.keyboard.press('Shift+N');await page.locator(`[data-person-id="${id}"]`).click();await page.getByTestId('companion-panel').locator(':scope > summary').click();await page.getByTestId('companion-care-panel').locator(':scope > summary').click();await page.getByTestId('companion-clinical-panel').locator(':scope > summary').click()}
async function close(){await page.keyboard.press('Escape')}
async function saveContinue(w:World,phase:string){await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,phase)}
async function load(f:ReturnType<typeof fixture>,width:number,height:number){const initial=serialize(f.s);writeFileSync(join(out,'initial-'+width+'.json'),initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},initial);await page.reload();await page.getByTestId('continue').click();await idle();return{db:f.w.db,s:deserialize(initial)}}
async function draft(f:ReturnType<typeof fixture>){await care(f.worker.id);for(let i=0;i<2;i++){await page.locator(`[data-clinical-topical="${f.wound.id}-${f.drug.uid}"]`).click();await page.getByTestId('companion-care-plan-add').click();await page.locator(`[data-care-delay="${i}"]`).selectOption('20')}await page.getByTestId('companion-clinical-procedures').locator(':scope > summary').click();await page.locator(`[data-clinical-procedure="bandage-${f.wound.id}"]`).click();await page.getByTestId('companion-care-plan-add').click();await page.getByTestId('companion-care-plan-draft').locator('details').nth(1).locator(':scope > summary').click()}
try{
 await page.goto(server.url)
 for(const[width,height]of[[1440,1080],[1366,768]]){
  const f=fixture(),w=await load(f,width,height),doctor=w.s.creatures.find(c=>c.id===f.worker.id)!,prefix='schedule-'+width;await compare(w,prefix+'-loaded');await draft(f);await page.getByTestId('companion-care-plan-start').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-review.png')});await compare(w,prefix+'-readonly-review')
  const q=companionCarePlanQuote(w,doctor,f.requests);assert.equal(q.error,null);await page.getByTestId('companion-care-plan-start').click();assert.equal(playerAct(w,{type:'companionCarePlan',target:doctor.id,requests:f.requests,expected:q.signature}),null);await compare(w,prefix+'-booked');assert.equal(doctor.companion!.carePlan!.status,'waiting');assert.equal(doctor.bag.find(i=>i.uid===f.drug.uid)!.count,2);await close();await saveContinue(w,prefix+'-waiting-continued')
  await page.getByTestId('care-schedule-chip').click();await page.getByTestId('care-plan-overview').waitFor();await page.screenshot({path:join(out,prefix+'-journal.png')});await compare(w,prefix+'-journal-readonly');await close()
  // The approved care interrupts a real 200-turn rest at the due time, rather than waiting200 turns.
  await input(w,'r',{type:'rest',turns:200});await compare(w,prefix+'-first-dose');assert.equal(doctor.companion!.carePlan!.cursor,1);assert.equal(doctor.companion!.carePlan!.status,'waiting');assert.equal(doctor.bag.find(i=>i.uid===f.drug.uid)!.count,1);await page.screenshot({path:join(out,prefix+'-beds-and-waiting.png')})
  if(width===1440){
   await page.keyboard.press('r');assert.equal(playerAct(w,{type:'rest',turns:200}),null)
   await page.waitForFunction(id=>(window as unknown as Hook).render_game_presentation().medical.some(m=>m.actor===id&&m.tools.some(t=>t.sprite==='av386_medical_bag')),doctor.id)
   const pose=await page.evaluate(()=>(window as unknown as Hook).render_game_presentation());writeFileSync(join(out,prefix+'-medical-bag-pose.json'),JSON.stringify(pose));await page.screenshot({path:join(out,prefix+'-medical-bag-held.png')})
   await compare(w,prefix+'-complete');assert.equal(doctor.companion!.carePlan!.status,'complete');assert.equal(doctor.companion!.carePlan!.cursor,3);assert.equal(doctor.bag.some(i=>i.uid===f.drug.uid),false);assert.equal(doctor.bag.find(i=>i.uid===f.medicalBag.uid)?.uses,4)
  }
  else{await care(doctor.id);await page.getByTestId('companion-care-schedule-cancel').click();assert.equal(playerAct(w,{type:'cancelCompanionCarePlan',target:doctor.id,uid:doctor.companion!.carePlan!.uid}),null);await compare(w,prefix+'-cancelled');await page.getByTestId('companion-care-plan-status').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-cancelled.png')});await close();await input(w,'Period',{type:'wait'});assert.equal(doctor.bag.find(i=>i.uid===f.drug.uid)!.count,1)}
  await saveContinue(w,prefix+'-final-continued');await page.keyboard.press('i');for(const it of f.icons)await page.getByTestId('item-'+it.def).waitFor();await page.screenshot({path:join(out,prefix+'-care-props.png')});await compare(w,prefix+'-inventory-readonly');await close();runs.push({width,height,patient:f.p.id,doctor:doctor.id,beds:f.beds,icons:f.icons.map(i=>({uid:i.uid,def:i.def})),plan:doctor.companion!.carePlan,finalTU:w.s.time});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,afterTitle:'Actual keyboard/pointer; read-only debug only',animationSpeed:1,runs,pairs,errors,scope:'Two finite delayed-care scenes: true waiting, due-time rest interruption, dose source quantities, save while waiting, second dose or exact-plan cancellation, HUD and journal, five placed bedding views and six actual inventory icons. No Full/World/1000 or long-term balance claim.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,pairs:pairs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)))}catch{/* title may not be loaded */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
