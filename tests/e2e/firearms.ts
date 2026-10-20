import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import assert from 'node:assert/strict'
import {tileAt,type World} from '../../src/core/ctx'
import {initializeFieldDevices} from '../../src/core/field-devices'
import {updatePlayerVision} from '../../src/core/fov'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {addToBag,makeItem} from '../../src/core/items'
import {Rng,seedState} from '../../src/core/rng'
import {serialize} from '../../src/core/save'
import {prisonerFixture} from '../prisoner-fixture'
const out=process.argv[2]??'test-results/firearms-browser-v280';mkdirSync(out,{recursive:true})
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true})
await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],rendered:{phase:string;fx:World['s']['fx']}[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
type Hook={__ashveil:{world():World}}
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity&&w.s.fx.length===0})
let screenshots=0,roundtrips=0
const shot=async(n:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,n+'.png')});screenshots++}
try{
 const {w,p,target}=prisonerFixture();w.s.overworld=undefined;w.s.maps={};w.s.offCreatures={};w.s.map.kind='dungeon';w.s.map.depth=3;w.s.map.name='장총 검증실';w.s.map.ambient=1;w.s.map.lights=[];p.bag=[];p.equip={};p.hotbar=Array(10).fill(null);p.needs.energy=100;target.pos={x:24,y:20};target.home=undefined;target.nextAct=1e12;target.hp=3;target.reactPolicy='none';target.ai.mode='hunt';target.ai.target=p.id;target.ai.alertTurn=Math.floor(w.s.time/100);target.bag=[];target.equip={};for(let x=20;x<=24;x++)Object.assign(tileAt(w,{x,y:20}),{t:'Terrain.Earth',items:[],roof:true})
 const gun=makeItem(w,'Item.FlintlockMusket'),ball=makeItem(w,'Item.LeadBall',2),powder=makeItem(w,'Item.BlackPowderCharge',2),oil=makeItem(w,'Item.GunOil');p.equip.main=gun;gun.firearmFouling=40;for(const it of[ball,powder,oil])assert.equal(addToBag(w,p,it),0)
 let chosen=false;for(let i=0;i<10000;i++){const state=seedState('native-firearm-'+i,'combat'),r=new Rng([...state]);if(!r.chance(.12)&&r.int(0,99)<5){w.s.rng.combat=state;chosen=true;break}}assert.ok(chosen)
 initializeFieldDevices(w);updatePlayerVision(w,p);const creationFx=structuredClone(w.s.fx);w.s.fx=[];const initial=JSON.parse(serialize(w.s)),raw=JSON.stringify(initial);assert.ok(raw.length<1_000_000);writeFileSync(join(out,'initial-original-musket-two-balls-two-powders-one-oil.json'),raw)
 const check=async(phase:string)=>{await idle();rendered.push({phase,fx:structuredClone(w.s.fx)});w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected)}
 const inventory=async()=>{if(!await page.getByTestId('bag').isVisible())await page.keyboard.press('i')}
 const gunMenu=async()=>{await inventory();await page.getByTestId('slot-main').locator('.cursor-grab').click({button:'right'})}
 const restore=async(phase:string)=>{await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(phase);roundtrips++}
 await page.goto('http://localhost:4317/?debug');await page.evaluate(s=>localStorage.setItem('ashveil.imprint.v1',s),raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check('actual-title-continue-entire188-finite-original-firearm-supplies');await inventory();await shot('1347-native-original-musket-ball-powder-oil-icons-and-actual-counts')
 await gunMenu();await page.getByRole('button',{name:'총열 청소 (기본6턴·총기 기름1)',exact:true}).click();assert.equal(playerAct(w,{type:'firearmCare',uid:gun.uid,operation:'clean'}),null);await check('actual-menu-clean-six-turns-original-one-gun-oil-only');assert.equal(w.s.time,initial.time+600);assert.equal(gun.firearmFouling,0);assert.ok(!p.bag.some(i=>i.uid===oil.uid));assert.equal(ball.count,2);assert.equal(powder.count,2)
 await gunMenu();await page.getByRole('button',{name:'장전 (기본7턴)',exact:true}).click();assert.equal(playerAct(w,{type:'reload',uid:gun.uid}),null);await check('actual-menu-reload-seven-turns-original-ball-and-powder-atomic');assert.equal(w.s.time,initial.time+1300);assert.equal(ball.count,1);assert.equal(powder.count,1);assert.equal(gun.loadedRound!.ball.count,1);assert.equal(gun.loadedRound!.powder.count,1);assert.notEqual(gun.loadedRound!.ball.uid,ball.uid);assert.notEqual(gun.loadedRound!.powder.uid,powder.uid);await shot('1348-native-actual-seven-turn-loaded-round-and-original-remaining-supplies')
 await restore('entire188-restored-original-loaded-ball-powder-and-clean-gun');await inventory();await shot('1349-native-entire188-restored-original-loaded-round-and-icons');await page.keyboard.press('Escape');await page.keyboard.press('f');await check('actual-firearm-aim-zero-tu-no-ammo-or-rng-change');await page.keyboard.press('Enter');assert.equal(playerAct(w,{type:'shoot',target:target.id}),null);await check('actual-one-loaded-shot-original-gunshot-target-death-no-arrow-recovery');assert.equal(w.s.time,initial.time+1400);assert.equal(target.alive,false);assert.equal(gun.loadedRound,undefined);assert.equal(gun.loadedAmmo,undefined);assert.equal(gun.firearmFouling,4);assert.equal(ball.count,1);assert.equal(powder.count,1);assert.ok(!tileAt(w,target.pos).items.some(i=>i.def==='Item.LeadBall'||i.def==='Item.Arrow'));await shot('1350-native-actual-gunshot-and-original-one-round-consumed')
 await restore('entire188-restored-original-spent-shot-fouling-and-remaining-two-supplies');await inventory();await shot('1351-native-entire188-restored-original-one-ball-one-powder-no-oil')
 assert.equal(screenshots,5);assert.equal(roundtrips,2);assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({screenshots,roundtrips,save:SAVE_VERSION,initialTime:initial.time,finalTime:w.s.time,gunUid:gun.uid,ballUid:ball.uid,powderUid:powder.uid,oilUid:oil.uid,creationFx,rendered,errors,source:'finite initial original musket/fouling40/two balls/two powder doses/one oil and initial seed; real Title continue/600TU clean/700TU atomic reload/zeroTU aim/100TU shot/two whole188 restores; no post-load browser world/time/RNG manipulation; headless expected normal renderer FX consumption only'},null,2));console.log(JSON.stringify({screenshots,roundtrips,save:SAVE_VERSION,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* 이미 종료됨 */}}
