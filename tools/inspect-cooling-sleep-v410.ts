import{chromium,type Page}from'playwright-core'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import assert from'node:assert/strict'
import{startNativePreview}from'./native-preview'
import{residentCoolingSleepFixture}from'../tests/resident-cooling-sleep-fixture'
import{playerAct,SAVE_VERSION}from'../src/core/game'
import{allItems,itemDef}from'../src/core/items'
import{player,type World}from'../src/core/ctx'
import{serialize,deserialize,stateHash}from'../src/core/save'
import{npcRestDef}from'../src/core/resident-rest'

const out=process.argv[2],selected=process.argv[3],size=process.argv[4]
assert.ok(out&&!existsSync(out),'Choose a new output directory');assert.ok(!selected||['fatigue','debt'].includes(selected));assert.ok(!size||['1440','1366','390'].includes(size));mkdirSync(out,{recursive:true})
const rows:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const mode of (selected?[selected]:['fatigue','debt'])as ('fatigue'|'debt')[])for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([w])=>!size||String(w)===size)){
  const d=residentCoolingSleepFixture(mode),w=d.w,prefix=mode+'-'+width,raw=serialize(w.s),beds=structuredClone(w.s.map.residentBeds)
  assert.deepEqual(JSON.parse(serialize(deserialize(raw))),JSON.parse(raw));writeFileSync(join(out,prefix+'-initial-world.json'),raw);proofs.push({width,...d.proof})
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();active=page;page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  async function compare(label:string){
   await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
   const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);w.s.fx=[]
   writeFileSync(join(out,prefix+'-'+label+'-actual.json'),serialize(actual));writeFileSync(join(out,prefix+'-'+label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),prefix+' '+label)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);rows.push({mode,width,height,label,time:actual.time,hash:stateHash(actual)});await page.mouse.move(100,40);await page.screenshot({path:join(out,prefix+'-'+label+'.png')})
  }
  const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
  async function wait(label:string){await close();assert.equal(playerAct(w,{type:'rest',turns:200}),null);await page.keyboard.press('r');await compare(label)}
  async function saveContinue(label:string){
   await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare(label+'-saved')
   await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare(label+'-continued')
  }
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('loaded')
  let slept=false,saved=false,maximum=d.c.needs.bodyTemp
  const release={sleepDebt:npcRestDef(w)!.debtAt,fatigue:npcRestDef(w)!.sleepAt}
  for(let i=0;i<48&&(mode==='debt'?(d.c.needs.sleepDebt??0)>=release.sleepDebt:d.c.needs.fatigue>=release.fatigue);i++){
   await wait('actual-cooling-sleep-'+i);slept||=!!d.c.asleep;maximum=Math.max(maximum,d.c.needs.bodyTemp)
   if(d.c.asleep&&!saved){saved=true;await saveContinue('same-resident-asleep-on-floor')}
  }
  assert.ok(slept&&saved,'Actual NPC sleep and a saved sleeping continuation are required');assert.ok(d.c.alive&&player(w).alive);assert.ok(maximum<39)
  assert.ok(mode==='debt'?(d.c.needs.sleepDebt??0)<release.sleepDebt:d.c.needs.fatigue<release.fatigue,'Actual sleep must bring the declared need below the existing rest trigger');assert.deepEqual(w.s.map.residentBeds,beds,'Original beds must not move or multiply')
  assert.deepEqual(allItems(d.c).filter(i=>itemDef(w,i).apparel).map(i=>({uid:i.uid,def:i.def})).sort((a,b)=>a.uid-b.uid),[...d.originalApparel].sort((a,b)=>a.uid-b.uid))
  proofs.push({mode,width,actualSleepObserved:slept,savedWhileAsleep:saved,releaseThresholds:release,maximumBodyTemperature:maximum,finalFatigue:d.c.needs.fatigue,finalSleepDebt:d.c.needs.sleepDebt,originalBedsPreserved:true,originalApparelUidsPreserved:true});await saveContinue('actual-rest-threshold-original-bed-preserved');await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,proofs,rows,errors,boundary:'Declared original resident body/fatigue/debt/courtyard/warm initial state and observer original garments in bag. Real Title/keyboard/checkpoint/continue only after capture, independent Node whole-state equality. No post-Title body, fatigue, debt, clock, RNG or resource writes. Actual sleep on ordinary floor; no bed creation or relocation, natural earlier heat/debt or all-community recovery claim.'},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),proofs,rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
