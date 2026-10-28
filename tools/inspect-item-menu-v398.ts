/** Real pointer/context-menu and Tab/Enter inspection of the same previously purchased book. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {loadDb} from './loadContent'
import type {World} from '../src/core/ctx'
type Hook={__ashveil:{world():World}}
const[out,url,source]=process.argv.slice(2),baseline=process.argv.includes('--baseline');assert.ok(out&&url&&source);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true});const raw=readFileSync(source,'utf8'),{db,report}=loadDb();assert.deepEqual(report.errors,[])
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),pairs:unknown[]=[],runs:unknown[]=[],errors:string[]=[];page.setDefaultTimeout(90000)
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(w:World,label:string){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(t=>{const s=(window as unknown as Hook).__ashveil.world().s;return!s.simulationPending&&s.time===t},w.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));pairs.push({label,hash:stateHash(actual)})}
try{
 await page.goto(url)
 for(const width of(baseline?[390]:[390,360,1366])){
  const key=String(width),w:World={db,s:deserialize(raw)},p=w.s.creatures.find(c=>c.id===w.s.playerId)!,book=p.bag.find(i=>i.def==='Item.SettlementMycologyRecords')!;assert.ok(book);writeFileSync(join(out,key+'-initial.json'),raw);await page.setViewportSize({width,height:844});await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},raw);await page.reload();await page.getByTestId('continue').click();await compare(w,key+'-loaded');await page.keyboard.press('i');const item=page.getByTestId('bag').locator(`[data-uid="${book.uid}"]`);await item.click({button:'right'})
  if(baseline){await page.getByTestId('tooltip').waitFor();await page.waitForTimeout(200);assert.equal(await page.getByTestId('item-menu').count(),0)}else await page.getByTestId('item-menu').getByRole('button',{name:'읽기',exact:true}).waitFor()
  await compare(w,key+'-pointer-menu-readonly');await page.screenshot({path:join(out,key+'-pointer.png')})
  if(!baseline){
   await page.keyboard.press('Escape');await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await page.waitForFunction(uid=>document.activeElement?.getAttribute('data-inventory-item')===uid,String(book.uid));await page.getByTestId('tooltip').waitFor();assert.ok((await page.getByTestId('tooltip').innerText()).includes(w.db.item(book.def).label));await compare(w,key+'-keyboard-details-readonly');await page.keyboard.press('Enter');await page.getByTestId('item-menu').getByRole('button',{name:'읽기',exact:true}).waitFor();await compare(w,key+'-keyboard-menu-readonly');await page.screenshot({path:join(out,key+'-keyboard.png')});await page.keyboard.press('Escape')
  }
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,key+'-continued');await page.getByRole('button',{name:'타이틀',exact:true}).click();runs.push({width,height:844,baseline,originalPurchasedBookUID:book.uid,mouseMenuOpened:!baseline,keyboardDetailsAndEnterMenu:!baseline,allInspectionAndRestoreWorldFieldsExact:true})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({baseline,initialFromActualPriorPurchase:true,postTitleWorldWrites:false,wholePairs:pairs.length,runs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),runs,pairs,errors},null,2));writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());throw error}finally{await browser.close()}
