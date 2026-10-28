import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {publicFoodSupplyNativeFixture} from '../public-food-supply-fixture'
import {eggNativeFixture} from '../eggs-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {tileAt,type World} from '../../src/core/ctx'
import {serialize} from '../../src/core/save'
import {tradeQuote} from '../../src/core/economy'
import type {Action} from '../../src/core/actions'

const out=process.argv[2]??'test-results/public-food-supply-browser-v298';mkdirSync(out,{recursive:true})
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
const initial=async(w:World,name:string,legacy=false)=>{const raw=JSON.parse(serialize(w.s));if(legacy)raw.version=201;writeFileSync(join(out,name+'-finite-initial.json'),JSON.stringify(raw));await page.setViewportSize({width:1440,height:1080});await page.evaluate(s=>localStorage.setItem('ashveil.imprint.v1',s),JSON.stringify(raw));await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(w,name+'-title-initial')}
const act=async(w:World,a:Action,input:()=>Promise<unknown>,name:string)=>{const at=w.s.time;assert.equal(playerAct(w,a),null);await input();await check(w,name);actualInputTU+=w.s.time-at}
const social=async(id:number)=>{await close();await page.keyboard.press('Shift+n');await page.getByTestId('win-society').waitFor();await page.locator('[data-person-id="'+id+'"]').click()}
const inv=async()=>{await close();await page.keyboard.press('i');await page.getByTestId('win-inv').waitFor()}
const tip=async(uid:number,floor=false)=>{await inv();await page.getByTestId('win-inv').locator('['+(floor?'data-floor-uid':'data-uid')+'="'+uid+'"]').hover();await page.getByTestId('tooltip').waitFor()}
try{
 await page.goto(server.url)
 for(const mode of['trade','legacy201']as const){
  const d=publicFoodSupplyNativeFixture(),w=d.w,eggUid=d.egg.uid,cash=d.p.money!+d.market.money
  await initial(w,mode,mode==='legacy201');await social(d.keeper.id)
  assert.equal(d.stock.supplyNotice,undefined);assert.equal(await page.getByTestId('heard-town-rumor').count(),0)
  if(mode==='trade'){
   const row=page.getByTestId('trade-stock').locator('[data-trade-uid="'+eggUid+'"]');await row.scrollIntoViewIfNeeded();await shot('1478-native-original-six-eggs-and-no-food-news-before-real-day')
   const before=serialize(w.s),quote=tradeQuote(w,d.p,d.keeper,[{uid:eggUid,count:3}],[]);assert.equal(quote.error,null)
   for(let i=0;i<3;i++)await row.getByRole('button',{name:'달걀 구매 늘리기',exact:true}).click()
   assert.equal(serialize(w.s),before);await check(w,'trade-select-three-eggs-quote-is-pure')
   await act(w,{type:'trade',target:d.keeper.id,buy:[{uid:eggUid,count:3}],sell:[],expectedBalance:quote.balance},()=>page.getByTestId('trade-confirm').click(),'trade-real-one-turn-three-original-eggs-and-daily-news')
   assert.equal(d.market.items.find(i=>i.uid===eggUid)!.count,3);assert.equal(d.p.bag.find(i=>i.def==='Item.Egg')!.count,3);assert.equal(d.p.money!+d.market.money,cash)
   assert.equal(await page.getByTestId('heard-town-rumor').count(),0);await social(d.keeper.id);await shot('1479-native-actual-purchase-three-eggs-common-reserve-empty-news-still-unheard')
   rows.push({...d.proof,mode,actualPrice:quote.balance,marketRemaining:3,bought:d.p.bag.find(i=>i.def==='Item.Egg'),cashTotal:cash})
  }else{
   await shot('1482-native-legacy201-same-original-six-eggs-no-retroactive-public-notice');await close()
   await act(w,{type:'wait'},()=>page.keyboard.press('Period'),'legacy201-real-first-completed-day-and-public-notice');await social(d.keeper.id)
   assert.equal(d.market.items.find(i=>i.uid===eggUid)!.count,6);assert.equal(await page.getByTestId('heard-town-rumor').count(),0);await shot('1483-native-legacy201-actual-new202-shortage-does-not-auto-teach-player')
   rows.push({...d.proof,mode,originalEggsRemaining:6,versionOnlyMigration:true})
  }
  assert.deepEqual(d.stock.supplyNotice,{day:0,unmet:true});assert.equal((d.s.knowledge.rumors??[]).filter(r=>r.id.startsWith('food-supply:')).length,0)
  await act(w,{type:'talk',target:d.keeper.id},()=>page.getByTestId('talk-person').click(),mode+'-real-one-turn-local-conversation')
  const news=d.s.knowledge.rumors!.filter(r=>r.id.startsWith('food-supply:'));assert.equal(news.length,1);assert.deepEqual(Object.keys(news[0].claims!).sort(),['place','what','when']);assert.ok(news[0].source.startsWith('양치기 골의 배급 공고 → '+d.keeper.name))
  await page.getByTestId('heard-town-rumor').filter({hasText:'공동 식량 배급'}).scrollIntoViewIfNeeded();await shot(mode==='trade'?'1480-native-actual-local-conversation-learns-dated-qualitative-food-shortage':'1484-native-legacy201-actual-local-talk-preserves-original-public-source')
  await restore(w,mode+'-whole202-restored-news-marker-pending-rng-original-food');await page.setViewportSize({width:1366,height:768});await social(d.keeper.id);await page.getByTestId('heard-town-rumor').filter({hasText:'공동 식량 배급'}).scrollIntoViewIfNeeded()
  if(mode==='trade'){await check(w,'trade-small-same-public-news-and-original-three-eggs');await shot('1481-native-small-whole202-restored-dated-food-news-and-finite-original-stock')}
  await close();await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 const d=await eggNativeFixture(),w=d.w,uid=d.egg.uid,next=d.s.nextId,start=d.s.time
 await initial(w,'default-original-eggs');await tip(uid);await page.getByTestId('tooltip').getByText(/30%/).waitFor();await shot('1485-native-three-original-egg-icons-and-real-default-thirty-percent-impact',true)
 await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').click({button:'right'});await act(w,{type:'drop',uid},()=>page.getByRole('button',{name:'버리기',exact:true}).click(),'eggs-default-real-floor-drop-same-three-original-contents')
 const floor=tileAt(w,d.p.pos).items.find(i=>i.uid===uid)!;assert.equal(floor.def,'Item.CrackedEgg');assert.equal(floor.count,3);assert.equal(floor.quality,2);assert.equal(floor.durability,81);assert.equal(d.s.nextId,next);assert.equal(d.s.time,start)
 await tip(uid,true);await shot('1486-native-actual-default-floor-impact-same-three-cracked-eggs-original-uid',true);await restore(w,'eggs-whole202-restored-original-cracked-floor-and-noise')
 await inv();await act(w,{type:'pickup',uid},()=>page.getByTestId('win-inv').locator('[data-floor-uid="'+uid+'"]').dblclick(),'eggs-real-pickup-keeps-original-three-contents-and-uid')
 const kcal=d.p.needs.kcal,vit=d.p.needs.vitamin,water=d.p.needs.waterDeficit
 await inv();await act(w,{type:'consume',uid},()=>page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').dblclick(),'eggs-one-real-meal-leaves-two-original-cracked-eggs')
 assert.equal(d.p.bag.find(i=>i.uid===uid)!.count,2);assert.equal(d.s.nextId,next+1);assert.equal(d.s.time-start,100);assert.ok(d.p.needs.kcal-kcal>79&&d.p.needs.kcal-kcal<=80);assert.equal(d.p.needs.vitamin-vit,1);assert.ok(water-d.p.needs.waterDeficit>44&&water-d.p.needs.waterDeficit<=45)
 await tip(uid);await shot('1487-native-one-actual-eighty-calorie-meal-two-original-eggs-six-hour-spoilage',true);await restore(w,'eggs-whole202-restored-two-original-contents-and-fed-body')
 const oldRng=structuredClone(d.s.rng);await inv();await page.getByTestId('win-inv').locator('[data-uid="'+uid+'"]').click({button:'right'});await act(w,{type:'drop',uid},()=>page.getByRole('button',{name:'버리기',exact:true}).click(),'eggs-real-redrop-two-cracked-eggs-no-reroll')
 assert.deepEqual(d.s.rng,oldRng);assert.equal(tileAt(w,d.p.pos).items.find(i=>i.uid===uid)!.count,2);await restore(w,'eggs-whole202-restored-redropped-two-original-contents');await page.setViewportSize({width:1366,height:768});await tip(uid,true);await shot('1488-native-small-restored-two-original-cracked-eggs-no-new-shell-no-reroll',true)
 rows.push({mode:'actual-default-egg-impact',seed:d.s.seed,originalUid:uid,originalCount:3,remainingCount:2,defaultDropChance:.3,actualMealTU:100,source:'FiniteinitialthreeEggs explicitly created by original egg fixture, quality2/durability81, noon/healthybody/pausedstory/light. Actualtitleload/drop/pickup/eat/redrop; originaldefault30percent realRNG, no forcedchance/afterloadstate injection. Not acquisition in normalplay or animalproduction.'})
 assert.equal(screenshots,11);assert.equal(roundtrips,5);assert.equal(phases,18);assert.equal(actualInputTU,500);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,actualInputTU,rows,errors,source:'Actualtitlefiniteinitialscenes, key/mouseinputs and independentNodeWHOLEworldpairs after rendererFXconsumption. Legacy201header currentfinite scene, not historicaluserfile. OriginalmarketEgg6 buy3/remaining3 and finitecash; realdayonlypublicnotice, actualtalkonlyknowledge; originalEggdefault30percent/UID/count/nutrition/redrop/restores. No postloadworld/time/RNG/material injection, no longdistancearrival/famine/migration/production claim.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read().catch(()=>undefined)));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
