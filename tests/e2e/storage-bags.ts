import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {player,type World} from '../../src/core/ctx'
import {updatePlayerVision} from '../../src/core/fov'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {addToBag,makeItem} from '../../src/core/items'
import {serialize} from '../../src/core/save'
import {prisonerFixture} from '../prisoner-fixture'

const out=process.argv[2]??'test-results/storage-bags-browser-v271';mkdirSync(out,{recursive:true})
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
 const{w,p}=prisonerFixture();w.s.creatures=[p];w.s.overworld=undefined;p.bag=[];p.equip={};w.s.map.kind='dungeon';w.s.map.depth=3
 for(const[id,count]of[['Item.Linen',2],['Item.Thread',1],['Item.Needle',1],['Item.RawMeat',2]]as const)assert.equal(addToBag(w,p,makeItem(w,id,count)),0)
 const food=p.bag.find(i=>i.def==='Item.RawMeat')!;food.contaminantAsh=.3
 updatePlayerVision(w,p);const creationFx=structuredClone(w.s.fx);w.s.fx=[]
 const initial=JSON.parse(serialize(w.s));writeFileSync(join(out,'initial.json'),JSON.stringify(initial))
 const check=async(phase:string)=>{await idle();const fx=structuredClone(w.s.fx);rendered.push({phase,fx});w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected)}
 await page.goto('http://localhost:4317/?debug');await page.getByTestId('start').click();await page.waitForSelector('[data-testid=map] canvas')
 await page.evaluate(s=>{(window as unknown as Hook).__ashveil.world().s=s},initial)
 await page.keyboard.press('F2');await page.getByTestId('Recipe.Sack').scrollIntoViewIfNeeded();await check('initial-materials-before-actual-craft');await shot('1316-native-sack-actual-linen-thread-needle-crafting-recipe')
 assert.equal(playerAct(w,{type:'craft',id:'Recipe.Sack'}),null)
 await page.getByTestId('Recipe.Sack').getByRole('button',{name:'제작',exact:true}).click();await check('actual-craft-completed-entire-world-exact')
 const sack=player(w).bag.find(i=>i.def==='Item.Sack')!;assert.ok(sack);assert.deepEqual(sack.contents,[]);assert.ok(w.s.time>initial.time)
 await page.keyboard.press('Escape');await page.keyboard.press('i');await page.getByTestId('item-Item.Sack').dblclick();assert.equal(playerAct(w,{type:'openBag',uid:sack.uid}),null);await check('actual-empty-four-by-three-bag-opened');assert.match(await page.getByTestId('loot').innerText(),/마대 자루.*4×3/);await shot('1317-native-crafted-empty-sack-original-uid-four-by-three-grid')
 await page.locator(`[data-testid="item-Item.RawMeat"][data-uid="${food.uid}"]`).click({button:'right'});await page.getByRole('button',{name:'넣기',exact:true}).click();assert.equal(playerAct(w,{type:'lootPut',uid:food.uid}),null);await check('actual-food-moved-inside-and-no-longer-in-root-bag')
 const foodBox=await page.getByTestId('loot-Item.RawMeat').boundingBox(),grid=await page.getByTestId('loot-grid').boundingBox();assert.ok(foodBox&&grid)
 await page.mouse.move(foodBox.x+foodBox.width/2,foodBox.y+foodBox.height/2);await page.mouse.down();await page.mouse.move(grid.x+3*38+19,grid.y+2*38+19,{steps:10});await page.mouse.up();assert.equal(playerAct(w,{type:'lootMove',uid:food.uid,gx:3,gy:2}),null);await check('actual-inner-drag-keeps-uid-count-food-state-and-coordinates')
 await page.getByTestId('item-Item.Sack').click({button:'right'});await page.getByRole('button',{name:'넣기',exact:true}).click();assert.equal(playerAct(w,{type:'lootPut',uid:sack.uid}),'가방 안에 가방을 넣을 수 없다');await check('actual-self-nesting-rejected-with-original-items-and-time');await shot('1318-native-filled-sack-real-food-and-self-nesting-rejected')
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas');await check('entire183-restored-original-sack-and-inner-food');wholeRoundtrips++
 await page.keyboard.press('i');await page.getByTestId('loot-Item.RawMeat').dblclick();assert.equal(playerAct(w,{type:'lootTake',uid:food.uid}),null);await check('actual-food-taken-to-root-with-original-uid-and-state');assert.deepEqual(player(w).bag.find(i=>i.uid===sack.uid)!.contents,[]);await page.locator(`[data-testid="item-Item.RawMeat"][data-uid="${food.uid}"]`).hover();await shot('1319-native-restored-sack-food-taken-out-original-state')
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas');await check('entire183-restored-empty-sack-and-original-extracted-food');wholeRoundtrips++
 assert.equal(screenshots,4);assert.equal(wholeRoundtrips,2);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,initialTime:initial.time,finalTime:w.s.time,sackUid:sack.uid,foodUid:food.uid,creationFx,rendered,source:'initial real ingredients; actual GUI craft/elapsed turns, double click, right click put, inner drag, rejected self nesting, take and two whole saves; only headless expected renderer FX consumption modeled',errors},null,2));console.log(JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}
finally{await page.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* 종료됨 */}}
