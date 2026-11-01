/** Declared finite initial evidence from actual Core work; all loaded actions use real UI. */
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {chromium,type Page,type BrowserContext} from 'playwright-core'
import {startNativePreview} from './native-preview'
import {endingFixture} from '../tests/expedition-endings-fixture'
import {playerAct} from '../src/core/game'
import {expeditionEndingQuote} from '../src/core/expedition-endings'
import {player,type World} from '../src/core/ctx'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {formatExpeditionReport} from '../src/client/report-export'
import {translateEndingRule} from '../src/client/locales/expedition-records'
import {retirementDef} from '../src/core/retirement'

type Hook={__ashveil:{world():World}}
const out=process.argv[2],size=process.argv[3],kinds=['signal','unveiled','witness','acknowledged']as const
assert.ok(out&&!existsSync(out));assert.ok(!size||['1440','1366','390'].includes(size));mkdirSync(out,{recursive:true})
const rows:unknown[]=[],runs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined,current='start'
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([v])=>!size||String(v)===size))for(const kind of kinds){
  current=kind+'-'+width
  const d=endingFixture(kind);d.s.saveMode='SaveMode.Imprint';d.s.fx=[]
  const raw=serialize(d.s),w:World={db:d.w.db,s:deserialize(raw)},p=player(w),q=expeditionEndingQuote(w,p,kind),parent=retirementDef(w).id
  assert.equal(q.error,null);writeFileSync(join(out,current+'-initial-world.json'),raw)
  const context:BrowserContext=await browser.newContext({viewport:{width,height}}),page:Page=await context.newPage();active=page;page.setDefaultTimeout(120000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const card=()=>page.locator('[data-ending="'+kind+'"]')
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
   await page.waitForFunction(t=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.time===t&&s.fx.length===0},w.s.time,{timeout:300000})
   w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s),prefix=current+'-'+label
   writeFileSync(join(out,prefix+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-expected.json'),serialize(w.s))
   assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   rows.push({kind,width,height,label,time:actual.time,hash:stateHash(actual)});await page.screenshot({path:join(out,prefix+'.png')})
  }
  async function journal(){await page.keyboard.press('Shift+j');await page.getByTestId('win-journal').getByRole('button',{name:'갈림길',exact:true}).click()}
  async function choose(){await card().locator('[data-ending-choose="'+kind+'"]').click();await card().getByTestId('ending-confirm').scrollIntoViewIfNeeded()}
  async function downloadReport(label:string,modeLabel?:string){
   const pending=page.waitForEvent('download');await page.getByTestId('report-download').click();const file=await pending,path=join(out,current+'-'+label+'.txt');await file.saveAs(path)
   const expected=formatExpeditionReport({report:w.s.over!.report,seed:w.s.seed,modeLabel,language:'en'})
   assert.equal(readFileSync(path,'utf8'),expected);assert.ok(file.suggestedFilename().startsWith('ashveil-expedition-report-'));assert.ok(expected.includes(p.name));return{path,bytes:Buffer.byteLength(expected),filename:file.suggestedFilename()}
  }
  await page.goto(server.url);await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},raw)
  await page.reload();await page.getByTestId('continue').click();await compare('loaded')
  await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption('en');await page.keyboard.press('Escape');await journal()
  assert.equal(await card().locator('h4').innerText(),translateEndingRule(parent,q.rule!,'label','en'));assert.doesNotMatch(await card().locator('h4').innerText(),/[가-힣]/)
  if(q.disclosures.length)assert.equal(await card().locator('.ending-evidence').innerText(),'Readings of original records to an actual audience: '+q.disclosures.length)
  assert.equal(await card().evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await compare('english-read-only')
  await choose();await compare('review');await card().getByRole('button',{name:'Keep exploring',exact:true}).click();assert.equal(await card().getByTestId('ending-confirm').count(),0);await compare('cancel')
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Title',exact:true}).click();await page.getByTestId('continue').click();await compare('continued')
  await journal();await choose();await compare('review-again')
  const at=w.s.time;assert.equal(playerAct(w,{type:'finishExpedition',ending:kind,expected:q.signature}),null);await card().getByTestId('ending-confirm').click()
  await page.getByTestId('report').waitFor();await compare('finished');assert.equal(w.s.time,at);assert.ok(player(w).alive)
  const exported=await downloadReport('actual-report');await compare('download-read-only')
  await page.getByTestId('report').getByTestId('discovery-archive').locator('summary').click();await compare('discovery-open-read-only')
  const entries=await page.evaluate(()=>JSON.parse(localStorage.getItem('ashveil.chronicle.v1')??'[]'));assert.equal(entries.length,1);assert.deepEqual(entries[0].report,JSON.parse(JSON.stringify(w.s.over!.report)));assert.equal(entries[0].kind,'escape')
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ashveil.imprint.v1')??'{}').ashveilDeleted),1)
  await page.getByRole('button',{name:'Record in the chronicle and return',exact:true}).click();await page.reload();assert.equal(await page.getByTestId('continue').count(),0)
  const archiveRaw=await page.evaluate(()=>localStorage.getItem('ashveil.chronicle.v1'));writeFileSync(join(out,current+'-actual-chronicle.json'),archiveRaw!)
  const chronicle=page.getByTestId('chronicle');await chronicle.scrollIntoViewIfNeeded();await page.getByTestId('chronicle-search').fill(p.name);await page.getByTestId('chronicle-kind').selectOption('escape');assert.equal(await page.getByTestId('chronicle-entry').count(),1)
  await chronicle.getByTestId('chronicle-life').locator('summary').first().click();await chronicle.getByTestId('discovery-archive').locator('summary').click()
  await chronicle.getByTestId('discovery-archive-kind').selectOption('fieldNote');const recordRows=await chronicle.locator('[data-discovery-kind]').allTextContents()
  for(const title of w.s.over!.report.discoveries!.records.filter(r=>r.kind==='fieldNote').map(r=>r.title))assert.ok(recordRows.some(text=>text.includes(title)),title)
  const archivedExport=await downloadReport('actual-chronicle-report',entries[0].saveModeLabel)
  assert.equal(await page.evaluate(()=>localStorage.getItem('ashveil.chronicle.v1')),archiveRaw);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await chronicle.getByTestId('chronicle-life').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,current+'-actual-chronicle-filtered-read-only.png')})
  runs.push({kind,width,height,declaredInitialPreparation:d.proof,initialSaveMode:'SaveMode.Imprint',realReviewCancelTitleContinueAndConfirmation:true,finishTU:0,originalPerson:p.id,originalName:p.name,originalBodyAlive:true,actualReport:exported,actualChronicleReport:archivedExport,archiveOriginalReportExactAndUnique:true,imprintDeletedAfterReload:true,archiveFilterAndExportReadOnly:true,noNaturalPriorAcquisitionClaim:true})
  await context.close();active=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({rows,runs,errors,boundary:'Finite INITIAL evidence from actual prior Core work and explicit fixture exit placement. Actual Title/settings/keys/pointers, review/cancel/continue/confirm, report downloads and chronicle filters/export. Browser complete-world comparisons use independent Node actions. Original saved report/discovery text is preserved. No post-Title browser World/body/clock/RNG/material/metadata writes. Only normal FX cleanup in the expected model. Chronicle reads and UI filters are metadata checks, not extra Node whole-world pairs. No clipboard/Study checkpoint, natural prior acquisition, full English reports or all X3/v1/human acceptance.'},null,2));console.log(JSON.stringify({scenes:runs.length,wholeWorldPairs:rows.length,errors}))
}catch(error){if(active){await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.txt'),await active.locator('body').innerText().catch(()=>''))}writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),rows,runs,errors},null,2));throw error}
finally{if(browser)await browser.close();server.stop()}
