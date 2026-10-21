import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {worldTerritoriesFixture} from '../world-territories-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {serialize} from '../../src/core/save'
import {drinkVolume} from '../../src/core/wash-water'
import type {FactionDef} from '../../src/core/types'
import type {World} from '../../src/core/ctx'
const out=process.argv[2]??'test-results/world-territories-browser-v289';mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],rows:unknown[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0})
let screenshots=0,roundtrips=0,phases=0
const shot=async(name:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
const map=async()=>{await close();await page.keyboard.press('m');await page.getByTestId('win-map').waitFor();await page.getByTestId('world-tab').click();await page.getByTestId('world-map').waitFor()}
try{
 for(const legacy of[false,true]){
  const d=worldTerritoriesFixture(legacy),w=d.w,initial=JSON.parse(serialize(w.s)),raw=JSON.stringify({...initial,...(legacy?{version:195}:{})}),start=w.s.time
  writeFileSync(join(out,legacy?'initial-finite195-no-territories.json':'initial-finite196-real-boundary-old-record-and-seven-original-items.json'),raw)
  const check=async(phase:string)=>{await idle();w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++}
  const restore=async(phase:string)=>{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(phase);roundtrips++}
  if(!legacy)await page.goto(server.url);else{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click()}
  await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(legacy?'legacy195-only-version-upgraded-no-territories-invented':'actual196-loaded-original-boundary-and-old-observation')
  await map();const label=(key:string)=>w.db.all<FactionDef>('Faction').find(f=>f.key===key)!.label
  if(legacy){assert.match(await page.getByTestId('world-territory').innerText(),/기록 없음/);await shot('1408-native-legacy195-no-invented-territories-or-past-records')}
  else{assert.ok((await page.getByTestId('world-territory').innerText()).includes(label(d.old)));await page.getByTestId('world-territory-toggle').check();await page.getByTestId('world-map-nearby').click();const canvas=page.getByTestId('world-map').locator('canvas'),rect=await canvas.boundingBox();assert.ok(rect);const ox=Number(await canvas.getAttribute('data-origin-x')),oy=Number(await canvas.getAttribute('data-origin-y')),cw=Number(await canvas.getAttribute('data-cells-w')),ch=Number(await canvas.getAttribute('data-cells-h'));await canvas.click({position:{x:(d.m.position.x+1-ox+.5)*rect.width/cw,y:(oy+ch-1-d.m.position.y+.5)*rect.height/ch}});assert.ok((await page.getByTestId('world-route').innerText()).includes(`(${d.m.position.x+1}, ${d.m.position.y})`));await page.getByTestId('world-map-current').click();await check('read-only-old-territory-observed-border-zoom-and-actual-canvas-picking');await shot('1402-native-actual-boundary-shows-only-dated-old-territory-record')}
  await page.getByTestId('survey-world').click();assert.equal(playerAct(w,{type:'surveyWorld'}),null);await check(legacy?'actual-legacy-survey-does-not-create-initial-territories':'actual-one-turn-survey-updates-only-real-nearby-territory-records')
  if(legacy){assert.match(await page.getByTestId('world-territory').innerText(),/기록 없음/);await shot('1409-native-legacy-real-survey-preserves-unknown-initial-territory');await restore('legacy-whole196-restored-same-original-world-and-unknown-territories')}
  else{
   assert.ok((await page.getByTestId('world-territory').innerText()).includes(label(d.current)));await shot('1403-native-actual-one-turn-observation-current-real-land-influence');await restore('whole196-restored-same-original-territories-and-dated-observations');await map();await page.getByTestId('world-map-nearby').click();await shot('1406-native-whole196-restored-same-boundary-and-original-records')
   await close();await page.keyboard.press('i');await page.getByTestId('bag').waitFor();for(const item of d.items)await page.locator(`[data-uid="${item.uid}"]`).waitFor();await shot('1404-native-seven-real-vessel-salt-eye-cell-draught-and-ampoule-icons')
   await page.locator(`[data-uid="${d.bottle.uid}"]`).click({button:'right'});await page.getByRole('button',{name:`다른 물병[${d.bucket.uid}]에 300ml 붓기`,exact:true}).click();assert.equal(playerAct(w,{type:'pourWater',uid:d.bottle.uid,targetUid:d.bucket.uid,ml:300}),null);await check('actual-one-turn-pour-original300ml-to-same-empty-wood-bucket');assert.equal(drinkVolume(w,d.bottle),0);assert.equal(drinkVolume(w,d.bucket),300);await shot('1405-native-real300ml-transfer-keeps-original-bottle-and-bucket-uids');await restore('whole196-restored-same-seven-uids-and-actual300ml-only');await page.setViewportSize({width:1366,height:768});await map();await page.getByTestId('world-map-nearby').click();await check('small-world-map-read-only-same-entire196');await shot('1407-native-small-screen-dated-territory-record-and-real-map')
  }
  assert.equal(w.s.time-start,legacy?100:200);rows.push({legacy,initialTime:start,finalTime:w.s.time,actualInputTU:w.s.time-start,index:d.index,old:d.old,current:d.current,items:d.items.map(i=>({uid:i.uid,def:i.def})),bottleMl:drinkVolume(w,d.bottle),bucketMl:drinkVolume(w,d.bucket)})
 }
 assert.equal(screenshots,8);assert.equal(roundtrips,3);assert.equal(phases,10);assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,rows,errors,source:'Two finite initial fixtures from real generated world boundary. Main contains explicit old territory observation differing from current, original seven item UIDs including finite300ml water/emptybucket; no claim past movement/territory change/crafting occurred. Legacy compatibility fixture is version195 with all territories absent and current header to isolate version migration; independent expected196 differs only version. Real TitleContinue/map/tab/readonlyborder/zoom/canvaspick/recenter/survey1T/whole196restore/inventory/pour300ml1T/whole196restore/1366resize; legacy real survey1T/whole196restore. No post-load world/time/RNG/owner injection; whole independent Node checks10phases; only normal rendererFX consumption.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU:300,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
