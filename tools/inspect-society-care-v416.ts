import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {chromium,type Page,type Locator} from 'playwright-core'
import {startNativePreview} from './native-preview'
import {carePlanFixture} from '../tests/companion-care-plan-fixture'
import {retirementFixture} from '../tests/retirement-fixture'
import {companionRecoveryFixture} from '../tests/companion-recovery-fixture'
import {companionCarePlanQuote} from '../src/core/companion-care-plan'
import {companionClinicalQuote} from '../src/core/companion-clinical'
import {clinicQuote} from '../src/core/clinic'
import {tradeQuote,marketFor,nearbyPeople} from '../src/core/economy'
import {companionRecoveryQuote} from '../src/core/companion-recovery'
import {translateDef} from '../src/client/locales/content'
import {createCreature} from '../src/core/creatures'
import {addToBag,makeItem} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {playerAct} from '../src/core/game'
import {player,terrainAt,type World} from '../src/core/ctx'
import {deserialize,serialize,stateHash} from '../src/core/save'
import type {Action} from '../src/core/actions'
import type {CompanionCarePlanRequest} from '../src/core/companion-care-plan'

const out=process.argv[2],selected=process.argv[3]??'all',size=process.argv[4],scenes=['trade','clinic','care','schedule','recovery']as const
type Scene=typeof scenes[number]
type Hook={__ashveil:{world():World}}
assert.ok(out&&!existsSync(out),'Choose a new output directory')
assert.ok(selected==='all'||scenes.some(s=>s===selected));assert.ok(!size||['1440','1366','390'].includes(size))
mkdirSync(out,{recursive:true})
const pairs:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],images:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
function medicalFixture(ally=false){
 const f=carePlanFixture(ally),bag=makeItem(f.w,'Item.MedicalBag')
 assert.equal(addToBag(f.w,f.worker,bag),0);return{...f,bag}
}
function clinicFixture(){
 const f=carePlanFixture(),doctor=createCreature(f.w,'Creature.SettlementDoctor',{x:19,y:20})
 f.s.creatures=[f.p,doctor];doctor.faction='coalition';doctor.ai.mode='calm';doctor.home={...doctor.pos};doctor.age=undefined;doctor.traits=['Trait.Neat'];doctor.background=undefined;doctor.effects=[];doctor.traumas=[];doctor.body.wounds=[];doctor.body.missing=[];doctor.body.blood=doctor.body.bloodMax;doctor.equip={};doctor.bag=[];doctor.skills={medicine:50};doctor.stats={str:10,agi:10,per:13,vit:10,wil:10};doctor.nextAct=f.s.time;doctor.activity=undefined;doctor.asleep=false;doctor.unconscious=false;doctor.money=0
 Object.assign(doctor.needs,{kcal:1000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37,hygiene:100,stress:0})
 f.p.money=5000
 const supplies=['Item.MedicalBag','Item.Needle','Item.Thread','Item.BitterMoss','Item.PoppyTincture'].map(id=>makeItem(f.w,id,id==='Item.Thread'?3:id==='Item.BitterMoss'?2:1))
 for(const item of supplies)assert.equal(addToBag(f.w,doctor,item),0)
 invalidateLights(f.w);updatePlayerVision(f.w,f.p)
 assert.equal(terrainAt(f.w,doctor.pos).passable,true,'declared doctor arrival must be passable')
 assert.ok(nearbyPeople(f.w).includes(doctor),'declared doctor must be a nonhostile nearby person')
 assert.equal(clinicQuote(f.w,f.p,doctor,{kind:'diagnose'}).error,null,'declared initial consultation must be valid')
 return{...f,doctor,supplies}
}
function tradeFixture(){
 const f=retirementFixture(),stock=makeItem(f.w,'Item.TetanusSerum'),own=makeItem(f.w,'Item.TetanusSerum')
 stock.appraisal=0;own.appraisal=0;f.market.items.push(stock);assert.equal(addToBag(f.w,f.p,own),0)
 return{...f,stock,own}
}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const scene of selected==='all'?scenes:[selected as Scene])for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([v])=>!size||String(v)===size)){
  const f=scene==='trade'?tradeFixture():scene==='clinic'?clinicFixture():scene==='recovery'?companionRecoveryFixture():medicalFixture(scene==='care'),initialWorld=f.w
  initialWorld.s.saveMode='SaveMode.Study';initialWorld.s.achievementsDisabled=true;initialWorld.s.fx=[]
  const raw=serialize(initialWorld.s);assert.equal(serialize(deserialize(raw)),raw)
  const w:World={db:initialWorld.db,s:deserialize(raw)},prefix=scene+'-'+width,names=w.s.creatures.map(c=>c.name)
  writeFileSync(join(out,prefix+'-initial-world.json'),raw)
  proofs.push({scene,width,height,finiteExistingFixture:true,fixture:scene==='trade'?'retirementFixture + declared two unappraised serum items':scene==='clinic'?'carePlanFixture room + declared actual settlement doctor on passable adjacent floor, calm nonhostile AI and finite supplies; no world-society relationship exists in this room':scene==='recovery'?'companionRecoveryFixture ready: actual original contract/guard/item':'carePlanFixture + declared one medical bag',studyMode:true,originalPeople:w.s.creatures.map(c=>({id:c.id,name:c.name})),noPriorNaturalAcquisitionOrTravelClaim:true,noPostTitleWorldWrites:true})
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
  const person=scene==='trade'?(f as ReturnType<typeof tradeFixture>).keeper.id:scene==='clinic'?(f as ReturnType<typeof clinicFixture>).doctor.id:scene==='recovery'?(f as ReturnType<typeof companionRecoveryFixture>).guard.id:(f as ReturnType<typeof medicalFixture>).worker.id
  const actor=()=>w.s.creatures.find(c=>c.id===person)!
  async function close(){for(let n=0;n<8&&await page.locator('[data-testid^="win-"]:visible').count();n++)await page.keyboard.press('Escape')}
  async function society(){await close();await page.keyboard.press('Shift+n');await page.locator('[data-person-id="'+person+'"]').click()}
  async function care(){await society();for(const id of ['companion-panel','companion-care-panel','companion-clinical-panel']){const panel=page.getByTestId(id);if(await panel.getAttribute('open')===null)await panel.locator(':scope > summary').click()}}
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
   await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s))
   assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(stateHash(actual),stateHash(w.s));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow')
   pairs.push({scene,width,height,label,time:actual.time,hash:stateHash(actual)})
  }
  async function picture(label:string,locator:Locator){await locator.scrollIntoViewIfNeeded();await page.mouse.move(100,40);const file=prefix+'-'+label+'.png';await page.screenshot({path:join(out,file)});images.push(file)}
  async function english(locator:Locator,preserved:string[]=[]){
   let text=await locator.innerText();for(const value of [...names,...preserved].filter(Boolean))text=text.split(value).join('')
   assert.doesNotMatch(text,/[가-힣]/,prefix+' English display')
   const attrs=await locator.locator('[aria-label],[title],[placeholder]').evaluateAll(es=>es.flatMap(e=>['aria-label','title','placeholder'].map(k=>e.getAttribute(k)??'')))
   let attr=attrs.join('\n');for(const value of names)attr=attr.split(value).join('')
   assert.doesNotMatch(attr,/[가-힣]/,prefix+' English attributes')
   assert.equal(await locator.evaluate(e=>e.scrollWidth>e.clientWidth+1),false,prefix+' internal overflow')
  }
  async function action(a:Action,input:()=>Promise<unknown>,label:string){assert.equal(playerAct(w,a),null);await input();await compare(label)}
  async function saveContinue(label:string){
   await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare(label+'-saved');await close()
   await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare(label+'-continued')
  }
  await page.goto(server.url)
  await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},raw)
  await page.reload();await page.getByTestId('continue').click();await compare('loaded')
  await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption('en');await close();await compare('language-readonly')
  if(scene==='trade'){
   const d=f as ReturnType<typeof tradeFixture>,market=marketFor(w,actor())!,unknownDef=w.db.item(d.stock.def)
   await society()
   for(const[id,uid]of[['trade-stock',d.stock.uid],['trade-bag',d.own.uid]]as const){
    const row=page.getByTestId(id).locator('[data-trade-uid="'+uid+'"]'),labels=await row.locator('button').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')))
    const known=translateDef(unknownDef,'label','en'),unknown=translateDef(unknownDef,'unknownLabel','en');assert.notEqual(known,unknown)
    assert.ok(labels.every(s=>s&&s.includes(unknown)&&!s.includes(known)&&!s.includes(unknownDef.label)),'all actual adjustment aria names must retain the unknown label and exclude both identified source and English names')
    await row.locator('button').last().click();await row.locator('button').first().click();await english(row)
   }
   const item=market.items.find(i=>i.count>=1&&!w.db.item(i.def).relic&&!tradeQuote(w,player(w),actor(),[{uid:i.uid,count:1}],[]).error);assert.ok(item,'actual purchasable original stock')
   const row=page.getByTestId('trade-stock').locator('[data-trade-uid="'+item.uid+'"]')
   await row.locator('button').last().click();await english(page.getByTestId('trade-total'));await compare('original-buy-review-readonly');await picture('trade-review',page.getByTestId('trade-total'))
   const q=tradeQuote(w,player(w),actor(),[{uid:item.uid,count:1}],[]),money=player(w).money!
   await action({type:'trade',target:person,buy:[{uid:item.uid,count:1}],sell:[],expectedBalance:q.balance},()=>page.getByTestId('trade-confirm').click(),'actual-buy')
   assert.equal(player(w).money,money-q.balance)
   await society();await action({type:'talk',target:person},()=>page.getByTestId('talk-person').click(),'actual-conversation')
   await society();await page.getByRole('button',{name:'Factions & news',exact:true}).click()
   await compare('heard-relations-readonly');await picture('heard-relations',page.getByTestId('win-society'))
   await saveContinue('original-trade-and-heard-memory')
  }else if(scene==='clinic'){
   const d=f as ReturnType<typeof clinicFixture>,doctor=actor(),patient=player(w),dose=doctor.bag.find(i=>i.def==='Item.BitterMoss')!,money=patient.money!
   await society();await page.getByTestId('clinic-diagnose').click();await english(page.getByTestId('clinic-panel'));await compare('paid-examination-review-readonly');await picture('examination-review',page.getByTestId('clinic-quote'))
   const request={kind:'diagnose'}as const,q=clinicQuote(w,patient,doctor,request)
   assert.equal(q.error,null);await action({type:'clinic',target:person,request,expectedFee:q.fee},()=>page.getByTestId('clinic-confirm').click(),'actual-paid-examination')
   assert.equal(patient.money,money-q.fee);assert.equal(patient.medicalReports?.at(-1)?.examinerId,person)
   await society();await page.getByTestId('clinic-topical-'+d.wound.id+'-'+dose.def).click();await english(page.getByTestId('clinic-quote'));await compare('original-topical-review-readonly');await picture('topical-review',page.getByTestId('clinic-quote'))
   const r={kind:'dose',uid:dose.uid,woundId:d.wound.id}as const,dq=clinicQuote(w,patient,doctor,r)
   assert.equal(dq.error,null);await action({type:'clinic',target:person,request:r,expectedFee:dq.fee},()=>page.getByTestId('clinic-confirm').click(),'actual-paid-topical')
   assert.equal(dose.count,1);assert.equal(patient.body.wounds.find(b=>b.id===d.wound.id)?.topicalDrug?.def,'Drug.BitterMoss')
   await saveContinue('same-patient-money-and-original-dose')
  }else if(scene==='care'||scene==='schedule'){
   const d=f as ReturnType<typeof medicalFixture>,doctor=actor(),patient=w.s.creatures.find(c=>c.id===d.patient.id)!
   await care()
   if(scene==='care'){
    await page.getByTestId('companion-clinical-patient').selectOption(String(patient.id))
    const r={kind:'diagnose',patient:patient.id,permanentLossAccepted:false}as const,q=companionClinicalQuote(w,doctor,r)
    assert.equal(q.error,null);await page.getByTestId('companion-clinical-diagnose').click();await english(page.getByTestId('companion-clinical-quote'));await compare('chosen-patient-examination-review-readonly')
    await action({type:'companionClinical',target:person,request:{...r,permanentLossAccepted:false},expected:q.signature},()=>page.getByTestId('companion-clinical-confirm').click(),'actual-ally-examination-start')
    await close();for(let n=0;doctor.activity&&n<80;n++)await action({type:'wait'},()=>page.keyboard.press('Period'),'examination-wait-'+n)
    assert.equal(patient.medicalReports?.at(-1)?.examinerId,person)
    await care();await page.getByTestId('companion-clinical-patient').selectOption(String(patient.id))
   }
   const requests:CompanionCarePlanRequest[]=scene==='care'?d.requests.map(r=>({...r,afterTurns:0})):[{...d.requests[1]!,afterTurns:20},{...d.requests[1]!,afterTurns:20},{...d.requests[3]!,afterTurns:0}]
   for(const request of requests){
    if(request.kind==='diagnose')await page.getByTestId('companion-clinical-diagnose').click()
    else if(request.kind==='dose')await page.locator('[data-clinical-topical="'+request.woundId+'-'+request.uid+'"]').click()
    else{const panel=page.getByTestId('companion-clinical-procedures');if(await panel.getAttribute('open')===null)await panel.locator(':scope > summary').click();await page.locator('[data-clinical-procedure="'+request.kind+'-'+request.woundId+'"]').click()}
    await page.getByTestId('companion-care-plan-add').click()
    const index=requests.indexOf(request);if(request.afterTurns)await page.locator('[data-care-delay="'+index+'"]').selectOption(String(request.afterTurns))
   }
   // Reordering and undoing it is a real draft edit, with no world action.
   await page.getByRole('button',{name:'Move step 2 up',exact:true}).click();await page.getByRole('button',{name:'Move step 1 down',exact:true}).click()
   const draft=page.getByTestId('companion-care-plan-draft');await draft.locator('details').first().locator(':scope > summary').click()
   await english(draft);await compare('sequence-and-bindings-review-readonly');await picture('sequence-review',draft)
   const q=companionCarePlanQuote(w,doctor,requests);assert.equal(q.error,null)
   await action({type:'companionCarePlan',target:person,requests,expected:q.signature},()=>page.getByTestId('companion-care-plan-start').click(),'actual-sequence-assigned')
   if(scene==='schedule'){
    assert.equal(doctor.companion!.carePlan!.status,'waiting');await saveContinue('waiting-original-plan');await close();await page.getByTestId('care-schedule-chip').click()
    await english(page.getByTestId('care-plan-overview'));await compare('scheduled-journal-readonly');await picture('scheduled-journal',page.getByTestId('care-plan-overview'))
    await page.getByRole('button',{name:'View companion care',exact:true}).click();await page.getByTestId('win-society').waitFor();await compare('overview-open-original-doctor-readonly');await close()
    await action({type:'rest',turns:200},()=>page.keyboard.press('r'),'actual-first-scheduled-dose')
    assert.equal(doctor.companion!.carePlan!.cursor,1);assert.equal(doctor.bag.find(i=>i.uid===d.drug.uid)?.count,1)
    await care();const uid=doctor.companion!.carePlan!.uid
    await action({type:'cancelCompanionCarePlan',target:person,uid},()=>page.getByTestId('companion-care-schedule-cancel').click(),'actual-remaining-schedule-cancelled')
    assert.equal(doctor.companion!.carePlan!.status,'paused');await picture('cancelled-sequence',page.getByTestId('companion-care-plan-status'))
    await page.getByTestId('companion-care-plan-review').click()
    const remaining=requests.slice(1),review=page.getByTestId('companion-care-plan-draft')
    await review.locator('details').first().locator(':scope > summary').click();await english(review)
    assert.ok((await review.innerText()).includes('#'+d.drug.uid),'remaining review must retain the same original medicine UID')
    await compare('remaining-original-steps-review-readonly')
    const rq=companionCarePlanQuote(w,doctor,remaining);assert.equal(rq.error,null)
    await action({type:'companionCarePlan',target:person,requests:remaining,expected:rq.signature},()=>page.getByTestId('companion-care-plan-start').click(),'actual-reviewed-remainder-rescheduled')
    assert.notEqual(doctor.companion!.carePlan!.uid,uid);await close()
    await action({type:'rest',turns:200},()=>page.keyboard.press('r'),'actual-original-remainder-completed')
    assert.equal(doctor.companion!.carePlan!.status,'complete');assert.equal(doctor.companion!.carePlan!.cursor,2)
    assert.equal(doctor.bag.some(i=>i.uid===d.drug.uid),false);assert.equal(doctor.bag.find(i=>i.uid===d.bag.uid)?.uses,4)
   }else{
    await close();for(let n=0;doctor.companion!.carePlan!.status!=='complete'&&n<160;n++)await action({type:'wait'},()=>page.keyboard.press('Period'),'sequence-wait-'+n)
    assert.equal(doctor.companion!.carePlan!.status,'complete');assert.equal(doctor.companion!.carePlan!.cursor,4)
    assert.equal(doctor.bag.find(i=>i.uid===d.drug.uid)?.count,1)
    assert.ok(patient.body.wounds.find(b=>b.id===d.wound.id)?.bandage)
    await care();await page.getByTestId('companion-clinical-patient').selectOption(String(patient.id));await page.getByTestId('companion-clinical-report').locator(':scope > summary').click()
    const findings=patient.medicalReports!.at(-1)!.findings;for(const finding of findings)assert.ok((await page.getByTestId('companion-clinical-report').innerText()).includes(finding))
    await compare('original-historical-findings-readonly');await picture('completed-and-recorded',page.getByTestId('companion-clinical-report'))
   }
   await saveContinue('original-patient-supplies-and-sequence')
  }else{
   const d=f as ReturnType<typeof companionRecoveryFixture>,doctor=actor(),record=d.record!
   await society();const panel=page.getByTestId('companion-recovery-panel');await panel.locator(':scope > summary').click()
   await english(panel,[record.label]);await compare('original-contract-review-readonly');await picture('recovery-review',panel)
   assert.equal(companionRecoveryQuote(w,doctor,record.id).error,null)
   await action({type:'companionRecoveryAssign',target:person,contract:record.id},()=>panel.getByTestId('companion-recovery-assign').click(),'actual-original-recovery-assigned')
   await society();if(await panel.getAttribute('open')===null)await panel.locator(':scope > summary').click()
   await action({type:'companionRecoveryStop',target:person},()=>page.getByTestId('companion-recovery-stop').click(),'actual-original-recovery-stopped')
   assert.equal(doctor.companionRecovery,undefined)
   await society();if(await panel.getAttribute('open')===null)await panel.locator(':scope > summary').click()
   await action({type:'companionRecoveryAssign',target:person,contract:record.id},()=>panel.getByTestId('companion-recovery-assign').click(),'actual-original-recovery-reassigned')
   await close();for(let n=0;!player(w).bag.some(i=>i.uid===d.book.uid)&&n<100;n++)await action({type:'wait'},()=>page.keyboard.press('Period'),'recovery-wait-'+n)
   assert.ok(player(w).bag.some(i=>i.uid===d.book.uid&&i.def===d.book.def),'same original returned')
   await saveContinue('same-original-recovered-item')
  }
  await context.close();active=undefined
 }
 assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,afterTitle:'Actual keyboard/pointer only; read-only world observations and independent Node whole-state comparisons',scenes:selected,size,pairs,proofs,images,errors,scope:'Five connected society/clinical surfaces; finite prepared trade, paid care, companion chosen patient/sequence, delayed care/cancel/review-original-remainder/resume/save and actual original recovery. No natural-acquisition/long-run/full-English-body/all-X1/v1 claim.'},null,2)+'\n')
 console.log(JSON.stringify({pairs:pairs.length,images:images.length,errors}))
}catch(error){
 if(active){try{writeFileSync(join(out,'failure-world.json'),JSON.stringify(await active.evaluate(()=>(window as unknown as Hook).__ashveil?.world().s)));writeFileSync(join(out,'failure.txt'),await active.locator('body').innerText());await active.screenshot({path:join(out,'failure.png')})}catch{/* preserve the original failure */}}
 writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error
}finally{await browser?.close();server.stop()}

