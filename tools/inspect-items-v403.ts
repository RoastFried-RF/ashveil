/** Finite initial diagnostic inventory; actual search/menu/drop/save inputs only after Title. */
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {chromium,type Page} from 'playwright-core'
import {loadDb} from './loadContent'
import {startNativePreview} from './native-preview'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {serialize,stateHash} from '../src/core/save'

const out=process.argv[2];assert.ok(out&&!existsSync(out),'Use a new output directory');mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const rows:unknown[]=[],errors:string[]=[]
type Hook={__ashveil:{world():World}}
let active:Page|undefined
try {
 const {db,report}=loadDb();assert.deepEqual(report.errors,[])
 for(const [width,height]of [[1440,1080],[1366,768],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const w:World={db,s:newGame(db,{seed:'ashveil-items-v403',background:'Bg.Deserter',mods:db.loadedMods,characterRoll:0,saveMode:'SaveMode.Study',overworld:true,legacyResidents:[]})};runUntilInput(w)
  // Finite diagnostic stock and explicit prior belief only. No acquisition or discovery is claimed.
  const p=player(w);p.bag=[];p.hotbar=Array(10).fill(null)
  const medical=makeItem(w,'Item.MedicalBag'),arm=makeItem(w,'Item.PioneerArm'),pill=makeItem(w,'Item.PillYellow')
  pill.pillRemaining=.75
  for(const it of [medical,arm,pill])assert.equal(addToBag(w,p,it),0)
  w.s.knowledge.pillMap[pill.def]='Pill.Toxin'
  ;(w.s.knowledge.pillBeliefs??={})[pill.def]={belief:'Pill.Analgesic',confidence:'likely',ruledOut:[],evidence:[]}
  p.hotbar[0]={kind:'item',def:arm.def};p.hotbar[1]={kind:'item',def:pill.def}
  const raw=serialize(w.s);writeFileSync(join(out,width+'-initial-world.json'),raw)
  async function compare(label:string,capture=true){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
   await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   rows.push({label,width,height,time:actual.time,hash:stateHash(actual)})
   if(capture)await page.screenshot({path:join(out,width+'-'+label+'.png')})
  }
  const item=(uid:number)=>page.getByTestId('win-inv').locator(`[data-inventory-item="${uid}"]`)
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click()
  await page.keyboard.press('i');await compare('inventory-ko')
  await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption('en')
  assert.match(await page.getByTestId('checkpoint-controls').innerText(),/Save mode · Study/)
  await page.keyboard.press('Escape');await compare('inventory-en')
  assert.match(await item(arm.uid).getAttribute('aria-label')??'',/^Warm metal arm/)
  assert.match(await item(pill.uid).getAttribute('aria-label')??'',/Yellow pill \(Painkiller suspected\) \[3\/4 tablet\]/)
  assert.match(await page.getByTestId('hotbar-0').getAttribute('aria-label')??'',/Warm metal arm/)
  const search=page.getByTestId('inventory-search')
  for(const q of ['Ｍｅｄｉｃａｌ　ｂａｇ','의료가방']){
   await search.fill(q);assert.equal(await item(medical.uid).evaluate(e=>e.classList.contains('inventory-unmatched')),false)
   await compare(q.startsWith('Ｍ')?'nfkc-search':'original-search',q.startsWith('Ｍ'))
  }
  await search.fill('Pioneer prosthetic');assert.equal(await item(arm.uid).evaluate(e=>e.classList.contains('inventory-unmatched')),true)
  await search.fill('Spoiled medicine');assert.equal(await item(pill.uid).evaluate(e=>e.classList.contains('inventory-unmatched')),true)
  await compare('hidden-name-search');await search.fill('')
  await page.locator('.inventory-groups').getByRole('button',{name:'Medical',exact:true}).click()
  assert.equal(await item(medical.uid).evaluate(e=>e.classList.contains('inventory-unmatched')),false)
  await compare('medical-filter',false);await page.locator('.inventory-groups').getByRole('button',{name:'All',exact:true}).click()
  await item(pill.uid).click({button:'right'});await page.getByTestId('item-menu').getByRole('button',{name:'Assign to quick slot',exact:true}).waitFor()
  assert.match(await page.getByTestId('item-menu').innerText(),/Painkiller suspected/);assert.doesNotMatch(await page.getByTestId('item-menu').innerText(),/Spoiled medicine/)
  await compare('pill-menu');await page.keyboard.press('Escape')
  // Real keyboard navigation, without DOM focus injection.
  await search.click()
  let focused=false
  for(let i=0;i<60;i++){await page.keyboard.press('Tab');focused=await page.evaluate(uid=>document.activeElement?.getAttribute('data-inventory-item')===String(uid),arm.uid);if(focused)break}
  assert.ok(focused,'Tab reaches original relic')
  await page.keyboard.press('Enter');await page.getByTestId('item-menu').getByRole('button',{name:'Drop',exact:true}).waitFor();await compare('relic-keyboard-menu')
  await page.getByTestId('item-menu').getByRole('button',{name:'Drop',exact:true}).click();assert.equal(playerAct(w,{type:'drop',uid:arm.uid}),null)
  await compare('relic-dropped');assert.match(await page.getByTestId('hotbar-0').getAttribute('aria-label')??'',/Warm metal arm/)
  assert.equal(await page.getByTestId('hotbar-count-0').innerText(),'0')
  await page.keyboard.press('Escape');await page.getByTestId('hotbar-0').hover();await page.getByTestId('tooltip').waitFor()
  assert.match(await page.getByTestId('tooltip').innerText(),/^Warm metal arm/);assert.doesNotMatch(await page.getByTestId('tooltip').innerText(),/Pioneer prosthetic arm/)
  await compare('empty-reference-tooltip');await page.getByTestId('hotbar-0').click();assert.equal(await page.getByTestId('hint').innerText(),'Warm metal arm: none remaining');await compare('empty-reference-hint',false);await page.getByTestId('hint').click();await page.getByRole('button',{name:'Settings (F3)',exact:true}).hover()
  await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-confirm').waitFor();await compare('checkpoint-confirm')
  await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();assert.match(await page.getByTestId('checkpoint-save-status').innerText(),/^Checkpoint saved\./);await compare('checkpoint-saved')
  await page.keyboard.press('Escape');await page.keyboard.press('Period');assert.equal(playerAct(w,{type:'wait'}),null);await compare('waited',false)
  await page.getByRole('button',{name:'Title',exact:true}).click();await page.getByTestId('title-language').waitFor();await page.reload();await page.getByTestId('continue').click();await compare('continued-en')
  await context.close()
 }
 assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({declaredFixture:'Fresh Study-mode world; initial bag replaced with MedicalBag, unappraised PioneerArm, 3/4 Yellow pill; initial quickbar references and deliberately wrong likely Analgesic belief with hidden Toxin mapping. No acquisition/discovery claimed.',postTitleWorldWrites:false,rows,errors},null,2))
 console.log(JSON.stringify({wholePairs:rows.length,errors}))
}catch(error){await active?.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2));throw error}
finally{await browser.close();server.stop()}
