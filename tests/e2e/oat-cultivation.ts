import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {oatCultivationNativeFixture} from '../oat-cultivation-fixture'
import {drinkVolume} from '../../src/core/wash-water'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {tileAt,type World} from '../../src/core/ctx'
import {serialize} from '../../src/core/save'
import type {Action} from '../../src/core/actions'

const out=process.argv[2]??'test-results/oat-cultivation-browser-v299';mkdirSync(out,{recursive:true})
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
const farm=async()=>{await craft();await page.getByTestId('cultivation-panel').waitFor();await page.getByTestId('cultivation-panel').scrollIntoViewIfNeeded()}
try{
 await page.goto(server.url)
 const seed=oatCultivationNativeFixture('seed'),w=seed.w
 await initial(w,'original-oat-seed');await tip(seed.seedsUid);await shot('1489-native-original-oat-grain-two-seeds-three-and-actual-crop-requirements',true)
 await inv();await page.getByTestId('win-inv').locator('[data-uid="'+seed.seedsUid+'"]').click({button:'right'})
 await act(w,{type:'place',uid:seed.seedsUid,dir:2},()=>page.getByRole('button',{name:'바라보는 흙에 심기',exact:true}).click(),'seed-real-one-turn-plant-original-source-no-retrospective-growth')
 assert.equal(seed.seed().count,2);assert.equal(seed.crop().waterMl,0);assert.equal(seed.crop().state.growth,0);assert.equal(tileAt(w,seed.pos).gatherAt,undefined);await farm();await shot('1490-native-actual-new-oat-plot-needs-real-water-not-a-free-timer')
 await act(w,{type:'waterCrop',pos:seed.pos,uid:seed.waterUid,ml:1000},()=>page.locator('[data-testid="crop-water"][data-water-uid="'+seed.waterUid+'"]').click(),'seed-real-one-turn-original-thousand-ml-first-growth')
 assert.equal(drinkVolume(w,seed.water()),0);assert.equal(seed.crop().state.growth,1);await farm();await shot('1491-native-real-thousand-ml-spent-original-bottle-and-first-sunlit-growth')
 await restore(w,'seed-whole203-restored-original-seed-water-and-growth');await page.setViewportSize({width:1366,height:768});await farm();await check(w,'seed-small-same-finite-water-and-growth');await shot('1492-native-small-restored-original-oat-plot-and-finite-water')
 rows.push(seed.proof);await close();await page.getByRole('button',{name:'타이틀',exact:true}).click()
 const ripe=oatCultivationNativeFixture('nearRipe'),v=ripe.w,c=ripe.cooking!
 await initial(v,'declared-near-ripe-oats');await farm();await shot('1493-native-declared-last-three-valid-growth-turns-and-original-irrigation-dose')
 for(let i=1;i<=3;i++){await close();await act(v,{type:'wait'},()=>page.keyboard.press('Period'),'ripe-real-growth-turn-'+i)}
 assert.equal(ripe.crop().ready,true);assert.equal(ripe.crop().waterMl,0);await close();await shot('1494-native-real-three-final-growth-turns-original-mature-oat-plant')
 await farm();await act(v,{type:'gather',pos:ripe.pos},()=>page.getByTestId('crop-harvest').click(),'ripe-real-twelve-turn-five-grain-harvest')
 const grain=ripe.p.bag.find(i=>i.def==='Item.Oats'&&i.uid!==ripe.cleanUid)!;assert.equal(grain.count,5);assert.equal(grain.foodWater!.ml,20);assert.equal(grain.foodWater!.quality.pathogen,60);assert.ok(Math.abs(grain.contaminantAsh!-.04)<1e-12);assert.equal(ripe.crop().state.growth,0)
 await tip(grain.uid);await shot('1495-native-five-real-oats-original-water-dose-and-two-clean-grains-kept-separate',true);await restore(v,'ripe-whole203-restored-five-contaminated-and-two-clean-grains')
 await inv();await page.getByTestId('win-inv').locator('[data-uid="'+ripe.cleanUid+'"]').click({button:'right'});await act(v,{type:'drop',uid:ripe.cleanUid},()=>page.getByRole('button',{name:'버리기',exact:true}).click(),'ripe-real-set-aside-original-two-clean-grains')
 await craft();await act(v,{type:'prepareUnheatedMeal',id:'Recipe.Oatmeal'},()=>page.getByTestId('Recipe.Oatmeal').locator('[data-unheated-action="prepare"]').click(),'ripe-real-one-turn-one-harvested-grain-and-original-bowl-water')
 const batch=ripe.s.map.cooking![0];assert.equal(batch.item.uid,c.bowlUid);assert.equal(batch.item.def,'Item.UnheatedOatmealBowl');assert.equal(batch.progress,1);assert.equal(batch.item.foodWater!.ml,240);assert.equal(batch.item.foodWater!.quality.pathogen,5);assert.equal(ripe.p.bag.find(i=>i.uid===grain.uid)!.count,4)
 await craft();assert.ok((await page.getByTestId('cooking-food-icon').locator('img').getAttribute('src'))!.endsWith('ashveil-hearth-raw-oatmeal.png'));await page.locator('[data-cooking-action="wait"]').scrollIntoViewIfNeeded();await shot('1496-native-original-one-grain-raw-mixture-retains-real-crop-pathogens');await restore(v,'ripe-whole203-restored-original-raw-grain-and-water-in-same-bowl')
 await craft();assert.equal(batch.total-batch.progress,399);await act(v,{type:'rest',turns:399},()=>page.locator('[data-cooking-action="wait"]').click(),'ripe-real-remaining-three-hundred-ninety-nine-hot-turns')
 assert.equal(batch.progress,400);assert.equal(batch.item.def,'Item.OatmealBowl');assert.equal(batch.item.foodWater,undefined);assert.ok(Math.abs(batch.item.contaminantAsh!-.04)<1e-12);assert.equal(batch.item.quality,3);assert.equal(batch.item.durability,81)
 await craft();assert.ok((await page.getByTestId('cooking-food-icon').locator('img').getAttribute('src'))!.endsWith('ashveil-hearth-oatmeal.png'));await page.locator('[data-cooking-action="take"]').scrollIntoViewIfNeeded();await shot('1497-native-four-hundred-real-hot-turns-keep-grain-ash-and-original-bowl');await restore(v,'ripe-whole203-restored-original-actually-boiled-harvest-meal')
 await craft();await act(v,{type:'takeCooking',uid:c.bowlUid},()=>page.locator('[data-cooking-action="take"]').click(),'ripe-real-one-turn-take-original-boiled-bowl');await inv()
 const kcal=ripe.p.needs.kcal,exposure=structuredClone(ripe.p.needs.waterExposure)
 await act(v,{type:'consume',uid:c.bowlUid},()=>page.getByTestId('win-inv').locator('[data-uid="'+c.bowlUid+'"]').dblclick(),'ripe-real-one-turn-meal-original-empty-bowl-and-four-grains')
 assert.equal(ripe.p.bag.find(i=>i.uid===c.bowlUid)!.def,'Item.Bowl');assert.equal(ripe.p.bag.find(i=>i.uid===grain.uid)!.count,4);assert.deepEqual(ripe.p.needs.waterExposure,exposure);assert.ok(ripe.p.needs.kcal-kcal>299&&ripe.p.needs.kcal-kcal<=300)
 const clean=tileAt(v,ripe.p.pos).items.find(i=>i.uid===ripe.cleanUid)!;assert.equal(clean.count,2);assert.equal(clean.foodWater,undefined)
 await restore(v,'ripe-whole203-restored-fed-body-empty-bowl-four-dirty-two-clean');await page.setViewportSize({width:1366,height:768});await tip(c.bowlUid);await shot('1498-native-small-restored-same-empty-bowl-four-harvest-grains-two-clean-grains',true)
 rows.push({...ripe.proof,harvestedUid:grain.uid,harvestedCount:5,remainingHarvested:4,cleanSetAside:2,originalBowlUid:c.bowlUid,actualHotTurns:400,rawExposureMetadataMl:240,rawPathogen:5,actualNutritiveMealWaterMl:220});await close();await page.getByRole('button',{name:'타이틀',exact:true}).click()
 const legacy=oatCultivationNativeFixture('legacy202'),z=legacy.w
 await initial(z,'legacy202-original-timed-oat-plot',true);assert.equal(tileAt(z,legacy.pos).cultivation,undefined);await close();await shot('1499-native-legacy202-original-near-deadline-oat-plot-no-invented-past-water')
 await act(z,{type:'wait'},()=>page.keyboard.press('Period'),'legacy202-real-one-turn-original-deadline');await craft();assert.equal(await page.getByTestId('cultivation-panel').count(),0)
 await act(z,{type:'gather',pos:legacy.pos},()=>page.getByRole('button',{name:'귀리 채집 (12턴)',exact:true}).click(),'legacy202-real-twelve-turn-original-five-grain-yield')
 assert.equal(legacy.p.bag.filter(i=>i.def==='Item.Oats').reduce((n,i)=>n+i.count,0),7);assert.equal(tileAt(z,legacy.pos).cultivation,undefined);await restore(z,'legacy202-whole203-restored-original-timer-and-seven-total-grains');await tip(legacy.cleanUid);await shot('1500-native-legacy202-to203-original-timed-crop-five-new-two-original-grains',true)
 rows.push(legacy.proof)
 assert.equal(screenshots,12);assert.equal(roundtrips,6);assert.equal(phases,23);assert.equal(actualInputTU,43200);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,actualInputTU,rows,errors,source:'Threefiniteinitialscenes loadedviarealTitleContinue. Actualkey/mouseplant/water3growthwaits/harvest12T/grainsetaside/prepare1T/399remaininghotT/take1T/eat1T/legacydeadline1T/harvest12T; independentNodeWHOLEaftereachphase. DeclarednearRipeinitialgrowthtotal-3, not143997pastvalidturns or5calendar-dayplay. Actualcrop1000ml+separateinitialcooking600ml;20mlpergrainisexistingexposuremetadata, noextra nutritionalwater beyond220ml. Legacy202header samecurrentfinite oldtimedplot, not historicaluserfile. No postloadworld/time/RNG/material injection, noNPCproduction/fullfamine/ecologycompletion.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read().catch(()=>undefined)));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
