import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {hpMax} from '../../src/core/body'
import {player,tileAt,type World} from '../../src/core/ctx'
import {initializeFieldDevices} from '../../src/core/field-devices'
import {updatePlayerVision} from '../../src/core/fov'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {addToBag,equip,makeItem,quickCount} from '../../src/core/items'
import {projectileReady} from '../../src/core/ranged'
import {serialize} from '../../src/core/save'
import {prisonerFixture} from '../prisoner-fixture'

const out=process.argv[2]??'test-results/fletching-browser-v277';mkdirSync(out,{recursive:true})
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
 const{w,p,target}=prisonerFixture();w.s.overworld=undefined;w.s.maps={};w.s.offCreatures={};p.bag=[];p.equip={};p.hotbar=Array(10).fill(null);w.s.map.kind='surface';w.s.weather='ashrain';w.s.weatherUntil=1e12;tileAt(w,p.pos).roof=false
 target.pos={x:25,y:20};target.home=undefined;target.nextAct=1e12;target.ai.mode='hunt';target.ai.target=p.id;target.ai.alertTurn=Math.floor(w.s.time/100);target.stats.vit=30;target.hp=hpMax(w,target)
 const quiver=makeItem(w,'Item.Quiver'),bow=makeItem(w,'Item.Bow'),sack=makeItem(w,'Item.Sack'),good=makeItem(w,'Item.Arrow',2),exposed=makeItem(w,'Item.Arrow',3),hidden=makeItem(w,'Item.Arrow')
 exposed.gx=0;exposed.gy=0;quiver.contents=[exposed];hidden.gx=0;hidden.gy=0;sack.contents=[hidden]
 for(const item of[quiver,bow,sack,good])assert.equal(addToBag(w,p,item),0)
 assert.equal(equip(w,p,quiver.uid),null);assert.equal(equip(w,p,bow.uid),null)
 initializeFieldDevices(w);updatePlayerVision(w,p);const creationFx=structuredClone(w.s.fx);w.s.fx=[];const initial=JSON.parse(serialize(w.s));writeFileSync(join(out,'initial-all-arrows-intact.json'),JSON.stringify(initial));const raw=JSON.stringify(initial);assert.ok(raw.length<1_000_000)
 const check=async(phase:string)=>{await idle();rendered.push({phase,fx:structuredClone(w.s.fx)});w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected)}
 const restore=async(phase:string)=>{await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas');await check(phase);wholeRoundtrips++}
 const counts=async(normal:string,damaged?:string)=>{assert.equal(await page.getByTestId('hotbar-count-0').innerText(),normal);if(damaged!==undefined)assert.equal(await page.getByTestId('hotbar-count-1').innerText(),damaged)}
 await page.goto('http://localhost:4317/?debug');await page.evaluate(s=>localStorage.setItem('ashveil.imprint.v1',s),raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas');await check('actual-title-continue-entire187-intact-real-arrows')
 await page.keyboard.press('i');await page.getByTestId('item-Item.Arrow').click({button:'right'});await page.getByRole('button',{name:'빠른 슬롯에',exact:true}).click();assert.equal(playerAct(w,{type:'hotbar',index:0,ref:{kind:'item',def:good.def,fletchingDamaged:false}}),null);await page.getByTestId('open-quiver').click();assert.equal(playerAct(w,{type:'openBag',uid:quiver.uid}),null);await check('actual-normal-only-quickslot-initial-five-accessible-arrows');await counts('5');await shot('1336-native-intact-arrows-before-actual-ashrain-exposure')
 await page.keyboard.press('Escape');await page.keyboard.press('Period');assert.equal(playerAct(w,{type:'wait'}),null);await check('actual-one-turn-ashrain-damages-only-worn-quiver-arrows');assert.equal(w.s.time,initial.time+100);assert.equal(player(w).equip.back!.contents![0].fletchingDamaged,true);assert.equal(player(w).bag.find(i=>i.uid===good.uid)!.fletchingDamaged,undefined);assert.equal(player(w).bag.find(i=>i.uid===sack.uid)!.contents![0].fletchingDamaged,undefined)
 await page.keyboard.press('i');await page.getByTestId('open-quiver').click();assert.equal(playerAct(w,{type:'openBag',uid:quiver.uid}),null);await page.getByTestId('loot-Item.Arrow').click({button:'right'});await page.getByRole('button',{name:'빠른 슬롯에',exact:true}).click();assert.equal(playerAct(w,{type:'hotbar',index:1,ref:{kind:'item',def:exposed.def,fletchingDamaged:true}}),null);await check('actual-separate-normal-two-and-damaged-three-quickslot-counts');await counts('2','3');assert.equal(await page.getByTestId('loot-Item.Arrow').getByTestId('fletching-damaged').count(),1);await shot('1337-native-real-ashrain-damaged-quiver-and-two-distinct-quickslots')
 const beforeSelection=w.s.time;await page.keyboard.press('2');assert.equal(playerAct(w,{type:'selectAmmo',uid:exposed.uid}),null);await check('actual-key-two-selects-only-damaged-arrows-zero-tu');assert.equal(w.s.time,beforeSelection)
 await page.keyboard.press('Escape');await page.keyboard.press('f');await page.keyboard.press('Enter');assert.equal(playerAct(w,{type:'shoot',target:target.id}),null);await check('actual-real-damaged-arrow-shot-debits-only-quiver');assert.equal(player(w).equip.back!.contents![0].count,2);assert.equal(player(w).bag.find(i=>i.uid===good.uid)!.count,2)
 await page.keyboard.press('i');await page.getByTestId('open-quiver').click();assert.equal(playerAct(w,{type:'openBag',uid:quiver.uid}),null);await check('actual-damaged-arrow-shot-visible-state');await counts('2','2');await shot('1338-native-actual-damaged-arrow-shot-and-original-remaining-stacks')
 await restore('entire187-restored-damaged-quiver-selection-and-distinct-quickslots');await page.keyboard.press('i');await counts('2','2');await shot('1339-native-entire187-restored-original-fletching-and-selected-ammo')
 await page.keyboard.press('1');assert.equal(playerAct(w,{type:'selectAmmo',uid:good.uid}),null);await check('actual-key-one-selects-only-intact-root-arrows-zero-tu');await page.keyboard.press('Escape')
 for(let i=0;i<2;i++){await page.keyboard.press('f');await page.keyboard.press('Enter');assert.equal(playerAct(w,{type:'shoot',target:target.id}),null);await check('actual-intact-root-arrow-shot-'+(i+1))}
 assert.equal(quickCount(player(w),good.def,false),0);assert.equal(quickCount(player(w),good.def,true),2);assert.equal(projectileReady(w,player(w),player(w).equip.main!),false)
 const exhaustedAt=w.s.time;await page.keyboard.press('f');await page.keyboard.press('Enter');assert.equal(playerAct(w,{type:'shoot',target:target.id}),'화살이 없다');await check('actual-exhausted-intact-selection-does-not-fire-damaged-arrows');assert.equal(w.s.time,exhaustedAt);assert.equal(player(w).equip.back!.contents![0].count,2)
 await page.keyboard.press('i');await page.getByTestId('open-quiver').click();assert.equal(playerAct(w,{type:'openBag',uid:quiver.uid}),null);await check('actual-zero-intact-two-damaged-with-protected-hidden-arrow');await counts('0','2');await shot('1340-native-no-auto-switch-after-intact-ammo-exhaustion')
 await page.keyboard.press('2');assert.equal(playerAct(w,{type:'selectAmmo',uid:exposed.uid}),null);await check('actual-explicit-damaged-selection-restores-readiness-zero-tu');assert.equal(projectileReady(w,player(w),player(w).equip.main!),true)
 await restore('entire187-restored-exhaustion-explicit-damaged-selection-and-original-hidden-arrow');await page.keyboard.press('i');await counts('0','2');await shot('1341-native-entire187-restored-explicit-ammo-selection-and-original-state')
 assert.equal(screenshots,6);assert.equal(wholeRoundtrips,2);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,initialTime:initial.time,finalTime:w.s.time,quiverUid:quiver.uid,exposedUid:exposed.uid,goodUid:good.uid,hiddenUid:hidden.uid,creationFx,rendered,source:'real Title continue; all initial arrows intact; actual wait in ashrain changes worn quiver only; two state-bound quickslots/three actual shots/no automatic condition substitution/two whole187 restores; no browser state replacement; only headless expected normal renderer FX consumption modeled',errors},null,2));console.log(JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}
finally{await page.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* 종료됨 */}}
