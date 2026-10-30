/** Actual cooking/meal/book inputs and a learned observation, never a simulated month. */
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {chromium,type Page} from 'playwright-core'
import {startNativePreview} from './native-preview'
import {foodExposureNativeFixture} from '../tests/food-exposure-native-fixture'
import {playerAct} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {drinkVolume} from '../src/core/wash-water'
import {foodExposureDiseaseMultiplier,foodExposureLungDose} from '../src/core/food-exposure-state'
import {readingPageTurns} from '../src/core/knowledge-state'
import {serialize,stateHash} from '../src/core/save'

const out=process.argv[2];assert.ok(out&&!existsSync(out));mkdirSync(out,{recursive:true})
const all=[[1440,1080],[1366,768],[390,844]],viewport=process.argv[3]
assert.ok(!viewport||all.some(v=>v.join('x')===viewport),'Expected supported WIDTHxHEIGHT')
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
type Hook={__ashveil:{world():World}}
const rows:unknown[]=[],errors:string[]=[];let active:Page|undefined
try{
 for(const [width,height]of all.filter(v=>!viewport||v.join('x')===viewport)){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
  const d=await foodExposureNativeFixture(),w=d.w,c=d.p,initial=serialize(w.s),at=w.s.time,next=w.s.nextId
  writeFileSync(join(out,width+'-initial-world.json'),initial)
  const item=(uid:number)=>page.getByTestId('win-inv').locator(`[data-inventory-item="${uid}"]`)
  async function compare(label:string,capture=true){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
   await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0})
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   assert.ok(isDeepStrictEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s))),label+' complete state differs')
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,headers:[...document.querySelectorAll<HTMLElement>('.window-shell')].flatMap(el=>{const h=el.querySelector<HTMLElement>('.window-heading');if(!h)return[];const r=el.getBoundingClientRect(),b=h.getBoundingClientRect();return[{scrollTop:el.scrollTop,top:b.top,bottom:b.bottom,reachable:b.top>=r.top-1&&b.bottom<=Math.min(r.bottom,innerHeight)+1&&b.left>=0&&b.right<=innerWidth+1}]})}))
   assert.equal(layout.overflow,false,label+' overflow');assert.ok(layout.headers.every(h=>h.reachable),label+' title/close header clipped: '+JSON.stringify(layout.headers))
   rows.push({label,width,height,time:actual.time,hash:stateHash(actual),headers:layout.headers})
   if(capture)await page.screenshot({path:join(out,width+'-'+label+'.png')})
  }
  async function clearPointer(){await page.mouse.move(4,4);await page.getByTestId('tooltip').waitFor({state:'detached'})}
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),initial);await page.reload();await page.getByTestId('continue').click();await compare('declared-initial-scene')
  await page.keyboard.press('F2');const card=page.getByTestId('Recipe.Ashcake');await card.scrollIntoViewIfNeeded();await compare('original-resources-review')
  await card.getByRole('button',{name:'제작',exact:true}).click();assert.equal(playerAct(w,{type:'craft',id:d.recipe}),null);await compare('actual-cooking')
  const bowl=player(w).bag.find(i=>i.uid===d.bowl.uid)!
  assert.equal(w.s.time-at,40000);assert.equal(w.s.nextId,next);assert.equal(bowl.def,'Item.Ashcake');assert.equal(d.ash.count,1);assert.equal(d.oats.count,2);assert.equal(drinkVolume(w,d.bottle),920)
  await page.keyboard.press('Escape');await page.keyboard.press('i');await item(bowl.uid).hover();await page.getByTestId('tooltip').waitFor();assert.match(await page.getByTestId('tooltip').innerText(),/재떡/);await compare('same-original-bowl-food');await clearPointer()
  await item(bowl.uid).click({button:'right'});await page.getByTestId('item-menu').getByRole('button',{name:'먹기·쓰기',exact:true}).waitFor();await compare('actual-meal-menu',false)
  await page.getByTestId('item-menu').getByRole('button',{name:'먹기·쓰기',exact:true}).click();assert.equal(playerAct(w,{type:'consume',uid:bowl.uid}),null);await compare('actual-meal-empty-bowl')
  assert.equal(w.s.time-at,40100);assert.equal(bowl.def,'Item.Bowl');assert.equal(c.foodExposureTraining?.[0].doseCount,1);assert.equal(c.foodExposureTraining?.[0].course?.receipts.length,1);assert.equal(foodExposureLungDose(c),1/3);assert.equal(foodExposureDiseaseMultiplier(w,c,'Disease.GreyFever'),1)
  await page.keyboard.press('Escape');await clearPointer();await page.keyboard.press('Shift+B');await page.getByTestId('body-air').scrollIntoViewIfNeeded();assert.equal(await page.getByTestId('body-food-exposure').count(),0);await compare('unread-no-mechanism')
  await page.keyboard.press('Escape');await page.keyboard.press('i');await item(d.book.uid).click({button:'right'});await page.getByTestId('item-menu').getByRole('button',{name:'읽기',exact:true}).waitFor();await compare('original-book-read-review',false)
  const beforeBook=w.s.time,readTurns=readingPageTurns(w,c)*w.db.item(d.book.def).book!.pages
  await page.getByTestId('item-menu').getByRole('button',{name:'읽기',exact:true}).click();assert.equal(playerAct(w,{type:'read',uid:d.book.uid}),null);await compare('actual-intact-book')
  assert.equal(w.s.time-beforeBook,readTurns*100);assert.ok(c.booksRead?.includes(d.book.def)&&c.literacyBooks?.includes(d.book.def));assert.equal(foodExposureDiseaseMultiplier(w,c,'Disease.GreyFever'),1)
  await page.keyboard.press('Escape');await clearPointer();await page.keyboard.press('Shift+B');const learned=page.getByTestId('body-food-exposure');await learned.scrollIntoViewIfNeeded();assert.match(await learned.innerText(),/식사 1\/30회/);await compare('personally-learned-ko')
  await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption('en');await page.keyboard.press('Escape');await learned.scrollIntoViewIfNeeded();assert.doesNotMatch(await learned.innerText(),/[가-힣]/);assert.match(await learned.innerText(),/Next qualifying meal/);assert.doesNotMatch(await page.getByTestId('body-air').innerText(),/[가-힣]/);await compare('personally-learned-en')
  await page.keyboard.press('Escape');await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await compare('save-review',false);await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare('saved',false);await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare('continued-whole-world',false);await page.keyboard.press('Shift+B');await learned.scrollIntoViewIfNeeded();assert.match(await learned.innerText(),/meals spaced as required 1\/30/);await compare('continued-personal-observation')
  await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({fixture:'Finite original campfire, bottle1000ml/oats3/bowl/ash2/book. Initial literate/washed/adequate nutrition, no past food course. Actual400-turn craft, one meal, one intact source book; no acquisition or natural month claimed.',postTitleWorldWrites:false,rows,errors},null,2));console.log(JSON.stringify({wholePairs:rows.length,errors}))
}catch(error){await active?.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2));throw error}
finally{await browser.close();server.stop()}
