import {chromium,type Page}from'playwright-core'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import assert from'node:assert/strict'
import{startNativePreview}from'./native-preview'
import{ashHarvestFixture,ashWorkshopFixture}from'../tests/ash-workshop-fixture'
import{playerAct,SAVE_VERSION}from'../src/core/game'
import{player,terrainAt,creatureAt,inBounds,type World}from'../src/core/ctx'
import{serialize,deserialize,stateHash}from'../src/core/save'
import{DIRS,cheb,dirIndex,type Pos}from'../src/core/geom'
import{findPath}from'../src/core/path'
import{tradeQuote,marketFor}from'../src/core/economy'
import{ashDepositCount}from'../src/core/ash-deposits'
import{drinkVolume}from'../src/core/wash-water'
import type{Action}from'../src/core/actions'

const out=process.argv[2],selected=process.argv[3],size=process.argv[4]
assert.ok(out&&!existsSync(out),'Choose a new output directory');assert.ok(!selected||['harvest','workshop'].includes(selected));assert.ok(!size||['1440','1366','390'].includes(size));mkdirSync(out,{recursive:true})
const rows:unknown[]=[],proofs:unknown[]=[],errors:string[]=[],server=await startNativePreview()
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,active:Page|undefined
type Hook={__ashveil:{world():World}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??chromium.executablePath(),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 for(const scene of selected?[selected]:['harvest','workshop'])for(const[width,height]of[[1440,1080],[1366,768],[390,844]].filter(([w])=>!size||String(w)===size)){
  const d=scene==='harvest'?ashHarvestFixture():ashWorkshopFixture(),w=d.w,p=player(w),prefix=scene+'-'+width,raw=serialize(w.s)
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
  async function act(action:Action,input:()=>Promise<unknown>,label:string){assert.equal(playerAct(w,action),null,label);await input();await compare(label)}
  async function approach(pos:Pos,label:string){
   for(let i=0;cheb(p.pos,pos)>1&&i<70;i++){
    const path=DIRS.map(v=>({x:pos.x+v.x,y:pos.y+v.y})).filter(q=>inBounds(w,q)&&terrainAt(w,q).passable&&(!creatureAt(w,q)||creatureAt(w,q)!.id===p.id)).map(q=>findPath(w,p.pos,q,{avoidCreatures:true,selfId:p.id})).filter((a):a is NonNullable<typeof a>=>!!a?.length).sort((a,b)=>a.length-b.length)[0]
    assert.ok(path?.length);const q=path[0],dir=dirIndex(q.x-p.pos.x,q.y-p.pos.y),keys=['ArrowUp','KeyU','ArrowRight','Numpad3','ArrowDown','KeyB','ArrowLeft','KeyY'];await close();await act({type:'move',dir},()=>page.keyboard.press(keys[dir]),label+'-'+i)
   }assert.ok(cheb(p.pos,pos)<=1)
  }
  async function saveContinue(label:string){
   await close();await page.keyboard.press('F3');await page.getByTestId('checkpoint-save').click();await page.getByTestId('checkpoint-save-accept').click();await page.getByTestId('checkpoint-save-status').waitFor();await compare(label+'-saved')
   await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await compare(label+'-continued')
  }
  await page.goto(server.url);await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),raw);await page.reload();await page.getByTestId('continue').click();await compare('loaded')
  if(scene==='harvest'){
   assert.equal(p.bag.length,0);const pos={x:30,y:24},before=ashDepositCount(w,pos)
   await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();await page.getByTestId('gather-30-24').waitFor();assert.match(await page.getByTestId('gather-30-24').innerText(),/한 회분씩/);await compare('finite-drift-reviewed')
   await act({type:'gather',pos},()=>page.getByTestId('gather-30-24').click(),'actual-one-bundle-gathered');assert.equal(ashDepositCount(w,pos),before-1);assert.equal(p.bag.find(i=>i.def==='Item.PilgrimAsh')!.count,1)
   await close();await approach(d.c.home!,'walk-to-original-merchant');await page.keyboard.press('Shift+N');await page.getByTestId('win-society').locator(`[data-person-id="${d.c.id}"]`).click()
   const market=marketFor(w,d.c)!,ids=['Item.Oats','Item.Bowl','Item.Wood','Item.CampfireKit','Item.WaterBottle'],stock=ids.map(id=>{const item=market.items.find(i=>i.def===id&&i.count>0);assert.ok(item,id);return item}),buy=stock.map(i=>({uid:i.uid,count:1})),q=tradeQuote(w,p,d.c,buy,[]);assert.equal(q.error,null)
   for(const row of buy)await page.getByTestId('trade-stock').locator(`[data-trade-uid="${row.uid}"]`).getByRole('button',{name:/구매 늘리기$/}).click()
   await compare('finite-materials-reviewed');await act({type:'trade',target:d.c.id,buy,sell:[],expectedBalance:q.balance},()=>page.getByTestId('trade-confirm').click(),'actual-materials-bought')
   await close();await approach({x:30,y:25},'walk-to-worksite')
   const firePos={x:p.pos.x+1,y:p.pos.y},kit=p.bag.find(i=>i.def==='Item.CampfireKit')!,wood=p.bag.find(i=>i.def==='Item.Wood')!,bowl=p.bag.find(i=>i.def==='Item.Bowl')!,bottle=p.bag.find(i=>i.def==='Item.WaterBottle')!
   assert.ok(inBounds(w,firePos)&&terrainAt(w,firePos).passable&&!terrainAt(w,firePos).gather&&!creatureAt(w,firePos));await act({type:'face',dir:2},()=>page.keyboard.press('Control+ArrowRight'),'face-own-fire-ground')
   await page.keyboard.press('i');await page.getByTestId('win-inv').locator(`[data-inventory-item="${kit.uid}"]`).click({button:'right'});await compare('real-item-menu')
   await act({type:'place',uid:kit.uid,dir:2},()=>page.getByRole('button',{name:'바라보는 쪽에 설치',exact:true}).click(),'actual-own-fire-placed')
   await close();await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();const fire=page.locator(`[data-fire-uid="${kit.uid}"]`);await fire.getByLabel(`모닥불 ${kit.uid} 땔감`,{exact:true}).selectOption(String(wood.uid));await compare('finite-wood-reviewed')
   await act({type:'fireWork',pos:firePos,uid:wood.uid},()=>fire.locator('[data-fire-action=fuel]').click(),'actual-own-wood-burned')
   await page.getByTestId('craft-tab-recipes').click();await page.getByTestId('craft-search').fill('재떡');const water=drinkVolume(w,bottle)
   await act({type:'craft',id:'Recipe.AshCake'},()=>page.getByTestId('Recipe.AshCake').getByRole('button',{name:'제작',exact:true}).click(),'gathered-ash-steamed');assert.equal(p.bag.find(i=>i.uid===bowl.uid)!.def,'Item.AshCake');assert.equal(drinkVolume(w,bottle),water-220)
   await close();await page.keyboard.press('i');await act({type:'consume',uid:bowl.uid},()=>page.getByTestId('win-inv').locator(`[data-inventory-item="${bowl.uid}"]`).dblclick(),'actual-gathered-food-eaten');assert.equal(p.bag.find(i=>i.uid===bowl.uid)!.def,'Item.Bowl')
   await saveContinue('same-gathered-resource-and-bowl')
  }else{
   let savedWork=false
   for(let i=0;i<10&&!marketFor(w,d.c)!.items.some(it=>it.workshopMade?.worker===d.c.id);i++){
    await close();await act({type:'rest',turns:200},()=>page.keyboard.press('r'),'actual-worker-time-'+i)
    if(d.c.workJob?.residentWorkshop&&!savedWork){await saveContinue('working-original-craft');savedWork=true}
   }
   const output=marketFor(w,d.c)!.items.find(it=>it.workshopMade?.worker===d.c.id);assert.ok(output,'actual resident must supply its physical product');assert.ok(savedWork,'actual in-progress craft save must be exercised')
   await approach(d.c.home!,'walk-to-worker-shop');await page.keyboard.press('Shift+N');await page.getByTestId('win-society').locator(`[data-person-id="${d.c.id}"]`).click();const q=tradeQuote(w,p,d.c,[{uid:output.uid,count:1}],[]);assert.equal(q.error,null)
   await page.getByTestId('trade-stock').locator(`[data-trade-uid="${output.uid}"]`).getByRole('button',{name:/구매 늘리기$/}).click();await compare('worker-same-bowl-sale-reviewed')
   await act({type:'trade',target:d.c.id,buy:[{uid:output.uid,count:1}],sell:[],expectedBalance:q.balance},()=>page.getByTestId('trade-confirm').click(),'actual-worker-product-bought');assert.ok(p.bag.some(i=>i.uid===output.uid&&i.workshopMade?.worker===d.c.id))
   await saveContinue('same-worker-product-and-cash')
  }
  await context.close()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,proofs,rows,errors,boundary:'Declared finite arrival/cash/healthy resident/scheduling. Original generated ash and finite stock. Real Title, pointer/keyboard inputs, whole independent Node save-state comparison; no post-Title state/time/RNG/resource writes. NPC own-stock transfer creates no self-sale money; customer purchase transfers actual cash. No claim of normal initial travel or sustainable crop/fuel production.'},null,2));console.log(JSON.stringify({wholeStatePairs:rows.length,errors:errors.length}))
}catch(error){if(active)await active.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows,errors},null,2));throw error}
finally{await browser?.close();server.stop()}
