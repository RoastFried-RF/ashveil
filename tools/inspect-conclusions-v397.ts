/** Finite INITIAL evidence from actual Core work. All loaded actions are real UI inputs. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {endingFixture} from '../tests/expedition-endings-fixture'
import {playerAct} from '../src/core/game'
import {expeditionEndingQuote} from '../src/core/expedition-endings'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {formatExpeditionReport} from '../src/client/report-export'
import type {World} from '../src/core/ctx'
type Hook={__ashveil:{world():World}}
const[out,url]=process.argv.slice(2);assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[];page.setDefaultTimeout(120000);let current='start'
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(w:World,label:string){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(t=>{const s=(window as unknown as Hook).__ashveil.world().s;return!s.simulationPending&&s.time===t},w.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)})}
async function journal(){await page.keyboard.press('Shift+J');await page.getByTestId('win-journal').getByRole('button',{name:'갈림길',exact:true}).click()}
try{
 await page.goto(url)
 for(const[width,height]of[[1366,768],[390,844]])for(const kind of ['signal','unveiled','witness','acknowledged']as const){
  current=kind+'-'+width;const d=endingFixture(kind),initial=serialize(d.s),w:World={db:d.w.db,s:deserialize(initial)},q=expeditionEndingQuote(w,w.s.creatures.find(c=>c.id===w.s.playerId)!,kind)
  writeFileSync(join(out,current+'-initial.json'),initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.removeItem('ashveil.chronicle.v1');localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},initial);await page.reload();await page.getByTestId('continue').click();await compare(w,current+'-loaded')
  await journal();const card=page.locator(`[data-ending="${kind}"]`);await card.locator(`[data-ending-choose="${kind}"]`).click();await compare(w,current+'-review');await card.getByRole('button',{name:'탐험 계속하기',exact:true}).click();assert.equal(await card.getByTestId('ending-confirm').count(),0);await compare(w,current+'-cancel')
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,current+'-continued');await journal();await card.locator(`[data-ending-choose="${kind}"]`).click();await card.getByTestId('ending-confirm').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,current+'-confirm.png')});await compare(w,current+'-review-again')
  const before=w.s.time;await card.getByTestId('ending-confirm').click();assert.equal(playerAct(w,{type:'finishExpedition',ending:kind,expected:q.signature}),null);assert.equal(w.s.time,before);await page.getByTestId('report').waitFor();await compare(w,current+'-finished');assert.ok(w.s.creatures.find(c=>c.id===w.s.playerId)!.alive)
  const downloadEvent=page.waitForEvent('download');await page.getByTestId('report').getByRole('button',{name:'보고서 파일 저장',exact:true}).click();const download=await downloadEvent,path=join(out,current+'-report.txt');await download.saveAs(path);assert.equal(readFileSync(path,'utf8'),formatExpeditionReport({report:w.s.over!.report,seed:w.s.seed}));await compare(w,current+'-download-readonly');await page.screenshot({path:join(out,current+'-report.png')})
  const archive=await page.evaluate(()=>JSON.parse(localStorage.getItem('ashveil.chronicle.v1')??'[]'));assert.equal(archive.length,1);assert.deepEqual(archive[0].report,JSON.parse(JSON.stringify(w.s.over!.report)));assert.equal(archive[0].kind,'escape');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ashveil.imprint.v1')??'{}').ashveilDeleted),1)
  await page.getByRole('button',{name:'연대기에 새기고 돌아가기',exact:true}).click();await page.reload();assert.equal(await page.getByTestId('continue').count(),0);assert.ok((await page.locator('body').innerText()).includes(q.rule!.label));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ashveil.chronicle.v1')??'[]').length),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  runs.push({kind,width,height,actualPreparation:d.proof,readReviewCancelAndTitleRestore:true,finishTU:0,originalBodyAlive:true,reportDownloadAllTextExact:true,archiveReportExactAndUnique:true,imprintDeletedAfterReload:true})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,postTitleWorldWrites:false,fxOnlyNormalized:true,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),runs,pairs,errors},null,2));writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());throw error}finally{await browser.close()}
