import assert from'node:assert/strict'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import{chromium,type Page,type BrowserContext,type Locator}from'playwright-core'
import{startNativePreview}from'./native-preview'
import{fieldWorkLocaleFixture,fieldWorkScenes,type FieldWorkScene}from'../tests/field-work-locale-fixture'
import{playerAct}from'../src/core/game'
import{player,tileAt,type World}from'../src/core/ctx'
import{serialize,deserialize,stateHash}from'../src/core/save'
import{containerPryQuote}from'../src/core/container-locks'
import{lockPickQuote}from'../src/core/lock-picking'
import{fieldDeviceQuote}from'../src/core/field-devices'
import{boatLaunchQuote}from'../src/core/journey'
import{boatRepairQuote}from'../src/core/marine-state'
import{waterRescueQuote}from'../src/core/aquatic'
import{allItems}from'../src/core/items'
import{drinkVolume}from'../src/core/wash-water'
import{knownBeaconPosts,beaconSignalQuote,rumorSignalKey,beaconFuelQuote}from'../src/core/beacons'
import type{Action}from'../src/core/actions'

const out=process.argv[2],selected=process.argv[3]??'all',size=process.argv[4]
assert.ok(out&&!existsSync(out),'Choose a new output directory');assert.ok(selected==='all'||fieldWorkScenes.some(s=>s===selected));assert.ok(!size||['1440','1366','390'].includes(size));mkdirSync(out,{recursive:true})
const rows:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const scene of selected==='all'?fieldWorkScenes:[selected as FieldWorkScene])for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([w])=>!size||String(w)===size)){
  const d=fieldWorkLocaleFixture(scene),w=d.w,p=player(w),prefix=scene+'-'+width
  w.s.saveMode='SaveMode.Study';w.s.achievementsDisabled=true;w.s.fx=[]
  const raw=serialize(w.s);assert.equal(serialize(deserialize(raw)),raw);writeFileSync(join(out,prefix+'-initial-world.json'),raw);proofs.push({scene,width,...d.proof,declaredStudyMode:true,noPostTitleWorldWrites:true})
  const context:BrowserContext=await browser.newContext({viewport:{width,height}}),page:Page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const id=scene.startsWith('lock-')?'container-locks':scene.startsWith('device-')?'field-device-'+d.uid:scene==='marine'?'marine-panel':scene==='aquatic'?'aquatic-panel':'beacon-panel'
  const panel=():Locator=>page.getByTestId(id)
  const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
  async function field(){await close();await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click()}
  async function language(code:'ko'|'en'){await close();await page.keyboard.press('F3');await page.getByTestId('settings-language').selectOption(code);await page.keyboard.press('Escape');await field()}
  async function english(required=true){
   if(!await panel().count()){assert.equal(required,false,'Target field panel is required');return}
   const text=await panel().evaluate(e=>{const copy=e.cloneNode(true)as HTMLElement;copy.querySelectorAll('[data-saved-rumor],[data-original-person-name]').forEach(n=>n.textContent='');return copy.textContent??''})
   assert.doesNotMatch(text,/[가-힣]/,scene+' static text')
   const attrs=await panel().locator('[title],[aria-label],[placeholder]').evaluateAll(es=>es.flatMap(e=>['title','aria-label','placeholder'].map(k=>e.getAttribute(k)??'')));assert.doesNotMatch(attrs.join('\n'),/[가-힣]/,scene+' attributes')
   assert.equal(await panel().evaluate(e=>e.scrollWidth>e.clientWidth+1),false,scene+' internal overflow')
   for(const name of await panel().locator('[data-original-person-name]').all()){const original=await name.innerText();assert.ok(w.s.creatures.some(c=>c.name===original))}
  }
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);rows.push({scene,width,height,label,time:actual.time,hash:stateHash(actual)});await page.mouse.move(100,40)
   if(await panel().count()&&await panel().isVisible())await panel().scrollIntoViewIfNeeded()
   await page.screenshot({path:join(out,prefix+'-'+label+'.png')})
  }
  async function act(action:Action,input:()=>Promise<unknown>,label:string){assert.equal(playerAct(w,action),null);await input();await compare(label)}
  async function saveContinue(label:string){
   await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare(label+'-saved')
   await close();await page.getByRole('button',{name:'Title',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare(label+'-continued')
  }
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('loaded');await language('en');await english();await compare('english-field-read-only');await saveContinue('original-initial-state');await field()
  if(scene==='lock-pry'||scene==='lock-pick'){
   const tool=p.bag.find(i=>i.uid===d.uid)!,durability=tool.durability!,tile=tileAt(w,d.pos!),beforeContents=structuredClone(tile.cont),at=w.s.time
   if(scene==='lock-pry'){
    const q=containerPryQuote(w,p,d.pos!);assert.equal(q.error,null)
    await act({type:'pryContainer',pos:d.pos!},()=>page.getByTestId('pry-container-'+d.pos!.x+'-'+d.pos!.y).click(),'actual-original-lock-pried')
    assert.equal(w.s.time-at,q.turns*100);assert.equal(tile.locked,false);assert.equal(tool.durability,durability-w.db.terrain(tile.t).lock!.wear)
   }else{
    const q=lockPickQuote(w,p,d.pos!);assert.equal(q.error,null)
    await act({type:'pickLock',pos:d.pos!},()=>page.getByTestId('pick-lock-'+d.pos!.x+'-'+d.pos!.y).click(),'actual-original-pick-attempt')
    assert.equal(w.s.time-at,q.turns!*100);assert.equal(tool.durability,durability-q.rule!.wear);proofs.push({scene,width,actualSeededPickSucceeded:!tile.locked,chance:q.chance,noRngOverride:true});await english(!!tile.locked)
   }
   assert.deepEqual(tile.cont,beforeContents);assert.equal(tile.searched,false)
  }else if(scene==='device-resume'||scene==='device-cancel'){
   const device=tileAt(w,d.pos!).device!,work=device.work!,clothUid=work.supplies[0].uid,waterUid=work.water!.uid,bottle=p.bag.find(i=>i.uid===waterUid)!,water=drinkVolume(w,bottle),bag=structuredClone(p.bag),at=w.s.time,q=fieldDeviceQuote(w,p,d.pos!,d.uid!,'clean')
   assert.equal(q.error,null);assert.equal(q.remaining,20);assert.equal(work.progress,10)
   if(scene==='device-resume'){
    await act({type:'deviceWork',pos:d.pos!,uid:d.uid!,operation:'clean'},()=>panel().locator('[data-device-operation=clean]').click(),'actual-remaining-device-work')
    assert.equal(w.s.time-at,q.turns*100);assert.ok(device.completed.includes('clean'));assert.ok(device.installed.some(i=>i.uid===clothUid));assert.equal(drinkVolume(w,bottle),water-200);assert.equal(device.waterUsed,200)
   }else{
    await act({type:'deviceCancel',pos:d.pos!,uid:d.uid!},()=>panel().locator('[data-device-cancel]').click(),'actual-zero-turn-device-cancel')
    assert.equal(w.s.time,at);assert.equal(device.work,undefined);assert.deepEqual(p.bag,bag);assert.equal(fieldDeviceQuote(w,p,d.pos!,d.uid!,'clean').remaining,30)
   }
   await english();await compare('english-updated-device-state')
  }else if(scene==='marine'){
   const q=boatLaunchQuote(w,p,d.uid),at=w.s.time;assert.equal(q.error,null)
   await act({type:'launchBoat',uid:d.uid},()=>panel().locator('[data-boat-launch="'+d.uid+'"]').click(),'actual-original-hull-launched');assert.equal(w.s.map.vessel?.hull.uid,d.uid);assert.equal(w.s.time-at,q.turns*100)
   await field();await english();await compare('english-original-deck');await saveContinue('original-hull-on-deck');await field()
   const repair=boatRepairQuote(w),start=w.s.time,hull=w.s.map.vessel!.hull,material=repair.need!,count=p.bag.filter(i=>i.def===material.item).reduce((n,i)=>n+i.count,0);assert.equal(repair.error,null)
   await act({type:'repairBoat'},()=>page.getByTestId('boat-repair').click(),'actual-original-hull-patched');assert.equal(w.s.time-start,repair.turns*100);assert.equal(hull.uid,d.uid);assert.ok(hull.durability!>60);assert.equal(p.bag.filter(i=>i.def===material.item).reduce((n,i)=>n+i.count,0),count-material.count);await english();await compare('english-repaired-hull')
   await act({type:'search'},()=>page.getByTestId('boat-hold').click(),'actual-original-cargo-hold-opened')
  }else if(scene==='aquatic'){
   const target=w.s.creatures.find(c=>c.id===d.target)!,q=waterRescueQuote(w,p,target.id),at=w.s.time,originalGear=allItems(target).map(i=>i.uid).sort((a,b)=>a-b),name=target.name;assert.equal(q.error,null)
   assert.equal(await panel().locator('[data-original-person-name]').innerText(),name)
   await act({type:'rescueWater',target:target.id},()=>panel().locator('[data-water-rescue="'+target.id+'"]').click(),'actual-original-person-pulled-ashore');assert.equal(w.s.time-at,q.turns*100);assert.deepEqual(target.pos,q.to);assert.deepEqual(allItems(target).map(i=>i.uid).sort((a,b)=>a-b),originalGear);assert.ok(target.alive);assert.equal(target.name,name)
  }else{
   const from=knownBeaconPosts(w).find(post=>post.address.uid===d.uid)!,to=knownBeaconPosts(w).find(post=>post.address.uid!==d.uid&&post.config.network===from.config.network)!,wood=p.bag.find(i=>i.def===from.config.fuel&&i.count>0)!,count=wood.count,fuel=beaconFuelQuote(w,p,from.address.pos,from.address.uid,wood.uid),at=w.s.time;assert.equal(fuel.error,null)
   await act({type:'beaconFuel',pos:from.address.pos,uid:from.address.uid,fuelUid:wood.uid},()=>page.getByTestId('beacon-fuel').click(),'actual-original-beacon-fuel');assert.equal(w.s.time-at,fuel.turns*100);assert.equal(wood.count,count-1)
   const known=w.s.knowledge.rumors!.length;await act({type:'beaconRead',pos:from.address.pos,uid:from.address.uid},()=>page.getByTestId('beacon-read').click(),'actual-prior-receipt-read');assert.equal(w.s.knowledge.rumors!.length,known+1);await english()
   const rumor=w.s.knowledge.rumors![0],key=rumorSignalKey(rumor),original=structuredClone(rumor);await page.getByLabel('News to relay by beacon',{exact:true}).selectOption(key);await compare('same-original-rumor-selected-read-only')
   for(const option of await panel().locator('[data-saved-rumor]').all()){const value=await option.getAttribute('value'),text=await option.innerText();assert.ok(w.s.knowledge.rumors!.some(r=>rumorSignalKey(r)===value&&r.text===text))}
   const signal=beaconSignalQuote(w,p,from.address.pos,from.address.uid,to.address,key),start=w.s.time;assert.equal(signal.error,null)
   await act({type:'beaconSend',pos:from.address.pos,uid:from.address.uid,to:to.address,rumorKey:key},()=>page.getByTestId('beacon-send').click(),'actual-original-news-encoded');assert.equal(w.s.time-start,signal.turns*100);await english()
   await close();await act({type:'wait'},()=>page.keyboard.press('Period'),'actual-signal-progress');assert.ok(w.s.overworld!.signals!.find(s=>s.key===key)!.progress>0);await saveContinue('original-signal-in-flight');await field();await english();await compare('english-saved-transmission')
   await close();await act({type:'rest',turns:200},()=>page.keyboard.press('r'),'actual-original-signal-arrived');const packet=w.s.overworld!.signals!.find(s=>s.key===key)!;assert.ok(packet.deliveredAt!==undefined);assert.ok(to.state.inbox.some(r=>r.key===key));assert.deepEqual(packet.rumor,original);assert.deepEqual(w.s.knowledge.rumors![0],original)
  }
  await language('ko');await compare('korean-after-original-action');await language('en');await english(!scene.startsWith('lock-')&&scene!=='aquatic');await compare('english-after-original-action');await saveContinue('original-action-result');await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({proofs,rows,errors,boundary:'Declared finite existing fixtures, original tools/hull/person/device/beacons and one declared earlier receipt. Real Title load, settings, pointers/keys, actions and checkpoint/continue; independent Node canonical whole-world equality. Prior partial device work/knowledge, initial hull wear, drowning state, visited/fueled posts and prior receipt are explicit initial conditions. No post-Title body/clock/RNG/material/world writes. Raw personal names and saved news are preserved; no whole-game English, normal prior acquisition/travel, prior incoming transmission or remote receipt-reading claim.'},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),proofs,rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
