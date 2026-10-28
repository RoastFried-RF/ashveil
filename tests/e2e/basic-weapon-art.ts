import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {clinicalDiseaseFixture} from '../clinical-diseases-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {serialize} from '../../src/core/save'
import {invalidateLights,updatePlayerVision} from '../../src/core/fov'
import {player,type World} from '../../src/core/ctx'
const out=process.argv[2]??'test-results/basic-weapon-art-browser-v292';mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
let screenshots=0,roundtrips=0,phases=0
const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
const shot=async(name:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
try{
 const d=clinicalDiseaseFixture('basic-weapon-original-292',false),w=d.w,knife=d.add('Item.RustyKnife'),hatchet=d.add('Item.Hatchet'),spear=d.add('Item.RebarSpear'),start=w.s.time
 w.s.map.name='기본 무기 원본·실제 장착 검증실';w.s.fx=[];invalidateLights(w);updatePlayerVision(w,d.p)
 const raw=serialize(w.s);writeFileSync(join(out,'finite198-initial-three-original-weapons.json'),raw)
 const check=async(phase:string)=>{await idle();w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++}
 const restore=async(phase:string)=>{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(phase);roundtrips++}
 const equip=async(uid:number,id:string)=>{await page.getByTestId('item-'+id).click({button:'right'});assert.equal(playerAct(w,{type:'equip',uid}),null);await page.getByRole('button',{name:'장착',exact:true}).click();await idle();assert.equal(player(w).equip.main!.uid,uid)}
 await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.keyboard.press('i');await check('actual-title198-and-inventory-three-original-weapons-unchanged');await shot('1427-native-original-knife32-hatchet64-and-rebar-spear32-in-actual-bag')
 await equip(knife.uid,knife.def);await check('actual-one-turn-original-knife-equipped-same-hatchet-and-spear-in-bag');await shot('1428-native-actual-original-knife-equipped-and-original-hatchet-and-spear-preserved');await restore('whole198-restored-same-original-knife-equipment-and-other-two-uids');await page.setViewportSize({width:1366,height:768});await page.keyboard.press('i');await check('small-screen-observation-entire-world-unchanged');await shot('1429-native-small-screen-original-knife-and-other-two-original-weapon-icons')
 await equip(spear.uid,spear.def);await check('actual-two-turn-original-two-handed-spear-replaces-original-knife');await shot('1430-native-actual-original-two-handed-spear-equipped');await restore('whole198-restored-original-spear-equipment-knife-and-hatchet-unchanged');await page.keyboard.press('i');await shot('1431-native-whole198-restored-original-spear-and-hatchet64')
 assert.equal(w.s.time-start,300);assert.equal(screenshots,5);assert.equal(roundtrips,2);assert.equal(phases,6);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,actualInputTU:300,initialTime:start,finalTime:w.s.time,knifeUid:knife.uid,hatchetUid:hatchet.uid,spearUid:spear.uid,originalHatchetStuff:hatchet.stuff,errors,source:'Finite actual default makeItem RustyKnife/Hatchet/RebarSpear with original materials/durability/edge; no crafting/loot-history claim. Actual TitleContinue/inventory/right-click equip1T knife/whole198restore/smallviewport/replace2T twohand spear/whole198restore.6 independent whole Node state comparisons; no post-load world/item/time/RNG injection. Item art only; no new weapon mechanics or combat outcome claim.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU:300,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
