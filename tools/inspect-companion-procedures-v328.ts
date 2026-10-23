/** Finite initial team/wounds/tools; real patient selection, diagnosis, suture and consent review. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {baseFixture,finishBase} from '../tests/base-camp-fixture'
import {createCreature} from '../src/core/creatures'
import {enlistRecruit} from '../src/core/companions'
import {addToBag,makeItem} from '../src/core/items'
import {addWound} from '../src/core/body'
import {startTreatment} from '../src/core/treatment'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize} from '../src/core/save'
import type {World} from '../src/core/ctx'
import {startNativePreview} from './native-preview'
type Hook={__ashveil:{world():World}}
const out=process.argv[2]??'test-results/autonomy-v328/native';mkdirSync(out,{recursive:true})
function fixture(ally:boolean){
 const {w,s,p,worker}=baseFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.depth=3;s.map.name='동료 환자·외과 처치 유한 초기 방';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[]
 for(const t of s.map.tiles)if(!t.placed)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0})
 worker.skills.medicine=50
 const thread=makeItem(w,'Item.Thread',3),needle=makeItem(w,'Item.Needle'),knife=makeItem(w,'Item.RustyKnife');for(const it of[thread,needle,knife])assert.equal(addToBag(w,worker,it),0)
 let patient=p
 if(ally){patient=createCreature(w,'Creature.SettlementGuard',{x:19,y:21});patient.name='돌봄을 기다리는 동료';patient.faction='coalition';patient.body.wounds=[];patient.body.missing=[];patient.bag=[];patient.equip={};patient.effects=[];patient.traumas=[];patient.asleep=false;patient.unconscious=false;patient.activity=undefined;s.creatures.push(patient);enlistRecruit(w,patient,1);patient.companion!.order='hold';patient.companion!.anchor={...patient.pos}}
 const wound=addWound(w,patient,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:0,source:'선언한 초기 외부 상처'}).wound
 if(!ally){const tq=makeItem(w,'Item.Tourniquet');assert.equal(addToBag(w,p,tq),0);assert.ok(startTreatment(w,p,tq.uid,undefined,'LeftUpperArm').ok);finishBase(w,p)}
 invalidateLights(w);updatePlayerVision(w,p)
 return{initial:serialize(s),provider:worker.id,patient:patient.id,thread:thread.uid,needle:needle.uid,wound:wound.id}
}
const server=await startNativePreview(4361),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function idle(){await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
async function care(provider:number,patient:number,ally:boolean){await page.keyboard.press('Shift+N');await page.locator(`[data-person-id="${provider}"]`).click();await page.getByTestId('companion-panel').locator(':scope > summary').click();await page.getByTestId('companion-care-panel').locator(':scope > summary').click();await page.getByTestId('companion-clinical-panel').locator(':scope > summary').click();if(ally)await page.getByTestId('companion-clinical-patient').selectOption(String(patient))}
async function finishAlly(ally:boolean){await idle();if(ally){await page.keyboard.press('Escape');await page.keyboard.press('r');await idle()}}
try{
 await page.goto(server.url)
 for(const[ally,width,height]of[[false,1440,1080],[true,1440,1080],[true,1366,768]]as const){
  const f=fixture(ally),prefix=(ally?'ally':'self')+'-'+width;writeFileSync(join(out,prefix+'-initial.json'),f.initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false,mapZoom:3}))},f.initial)
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');const before=await read()
  await care(f.provider,f.patient,ally)
  if(ally){await page.getByTestId('companion-clinical-diagnose').click();await page.getByTestId('companion-clinical-confirm').click();await idle();const partial=await read();assert.equal(partial.creatures.find(c=>c.id===partial.playerId)!.activity,undefined);assert.equal(partial.creatures.find(c=>c.id===f.patient)!.activity?.kind,'careWait');writeFileSync(join(out,prefix+'-diagnose-partial.json'),JSON.stringify(partial));if(width===1440){await page.keyboard.press('Escape');await care(f.provider,f.patient,true);await page.getByTestId('companion-clinical-cancel').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-cancel-review.png')});await page.getByTestId('companion-clinical-cancel').click();await idle();const cancelled=await read();assert.equal(cancelled.creatures.find(c=>c.id===f.provider)!.activity,undefined);assert.equal(cancelled.creatures.find(c=>c.id===f.patient)!.activity,undefined);assert.equal(cancelled.creatures.find(c=>c.id===f.patient)!.medicalReports,undefined);writeFileSync(join(out,prefix+'-cancelled.json'),JSON.stringify(cancelled));await page.keyboard.press('Escape');await care(f.provider,f.patient,true);await page.getByTestId('companion-clinical-diagnose').click();await page.getByTestId('companion-clinical-confirm').click();await idle()}
   await finishAlly(true);const diagnosed=await read();assert.equal(diagnosed.creatures.find(c=>c.id===f.patient)!.medicalReports?.at(-1)?.examinerId,f.provider);assert.equal(diagnosed.creatures.find(c=>c.id===diagnosed.playerId)!.medicalReports,undefined);await care(f.provider,f.patient,true)}
  await page.getByTestId('companion-clinical-procedures').locator(':scope > summary').click();await page.locator(`[data-clinical-procedure="suture-${f.wound}"]`).click();await page.getByTestId('companion-clinical-confirm').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-suture-review.png')});await page.getByTestId('companion-clinical-confirm').click();await finishAlly(ally)
  const end=await read(),patient=end.creatures.find(c=>c.id===f.patient)!,provider=end.creatures.find(c=>c.id===f.provider)!;assert.ok(patient.body.wounds.find(w=>w.id===f.wound)?.suture);assert.equal(provider.bag.find(i=>i.uid===f.thread)?.count,2);assert.ok(provider.bag.some(i=>i.uid===f.needle));if(ally)assert.equal(end.creatures.find(c=>c.id===end.playerId)!.body.wounds.length,0);writeFileSync(join(out,prefix+'-final.json'),JSON.stringify(end))
  if(!ally){await page.keyboard.press('Escape');await care(f.provider,f.patient,false);await page.getByTestId('companion-clinical-procedures').locator(':scope > summary').click();await page.getByRole('button',{name:'절단 상담 펼치기',exact:true}).click();await page.locator('[data-clinical-amputate="LeftHand"]').click();const confirm=page.getByTestId('companion-clinical-confirm');assert.equal(await confirm.isDisabled(),true);await page.getByTestId('companion-clinical-permanent-consent').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-permanent-review.png')});await page.getByTestId('companion-clinical-permanent-consent').check();assert.equal(await confirm.isEnabled(),true);await page.getByTestId('companion-clinical-quote').getByRole('button',{name:'취소',exact:true}).click();assert.ok(!(await read()).creatures.find(c=>c.id===f.patient)!.body.missing.includes('LeftHand'))}
  else{await care(f.provider,f.patient,true);await page.getByTestId('companion-clinical-report').locator(':scope > summary').click();await page.getByTestId('companion-clinical-report').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-report.png')})}
  runs.push({ally,width,height,beforeTU:before.time,afterTU:end.time,patient:f.patient,provider:f.provider,thread:f.thread,needle:f.needle,remainingThread:2,suture:true,reportOwnedByPatient:ally,interruptedAllyDiagnosis:ally&&width===1440,permanentConsentReviewOnly:!ally,errors:[]});await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Three actual patient selection/suture runs, two ally diagnoses, one explicit interrupted ally diagnosis and one cancelled permanent-loss review. Initial wounds/tools and self tourniquet are declared; not every surgical procedure or natural occurrence.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* title may not be loaded */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
