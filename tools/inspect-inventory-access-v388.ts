/** Actual keyboard focus/context and physical long-item rotation; finite initial items. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {carePlanFixture} from '../tests/companion-care-plan-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {startNativePreview} from './native-preview'
import type {World} from '../src/core/ctx'
const out=process.argv[2]??'test-results/autonomy-v388/inventory-access-r1';mkdirSync(out,{recursive:true})
const f=carePlanFixture();f.p.bag=[];const glaive=makeItem(f.w,'Item.CullerGlaive'),medical=makeItem(f.w,'Item.MedicalBag');assert.equal(addToBag(f.w,f.p,glaive),0);assert.equal(addToBag(f.w,f.p,medical),0)
const initial=serialize(f.s),w={db:f.w.db,s:deserialize(initial)},pairs:unknown[]=[],errors:string[]=[];writeFileSync(join(out,'initial.json'),initial)
type Hook={__ashveil:{world():World}}
const server=await startNativePreview(4389),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}})
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function check(label:string){w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);assert.equal(stateHash(actual),stateHash(w.s));pairs.push({label,hash:stateHash(actual)});await page.screenshot({path:join(out,label+'.png')})}
try{
 await page.goto(server.url);await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false}))},initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check('world');await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor()
 for(let n=0;n<40;n++){if(await page.evaluate(uid=>document.activeElement?.getAttribute('data-inventory-item')===String(uid),medical.uid))break;await page.keyboard.press('Tab')}
 assert.equal(await page.evaluate(uid=>document.activeElement?.getAttribute('data-inventory-item')===String(uid),medical.uid),true)
 await page.getByRole('tooltip').waitFor();assert.ok((await page.getByRole('tooltip').innerText()).includes('의료 가방'));await check('keyboard-detail')
 await page.keyboard.press('Enter');await page.getByTestId('item-menu').waitFor();await check('keyboard-menu');await page.keyboard.press('Escape')
 const icon=page.getByTestId('item-Item.CullerGlaive'),box=(await icon.boundingBox())!,bag=(await page.getByTestId('bag').boundingBox())!
 await page.mouse.move(box.x+8,box.y+8);await page.mouse.down();await page.mouse.move(bag.x+2+2*38+8,bag.y+2+4*38+8,{steps:8});await page.keyboard.press('r');await page.mouse.move(bag.x+2+2*38+9,bag.y+2+4*38+9);await page.mouse.up();assert.equal(playerAct(w,{type:'moveItem',uid:glaive.uid,gx:2,gy:4,rot:true}),null);await check('actual-rotated')
 const actualItem=await page.evaluate(uid=>(window as unknown as Hook).__ashveil.world().s.creatures.find(c=>c.id===1)!.bag.find(i=>i.uid===uid),glaive.uid);assert.equal(actualItem?.rot,true)
 await page.setViewportSize({width:390,height:844});await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');const bounds=await page.getByRole('tooltip').boundingBox();if(bounds)assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=391&&bounds.y+bounds.height<=845);await check('narrow-inventory');await page.keyboard.press('Escape');await check('narrow-world')
 const overlap=await page.evaluate(()=>{const s=document.querySelector('[data-testid=status-strip]')!.getBoundingClientRect(),t=document.querySelector('.game-tools')!.getBoundingClientRect();return s.left<t.right&&s.right>t.left&&s.top<t.bottom&&s.bottom>t.top});assert.equal(overlap,false)
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,afterTitle:'Actual keyboard/pointer only',pairs,errors,rotatedOriginalUid:glaive.uid,noNewPixels:true},null,2));console.log(JSON.stringify({pairs:pairs.length,errors}))
}catch(e){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());throw e}finally{await browser.close();server.stop()}
