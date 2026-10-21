import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {playerWandererFixture} from '../player-wanderer-fixture'
import {seasonalProductionNativeFixture} from '../seasonal-production-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {serialize} from '../../src/core/save'
import {tradeQuote} from '../../src/core/economy'
import {creatureSprite} from '../../src/client/render/creature-sprite'
import type {World} from '../../src/core/ctx'
const out=process.argv[2]??'test-results/player-wanderer-browser-v295';mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity&&s.fx.length===0},{},{timeout:300000})
let screenshots=0,roundtrips=0,phases=0,actualInputTU=0
const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
const shot=async(name:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
const check=async(w:World,phase:string)=>{await idle();w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++}
const load=async(w:World,name:string)=>{const raw=serialize(w.s);writeFileSync(join(out,name+'-finite-initial.json'),raw);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(w,name+'-actual-title-continue')}
const restore=async(w:World,name:string)=>{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(w,name);roundtrips++}
try{
 const d=playerWandererFixture(),{w,p}=d,start=w.s.time
 assert.equal(p.sprite,'hero');assert.equal(creatureSprite(w,p),'original_wanderer_hero');assert.deepEqual(d.people.map(c=>c.displaySprite),['resident_worker','hero'])
 await page.goto(server.url);await load(w,'original-player-and-npcs');await shot('1450-native-original-player-with-stored-hero-worker-and-retired-wanderer')
 await page.keyboard.press('Numpad6');assert.equal(playerAct(w,{type:'move',dir:2}),null);await check(w,'actual-one-tile-east-walk-same-hero-selection');assert.deepEqual(p.pos,{x:21,y:20});await shot('1451-native-actual-player-east-walk-new-original-sprite')
 const targetHp=d.target.hp;await page.keyboard.press('Numpad6');assert.equal(playerAct(w,{type:'move',dir:2}),null);await check(w,'actual-bump-melee-original-knife-and-original-target');assert.ok(d.target.hp<targetHp);assert.deepEqual(p.pos,{x:21,y:20});await shot('1452-native-after-actual-melee-new-player-and-original-target')
 await page.keyboard.press('c');await check(w,'actual-character-window-is-pure-observation');await shot('1453-native-character-window-new-player-pixel-miniature');await restore(w,'whole199-restored-same-player-choice-npcs-and-actual-melee');await page.setViewportSize({width:1366,height:768});await check(w,'small-map-pure-observation');await shot('1454-native-small-map-whole199-restored-original-player-and-npcs');actualInputTU+=w.s.time-start
 await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.setViewportSize({width:1440,height:1080})
 const shop=seasonalProductionNativeFixture(),sw=shop.w,shopStart=sw.s.time,stock=shop.market.items.find(i=>i.def==='Item.Hardtack')!;assert.ok(stock);const originalCount=stock.count,originalMoney=shop.p.money!,buy=[{uid:stock.uid,count:1}],quote=tradeQuote(sw,shop.p,shop.trader,buy,[]);assert.equal(quote.error,null)
 await load(sw,'original-finite-village-shop');await page.keyboard.press('n');await page.locator('[data-person-id="'+shop.trader.id+'"]').click();await check(sw,'actual-reordered-shop-opening-pure-observation')
 const ordering=await page.evaluate(()=>{const stock=document.querySelector('[data-testid=trade-stock]')!,services=document.querySelector('[data-testid=resident-services]')!;return!!(stock.compareDocumentPosition(services)&Node.DOCUMENT_POSITION_FOLLOWING)});assert.equal(ordering,true);await shot('1455-native-trade-stock-before-resident-services')
 await page.getByTestId('resident-services-open').click();await check(sw,'actual-help-jump-no-time-rng-or-world-change');await shot('1456-native-actual-help-and-contracts-jump');await page.getByTestId('resident-trade-open').click();await check(sw,'actual-return-to-trade-no-world-change')
 await page.setViewportSize({width:1366,height:768});await page.locator('[data-testid=trade-stock] [data-trade-uid="'+stock.uid+'"] button').last().click();await page.getByTestId('trade-total').scrollIntoViewIfNeeded();await check(sw,'actual-small-purchase-quote-no-world-change');await shot('1457-native-small-original-finite-food-purchase-quote')
 assert.equal(playerAct(sw,{type:'trade',target:shop.trader.id,buy,sell:[],expectedBalance:quote.balance}),null);await page.getByTestId('trade-confirm').click();await check(sw,'actual-one-turn-purchase-original-stock-and-money');assert.equal(shop.p.money,originalMoney-quote.balance);assert.equal(shop.market.items.find(i=>i.uid===stock.uid)?.count,originalCount-1);assert.ok(shop.p.bag.some(i=>i.def==='Item.Hardtack'&&i.count===1));await shot('1458-native-small-actual-original-food-purchased');await restore(sw,'whole199-restored-same-original-stock-money-and-purchased-food');await page.keyboard.press('i');await shot('1459-native-small-whole199-restored-original-bow-string-and-purchased-food');actualInputTU+=sw.s.time-shopStart
 assert.equal(screenshots,10);assert.equal(roundtrips,2);assert.equal(phases,13);assert.equal(actualInputTU,300);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,actualInputTU,playerStored:p.sprite,playerDisplay:creatureSprite(w,p),people:d.people,knifeUid:p.equip.main?.uid,targetId:d.target.id,trade:{stockUid:stock.uid,originalCount,finalStockCount:shop.market.items.find(i=>i.uid===stock.uid)?.count,originalMoney,finalMoney:shop.p.money,quote,foodUid:shop.p.bag.find(i=>i.def==='Item.Hardtack')?.uid},errors,source:'Finite initial actual generated player/knife/target/worker/retiree; NPCs paused nextAct1e12, roof/lit floor for observation. Separate same294 actualgeneratedtown finite near-day-boundary stock fixture. ActualTitleContinue/east walk/bump melee/characterwindow/whole199restore/small/society/realhelpjump/back/quote/realone-turntrade/whole199restore/inventory. Node performs only independent expected actions; all browser actions through actual input; no post-load world/time/RNG/sprite injection. Still screenshot after melee does not prove every animated attack pose displayed.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
