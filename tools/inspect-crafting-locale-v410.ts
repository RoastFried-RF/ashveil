import{chromium,type Page}from'playwright-core'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import assert from'node:assert/strict'
import{startNativePreview}from'./native-preview'
import{oatCultivationFixture}from'../tests/oat-cultivation-fixture'
import{boilProgressNativeFixture}from'../tests/boil-progress-fixture'
import{playerAct}from'../src/core/game'
import{player,type World}from'../src/core/ctx'
import{serialize,deserialize,stateHash}from'../src/core/save'
import{drinkVolume}from'../src/core/wash-water'
import{waterQuality,waterSafetyDef}from'../src/core/water-state'

const out=process.argv[2],selected=process.argv[3]??'all',size=process.argv[4]
assert.ok(out&&!existsSync(out),'Choose a new output directory');assert.ok(['all','craft','boil-resume','boil-cancel'].includes(selected));assert.ok(!size||['1440','1366','390'].includes(size));mkdirSync(out,{recursive:true})
const rows:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const scene of selected==='all'?['craft','boil-resume','boil-cancel']:[selected])for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([w])=>!size||String(w)===size)){
  let w:World,fixtureProof:unknown,boilUid:number|undefined
  if(scene==='craft'){const d=oatCultivationFixture('dry');w=d.w;fixtureProof=d.proof}
  else{const d=await boilProgressNativeFixture(scene==='boil-cancel'?'changed':'interrupted');w=d.w;boilUid=d.bottle.uid;fixtureProof={existingFixture:scene==='boil-cancel'?'boilProgressNativeFixture(changed)':'boilProgressNativeFixture(interrupted)',declaredEarlierCore80TurnBoilingAndStop:true,notEarlierBrowserInput:true}}
  w.s.saveMode='SaveMode.Study';w.s.achievementsDisabled=true;w.s.fx=[]
  const p=player(w),prefix=scene+'-'+width,raw=serialize(w.s);assert.deepEqual(JSON.parse(serialize(deserialize(raw))),JSON.parse(raw));writeFileSync(join(out,prefix+'-initial-world.json'),raw)
  proofs.push({scene,width,fixtureProof,declaredInitialStudyMode:true,initialBag:p.bag.map(i=>({uid:i.uid,def:i.def,count:i.count,uses:i.uses})),initialBoilJob:p.boilJob})
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);rows.push({scene,width,height,label,time:actual.time,hash:stateHash(actual)});await page.mouse.move(100,40);await page.screenshot({path:join(out,prefix+'-'+label+'.png')})
  }
  const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
  async function language(code:'ko'|'en'){await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption(code);await page.keyboard.press('Escape')}
  async function field(){await close();await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await page.getByTestId('boil-panel').waitFor()}
  async function englishCraft(){const win=page.getByTestId('win-craft');assert.doesNotMatch(await win.innerText(),/[가-힣]/);const attributes=await win.locator('[title],[aria-label],[placeholder]').evaluateAll(elements=>elements.flatMap(e=>['title','aria-label','placeholder'].map(k=>e.getAttribute(k)??'')));assert.doesNotMatch(attributes.join('\n'),/[가-힣]/)}
  async function saveContinue(label:string){
   await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare(label+'-saved')
   await close();await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare(label+'-continued')
  }
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('loaded')
  await page.keyboard.press('F2');await language('en');assert.equal(await page.getByTestId('craft-tab-field').innerText(),'Field & camp')
  if(scene==='craft'){
   await page.getByTestId('craft-tab-recipes').click();await englishCraft();await compare('english-recipes-read-only')
   await page.getByTestId('craft-search').fill('oatmeal');const row=page.getByTestId('Recipe.Oatmeal');await row.waitFor();assert.match(await row.innerText(),/Cook oatmeal/);await row.locator('.recipe-pin').click();await page.getByLabel('Pinned recipes',{exact:true}).check();await englishCraft();await compare('english-search-pin-read-only')
   await page.getByTestId('craft-search').fill('no matching recipe 410');assert.equal(await page.getByTestId('win-craft').locator('[data-testid^="Recipe."]').count(),0);assert.match(await page.getByTestId('win-craft').innerText(),/No recipes match/);await englishCraft();await compare('english-empty-search-read-only')
   await page.getByTestId('craft-search').fill('');await page.getByLabel('Pinned recipes',{exact:true}).uncheck();await page.getByTestId('craft-tab-maintenance').click();assert.match(await page.getByTestId('win-craft').innerText(),/permanently lowers maximum durability/);await englishCraft();await compare('english-maintenance-warning-read-only')
   await language('ko');assert.match(await page.getByTestId('win-craft').innerText(),/최대 내구가 영구 감소/);await compare('korean-maintenance-read-only');await language('en');await field();assert.doesNotMatch(await page.getByTestId('boil-panel').innerText(),/[가-힣]/);await compare('english-field-boiling-read-only');await saveContinue('same-original-world-after-language')
  }else{
   await field();const panel=page.getByTestId('boil-panel'),bottle=p.bag.find(i=>i.uid===boilUid)!;assert.doesNotMatch(await panel.innerText(),/[가-힣]/);assert.match(await panel.innerText(),/Paused boiling/);await compare('english-paused-original-boiling')
   const at=w.s.time,volume=drinkVolume(w,bottle),quality=waterQuality(w,bottle),fuel=p.bag.filter(i=>i.def==='Item.Wood').reduce((n,i)=>n+i.count,0),remaining=p.boilJob!.remaining,batches=p.boilJob!.batches??1
   if(scene==='boil-resume'){
    assert.equal(playerAct(w,{type:'waterTreatment',uid:boilUid!,method:'boil'}),null);await panel.locator('[data-boil-uid="'+boilUid+'"] [data-boil-action=start]').click();await compare('actual-resume-same-water-and-fuel');assert.equal(p.boilJob,undefined);assert.ok(w.s.time-at>=remaining*100);assert.equal(drinkVolume(w,bottle),volume);assert.equal(p.bag.filter(i=>i.def==='Item.Wood').reduce((n,i)=>n+i.count,0),fuel-batches);assert.equal(waterQuality(w,bottle).pathogen,0);assert.equal(waterQuality(w,bottle).ash,Math.round(quality.ash*waterSafetyDef(w).treatments.boil.ashMult*10000)/10000)
   }else{
    assert.match(await panel.innerText(),/original water, volume, quality or boiling rules changed/);assert.equal(playerAct(w,{type:'cancelBoil'}),null);await panel.locator('[data-boil-action=cancel]').click();await compare('actual-cancel-preserves-water-and-fuel');assert.equal(w.s.time,at);assert.equal(p.boilJob,undefined);assert.equal(drinkVolume(w,bottle),volume);assert.equal(p.bag.filter(i=>i.def==='Item.Wood').reduce((n,i)=>n+i.count,0),fuel)
   }
   await saveContinue('same-water-after-boiling-input')
  }
  await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({proofs,rows,errors,boundary:'Declared finite oat and prior interrupted-boiling Study fixtures. Real Title/settings/search/pin/tab/boil/checkpoint/continue inputs, independent Node complete-state equality. No post-Title world/clock/RNG/material writes. Main crafting shell/recipes/maintenance and boiling panel coverage; other field subpanels, dynamic logs, natural prior acquisition and a whole-game English claim remain outside this diagnostic.'},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),proofs,rows,errors,visibleCraftText:active?await active.getByTestId('win-craft').innerText().catch(()=>null):null},null,2));throw error}
finally{await browser?.close();server.stop()}
