import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {player,type World} from '../../src/core/ctx'
import {applyContentTransition} from '../../src/core/content-transition'
import {initializeClimate} from '../../src/core/climate'
import {initializeFieldDevices} from '../../src/core/field-devices'
import {updatePlayerVision} from '../../src/core/fov'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {addToBag,equip,makeItem} from '../../src/core/items'
import {deserialize,serialize} from '../../src/core/save'
import {initializeScriptState} from '../../src/core/script-hooks'
import {initializeSettlement} from '../../src/core/settlements'
import {initializeWorldSimulation} from '../../src/core/world-simulation'
import {prisonerFixture} from '../prisoner-fixture'

const out=process.argv[2]??'test-results/quiver-browser-v275';mkdirSync(out,{recursive:true})
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
 const fixture=prisonerFixture(),w=fixture.w,p=fixture.p,target=fixture.target
 w.s.overworld=undefined;p.bag=[];p.equip={};p.hotbar=Array(10).fill(null);w.s.map.kind='dungeon';w.s.map.depth=3
 target.pos={x:25,y:20};target.home=undefined;target.ai.mode='idle';target.asleep=true;target.deepSleep=true;target.needs.fatigue=98;target.nextAct=1e12
 const belt=makeItem(w,'Item.LeatherBelt');assert.equal(addToBag(w,p,belt),0);assert.equal(equip(w,p,belt.uid),null)
 for(const[id,count]of[['Item.Leather',2],['Item.Thread',1],['Item.Needle',1],['Item.Bow',1],['Item.Arrow',3],['Item.Jerky',2]]as const)assert.equal(addToBag(w,p,makeItem(w,id,count)),0)
 const bow=p.bag.find(i=>i.def==='Item.Bow')!,arrow=p.bag.find(i=>i.def==='Item.Arrow')!,food=p.bag.find(i=>i.def==='Item.Jerky')!
 initializeFieldDevices(w);updatePlayerVision(w,p);const creationFx=structuredClone(w.s.fx);w.s.fx=[]
 const legacy=JSON.parse(serialize(w.s));legacy.version=184
 for(const key of['loadHash','contentDefinitions','contentItemShapes','contentMods','gameVersion','defSchemaVersion'])delete legacy[key]
 const raw=JSON.stringify(legacy);assert.ok(raw.length<1_000_000);writeFileSync(join(out,'initial-unknown-legacy184.json'),raw)
 w.s=deserialize(raw);assert.equal(applyContentTransition(w),null);initializeScriptState(w);initializeClimate(w);initializeWorldSimulation(w);initializeSettlement(w);initializeFieldDevices(w);updatePlayerVision(w,player(w))
 const initial=JSON.parse(serialize(w.s))
 const noInventedHistory=()=>{for(const key of['loadHash','contentDefinitions','contentItemShapes','contentMods','gameVersion','defSchemaVersion'])assert.equal(Object.hasOwn(w.s,key),false,key)}
 const check=async(phase:string)=>{await idle();rendered.push({phase,fx:structuredClone(w.s.fx)});w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);noInventedHistory()}
 const restore=async(phase:string)=>{await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas');await check(phase);wholeRoundtrips++}
 await page.goto('http://localhost:4317/?debug');await page.evaluate(s=>localStorage.setItem('ashveil.imprint.v1',s),raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas');await check('actual-title-continue-unknown-legacy184-no-fabricated-history')
 await page.keyboard.press('i');await page.getByTestId('open-belt-pocket').click();assert.equal(playerAct(w,{type:'openBag',uid:belt.uid}),null)
 await page.getByTestId('item-Item.Jerky').click({button:'right'});await page.getByRole('button',{name:'넣기',exact:true}).click();assert.equal(playerAct(w,{type:'lootPut',uid:food.uid}),null);await check('actual-unknown-legacy-empty-belt-filled-with-original-two-jerky')
 await restore('entire186-restored-unknown-history-actual-filled-belt');await page.keyboard.press('i');assert.equal(player(w).equip.belt!.contents![0].count,2);await shot('1332-native-unknown-legacy184-real-continue-filled-pocket-and-entire186-restore')
 await page.keyboard.press('Escape');await page.keyboard.press('F2');await page.getByTestId('Recipe.Quiver').scrollIntoViewIfNeeded();await page.getByTestId('Recipe.Quiver').getByRole('button',{name:'제작',exact:true}).click();assert.equal(playerAct(w,{type:'craft',id:'Recipe.Quiver'}),null);await check('actual-three-hundred-turns-original-leather-thread-needle-craft-empty-quiver')
 const quiver=player(w).bag.find(i=>i.def==='Item.Quiver')!;assert.ok(quiver);assert.deepEqual(quiver.contents,[]);assert.equal(w.s.time,initial.time+30000)
 await page.keyboard.press('Escape');await page.keyboard.press('i');await page.getByTestId('item-Item.Quiver').dblclick();assert.equal(playerAct(w,{type:'equip',uid:quiver.uid}),null);await check('actual-new-empty-quiver-worn-one-turn')
 await page.getByTestId('item-Item.Bow').dblclick();assert.equal(playerAct(w,{type:'equip',uid:bow.uid}),null);await check('actual-original-bow-equipped')
 await page.getByTestId('open-quiver').click();assert.equal(playerAct(w,{type:'openBag',uid:quiver.uid}),null);await page.getByTestId('item-Item.Arrow').click({button:'right'});await page.getByRole('button',{name:'넣기',exact:true}).click();assert.equal(playerAct(w,{type:'lootPut',uid:arrow.uid}),null);await check('actual-original-three-arrows-moved-into-one-by-six-quiver');assert.equal(player(w).bag.some(i=>i.def==='Item.Arrow'),false);assert.match(await page.getByTestId('loot').innerText(),/화살통.*1×6/);await shot('1333-native-crafted-worn-quiver-original-three-arrows-and-real-one-by-six-grid')
 await page.keyboard.press('Escape');await page.keyboard.press('f');await page.keyboard.press('Enter');assert.equal(playerAct(w,{type:'shoot',target:target.id}),null);await check('actual-keyboard-shot-debits-one-original-quiver-arrow');assert.equal(player(w).equip.back!.contents![0].count,2);assert.equal(player(w).equip.back!.contents![0].uid,arrow.uid)
 await page.keyboard.press('i');await page.getByTestId('open-quiver').click();assert.equal(playerAct(w,{type:'openBag',uid:quiver.uid}),null);await check('actual-shot-remaining-two-original-arrows-visible');await shot('1334-native-real-bow-shot-consumes-one-original-quiver-arrow')
 await restore('entire186-restored-unknown-history-quiver-belt-and-real-shot');await page.keyboard.press('i');await shot('1335-native-entire186-restored-original-quiver-arrows-belt-and-unknown-history')
 assert.equal(screenshots,4);assert.equal(wholeRoundtrips,2);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,initialTime:initial.time,finalTime:w.s.time,beltUid:belt.uid,foodUid:food.uid,quiverUid:quiver.uid,arrowUid:arrow.uid,bowUid:bow.uid,creationFx,rendered,source:'real Title continue of unknown legacy184 containing only old items; actual pouch filling/whole restore; actual craft300turn/equip/put original arrows/keyF+Enter shot/whole restore; no browser state replacement; only headless expected normal renderer FX consumption modeled',errors},null,2));console.log(JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}
finally{await page.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* 종료됨 */}}
