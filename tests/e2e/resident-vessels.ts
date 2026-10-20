import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {runUntilInput} from '../../src/core/game'
import {SAVE_VERSION} from '../../src/core/game'
import {residentVesselsNativeFixture} from '../resident-vessels-fixture'
const outDir=process.argv[2]??'test-results/resident-vessels-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');const installed=await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);assert.deepEqual(JSON.parse(JSON.stringify(installed)),JSON.parse(JSON.stringify(w.s)));if(w.s.simulationPending){await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');await idle(p)}else{const at=w.s.time;await p.keyboard.press('i');await p.getByTestId('win-inv').waitFor();await p.keyboard.press('Control+s');await p.keyboard.press('Escape');assert.equal((await read(p)).time,at)}return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:outDir+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save87 drift; before/after files saved');return after}


async function person(p:Page,id:number){await close(p);await p.keyboard.press('N');await p.getByTestId('win-society').waitFor();await p.locator('[data-person-id="'+id+'"]').click();await p.getByTestId('resident-hygiene').waitFor()}
let page:Page|undefined
try{
 const phases=['initial','bought','body','clean','owner','pending']as const,names=[
 '564-native-vessel-short-resident-plans-real-market-purchase-with-own-cash-and-one-original-empty-bottle',
 '565-native-real-resident-purchase-removes-one-original-market-bottle-and-transfers-ten-coins-to-actual-market-cash',
 '566-native-resident-refills-original-retained-bottle-and-washes-with-actual-two-litres-including-real-purchased-vessel',
 '567-native-actual-body-wash-keeps-both-original-empty-vessel-uids-and-does-not-repeat-market-purchase',
 '568-native-market-owner-uses-one-actual-owned-stock-vessel-without-self-trade-or-changing-either-cash-ledger',
 '569-native-continue-finishes-only-original-pending-wash-and-keeps-same-once-purchased-vessel-stock-cash-and-empty-uids']
 const rows:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i],d=residentVesselsNativeFixture(phase),expected:World|undefined=phase==='pending'?{db:d.w.db,s:structuredClone(d.s)}:undefined,queues:{before:World['s']['fx'];after:World['s']['fx']}={before:[],after:[]}
  if(expected){queues.before=expected.s.fx.splice(0);runUntilInput(expected);queues.after=expected.s.fx.splice(0);writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify(queues));assert.ok([...queues.before,...queues.after].every(fx=>fx.k==='move'||fx.k==='xp'))}
  page=await initial(d.w);const s=await read(page),c=s.creatures.find(c=>c.id===d.c.id)!,market=s.overworld!.markets![d.market.site],original=market.items.find(it=>it.uid===d.originalStockUid)!,bottles=c.bag.filter(it=>['Item.WaterBottle','Item.DirtyWaterBottle'].includes(it.def)),water=bottles.reduce((n,it)=>n+(it.uses??0)*200,0)
  assert.equal(s.nextId,d.s.nextId);assert.equal(c.bag.some(it=>it.uid===d.retained.uid),true);assert.deepEqual(s.map.tiles[17*s.map.w+17].items.map(it=>it.uid),d.lost.map(it=>it.uid))
  if(phase==='initial'){assert.equal(original.count,8);assert.equal(c.money,100);assert.equal(market.money,300);assert.equal(bottles.length,1);assert.equal(water,0)}
  else{assert.equal(original.count,7);assert.equal(bottles.length,2);assert.equal(c.money,phase==='owner'?100:90);assert.equal(market.money,phase==='owner'?300:310)}
  if(phase==='body'){assert.equal(c.activity!.kind,'wash');assert.equal(c.activity!.total,200);assert.equal(water,2000)}
  if(phase==='clean'||phase==='owner'||phase==='pending'){assert.equal(c.needs.hygiene,60);assert.equal(water,0);assert.ok(bottles.every(it=>it.uses===0));assert.equal(c.activity,undefined)}
  if(expected){const want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(s));assert.deepEqual(s,want);assert.equal(s.time-d.s.time,d.pendingTurns*100)}
  await person(page,phase==='bought'?d.trader.id:c.id)
  if(phase==='initial')await page.getByTestId('resident-hygiene').getByText(/자기 돈으로 물 용기를/).waitFor()
  if(phase==='body')await page.getByTestId('resident-hygiene-activity').getByText(/몸 씻기/).waitFor()
  if(phase==='clean'||phase==='owner'||phase==='pending')await page.getByTestId('resident-hygiene').getByText(/몸이 깨끗함/).waitFor()
  if(phase==='bought'||phase==='owner'){const count=page.getByTestId('stock-count-'+d.originalStockUid);await count.scrollIntoViewIfNeeded();await count.getByText('재고 7',{exact:true}).waitFor();await page.getByTestId('market-cash').getByText(phase==='owner'?/금고 300/:/금고 310/).waitFor()}
  await shot(page,names[i]);await restore(page,'same-real-vessel-acquisition-'+phase);rows.push({phase,workerId:c.id,originalRetainedUid:d.retained.uid,actualBottleUids:bottles.map(it=>it.uid),originalStockUid:d.originalStockUid,actualStock:original.count,actualActorCash:c.money,actualMarketCash:market.money,actualWaterMl:water,actualBodyWashTurns:phase==='body'?c.activity!.total:undefined,actualPendingTurns:d.pendingTurns,wholePendingExactAfterRendering:phase==='pending'?true:undefined,queues:phase==='pending'?queues:undefined});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,initialStock:8,finalStock:7,actualPurchasePrice:10,originalCash:100,actualBuyerCash:90,originalMarketCash:300,actualMarketCash:310,ownerCashUnchanged:true,ownerMarketCashUnchanged:true,actualBodyWaterMl:2000,actualBodyWashTurns:200,sameEmptyOriginalUids:true,pendingBrowserWholeExactAfterRendering:true,wholeRoundtrips:6,screenshots:6,rows,consoleErrors:errors},null,2));console.log('OK: actual finite stock8to7/real10cash buyer100to90 market300to310/original emptyUID73+purchased85/two real litres200T/same emptyUIDs/own stock withdrawal no selftrade/cash unchanged/actual pending198T whole87 after renderer/six whole87/sixscreens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
