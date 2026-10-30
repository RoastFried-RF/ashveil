import{chromium,type Page}from'playwright-core'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import assert from'node:assert/strict'
import{startNativePreview}from'./native-preview'
import{oatCultivationFixture}from'../tests/oat-cultivation-fixture'
import{playerAct}from'../src/core/game'
import{type World}from'../src/core/ctx'
import{serialize,deserialize,stateHash}from'../src/core/save'
import{drinkVolume}from'../src/core/wash-water'

const out=process.argv[2],size=process.argv[3];assert.ok(out&&!existsSync(out),'Choose a new output directory');assert.ok(!size||['1440','1366','390'].includes(size));mkdirSync(out,{recursive:true})
const rows:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([w])=>!size||String(w)===size)){
  const d=oatCultivationFixture('dry'),w=d.w,p=d.p,prefix='crop-locale-'+width
  // Declared initial manual-save mode for this UI diagnostic; not a normal creation/travel claim.
  w.s.saveMode='SaveMode.Study';w.s.achievementsDisabled=true
  const raw=serialize(w.s);assert.deepEqual(JSON.parse(serialize(deserialize(raw))),JSON.parse(raw));writeFileSync(join(out,prefix+'-initial-world.json'),raw);proofs.push({width,...d.proof,declaredInitialStudyMode:true})
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);rows.push({width,height,label,time:actual.time,hash:stateHash(actual)});await page.mouse.move(100,40);await page.screenshot({path:join(out,prefix+'-'+label+'.png')})
  }
  const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
  const field=async()=>{await close();await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await page.getByTestId('cultivation-panel').waitFor()}
  async function englishPanel(){
   const panel=page.getByTestId('cultivation-panel');assert.doesNotMatch(await panel.innerText(),/[가-힣]/);assert.match(await panel.innerText(),/Oat plot/)
   for(const summary of await panel.locator('summary').all())await summary.click()
   assert.doesNotMatch(await panel.innerText(),/[가-힣]/)
  }
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('loaded')
  await field();await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption('en');await page.keyboard.press('Escape');await englishPanel();await compare('english-rules-read-only')
  await page.getByTestId('crop-uproot-review').click();assert.match(await page.getByTestId('cultivation-panel').innerText(),/Wet earth/);await compare('english-clear-review-read-only')
  await page.getByRole('button',{name:'Keep growing',exact:true}).click();await compare('english-clear-cancel-read-only')
  const beforeWater=drinkVolume(w,d.water()),ml=1000;assert.equal(playerAct(w,{type:'waterCrop',pos:d.pos,uid:d.waterUid,ml}),null)
  await page.getByTestId('crop-water').and(page.locator('[data-water-uid="'+d.waterUid+'"]')).click();await compare('actual-water-original-crop');assert.equal(drinkVolume(w,d.water()),beforeWater-ml);assert.ok(d.crop().waterMl>0)
  await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare('same-watered-crop-saved')
  await close();await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare('same-watered-crop-continued')
  await field();await englishPanel();await page.getByTestId('crop-uproot-review').click();await compare('watered-crop-clear-review-read-only')
  const seed=d.crop().state.seedUid,seeds=p.bag.find(i=>i.uid===d.seedsUid)!.count;assert.equal(playerAct(w,{type:'uprootCrop',pos:d.pos,expectedSeed:seed}),null);await page.getByTestId('crop-uproot-confirm').click();await compare('actual-clear-no-returned-seed');assert.equal(p.bag.find(i=>i.uid===d.seedsUid)!.count,seeds);assert.equal(d.crop(),undefined)
  await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({proofs,rows,errors,boundary:'Declared original oat fixture seed3/water1000ml/clean grain2/noon/healthy body/Study mode. Actual Title, language/settings, details, review/cancel, watering, save/continue and confirmed clearing. Whole independent Node state equality; no post-Title world/time/RNG/resource writes. This is crop-panel translation coverage, not the full crafting window, dynamic logs, normal initial acquisition or five-day growth.'},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
