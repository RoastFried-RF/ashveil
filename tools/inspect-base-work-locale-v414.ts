import assert from'node:assert/strict'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import{chromium,type Page,type BrowserContext,type Locator}from'playwright-core'
import{startNativePreview}from'./native-preview'
import{baseWorkLocaleFixture,baseWorkScenes,type BaseWorkScene}from'../tests/base-work-locale-fixture'
import{playerAct}from'../src/core/game'
import{player,tileAt,type World}from'../src/core/ctx'
import{baseCraftStock,baseCampDef}from'../src/core/base-camp-state'
import{baseBedQuote}from'../src/core/base-rest'
import{fireTurnsLeft}from'../src/core/campfire'
import{drinkVolume}from'../src/core/wash-water'
import{serialize,deserialize,stateHash}from'../src/core/save'
import type{Action}from'../src/core/actions'
import type{BaseTaskRequest}from'../src/core/types'

const out=process.argv[2],selected=process.argv[3]??'all',size=process.argv[4]
assert.ok(out&&!existsSync(out),'Choose a new output directory');assert.ok(selected==='all'||baseWorkScenes.some(s=>s===selected));assert.ok(!size||['1440','1366','390'].includes(size));mkdirSync(out,{recursive:true})
const rows:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const scene of selected==='all'?baseWorkScenes:[selected as BaseWorkScene])for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([v])=>!size||String(v)===size)){
  const d=baseWorkLocaleFixture(scene),w=d.w,p=player(w),c=d.worker,prefix=scene+'-'+width,name=c.name,initialCloth=d.cloth.count
  w.s.saveMode='SaveMode.Study';w.s.achievementsDisabled=true;w.s.fx=[]
  const raw=serialize(w.s);assert.equal(serialize(deserialize(raw)),raw);writeFileSync(join(out,prefix+'-initial-world.json'),raw);proofs.push({width,...d.proof,declaredStudyMode:true,noPostTitleWorldWrites:true})
  const context:BrowserContext=await browser.newContext({viewport:{width,height}}),page:Page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const panel=():Locator=>page.getByTestId('base-camp-panel'),worker=():Locator=>panel().locator('[data-base-worker="'+c.id+'"]')
  async function close(){for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
  async function field(){await close();await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click()}
  async function language(code:'ko'|'en'){await close();await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption(code);await page.keyboard.press('Escape');await field()}
  async function english(){
   const text=await panel().evaluate(e=>{const copy=e.cloneNode(true)as HTMLElement;copy.querySelectorAll('[data-original-person-name]').forEach(n=>n.textContent='');return copy.textContent??''});assert.doesNotMatch(text,/[가-힣]/,'Base static text')
   const attrs=await panel().locator('[title],[aria-label],[placeholder]').evaluateAll(es=>es.flatMap(e=>['title','aria-label','placeholder'].map(k=>e.getAttribute(k)??'')));assert.doesNotMatch(attrs.join('\n').split(name).join(''),/[가-힣]/,'Base attributes except original name');assert.equal(c.name,name)
   assert.equal(await panel().evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'Base internal overflow')
  }
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[];writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);rows.push({scene,width,height,label,time:actual.time,hash:stateHash(actual)});await page.mouse.move(100,40)
   let focus=panel()
   if(label.startsWith('actual-queue-'))focus=worker().locator('[data-base-queued-order]').last()
   else if(label==='english-actual-finished-stock')focus=worker().getByTestId('base-craft-stock-target')
   else if(label==='english-original-finite-fire-care')focus=worker().getByTestId('base-task-status')
   if(await focus.count()&&await focus.isVisible())await focus.scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-'+label+'.png')})
  }
  async function act(action:Action,input:()=>Promise<unknown>,label:string){assert.equal(playerAct(w,action),null);await input();await compare(label)}
  async function saveContinue(label:string){await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare(label+'-saved');await close();await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare(label+'-continued')}
  async function widgets(batches:number){await worker().getByLabel(name+': recipe',{exact:true}).selectOption('Recipe.Bandage');await worker().getByLabel(name+': batches or target stock',{exact:true}).fill(String(batches));await worker().getByLabel(name+': hauling or gathering item',{exact:true}).selectOption('Item.Wood');await worker().getByLabel(name+': campfire',{exact:true}).selectOption(String(d.fire.uid));await worker().getByLabel(name+': bedding',{exact:true}).selectOption(String(d.bed.uid))}
  const stored=(id:string)=>(tileAt(w,d.store).cont?.items??[]).filter(i=>i.def===id).reduce((n,i)=>n+i.count,0)
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('loaded');await language('en');await english();await compare('english-original-base-read-only');await saveContinue('original-base-scene');await field()
  if(scene==='claim'){
   const at=w.s.time;assert.equal(Boolean(w.s.map.baseCamp),false);await act({type:'claimBase',pos:d.store},()=>page.getByTestId('base-claim').click(),'actual-original-chest-claimed');assert.equal(w.s.time-at,20000);assert.equal(w.s.map.baseCamp!.storeUid,d.chest.uid);assert.equal(tileAt(w,d.store).placed!.item.uid,d.chest.uid);await english();await saveContinue('same-chest-actual-base')
  }else{
   const transfer=panel().locator('details').first();await transfer.locator('summary').click();const button=panel().locator('[data-base-put="'+d.cloth.uid+'"]');assert.match(await button.innerText(),new RegExp('Cloth scrap ×'+initialCloth));assert.equal((await button.innerText()).match(new RegExp('×'+initialCloth,'g'))?.length,1)
   const at=w.s.time;await act({type:'baseTransfer',direction:'put',uid:d.cloth.uid},()=>button.click(),'actual-original-cloth-stack-stored');assert.equal(w.s.time-at,100);assert.equal((tileAt(w,d.store).cont!.items.find(i=>i.uid===d.cloth.uid))!.count,initialCloth)
   await widgets(2);const bedQuote=baseBedQuote(w,d.bedPos,c),bedAt=w.s.time;assert.equal(bedQuote.error,null);assert.equal(await worker().locator('[data-base-bed=assign]').innerText(),'Allow bedding use ('+bedQuote.turns+' '+(bedQuote.turns===1?'turn':'turns')+')')
   await act({type:'baseBed',target:c.id,pos:d.bedPos},()=>worker().locator('[data-base-bed=assign]').click(),'actual-original-bedding-permission');assert.equal(w.s.time-bedAt,bedQuote.turns*100);assert.equal(w.s.map.baseCamp!.beds![d.bed.uid].tenant,c.id)
   await act({type:'baseBed',pos:d.bedPos},()=>worker().locator('[data-base-bed=release]').click(),'actual-original-bedding-permission-released');assert.equal(w.s.map.baseCamp!.beds![d.bed.uid],undefined)
   await act({type:'baseAssign',target:c.id,kind:'guard'},()=>worker().locator('[data-base-order=guard]').click(),'actual-guard-order')
   const queue=worker().locator('[data-base-queue="'+c.id+'"]');await queue.locator('summary').click()
   const limit=baseCampDef(w).queueLimit!;assert.ok(limit>=2)
   for(const kind of['craft','craftStock','guard','haul','gather','water','fire']as BaseTaskRequest['kind'][]){
    const current=w.s.map.baseCamp!.queues?.[c.id]??[]
    if(current.length>=limit){const id=current[0].id;await act({type:'baseQueueEdit',target:c.id,id,operation:'remove'},()=>queue.locator('[data-base-queued-order="'+id+'"]').getByRole('button',{name:'Remove from queue (1 turn)',exact:true}).click(),'actual-queue-make-room-'+kind)}
    await queue.getByLabel(name+': next task kind',{exact:true}).selectOption(kind);const request={kind,recipe:'Recipe.Bandage',batches:2,item:'Item.Wood',firePos:d.firePos};await act({type:'baseQueueAdd',target:c.id,request},()=>page.getByTestId('base-queue-add').click(),'actual-queue-add-'+kind);await english()
   }
   const order=w.s.map.baseCamp!.queues![c.id],last=order.at(-1)!,beforeQueue=order.map(t=>t.id)
   await act({type:'baseQueueEdit',target:c.id,id:last.id,operation:'up'},()=>queue.locator('[data-base-queued-order="'+last.id+'"]').getByRole('button',{name:'Move up (1 turn)',exact:true}).click(),'actual-queue-reordered');assert.notDeepEqual(order.map(t=>t.id),beforeQueue)
   const first=order[0];await act({type:'baseQueueEdit',target:c.id,id:first.id,operation:'remove'},()=>queue.locator('[data-base-queued-order="'+first.id+'"]').getByRole('button',{name:'Remove from queue (1 turn)',exact:true}).click(),'actual-queue-entry-removed');await saveContinue('same-original-queued-orders');await field()
   await act({type:'baseAssign',target:c.id,kind:'cancel'},()=>worker().locator('[data-base-order=cancel]').click(),'actual-task-and-queue-cancelled');assert.equal(w.s.map.baseCamp!.queues?.[c.id],undefined);assert.equal(w.s.map.baseCamp!.tasks[c.id],undefined);assert.equal(stored('Item.Cloth'),initialCloth)
   await widgets(1);await act({type:'baseAssign',target:c.id,kind:'water',batches:1},()=>worker().locator('[data-base-order=water]').click(),'actual-original-water-supply-assigned');await close()
   for(let i=0;!tileAt(w,d.store).cont!.items.some(item=>item.uid===d.water.uid)&&i<10;i++)await act({type:'rest',turns:200},()=>page.keyboard.press('r'),'actual-original-worker-water-delivery-'+i)
   const bottle=tileAt(w,d.store).cont!.items.find(item=>item.uid===d.water.uid);assert.ok(bottle);assert.equal(drinkVolume(w,bottle),1000);await field();await english();await compare('english-original-vessel-delivered');await saveContinue('same-worker-finite-deliveries')
   await field();
   await widgets(3);await act({type:'baseAssign',target:c.id,kind:'haul',item:'Item.Wood',batches:3},()=>worker().locator('[data-base-order=haul]').click(),'actual-ground-wood-haul-assigned');await close()
   for(let i=0;stored('Item.Wood')<3&&i<10;i++)await act({type:'rest',turns:200},()=>page.keyboard.press('r'),'actual-original-worker-haul-'+i)
   assert.equal(stored('Item.Wood'),3);assert.ok(tileAt(w,d.store).cont!.items.some(i=>i.uid===d.wood.uid));assert.ok(!tileAt(w,d.ground).items.some(i=>i.uid===d.wood.uid));await field();await english();await compare('english-original-wood-delivered')
   await widgets(2);await act({type:'baseAssign',target:c.id,kind:'craftStock',recipe:'Recipe.Bandage',batches:2},()=>worker().locator('[data-base-order=craftStock]').click(),'actual-minimum-stock-assigned');await close()
   for(let i=0;stored('Item.Bandage')<2&&i<10;i++)await act({type:'rest',turns:200},()=>page.keyboard.press('r'),'actual-original-worker-craft-'+i)
   assert.ok(stored('Item.Bandage')>=2);assert.equal(baseCraftStock(w,c)!.needed,0);assert.ok(stored('Item.Cloth')<initialCloth);await field();await english();await compare('english-actual-finished-stock');await saveContinue('same-chest-worker-and-stock');await field();await widgets(1)
   const fuel=stored('Item.Wood'),left=fireTurnsLeft(w,d.firePos),fireAt=w.s.time
   await act({type:'baseAssign',target:c.id,kind:'fire',firePos:d.firePos},()=>worker().locator('[data-base-order=fire]').click(),'actual-original-fire-care-assigned');await close();await act({type:'rest',turns:200},()=>page.keyboard.press('r'),'actual-original-worker-finite-fire-care');assert.ok(stored('Item.Wood')<fuel);assert.ok(fireTurnsLeft(w,d.firePos)>Math.max(0,left-(w.s.time-fireAt)/100));assert.equal(tileAt(w,d.firePos).placed!.item.uid,d.fire.uid);await field();await english();await compare('english-original-finite-fire-care')

   proofs.push({scene,width,queueKindsAllSeven:true,actualHaulUid:d.wood.uid,actualClothUid:d.cloth.uid,actualStoredBandages:stored('Item.Bandage'),actualDeliveredWaterUid:d.water.uid,actualDeliveredMl:1000,deliverySnapshot:prefix+'-english-original-vessel-delivered-actual.json',sameOriginalOwnedFire:d.fire.uid,sameOriginalChest:d.chest.uid,initialWorkerDelayIsFinite:true,noEarlierNaturalCleanWaterAcquisitionClaim:true,noGatherLaborOrUnlimitedMaintenanceClaim:true})
  }
  assert.equal(c.name,name);assert.ok(c.alive&&p.alive);await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({proofs,rows,errors,boundary:'Declared finite baseFixture resources, original chest/worker/bedding/fire, one initial fuel, finite clean worker water, ordinary floor replacing legacy unlimited heat and a finite initial50-turn AI delay. Actual earlier Core fixture work is distinguished from real Title/settings/pointers/keys and browser claim/transfer/bed/queue/cancel/haul/craft/fire/water/checkpoint actions. Independent Node canonical whole-world equality. No post-Title world/body/clock/RNG/material writes. No natural prior travel/acquisition/purification, gather labor, whole-game English, general colony sustainability or unlimited fuel claim.'},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),proofs,rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
