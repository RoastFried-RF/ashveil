/** Finite declared stock, real tooltip/menu/meal/save inputs and independent whole-state checks. */
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {chromium,type Page} from 'playwright-core'
import {loadDb} from './loadContent'
import {startNativePreview} from './native-preview'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {addToBag,makeItem} from '../src/core/items'
import {serialize,stateHash} from '../src/core/save'

const out=process.argv[2];assert.ok(out&&!existsSync(out));mkdirSync(out,{recursive:true})
const viewports=[[1440,1080],[1366,768],[390,844]],viewport=process.argv[3]
assert.ok(!viewport||viewports.some(v=>v.join('x')===viewport),'Expected a supported WIDTHxHEIGHT')
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
type Hook={__ashveil:{world():World}}
const rows:unknown[]=[],errors:string[]=[];let active:Page|undefined
try{
 const {db,report}=loadDb();assert.deepEqual(report.errors,[])
 for(const [width,height]of viewports.filter(v=>!viewport||v.join('x')===viewport)){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const w:World={db,s:newGame(db,{seed:'ashveil-item-details-v405',background:'Bg.Deserter',mods:db.loadedMods,characterRoll:0,saveMode:'SaveMode.Study',overworld:true,legacyResidents:[]})};runUntilInput(w)
  const c=player(w);c.bag=[];c.hotbar=Array(10).fill(null)
  const stock=['Item.MedicalBag','Item.PioneerArm','Item.PillYellow','Item.PaddedJacket','Item.Javelin','Item.OatmealBowl','Item.Revolver','Item.WaterBottle'].map(id=>makeItem(w,id))
  for(const it of stock)assert.equal(addToBag(w,c,it),0)
  const pill=stock[2],meal=stock[5];pill.pillRemaining=.75
  w.s.knowledge.pillMap[pill.def]='Pill.Toxin';(w.s.knowledge.pillBeliefs??={})[pill.def]={belief:'Pill.Analgesic',confidence:'likely',ruledOut:[],evidence:[]}
  c.hotbar[0]={kind:'item',def:meal.def}
  const initial=serialize(w.s);writeFileSync(join(out,width+'-initial-world.json'),initial)
  async function compare(label:string,capture=true){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
   await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0})
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   assert.ok(isDeepStrictEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s))),label+' complete serialized state differs')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   rows.push({label,width,height,time:actual.time,hash:stateHash(actual)})
   if(capture)await page.screenshot({path:join(out,width+'-'+label+'.png')})
  }
  const item=(uid:number)=>page.getByTestId('win-inv').locator(`[data-inventory-item="${uid}"]`)
  async function clearPointer(){await page.mouse.move(4,4);await page.getByTestId('tooltip').waitFor({state:'detached'})}
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
  await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor();await item(stock[1].uid).hover();await page.getByTestId('tooltip').waitFor();assert.match(await page.getByTestId('tooltip').innerText(),/손목 같은 관절/);await compare('unappraised-ko');await clearPointer()
  await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption('en');await page.keyboard.press('Escape')
  for(const it of stock){
   await item(it.uid).hover();await page.getByTestId('tooltip').waitFor();const text=await page.getByTestId('tooltip').innerText()
   if(it.def!=='Item.WaterBottle')assert.doesNotMatch(text,/[가-힣]/,it.def)
   if(it.def==='Item.PioneerArm'){assert.match(text,/A metal mass with a wrist-like joint/);assert.doesNotMatch(text,/base efficiency|Pioneer prosthetic arm/)}
   if(it.def==='Item.PillYellow'){assert.match(text,/Painkiller suspected/);assert.match(text,/Suspected effect: Reduces pain by 50/);assert.doesNotMatch(text,/Causes vomiting|Spoiled medicine/)}
   if(it.def==='Item.WaterBottle')assert.match(text,/Water remaining 1000ml/)
   const box=await page.getByTestId('tooltip').boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height)
   await compare(it.def.replace('Item.','')+'-detail-en');await clearPointer()
  }
  // Tab reaches the same actual item; Enter opens its menu without consuming it.
  await page.getByTestId('inventory-search').click();let focused=false
  for(let i=0;i<100;i++){await page.keyboard.press('Tab');focused=await page.evaluate(uid=>document.activeElement?.getAttribute('data-inventory-item')===String(uid),meal.uid);if(focused)break}
  assert.ok(focused);await page.getByTestId('tooltip').waitFor();assert.doesNotMatch(await page.getByTestId('tooltip').innerText(),/[가-힣]/);await compare('meal-keyboard-tooltip')
  await page.keyboard.press('Enter');await page.getByTestId('item-menu').getByRole('button',{name:'Consume / use',exact:true}).waitFor();await compare('meal-menu',false)
  await page.getByTestId('item-menu').getByRole('button',{name:'Consume / use',exact:true}).click();assert.equal(playerAct(w,{type:'consume',uid:meal.uid}),null);await compare('actual-meal')
  assert.equal(player(w).bag.find(i=>i.uid===meal.uid)?.def,'Item.Bowl')
  await page.keyboard.press('Escape');await page.mouse.move(4,4);await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await compare('checkpoint-confirm',false);await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare('checkpoint-saved',false);await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare('continued-en')
  await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({declaredFixture:'Fresh Study world; finite initial bag of eight items and initial oatmeal quick slot, wrong likely pill belief with hidden Toxin mapping. No acquisition, cooking, appraisal or discovery claimed.',postTitleWorldWrites:false,rows,errors},null,2));console.log(JSON.stringify({wholePairs:rows.length,errors}))
}catch(error){await active?.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2));throw error}
finally{await browser.close();server.stop()}
