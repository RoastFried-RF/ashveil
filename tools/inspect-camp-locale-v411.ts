import{chromium,type Page}from'playwright-core'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import assert from'node:assert/strict'
import{startNativePreview}from'./native-preview'
import{pineTeaNativeFixture}from'../tests/pine-tea-fixture'
import{cookingNativeFixture}from'../tests/campfire-cooking-fixture'
import{brewProgressNativeFixture}from'../tests/brew-progress-fixture'
import{terrainFireNativeFixture}from'../tests/terrain-fire-fixture'
import{brushClearingNativeFixture}from'../tests/brush-clearing-fixture'
import{playerAct}from'../src/core/game'
import{calendar}from'../src/core/climate-state'
import{player,tileAt,turnOf,TURNS_PER_DAY,type World}from'../src/core/ctx'
import{invalidateLights,updatePlayerVision}from'../src/core/fov'
import{fireTurnsLeft,campfireAt}from'../src/core/campfire'
import{drinkVolume}from'../src/core/wash-water'
import{waterQuality,waterSafetyDef}from'../src/core/water-state'
import{serialize,deserialize,stateHash}from'../src/core/save'
import type{Action}from'../src/core/actions'
import type{Pos}from'../src/core/geom'

const scenes=['campfire','cooking','tea-resume','tea-cancel','terrain-fire','forage','brush']as const
type Scene=typeof scenes[number]
const out=process.argv[2],selected=process.argv[3]??'all',size=process.argv[4]
assert.ok(out&&!existsSync(out),'Choose a new output directory');assert.ok(selected==='all'||scenes.some(s=>s===selected));assert.ok(!size||['1440','1366','390'].includes(size));mkdirSync(out,{recursive:true})
const rows:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
async function prepare(scene:Scene):Promise<{w:World;uid?:number;pos?:Pos;proof:object}>{
 if(scene==='campfire'){const d=await pineTeaNativeFixture(),fuel=d.add('Item.Wood',2);return{w:d.w,uid:fuel.uid,pos:d.pos,proof:{fixture:'pineTeaNativeFixture',declaredAdditionalWood:2,originalFireUid:campfireAt(d.w,d.pos)!.uid}}}
 if(scene==='cooking'){const d=await cookingNativeFixture();return{w:d.w,uid:d.raw.uid,pos:d.pos,proof:{fixture:'cookingNativeFixture',originalFoodUid:d.raw.uid,originalFireUid:campfireAt(d.w,d.pos)!.uid}}}
 if(scene==='tea-resume'||scene==='tea-cancel'){const d=await brewProgressNativeFixture(scene==='tea-cancel'?'changed':'interrupted');return{w:d.w,uid:d.bottle.uid,proof:{fixture:'brewProgressNativeFixture',declaredEarlier80CoreTurnsAndInterruption:true,declaredEarlierPour:scene==='tea-cancel'?200:0,notEarlierBrowserInput:true}}}
 if(scene==='terrain-fire'){const d=terrainFireNativeFixture('uiExtinguish');return{w:d.w,pos:d.treePos,proof:{fixture:'terrainFireNativeFixture(uiExtinguish)',earlierCoreFireAndApproachAreInitialConditions:true,...d.proof}}}
 const d=brushClearingNativeFixture(),prior=d.s.time
 if(scene==='forage'){
  for(let days=0;calendar(d.w).season.id!=='Season.Summer'&&days<120;days++)d.s.time+=TURNS_PER_DAY*100
  assert.equal(calendar(d.w).season.id,'Season.Summer');tileAt(d.w,d.north).gatherAt=turnOf(d.w)+100;delete tileAt(d.w,d.east).gatherAt;d.p.nextAct=d.s.time;d.p.needs.nutritionDay=Math.floor(turnOf(d.w)/TURNS_PER_DAY);d.s.fx=[];invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 }
 return{w:d.w,uid:d.machete.uid,pos:scene==='forage'?d.east:d.north,proof:{fixture:'brushClearingNativeFixture',declaredCalendarAdvanceTU:d.s.time-prior,noEarlierSeasonalGrowthClaim:true,originalGroundItems:structuredClone(tileAt(d.w,d.east).items)}}
}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const scene of selected==='all'?scenes:[selected as Scene])for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([w])=>!size||String(w)===size)){
  const d=await prepare(scene),w=d.w,p=player(w),prefix=scene+'-'+width
  w.s.saveMode='SaveMode.Study';w.s.achievementsDisabled=true;w.s.fx=[]
  const raw=serialize(w.s);assert.deepEqual(JSON.parse(serialize(deserialize(raw))),JSON.parse(raw));writeFileSync(join(out,prefix+'-initial-world.json'),raw);proofs.push({scene,width,...d.proof,declaredInitialStudyMode:true})
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);rows.push({scene,width,height,label,time:actual.time,hash:stateHash(actual)});await page.mouse.move(100,40)
   const panelId=scene==='campfire'?'campfire-panel':scene==='cooking'?'cooking-panel':scene.startsWith('tea-')?'tea-panel':scene==='terrain-fire'?'terrain-fire-panel':scene==='forage'?'seasonal-forage':'brush-clearing',panel=page.getByTestId(panelId)
   if(await panel.count()&&await panel.isVisible())await panel.scrollIntoViewIfNeeded()
   await page.screenshot({path:join(out,prefix+'-'+label+'.png')})
  }
  const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
  async function field(){await close();await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click()}
  async function language(code:'ko'|'en'){await close();await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption(code);await page.keyboard.press('Escape');await field()}
  async function english(){
   for(const id of ['campfire-panel','cooking-panel','tea-panel','terrain-fire-panel','seasonal-forage','brush-clearing']){const panel=page.getByTestId(id);if(!await panel.count()||!await panel.isVisible())continue;assert.doesNotMatch(await panel.innerText(),/[가-힣]/,id);const attrs=await panel.locator('[title],[aria-label],[placeholder]').evaluateAll(es=>es.flatMap(e=>['title','aria-label','placeholder'].map(k=>e.getAttribute(k)??'')));assert.doesNotMatch(attrs.join('\n'),/[가-힣]/,id+' attributes')
    for(const option of await panel.locator('option[value]').all()){const uid=Number(await option.getAttribute('value')),item=p.bag.find(i=>i.uid===uid);if(item&&item.count>1)assert.equal((await option.innerText()).split('×'+item.count).length-1,1,'A stack count must appear exactly once')}
   }
  }
  async function act(action:Action,input:()=>Promise<unknown>,label:string){assert.equal(playerAct(w,action),null);await input();await compare(label)}
  async function saveContinue(label:string){
   await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare(label+'-saved')
   await close();await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare(label+'-continued')
  }
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('loaded');await language('en');await english();await compare('english-field-read-only')
  if(scene==='campfire'){
   const panel=page.getByTestId('campfire-panel'),count=p.bag.find(i=>i.uid===d.uid)!.count,fireUid=campfireAt(w,d.pos!)!.uid
   await panel.locator('select').selectOption(String(d.uid));await english();await compare('english-actual-fuel-selected-read-only')
   await act({type:'fireWork',pos:d.pos!,uid:d.uid!},()=>panel.locator('[data-fire-action=fuel]').click(),'actual-same-fire-fuel-work');assert.equal(p.bag.find(i=>i.uid===d.uid)!.count,count-1)
   await act({type:'extinguishFire',pos:d.pos!},()=>panel.locator('[data-fire-action=out]').click(),'actual-one-turn-extinguish');assert.equal(fireTurnsLeft(w,d.pos!),0)
   await act({type:'fireWork',pos:d.pos!,uid:d.uid!},()=>panel.locator('[data-fire-action=fuel]').click(),'actual-same-fire-relit');assert.equal(campfireAt(w,d.pos!)!.uid,fireUid);assert.ok(fireTurnsLeft(w,d.pos!)>0)
  }else if(scene==='cooking'){
   await close();await page.keyboard.press('i');await page.getByTestId('win-inv').locator('[data-uid="'+d.uid+'"]').click({button:'right'})
   await act({type:'stageCooking',uid:d.uid!,pos:d.pos!},()=>page.getByRole('button',{name:'Set on campfire ('+d.pos!.x+','+d.pos!.y+')',exact:true}).click(),'actual-original-food-staged');await field();await english();await compare('english-original-food-progress');await saveContinue('original-food-on-original-fire');await field()
   let batch=w.s.map.cooking!.find(b=>b.item.uid===d.uid)!;await act({type:'rest',turns:batch.total-batch.progress},()=>page.locator('[data-cooking-action=wait]').click(),'actual-same-food-cooked');batch=w.s.map.cooking!.find(b=>b.item.uid===d.uid)!;assert.equal(batch.item.def,'Item.BakedPotato');assert.equal(batch.item.count,1);await english()
   const neglect=w.db.get<import('../src/core/types').FoodSafetyDef>('FoodSafety.Human').cooking!.neglectTurns;await act({type:'rest',turns:neglect},()=>page.locator('[data-cooking-action=rest]').click(),'actual-neglect-burn-check');await english()
   await act({type:'takeCooking',uid:d.uid!},()=>page.locator('[data-cooking-action=take]').click(),'actual-same-food-taken');assert.ok(p.bag.some(i=>i.uid===d.uid&&i.def==='Item.BakedPotato'))
  }else if(scene==='tea-resume'||scene==='tea-cancel'){
   const panel=page.getByTestId('tea-panel'),bottle=p.bag.find(i=>i.uid===d.uid)!,ml=drinkVolume(w,bottle),quality=waterQuality(w,bottle),at=w.s.time;assert.match(await panel.innerText(),/turns remaining/);await saveContinue('original-paused-tea');await field()
   if(scene==='tea-resume'){const remaining=p.brewJob!.remaining;await act({type:'brewTea',uid:d.uid!},()=>panel.locator('[data-tea-bottle="'+d.uid+'"] [data-tea-action=brew]').click(),'actual-original-tea-resumed');assert.equal(p.brewJob,undefined);assert.ok(w.s.time-at>=remaining*100);assert.equal(bottle.def,'Item.PineTeaBottle');assert.equal(drinkVolume(w,bottle),ml);assert.equal(waterQuality(w,bottle).pathogen,0);assert.equal(waterQuality(w,bottle).ash,Math.round(quality.ash*waterSafetyDef(w).treatments.boil.ashMult*10000)/10000);assert.equal(waterQuality(w,bottle).salinity,quality.salinity)}
   else{assert.match(await panel.innerText(),/original water, pine needles, fire or brewing rules changed/);await act({type:'cancelBrew'},()=>panel.locator('[data-tea-action=cancel]').click(),'actual-changed-tea-cancelled');assert.equal(w.s.time,at);assert.equal(drinkVolume(w,bottle),ml);assert.deepEqual(waterQuality(w,bottle),quality)}
  }else if(scene==='terrain-fire'){
   const volume=()=>p.bag.reduce((n,i)=>n+drinkVolume(w,i),0),ml=volume();await act({type:'putOutTerrainFire',pos:d.pos!},()=>page.getByTestId('put-out-terrain-'+d.pos!.x+'-'+d.pos!.y).click(),'actual-same-water-extinguishes-terrain');assert.equal(ml-volume(),w.db.get<import('../src/core/types').CampfireDef>('Campfire.Hearth').wildfire!.waterMl);assert.equal(tileAt(w,d.pos!).terrainFire,undefined)
  }else if(scene==='forage'){
   assert.match(await page.getByTestId('seasonal-forage').innerText(),/Summer/);await act({type:'gather',pos:d.pos!},()=>page.getByTestId('seasonal-forage').locator('[data-forage-action=gather]:enabled').click(),'actual-seasonal-berries-harvested');assert.ok(tileAt(w,d.pos!).gatherAt!>turnOf(w));await english();assert.match(await page.getByTestId('seasonal-forage').innerText(),/Wait for new berries/)
  }else{
   assert.match(await page.getByTestId('brush-clearing').innerText(),/Permanently removes.*no longer regrow/);assert.match(await page.getByTestId('brush-clearing').innerText(),/Equip a tool/);await close();await page.keyboard.press('i');await page.getByTestId('win-inv').locator('[data-uid="'+d.uid+'"]').click({button:'right'})
   await act({type:'equip',uid:d.uid!},()=>page.getByRole('button',{name:'Equip',exact:true}).click(),'actual-original-machete-equipped');await field();await english();await act({type:'clearBrush',pos:d.pos!},()=>page.getByTestId('clear-brush-'+d.pos!.x+'-'+d.pos!.y).click(),'actual-permanent-clear-same-ground');assert.equal(tileAt(w,d.pos!).t,'Terrain.Earth');assert.equal(tileAt(w,d.pos!).gatherAt,undefined)
  }
  await language('ko');await compare('korean-field-read-only');await language('en');await english();await compare('english-field-restored-read-only');await saveContinue('actual-original-result');await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({proofs,rows,errors,boundary:'Declared finite existing fire/food/brewing/brush fixtures, explicit summer calendar and earlier Core steps only before Title. Actual Title/settings/keys/pointer/fuel/cooking/tea/fire/forage/clearing/checkpoint/continue inputs, independent Node whole-state equality. No post-Title world/body/time/RNG/resource writes. Six camp panels only, not all F2/logs or natural initial travel/acquisition.'},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),proofs,rows,errors,visibleCraftText:active?await active.getByTestId('win-craft').innerText().catch(()=>null):null},null,2));throw error}
finally{await browser?.close();server.stop()}
