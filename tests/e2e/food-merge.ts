import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {foodMergeQuote} from '../../src/core/food-merge'
import {updatePlayerVision} from '../../src/core/fov'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {addToBag,makeItem} from '../../src/core/items'
import {serialize} from '../../src/core/save'
import {prisonerFixture} from '../prisoner-fixture'

const out=process.argv[2]??'test-results/food-merge-browser-v273';mkdirSync(out,{recursive:true})
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
 const from=makeItem(w,'Item.Jerky',3),to=makeItem(w,'Item.Jerky',2);from.freshness=80;to.freshness=40;assert.equal(addToBag(w,p,from),0);assert.equal(addToBag(w,p,to),0)
 updatePlayerVision(w,p);const creationFx=structuredClone(w.s.fx);w.s.fx=[];const initial=JSON.parse(serialize(w.s));writeFileSync(join(out,'initial.json'),JSON.stringify(initial))
 const check=async(phase:string)=>{await idle();rendered.push({phase,fx:structuredClone(w.s.fx)});w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected)}
 const item=(uid:number)=>page.locator(`[data-testid="item-Item.Jerky"][data-uid="${uid}"]`)
 const drag=async()=>{const a=await item(from.uid).boundingBox(),b=await item(to.uid).boundingBox();assert.ok(a&&b);await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();await page.getByTestId('food-merge-confirmation').waitFor()}
 await page.goto('http://localhost:4317/?debug');await page.getByTestId('start').click();await page.waitForSelector('[data-testid=map] canvas');await page.evaluate(s=>{(window as unknown as Hook).__ashveil.world().s=s},initial)
 await page.keyboard.press('i');await page.keyboard.press('Control+s');assert.equal(playerAct(w,{type:'sortBag'}),null);await check('actual-zero-turn-sort-initial-two-real-food-stacks')
 await drag();await check('actual-cross-band-drag-review-no-world-mutation');assert.match(await page.getByTestId('food-merge-confirmation').innerText(),/오래됨 5개.*40%/);await shot('1324-native-food-freshness-merge-review-actual-lower-state-before-any-change')
 await page.keyboard.press('Numpad6');await check('actual-review-blocks-game-movement-hotkey');await page.getByTestId('food-merge-cancel').click();await page.getByTestId('food-merge-confirmation').waitFor({state:'detached'});await check('actual-food-merge-cancel-entire-original-world-preserved');await shot('1325-native-cancelled-food-merge-both-original-uids-counts-and-freshness')
 await drag();await page.keyboard.press('Escape');await page.getByTestId('food-merge-confirmation').waitFor({state:'detached'});await check('actual-escape-cancels-review-without-closing-inventory-or-changing-world');assert.equal(await page.getByTestId('win-inv').isVisible(),true)
 const quote=foodMergeQuote(w,p,from.uid,to.uid);await drag();await page.getByTestId('food-merge-accept').click();assert.equal(playerAct(w,{type:'mergeItem',uid:from.uid,into:to.uid,freshnessApproval:quote.signature}),null);await check('actual-explicit-consent-merges-five-at-lower-freshness-same-target-uid');assert.equal(w.s.time,initial.time);assert.equal(p.bag.length,1);assert.equal(p.bag[0].uid,to.uid);assert.equal(p.bag[0].count,5);assert.equal(p.bag[0].freshness,40);await item(to.uid).hover();await shot('1326-native-approved-food-merge-five-real-pieces-same-target-uid-lower-freshness')
 await page.keyboard.press('Escape');await page.keyboard.press('Space');assert.equal(playerAct(w,{type:'wait'}),null);await check('actual-game-keyboard-resumes-after-food-confirmation-closes')
 await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas');await check('entire184-restored-approved-food-merge-and-following-real-turn');wholeRoundtrips++
 await page.keyboard.press('i');await item(to.uid).hover();await shot('1327-native-restored-entire184-original-merged-food-state-and-next-real-turn')
 assert.equal(screenshots,4);assert.equal(wholeRoundtrips,1);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,initialTime:initial.time,finalTime:w.s.time,fromUid:from.uid,toUid:to.uid,creationFx,rendered,source:'real initial food states; actual sort/drag/review/blocked movement/cancel/escape/consent/next real wait/whole restore; only headless expected renderer FX consumption modeled',errors},null,2));console.log(JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}
finally{await page.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* 종료됨 */}}
