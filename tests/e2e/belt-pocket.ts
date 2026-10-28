import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {player,type World} from '../../src/core/ctx'
import {updatePlayerVision} from '../../src/core/fov'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {addToBag,makeItem,quickCount,quickItem} from '../../src/core/items'
import {serialize} from '../../src/core/save'
import {prisonerFixture} from '../prisoner-fixture'

const out=process.argv[2]??'test-results/belt-pocket-browser-v272';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],rendered:{phase:string;fx:World['s']['fx']}[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
type Hook={__ashveil:{world():World}}
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity&&w.s.fx.length===0})
let screenshots=0,wholeRoundtrips=0
const shot=async(name:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
try{
 const{w,p}=prisonerFixture();w.s.creatures=[p];w.s.overworld=undefined;p.bag=[];p.equip={};p.hotbar=Array(10).fill(null);w.s.map.kind='dungeon';w.s.map.depth=3
 const belt=makeItem(w,'Item.LeatherBelt'),food=makeItem(w,'Item.Jerky',2);food.contaminantAsh=.2;assert.equal(addToBag(w,p,belt),0);assert.equal(addToBag(w,p,food),0)
 updatePlayerVision(w,p);const creationFx=structuredClone(w.s.fx);w.s.fx=[];const initial=JSON.parse(serialize(w.s));writeFileSync(join(out,'initial.json'),JSON.stringify(initial))
 const check=async(phase:string)=>{await idle();rendered.push({phase,fx:structuredClone(w.s.fx)});w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected)}
 const restore=async(phase:string)=>{await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas');await check(phase);wholeRoundtrips++}
 const hotbarCount=()=>page.getByTestId('hotbar-0').locator('span.absolute.bottom-0').innerText()
 await page.goto('http://localhost:4317/?debug');await page.getByTestId('start').click();await page.waitForSelector('[data-testid=map] canvas');await page.evaluate(s=>{(window as unknown as Hook).__ashveil.world().s=s},initial)
 await page.keyboard.press('i');await page.getByTestId('item-Item.LeatherBelt').dblclick();assert.equal(playerAct(w,{type:'equip',uid:belt.uid}),null);await check('actual-belt-equipped-one-turn-original-uid-no-items-created');await page.getByTestId('open-belt-pocket').click();assert.equal(playerAct(w,{type:'openBag',uid:belt.uid}),null);await check('actual-worn-belt-empty-two-by-two-pocket-opened');assert.match(await page.getByTestId('loot').innerText(),/가죽 허리띠.*2×2/);await shot('1320-native-original-leather-belt-equipped-and-empty-two-by-two-pocket')
 await page.getByTestId('item-Item.Jerky').click({button:'right'});await page.getByRole('button',{name:'넣기',exact:true}).click();assert.equal(playerAct(w,{type:'lootPut',uid:food.uid}),null);await check('actual-jerky-original-uid-two-pieces-moved-to-pocket')
 const assignedAt=w.s.time;await page.getByTestId('loot-Item.Jerky').click({button:'right'});await page.getByRole('button',{name:'빠른 슬롯에',exact:true}).click();assert.equal(playerAct(w,{type:'hotbar',index:0,ref:{kind:'item',def:food.def}}),null);await check('actual-pocket-quickslot-assignment-zero-time-and-no-move');assert.equal(w.s.time,assignedAt);assert.equal(await hotbarCount(),'2');assert.equal(quickCount(player(w),food.def),2);await shot('1321-native-two-real-pocket-consumables-assigned-to-quickslot-with-zero-turn')
 assert.equal(quickItem(player(w),food.def)!.uid,food.uid);await page.keyboard.press('1');assert.equal(playerAct(w,{type:'consume',uid:food.uid}),null);await check('actual-key-one-consumes-one-real-pocket-item-and-one-turn');assert.equal(w.s.time,assignedAt+100);assert.equal(await hotbarCount(),'1');assert.equal(player(w).equip.belt!.contents![0].count,1)
 await restore('entire184-restored-worn-belt-pocket-item-and-quickslot');await page.keyboard.press('i');assert.equal(await hotbarCount(),'1');await shot('1322-native-entire184-restored-real-pocket-use-and-one-remaining-original-item')
 await page.getByTestId('slot-belt').dblclick();assert.equal(playerAct(w,{type:'unequip',slot:'belt'}),null);await check('actual-belt-unequipped-original-inner-item-kept-and-quickslot-inactive');assert.equal(quickCount(player(w),food.def),0);assert.equal(await hotbarCount(),'0');assert.equal(await page.getByTestId('open-belt-pocket').count(),0);assert.equal(player(w).bag.find(i=>i.uid===belt.uid)!.contents![0].count,1)
 await restore('entire184-restored-unequipped-belt-inner-item-and-inactive-quickslot');await page.keyboard.press('i');await shot('1323-native-unequipped-belt-keeps-original-pocket-item-and-quickslot-count-zero')
 assert.equal(screenshots,4);assert.equal(wholeRoundtrips,2);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,initialTime:initial.time,finalTime:w.s.time,beltUid:belt.uid,foodUid:food.uid,creationFx,rendered,source:'initial existing belt and real two jerky; actual GUI equip/open/put/quickslot assign/key1/unequip and two whole restores; only headless normal renderer FX consumption modeled',errors},null,2));console.log(JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}
finally{await page.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* 종료됨 */}}
