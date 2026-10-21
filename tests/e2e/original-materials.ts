import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {originalMaterialsFixture} from '../original-materials-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {tileAt,type World} from '../../src/core/ctx'
import {serialize} from '../../src/core/save'
import type {Action} from '../../src/core/actions'

const out=process.argv[2]??'test-results/original-materials-browser-v300';mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],rows:unknown[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
let screenshots=0,roundtrips=0,phases=0,actualInputTU=0
const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
const shot=async(name:string,keepHover=false)=>{if(!keepHover)await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
const check=async(w:World,name:string)=>{await idle();w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,name+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,name+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++}
const restore=async(w:World,name:string)=>{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(w,name);roundtrips++}
const initial=async(w:World,name:string,legacy=false)=>{const raw=JSON.parse(serialize(w.s));if(legacy)raw.version=202;writeFileSync(join(out,name+'-finite-initial.json'),JSON.stringify(raw));await page.setViewportSize({width:1440,height:1080});await page.evaluate(s=>localStorage.setItem('ashveil.imprint.v1',s),JSON.stringify(raw));await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(w,name+'-title-initial')}
const act=async(w:World,a:Action,input:()=>Promise<unknown>,name:string)=>{const at=w.s.time;assert.equal(playerAct(w,a),null);await input();await check(w,name);actualInputTU+=w.s.time-at}
const inv=async()=>{await close();await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor()}
const tip=async(uid:number,floor=false)=>{await inv();await page.getByTestId('win-inv').locator('['+(floor?'data-floor-uid':'data-uid')+'="'+uid+'"]').hover();await page.getByTestId('tooltip').waitFor()}
const craft=async()=>{await close();await page.keyboard.press('F2');await page.getByTestId('win-craft').waitFor()}
try{
 await page.goto(server.url)
 const d=originalMaterialsFixture(),w=d.w,torch=d.uid('Item.Torch'),wood=d.uid('Item.Wood'),iron=d.uid('Item.IronScrap'),start=d.s.time
 await initial(w,'declared-original-materials');await inv();await shot('1501-native-eleven-original-material-stacks-and-empty-clay-bowl')
 await tip(d.uid('Item.Cloth'));await shot('1502-native-distinct-torn-cloth-and-bandage-original-counts',true)
 const light=()=>d.p.equip.main??d.p.bag.find(i=>i.uid===torch)!
 const torchTip=async()=>{await inv();await page.getByTestId('slot-main').hover();await page.getByTestId('tooltip').waitFor()}
 assert.equal(light().lit,false);const originalFuel=light().fuel!
 await inv();await page.getByTestId('win-inv').locator('[data-uid="'+torch+'"]').click({button:'right'});await act(w,{type:'equip',uid:torch},()=>page.getByRole('button',{name:'장착',exact:true}).click(),'real-one-turn-equip-original-torch');assert.equal(d.p.equip.main!.uid,torch)
 await inv();await page.getByTestId('slot-main').click({button:'right'})
 await act(w,{type:'toggleLight',uid:torch},()=>page.getByRole('button',{name:'불 켜기',exact:true}).click(),'real-one-turn-original-torch-lit')
 assert.equal(light().lit,true);await torchTip();await shot('1503-native-original-flameless-torch-icon-real-lit-marker-and-fuel',true)
 await inv();await page.getByTestId('slot-main').click({button:'right'})
 await act(w,{type:'toggleLight',uid:torch},()=>page.getByRole('button',{name:'불 끄기',exact:true}).click(),'real-one-turn-original-torch-unlit')
 assert.equal(light().lit,false);assert.ok(light().fuel!<originalFuel);await torchTip();await shot('1504-native-same-original-unlit-torch-finite-fuel-and-separate-marker',true)
 await restore(w,'whole203-restored-original-materials-and-unlit-torch')
 for(const uid of[wood,iron]){if(uid===iron){await close();await act(w,{type:'wait'},()=>page.keyboard.press('Period'),'real-one-turn-between-two-free-floor-drops')}await inv();await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').click({button:'right'});await act(w,{type:'drop',uid},()=>page.getByRole('button',{name:'버리기',exact:true}).click(),'real-free-floor-drop-original-'+uid)}
 const floor=()=>tileAt(w,d.p.pos).items
 assert.equal(floor().find(i=>i.uid===wood)!.count,3);assert.equal(floor().find(i=>i.uid===iron)!.count,3)
 await close();await shot('1505-native-actual-portable-wood-and-scrap-floor-sprites')
 await tip(wood,true);await shot('1506-native-same-three-original-wood-pieces-on-floor-and-finite-materials',true)
 await craft();await page.getByTestId('Recipe.CampfireKit').scrollIntoViewIfNeeded();await check(w,'craft-observation-whole-world-pure');await shot('1507-native-campfire-kit-original-recipe-icon-and-actual-missing-wood')
 await close();await page.keyboard.press('Shift+KeyK');await page.getByTestId('win-abil').waitFor();await check(w,'ability-observation-whole-world-pure');await shot('1508-native-eight-ability-icons-reuse-existing-spear-bow-and-arrow-originals')
 await restore(w,'whole203-restored-floor-originals-and-unchanged-ability-state');await page.setViewportSize({width:1366,height:768});await inv();await check(w,'small-same-original-materials-and-two-floor-stacks');await shot('1509-native-small-restored-original-materials-and-floor-stacks')
 for(const i of d.original){const actual=d.p.bag.find(a=>a.uid===i.uid)??Object.values(d.p.equip).find(a=>a?.uid===i.uid)??floor().find(a=>a.uid===i.uid);assert.ok(actual);assert.equal(actual.def,i.id);assert.equal(actual.count,i.count)}
 assert.equal(d.s.time-start,400);assert.equal(screenshots,9);assert.equal(roundtrips,2);assert.equal(phases,12);assert.equal(actualInputTU,400);assert.deepEqual(errors,[])
 rows.push({...d.proof,actualOriginalTorchUid:torch,torchFuelBefore:originalFuel,torchFuelAfter:light().fuel,originalWoodUid:wood,originalScrapUid:iron,allOriginalCountsPreserved:true,abilityPointsUnspent:true})
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,actualInputTU,rows,errors,source:'Finite11initialstacks andactualoriginalplayer; realtitleload/1torch-equipturn/2torch-toggleturns/1waitbetween2freedrops/readonlyinventory+craft+ability/smallviewport/2whole203restores. All12actualexpectedwholepairs comparedindependently. No normalacquisition/crafting/cooking claim for thismaterial-onlyfixture. Three actual bowl states separately covered byrealOatmealNative.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read().catch(()=>undefined)));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
