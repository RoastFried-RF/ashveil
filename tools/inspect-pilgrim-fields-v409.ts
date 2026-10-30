import{chromium,type Page}from'playwright-core'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import assert from'node:assert/strict'
import{startNativePreview}from'./native-preview'
import{pilgrimFieldsFixture,pilgrimHarvestFixture}from'../tests/pilgrim-fields-fixture'
import{playerAct,SAVE_VERSION}from'../src/core/game'
import{player,type World}from'../src/core/ctx'
import{serialize,deserialize,stateHash}from'../src/core/save'
import{cultivationStatus}from'../src/core/cultivation'

const out=process.argv[2],selected=process.argv[3],size=process.argv[4]
assert.ok(out&&!existsSync(out),'Choose a new output directory');assert.ok(!selected||['seed','near-ripe'].includes(selected));assert.ok(!size||['1440','1366','390'].includes(size));mkdirSync(out,{recursive:true})
const rows:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const scene of selected?[selected]:['seed','near-ripe'])for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([w])=>!size||String(w)===size)){
  const d=scene==='seed'?pilgrimFieldsFixture():pilgrimHarvestFixture(),w=d.w,p=player(w),prefix=scene+'-'+width,raw=serialize(w.s),bank=d.market.money
  assert.deepEqual(JSON.parse(serialize(deserialize(raw))),JSON.parse(raw));writeFileSync(join(out,prefix+'-initial-world.json'),raw);proofs.push({scene,width,...d.proof})
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);rows.push({scene,width,height,label,time:actual.time,hash:stateHash(actual)});await page.mouse.move(100,40);await page.screenshot({path:join(out,prefix+'-'+label+'.png')})
  }
  const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
  async function wait(label:string,long=false){await close();assert.equal(playerAct(w,long?{type:'rest',turns:200}:{type:'wait'}),null);await page.keyboard.press(long?'r':'Period');await compare(label)}
  async function saveContinue(label:string){
   await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare(label+'-saved')
   await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare(label+'-continued')
  }
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('loaded')
  if(scene==='seed'){
   assert.equal(d.c.money,undefined);let seedUid:number|undefined
   for(let i=0;i<40&&!seedUid;i++){await wait('actual-seed-preparation-'+i);seedUid=d.c.bag.find(i=>i.def==='Item.OatSeed')?.uid}
   assert.ok(seedUid,'Original walletless guard must receive an actual seed');assert.equal(d.market.items.filter(i=>i.def==='Item.OatSeed').reduce((n,i)=>n+i.count,0),3);assert.equal(d.c.money,undefined);assert.equal(d.market.money,bank)
   await saveContinue('allocated-original-seed')
   for(let i=0;i<4&&(!d.c.residentPlot||cultivationStatus(w,d.c.residentPlot.pos)!.waterMl<=300);i++)await wait('actual-plant-water-'+i,true)
   assert.equal(d.c.residentPlot?.seedUid,seedUid);assert.ok(cultivationStatus(w,d.c.residentPlot!.pos)!.waterMl>300);await saveContinue('same-owned-plot-water')
  }else{
   let harvest=false,sale=false,paid=false,usedCrop=false,working=false
   for(let i=0;i<24&&!d.market.items.some(it=>it.workshopMade?.worker===d.trader.id);i++){
    await wait('actual-harvest-sale-work-'+i,true)
    harvest||=d.c.bag.some(it=>it.cropHarvest?.owner===d.c.id);sale||=d.market.items.some(it=>it.cropHarvest?.owner===d.c.id);paid||=(d.c.money??0)>0
    usedCrop||=!!d.trader.workJob?.residentWorkshop&&d.trader.workJob.inputs.some(input=>input.def==='Item.Oats'&&d.trader.bag.some(it=>it.uid===input.uid&&it.cropHarvest?.owner===d.c.id))
    if(d.trader.workJob?.residentWorkshop&&usedCrop&&!working){working=true;await saveContinue('new-crop-original-craft')}
   }
   proofs.push({scene,width,observed:{harvest,sale,paid,usedCrop,working},farmerTemperature:d.c.needs.bodyTemp,workerTemperature:d.trader.needs.bodyTemp})
   assert.ok(harvest&&sale&&paid&&usedCrop&&working,'Actual harvest, paid sale and new crop craft must all be observed')
   assert.ok(d.market.items.some(it=>it.workshopMade?.worker===d.trader.id));assert.ok((d.c.money??0)+d.market.money===bank,'Actual farmer payment is conserved with the market bank');assert.ok(p.alive);await saveContinue('actual-new-crop-product-and-cash')
  }
  await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,proofs,rows,errors,boundary:'Declared original guard/merchant observation, healthy noon/warm climate and finite scheduling. Seed scene has no seed/cash gift. Near-ripe scene explicitly declares last three growth turns and preserves old grain on the floor; it does not verify the preceding five effective days. Real Title and keyboard/settings inputs, independent Node whole-state equality; no post-Title world/time/RNG/resource writes.'},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),proofs,rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
