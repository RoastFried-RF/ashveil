/** Replays a captured actual worker course through Title and normal rest/save inputs. */
import assert from'node:assert/strict'
import{createHash}from'node:crypto'
import{readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs'
import{join,resolve}from'node:path'
import{chromium,type Page}from'playwright-core'
import{startNativePreview}from'./native-preview'
import{db}from'../tests/helpers'
import{player,type World,turnOf}from'../src/core/ctx'
import{playerAct,runUntilInput,SAVE_VERSION}from'../src/core/game'
import{serialize,deserialize,stateHash}from'../src/core/save'
const out=process.argv[2],source=resolve(process.argv[3]??''),selected=process.argv[4]
assert.ok(out&&!existsSync(out));assert.ok(process.argv[3]&&existsSync(source));assert.ok(!selected||['1440','1366','390'].includes(selected));mkdirSync(out,{recursive:true})
const raw=readFileSync(source,'utf8'),sourceSha256=createHash('sha256').update(raw).digest('hex'),rows:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([w])=>!selected||String(w)===selected)){
  const w:World={db,s:deserialize(raw)},start=turnOf(w),c=w.s.creatures.find(c=>c.id===46)!,prefix=String(width)
  assert.ok(c.alive&&(c.workJob?.residentWorkshop||c.boilJob)&&w.s.saveMode==='SaveMode.Study','Requires an actual workshop or partial-boil checkpoint')
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
  async function compare(label:string,shot=false){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);rows.push({width,height,label,time:actual.time,hash:stateHash(actual),workerBody:c.needs.bodyTemp,workerPos:{...c.pos},boilRemaining:c.boilJob?.remaining})
   if(shot){await page.mouse.move(100,40);await page.screenshot({path:join(out,prefix+'-'+label+'.png')})}
  }
  async function saveContinue(label:string){
   await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare(label+'-saved',true)
   await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare(label+'-continued',true)
  }
  writeFileSync(join(out,prefix+'-initial-world.json'),raw)
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click()
  while(w.s.simulationPending&&!w.s.over)runUntilInput(w,200)
  await compare('original-pending-input-settled',true)
  let partial=!!c.boilJob,cancelled=false,saved=false,maximum=c.needs.bodyTemp
  if(partial){saved=true;await saveContinue('actual-partial-boil')}
  for(let i=0;i<60;i++){
   await close();assert.equal(playerAct(w,{type:'rest',turns:200}),null);await page.keyboard.press('r');await compare('normal-rest-'+i,[0,3,6,25,59].includes(i))
   maximum=Math.max(maximum,c.needs.bodyTemp);partial||=!!c.boilJob
   if(partial&&!c.boilJob&&(c.residentPurifyAfter??0)>turnOf(w))cancelled=true
   if(c.boilJob&&!saved){saved=true;await saveContinue('actual-partial-boil')}
   assert.ok(c.alive&&player(w).alive,'Original observer and worker must survive each actual input')
  }
  assert.ok(partial&&cancelled&&saved,'Observe the real partial boil, saved continuation and normal cancellation/backoff')
  assert.ok(c.needs.bodyTemp<39,'The observed runaway must recover below dangerous hyperthermia')
  assert.ok(turnOf(w)-start>=12000,'Continue past the original death horizon through real elapsed time')
  await saveContinue('same-worker-after-recovery');proofs.push({width,height,actualElapsedTurns:turnOf(w)-start,partialBoilObserved:partial,actualCancellationObserved:cancelled,savedWhileBoiling:saved,maximumSampledBodyTemperature:maximum,finalBodyTemperature:c.needs.bodyTemp,originalWorkerAlive:c.alive,continuedOriginalObserverCourse:false});await context.close()
 }
 assert.equal(createHash('sha256').update(readFileSync(source,'utf8')).digest('hex'),sourceSha256);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,source,sourceSha256,proofs,rows,errors,boundary:'Exact actual workshop or partial-boil checkpoint from the controlled course and prior Native replay, with the previously declared warm arrival and finite observer cache. Real Title load, pending normal simulation, keyboard rests and checkpoint/continue after capture; independent Node whole-state equality. Different subsequent observer rests, not a continuation of the original customer-demand course or a natural acquisition/community survival claim.'},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),source,sourceSha256,proofs,rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
