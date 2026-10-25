/** UI surface audit: finite declared inventory, actual inputs after Title; independent whole-state checks. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {carePlanFixture} from '../tests/companion-care-plan-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {startNativePreview} from './native-preview'
import type {World} from '../src/core/ctx'
const out=process.argv[2]??'test-results/autonomy-v388/ui-r1';mkdirSync(out,{recursive:true})
const f=carePlanFixture(),ids=['CullerGlaive','MedicalBag','Thread','Needle','Moonshine','Charcoal','CrawlerPlate','CullerScytheBlade']
f.p.bag=[];for(const id of ids){const it=makeItem(f.w,'Item.'+id);assert.equal(addToBag(f.w,f.p,it),0)}
const initial=serialize(f.s);writeFileSync(join(out,'declared-initial.json'),initial)
const server=await startNativePreview(4388),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],rows:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
type Hook={__ashveil:{world():World}}
async function idle(){await page.waitForSelector('[data-testid=map][data-ready=true] canvas')}
async function check(label:string,w:World){await idle();w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);assert.equal(stateHash(actual),stateHash(w.s));const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,dialogs:[...document.querySelectorAll<HTMLElement>('.window-shell')].map(e=>{const r=e.getBoundingClientRect();return{label:e.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height,reachable:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}})}));assert.equal(layout.overflow,false,label+' document overflow');assert.ok(layout.dialogs.every(d=>d.reachable),label+' unreachable dialog');rows.push({label,hash:stateHash(actual),layout});await page.screenshot({path:join(out,label+'.png')})}
async function close(){await page.keyboard.press('Escape')}
try{
 await page.goto(server.url)
 for(const [width,height]of [[1440,1080],[1366,768],[390,844]]){
  await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false,mapZoom:'vision'}))},initial);await page.reload();await page.getByTestId('continue').click();await idle();const w={db:f.w.db,s:deserialize(initial)},prefix=String(width)
  await check(prefix+'-world',w)
  const header=await page.evaluate(()=>{const s=document.querySelector('[data-testid=status-strip]')!.getBoundingClientRect(),t=document.querySelector('.game-tools')!.getBoundingClientRect();return{overlap:s.left<t.right&&s.right>t.left&&s.top<t.bottom&&s.bottom>t.top}});assert.equal(header.overlap,false,'status and tools overlap')
  for(const [key,id]of [['c','char'],['i','inv'],['Shift+K','abil'],['Shift+B','body'],['m','map'],['Shift+N','society']]){await page.keyboard.press(key!);await page.getByTestId('win-'+id).waitFor();await check(prefix+'-'+id,w);await close()}
  await page.keyboard.press('Shift+J');const journal=page.getByTestId('win-journal');await journal.waitFor()
  for(const label of ['생존','계약','구조 단서','지식','상호작용','도감','진료','소문','사건','실마리','갈림길','연대기','기록']){await journal.getByRole('button',{name:label,exact:true}).click();await check(prefix+'-journal-'+label,w)}await close()
  await page.keyboard.press('F2');for(const tab of ['recipes','field','maintenance']){await page.getByTestId('craft-tab-'+tab).click();await check(prefix+'-craft-'+tab,w)}await close()
  await page.getByRole('button',{name:'설정 (F3)',exact:true}).click();await page.getByTestId('win-settings').waitFor();await check(prefix+'-settings',w);await close();await page.getByRole('button',{name:'? 조작법',exact:true}).click();await page.getByRole('dialog',{name:'조작법',exact:true}).waitFor();await check(prefix+'-help',w);await close()
  await page.keyboard.press('i');const search=page.getByTestId('inventory-search');await search.fill('의료가방');assert.equal(await page.getByTestId('item-Item.MedicalBag').evaluate(e=>e.classList.contains('inventory-unmatched')),false);await check(prefix+'-search',w);await search.fill('');await page.locator('.inventory-groups').getByRole('button',{name:'의료',exact:true}).click()
  for(const id of ['Thread','Needle','Moonshine','MedicalBag'])assert.equal(await page.getByTestId('item-Item.'+id).evaluate(e=>e.classList.contains('inventory-unmatched')),false,id)
  await check(prefix+'-medical-filter',w);await page.locator('.inventory-groups').getByRole('button',{name:'재료',exact:true}).click();for(const id of ['Thread','Charcoal','CrawlerPlate','CullerScytheBlade'])assert.equal(await page.getByTestId('item-Item.'+id).evaluate(e=>e.classList.contains('inventory-unmatched')),false,id)
  await check(prefix+'-material-filter',w);await page.locator('.inventory-groups').getByRole('button',{name:'전체',exact:true}).click();assert.equal(await page.getByTestId('item-Item.CullerGlaive').locator('[data-icon-layout="glaive-long-axis"]').count(),1);await check(prefix+'-glaive',w);await close()
  await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({scope:'Finite initial scene. All eight main windows, thirteen journal tabs, three craft tabs, settings/help, actual inventory searches/categories and original long-axis icon. Three viewport sizes. Every UI surface compared to independent complete Node state; no post-Title world mutation. Not every conditional clinical/quest panel.',rows,errors},null,2));console.log(JSON.stringify({surfaces:rows.length,errors}))
}catch(e){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw e}finally{await browser.close();server.stop()}
