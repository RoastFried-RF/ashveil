/** Real trade/craft/consume/body/save UI after finite declared initial diagnostic scenes. */
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {chromium,type Page} from 'playwright-core'
import {startNativePreview} from './native-preview'
import {ashCakeSupplyFixture,ashCakeCraftFixture} from '../tests/ash-cake-fixture'
import {playerAct} from '../src/core/game'
import {type World} from '../src/core/ctx'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {tradeQuote} from '../src/core/economy'
import {foodTrainingReady,foodTrainingLungAsh} from '../src/core/food-training'
import {drinkVolume} from '../src/core/wash-water'
import type {DiseaseDef} from '../src/core/types'
import type {Action} from '../src/core/actions'

const out=process.argv[2];assert.ok(out&&!existsSync(out),'Use a new output directory');mkdirSync(out,{recursive:true})
const selected=process.argv[3],viewport=process.argv[4];assert.ok(!selected||['supply','craft','mature'].includes(selected));assert.ok(!viewport||['1440','1366','390'].includes(viewport))
const rows:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const scene of selected?[selected]:['supply','craft','mature'])for(const[width,height]of [[1440,1080],[1366,768],[390,844]].filter(([w])=>!viewport||String(w)===viewport)){
  const supply=scene==='supply'?ashCakeSupplyFixture():undefined,craft=scene!=='supply'?ashCakeCraftFixture(scene==='mature'):undefined,d=(supply??craft)!,{w,p}=d,prefix=scene+'-'+width
  const raw=serialize(w.s);assert.deepEqual(JSON.parse(serialize(deserialize(raw))),JSON.parse(raw),'Declared initial save');writeFileSync(join(out,prefix+'-initial-world.json'),raw)
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(45000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[];assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   rows.push({scene,label,width,height,time:actual.time,hash:stateHash(actual)});writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));await page.screenshot({path:join(out,prefix+'-'+label+'.png')})
  }
  async function act(action:Action,input:()=>Promise<unknown>,label:string){assert.equal(playerAct(w,action),null,label);await input();await compare(label)}
  const item=(uid:number)=>page.getByTestId('win-inv').locator(`[data-inventory-item="${uid}"]`)
  async function hover(uid:number){await page.mouse.move(0,0);await item(uid).hover();await page.getByTestId('tooltip').waitFor();return page.getByTestId('tooltip').innerText()}
  async function english(){await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption('en');await page.keyboard.press('Escape')}
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('loaded')
  if(supply){
   await page.keyboard.press('Shift+N');await page.getByTestId('win-society').locator(`[data-person-id="${supply.trader.id}"]`).click();await compare('original-merchant')
   const buy=[{uid:supply.ash.uid,count:1},{uid:supply.cake.uid,count:1}],q=tradeQuote(w,p,supply.trader,buy,[]),cash=p.money!;assert.equal(q.error,null)
   for(const uid of[supply.ash.uid,supply.cake.uid])await page.getByTestId('trade-stock').locator(`[data-trade-uid="${uid}"]`).getByRole('button',{name:/구매 늘리기$/}).click()
   await compare('trade-review');await act({type:'trade',target:supply.trader.id,buy,sell:[],expectedBalance:q.balance},()=>page.getByTestId('trade-confirm').click(),'bought-original-food')
   assert.equal(p.money,cash-q.balance);assert.ok(p.bag.some(i=>i.uid===supply.cake.uid));await page.keyboard.press('Escape');await page.keyboard.press('i');await english()
   const text=await hover(supply.cake.uid);assert.match(text,/Ashcake bowl/);assert.doesNotMatch(text,/0\.70|Grey fever|[가-힣]/);await compare('unknown-food-en')
   await act({type:'consume',uid:supply.cake.uid},()=>item(supply.cake.uid).dblclick(),'purchased-food-eaten');assert.equal(p.bag.find(i=>i.uid===supply.cake.uid)?.def,'Item.Bowl')
  }else if(craft&&scene==='craft'){
   const beforeWater=drinkVolume(w,craft.bottle),bowlUid=craft.bowl.uid;await page.keyboard.press('F2');await page.getByTestId('craft-tab-recipes').click();await page.getByTestId('craft-search').fill('재떡');await compare('recipe-reviewed')
   await act({type:'craft',id:craft.recipe},()=>page.getByTestId(craft.recipe).getByRole('button',{name:'제작',exact:true}).click(),'steamed-original-grain')
   assert.equal(p.bag.find(i=>i.uid===bowlUid)?.def,'Item.AshCake');assert.equal(drinkVolume(w,craft.bottle),beforeWater-220);assert.ok(!p.bag.some(i=>i.uid===craft.ash.uid))
   await page.keyboard.press('Escape');await page.keyboard.press('i');await english();assert.doesNotMatch(await hover(bowlUid),/0\.70|Grey fever|[가-힣]/);await compare('steamed-food-en')
   await act({type:'consume',uid:bowlUid},()=>item(bowlUid).dblclick(),'steamed-food-eaten');assert.equal(p.bag.find(i=>i.uid===bowlUid)?.def,'Item.Bowl')
  }else if(craft&&scene==='mature'){
   const disease=w.db.get<DiseaseDef>('Disease.GreyFever'),knowledge=JSON.stringify(w.s.knowledge);assert.equal(foodTrainingReady(w,p,disease),false)
   await page.keyboard.press('i');await english();assert.match(await hover(craft.cake!.uid),/Resistance not yet formed/);await compare('declared-month-boundary-en')
   await act({type:'consume',uid:craft.cake!.uid},()=>item(craft.cake!.uid).dblclick(),'thirtieth-serving');assert.equal(foodTrainingReady(w,p,disease),true);assert.equal(foodTrainingLungAsh(p),10)
   const tip=await hover(craft.extra!.uid);assert.match(tip,/Resistance formed/);assert.match(tip,/Grey fever exposure risk ×0.70/);assert.doesNotMatch(tip,/[가-힣]/);await compare('formed-resistance-en')
   await act({type:'consume',uid:craft.extra!.uid},()=>item(craft.extra!.uid).dblclick(),'extra-serving-cost');assert.equal(foodTrainingLungAsh(p),10.333333);assert.equal(p.body.foodTraining!['Disease.GreyFever'].servings,30);assert.equal(JSON.stringify(w.s.knowledge),knowledge)
   await page.keyboard.press('Escape');await page.keyboard.press('Shift+B');await page.getByTestId('body-air').waitFor();assert.match(await page.getByTestId('body-air').innerText(),/Lung burden from ritual-food exposure 10.33/);await compare('same-lungs-en')
  }
  await page.keyboard.press('Escape');await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare('saved')
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare('continued')
  if(scene==='mature'){await page.keyboard.press('Shift+B');await page.getByTestId('body-air').waitFor();assert.match(await page.getByTestId('body-air').innerText(),/10.33/);await compare('restored-lungs')}
  await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({declaredFixtures:'Arrival beside the original Stillhouse merchant with finite initial cash; isolated finite grain/ash/water/bowl and wood fire; a separate 29-serving prior body history and personal book/specimen evidence at the 30-day boundary. Initial clock/history are diagnostic declarations, not naturally played 30 days. Actual UI only after Title; no world/RNG/time writes.',rows,errors},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
