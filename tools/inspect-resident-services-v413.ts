import assert from'node:assert/strict'
import{existsSync,mkdirSync,readFileSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import{chromium,type Page,type BrowserContext,type Locator}from'playwright-core'
import{startNativePreview}from'./native-preview'
import{residentHygieneFixture,residentHygieneNativeFixture}from'../tests/resident-hygiene-fixture'
import{retirementFixture}from'../tests/retirement-fixture'
import{playerAct}from'../src/core/game'
import{creatureAt,inBounds,player,terrainAt,type World}from'../src/core/ctx'
import{DIRS}from'../src/core/geom'
import{updatePlayerVision}from'../src/core/fov'
import{allItems}from'../src/core/items'
import{isWaterVessel,waterCapacity}from'../src/core/water-vessels'
import{drinkVolume}from'../src/core/wash-water'
import{marketFor}from'../src/core/economy'
import{innQuote}from'../src/core/inn'
import{retirementLongLeaseQuote,retirementQuote}from'../src/core/retirement'
import{serialize,deserialize,stateHash}from'../src/core/save'
import type{Action}from'../src/core/actions'
import{formatExpeditionReport}from'../src/client/report-export'

const out=process.argv[2],selected=process.argv[3]??'all',size=process.argv[4],reportRestore=process.argv[5]==='report-restore',scenes=['well','hygiene','inn']as const
type Scene=typeof scenes[number]
assert.ok(out&&!existsSync(out),'Choose a new output directory');assert.ok(selected==='all'||scenes.some(s=>s===selected));assert.ok(!size||['1440','1366','390'].includes(size));mkdirSync(out,{recursive:true})
assert.ok(!process.argv[5]||reportRestore);assert.ok(!reportRestore||selected==='inn')
const rows:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const scene of selected==='all'?scenes:[selected as Scene])for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([v])=>!size||String(v)===size)){
  const d=scene==='inn'?retirementFixture():scene==='hygiene'?residentHygieneNativeFixture('body'):residentHygieneFixture(),w=d.w,p=player(w),target=scene==='inn'?(d as ReturnType<typeof retirementFixture>).keeper:scene==='hygiene'?(d as ReturnType<typeof residentHygieneFixture>).c:undefined,prefix=scene+'-'+width
  const names=w.s.creatures.map(c=>({id:c.id,name:c.name})),bottle=scene==='well'?allItems(p).find(i=>isWaterVessel(w,i)&&i.count===1):undefined,well=scene==='well'?w.s.map.residentWell:undefined
  if(scene==='well'){
   assert.ok(well&&bottle,'Original well and player vessel required')
   const pos=DIRS.map(v=>({x:well.pos.x+v.x,y:well.pos.y+v.y})).find(pos=>inBounds(w,pos)&&terrainAt(w,pos).passable&&!creatureAt(w,pos));assert.ok(pos)
   p.pos=pos;p.needs.waterDeficit=400
   for(const c of w.s.creatures)c.nextAct=c.id===p.id?w.s.time:1e12
   updatePlayerVision(w,p)
  }
  w.s.saveMode='SaveMode.Study';w.s.achievementsDisabled=true;w.s.fx=[]
  const raw=serialize(w.s);assert.equal(serialize(deserialize(raw)),raw);writeFileSync(join(out,prefix+'-initial-world.json'),raw)
  proofs.push({scene,width,fixture:scene==='inn'?'retirementFixture':scene==='hygiene'?'residentHygieneNativeFixture(body)':'residentHygieneFixture',declaredFiniteExistingFixture:true,declaredStudyMode:true,originalPeople:names,originalVessel:bottle?.uid,originalTarget:target?.id,declaredWellArrival:scene==='well',declaredWellObserverWaterDeficit:scene==='well'?400:undefined,declaredWellNpcUnscheduled:scene==='well',earlierBodyWashIsActualCoreFixtureWork:scene==='hygiene',noEarlierNaturalAcquisitionOrTravelClaim:true,noPostTitleWorldWrites:true})
  const context:BrowserContext=await browser.newContext({viewport:{width,height}}),page:Page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const ids=scene==='well'?['resident-depot','resident-well']:scene==='hygiene'?['resident-hygiene']:['inn-panel']
  const panel=(id=ids[0]):Locator=>page.getByTestId(id)
  async function close(){for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
  async function services(){await close();await page.keyboard.press('Shift+n');if(target)await page.locator('[data-person-id="'+target.id+'"]').click()}
  async function language(code:'ko'|'en'){await close();await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption(code);await page.keyboard.press('Escape');await services()}
  async function english(){for(const id of ids){assert.ok(await panel(id).count(),id+' required');assert.doesNotMatch(await panel(id).innerText(),/[가-힣]/,id+' text');const attrs=await panel(id).locator('[title],[aria-label],[placeholder]').evaluateAll(es=>es.flatMap(e=>['title','aria-label','placeholder'].map(k=>e.getAttribute(k)??'')));assert.doesNotMatch(attrs.join('\n'),/[가-힣]/,id+' attributes');assert.equal(await panel(id).evaluate(e=>e.scrollWidth>e.clientWidth+1),false,id+' internal overflow')}}
  async function compare(label:string,showPanel=true){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[];writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);rows.push({scene,width,height,label,time:actual.time,hash:stateHash(actual)});await page.mouse.move(100,40)
   if(showPanel&&await panel().count()&&await panel().isVisible())await panel().scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-'+label+'.png')})
  }
  async function act(action:Action,input:()=>Promise<unknown>,label:string){assert.equal(playerAct(w,action),null);await input();await compare(label)}
  async function saveContinue(label:string){await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare(label+'-saved',false);await close();await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare(label+'-continued',false)}
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('loaded',false);await language('en');await english();await compare('english-original-services-read-only');await saveContinue('original-service-state');await services()
  if(scene==='well'){
   const uid=bottle!.uid,at=w.s.time,capacity=waterCapacity(w,bottle!),before=drinkVolume(w,bottle!)
   await act({type:'fillBottle',uid,pos:well!.pos},()=>page.getByTestId('well-fill-'+uid).click(),'actual-original-vessel-filled');assert.equal(w.s.time-at,150);assert.equal(bottle!.uid,uid);assert.equal(drinkVolume(w,bottle!),capacity);await english();await compare('english-actual-full-vessel')
   const start=w.s.time,deficit=p.needs.waterDeficit
   await act({type:'drinkHere',pos:well!.pos},()=>page.getByTestId('well-drink').click(),'actual-well-drink');assert.equal(w.s.time-start,200);assert.ok(p.needs.waterDeficit<deficit);assert.equal(drinkVolume(w,bottle!),capacity)
   proofs.push({scene,width,originalVessel:uid,priorMl:before,filledMl:capacity,fillTu:150,drinkTu:200,wellDrinkDoesNotConsumeVessel:true});await saveContinue('same-filled-vessel-and-actual-drink')
  }else if(scene==='hygiene'){
   const c=target!,name=c.name,at=w.s.time,initial=structuredClone(c.activity);assert.equal(initial?.kind,'wash')
   await close();await act({type:'rest',turns:200},()=>page.keyboard.press('r'),'actual-resident-wash-finished-through-normal-rest');assert.equal(w.s.time-at,20000);assert.ok(c.needs.hygiene>=60);assert.equal(c.name,name);assert.ok(c.alive)
   proofs.push({scene,width,originalResident:c.id,initialActivity:initial,finalHygiene:c.needs.hygiene,originalResidentAlive:c.alive,elapsedTurns:200});await saveContinue('same-resident-after-actual-body-wash')
  }else{
   const keeper=target!,market=marketFor(w,keeper)!,bed=w.s.map.innBeds!.find(b=>b.keeper===keeper.id)!,index=w.s.map.innBeds!.filter(b=>b.keeper===keeper.id).findIndex(b=>b.id===bed.id),originalBed={id:bed.id,keeper:bed.keeper,terrain:bed.terrain,pos:{...bed.pos}}
   for(const label of['rent','extend']){const q=innQuote(w,p,keeper,bed.id),at=w.s.time,cash=p.money!,fund=market.money;assert.equal(q.error,null);await act({type:'rentBed',target:keeper.id,bed:bed.id,expectedFee:q.fee},()=>page.getByTestId('inn-rent-'+index).click(),'actual-original-bed-'+label);assert.equal(w.s.time-at,100);assert.equal(p.money,cash-q.fee);assert.equal(market.money,fund+q.fee);assert.deepEqual(bed.lease,{tenant:p.id,until:q.until});await english()}
   await saveContinue('same-bed-paid-and-extended');await services();const long=retirementLongLeaseQuote(w,p,keeper,bed.id),at=w.s.time,cash=p.money!,fund=market.money;assert.equal(long.error,null)
   await act({type:'rentBed',target:keeper.id,bed:bed.id,periods:long.periods,expectedFee:long.fee},()=>page.getByTestId('inn-long-rent-'+index).click(),'actual-original-bed-long-lease');assert.equal(w.s.time-at,100);assert.equal(p.money,cash-long.fee);assert.equal(market.money,fund+long.fee);assert.equal(bed.lease!.until,long.until);await english();await compare('english-ready-retirement-quote');await saveContinue('same-long-housing-before-retirement');await services()
   const checkpointRaw=serialize(w.s),q=retirementQuote(w,p,keeper),money=p.money!,fundBefore=market.money;assert.equal(q.error,null)
   await act({type:'retire',target:keeper.id,expectedSavings:q.savings},()=>page.getByTestId('retire-confirm').click(),'actual-retirement-with-same-paid-bed');assert.equal(p.money,money-q.savings);assert.equal(market.money,fundBefore+q.savings);assert.equal(w.s.over?.retirement?.legacy.name,p.name);assert.ok(p.alive);assert.deepEqual({id:bed.id,keeper:bed.keeper,terrain:bed.terrain,pos:bed.pos},originalBed)
   proofs.push({scene,width,originalBed,actualLongLeasePeriods:long.periods,actualLongLeaseFee:long.fee,actualRetirementSavings:q.savings,originalPersonAlive:p.alive,endingReportEnglishNotClaimed:true,postRetirementCheckpointNotClaimed:!reportRestore})
   if(reportRestore){
    const retiredRaw=serialize(w.s),report=w.s.over!.report,expected=formatExpeditionReport({report,seed:w.s.seed,language:'en'}),ending=page.getByTestId('report'),downloadPromise=page.waitForEvent('download')
    await ending.getByTestId('report-download').click()
    const download=await downloadPromise,path=join(out,prefix+'-actual-retirement-report.txt');await download.saveAs(path);const exported=readFileSync(path,'utf8')
    assert.equal(exported,expected);assert.ok(exported.includes(p.name)&&exported.includes(w.s.seed)&&exported.includes(q.label)&&exported.includes(String(q.savings)));assert.ok(download.suggestedFilename().startsWith('ashveil-'))
    assert.equal(serialize(w.s),retiredRaw);await compare('actual-retirement-report-downloaded-read-only',false)
    await ending.getByTestId('checkpoint-load').click();const dialog=page.getByTestId('checkpoint-dialog');await dialog.getByTestId('content-change-accept').waitFor();await compare('post-retirement-checkpoint-review-read-only',false)
    await dialog.getByTestId('content-change-accept').click();await dialog.waitFor({state:'detached'});w.s=deserialize(checkpointRaw);await compare('actual-post-retirement-checkpoint-restored',false)
    const restored=player(w),restoredBed=w.s.map.innBeds!.find(b=>b.id===originalBed.id)!,restoredMarket=w.s.overworld!.markets![keeper.traderSite!]
    assert.equal(Boolean(w.s.over),false);assert.ok(restored.alive);assert.equal(restored.id,p.id);assert.equal(restored.name,p.name);assert.equal(restored.money,money);assert.equal(restoredMarket.money,fundBefore);assert.deepEqual(restoredBed.lease,{tenant:p.id,until:long.until})
    proofs.push({scene,width,actualReportDownload:path,actualReportSuggestedFilename:download.suggestedFilename(),reportBytes:Buffer.byteLength(exported,'utf8'),reportDownloadWorldUnchanged:true,checkpointReviewWorldUnchanged:true,actualCheckpointRestoredWholeWorld:true,restoredMoney:restored.money,restoredBed:originalBed.id,restoredLeaseUntil:restoredBed.lease!.until,clipboardAndChronicleActionsNotClaimed:true})
   }
  }
  for(const original of names)assert.equal(w.s.creatures.find(c=>c.id===original.id)?.name,original.name)
  await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({proofs,rows,errors,boundary:reportRestore?'Finite declared original retirement fixture, initial money and actual housing. Real Title/settings, paid leases, retirement, actual report-file button/download, read-only checkpoint review and actual confirmed restoration. Independent Node complete-world equality, including the expected Node state restored solely to model that real UI action. No direct browser world/body/RNG/clock/material writes. Report language, clipboard copy, chronicle recording, natural prior acquisition and other ending branches remain separate.':'Finite declared existing resident/retirement fixtures, warm healthy initial bodies, initial well arrival/thirst/NPC scheduling, actual earlier Core body wash and finite initial money are explicit. Real Title/settings/pointers/keys, original vessel and paid bed, normal wash/lease/retirement actions, checkpoints before retirement, independent Node canonical whole-world equality. No post-Title body/clock/RNG/material/world writes. No whole Society/clinic/base-task/ending-report English, natural prior acquisition/travel, full community sustainability or post-retirement checkpoint claim.'},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),proofs,rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
