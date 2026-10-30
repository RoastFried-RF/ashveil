/** Declared initial inventory; real hover/keyboard/language/drop/save inputs only. */
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
const rows:unknown[]=[],errors:string[]=[]
const server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 const {db,report}=loadDb();assert.deepEqual(report.errors,[])
 for(const[width,height]of [[1440,1080],[1366,768],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(45000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const w:World={db,s:newGame(db,{seed:'ashveil-item-details-v405',background:'Bg.Deserter',mods:db.loadedMods,characterRoll:0,saveMode:'SaveMode.Study',overworld:true,legacyResidents:[]})};runUntilInput(w)
  const p=player(w);p.bag=[];p.hotbar=Array(10).fill(null)
  const knife=makeItem(w,'Item.RustyKnife'),coat=makeItem(w,'Item.LeatherCoat'),unknown=makeItem(w,'Item.PioneerArm'),known=makeItem(w,'Item.PioneerArm')
  coat.stuff={body:[{material:'Material.Leather',massG:100},{material:'Material.Linen',massG:50}]};coat.wetness={torso:37};coat.maxDurability=74;coat.durability=45
  unknown.appraisal=1;known.appraisal=2
  for(const item of [knife,coat,unknown,known])assert.equal(addToBag(w,p,item),0)
  const raw=serialize(w.s);writeFileSync(join(out,width+'-initial-world.json'),raw)
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas')
   await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   rows.push({label,width,height,time:actual.time,hash:stateHash(actual)})
   writeFileSync(join(out,width+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,width+'-'+label+'-expected.json'),serialize(w.s))
   await page.screenshot({path:join(out,width+'-'+label+'.png')})
  }
  const item=(uid:number)=>page.getByTestId('win-inv').locator(`[data-inventory-item="${uid}"]`)
  async function hover(uid:number){await page.mouse.move(0,0);await item(uid).hover();await page.getByTestId('tooltip').waitFor();return page.getByTestId('tooltip').innerText()}
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click()
  await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor()
  assert.match(await hover(knife.uid),/날이 무뎌 베기보다 찢는다/);await compare('knife-ko')
  await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption('en');await page.keyboard.press('Escape')
  const blade=await hover(knife.uid);assert.match(blade,/Slash: Slash 6 · penetration 8 · accuracy \+10 · energy 4/);assert.doesNotMatch(blade,/[가-힣]/);await compare('knife-en')
  const armor=await hover(coat.uid);assert.match(armor,/Tanned leather·Linen \(mass-weighted mixture\)/);assert.match(armor,/Wetness 37–37%/);assert.doesNotMatch(armor,/[가-힣]/);await compare('coat-en')
  const hidden=await hover(unknown.uid);assert.match(hidden,/Warm metal arm/);assert.doesNotMatch(hidden,/Pioneer prosthetic|base efficiency|[가-힣]/);await compare('unknown-relic-en')
  const identified=await hover(known.uid);assert.match(identified,/Pioneer prosthetic arm/);assert.match(identified,/base efficiency/);assert.doesNotMatch(identified,/[가-힣]/);await compare('known-relic-en')
  // Actual Tab navigation reaches the original blade and opens the same details.
  await page.getByTestId('inventory-search').click()
  let focused=false
  for(let i=0;i<60;i++){await page.keyboard.press('Tab');focused=await page.evaluate(uid=>document.activeElement?.getAttribute('data-inventory-item')===String(uid),knife.uid);if(focused)break}
  assert.ok(focused,'Tab reaches original blade');assert.match(await page.getByTestId('tooltip').innerText(),/Rusty knife/);await compare('knife-keyboard-en')
  await page.keyboard.press('Enter');await page.getByTestId('item-menu').getByRole('button',{name:'Drop',exact:true}).click();assert.equal(playerAct(w,{type:'drop',uid:knife.uid}),null);await compare('knife-dropped')
  await page.keyboard.press('Escape');await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare('saved-en')
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare('continued-en')
  await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor();assert.doesNotMatch(await hover(unknown.uid),/base efficiency/);await compare('continued-unknown-en')
  await context.close()
 }
 assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({declaredFixture:'Fresh Study world with original blade, finite mass-mixed/wet/repaired coat and two independently appraised arms. Diagnostic stock is not natural acquisition. No post-Title world writes.',rows,errors},null,2))
 console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
