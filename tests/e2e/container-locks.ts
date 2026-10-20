import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {player,tileAt,type World} from '../../src/core/ctx'
import {initializeFieldDevices} from '../../src/core/field-devices'
import {updatePlayerVision} from '../../src/core/fov'
import {DIRS} from '../../src/core/geom'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {addToBag,equip,makeItem} from '../../src/core/items'
import {generateDungeon} from '../../src/core/mapgen'
import {serialize} from '../../src/core/save'
import {prisonerFixture} from '../prisoner-fixture'

const out=process.argv[2]??'test-results/container-locks-browser-v274';mkdirSync(out,{recursive:true})
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
 const{w,p}=prisonerFixture();w.s.creatures=[p];w.s.overworld=undefined;p.bag=[];p.equip={};w.s.loot=undefined
 const generated=generateDungeon(w,1);w.s.map=generated.map;w.s.maps={};w.s.offCreatures={};const index=w.s.map.tiles.findIndex(t=>t.t==='Terrain.GuardChest'&&t.locked);assert.ok(index>=0)
 const pos={x:index%w.s.map.w,y:Math.floor(index/w.s.map.w)},stand=DIRS.filter(d=>Math.abs(d.x)+Math.abs(d.y)===1).map(d=>({x:pos.x+d.x,y:pos.y+d.y})).find(p=>p.x>=0&&p.y>=0&&p.x<w.s.map.w&&p.y<w.s.map.h&&w.db.terrain(tileAt(w,p).t).passable);assert.ok(stand);p.pos=stand;p.mapId=w.s.map.id
 const knife=makeItem(w,'Item.RustyKnife'),lamp=makeItem(w,'Item.Lantern');lamp.lit=true;assert.equal(addToBag(w,p,knife),0);assert.equal(addToBag(w,p,lamp),0);assert.equal(equip(w,p,knife.uid,'main'),null);assert.equal(equip(w,p,lamp.uid,'off'),null)
 initializeFieldDevices(w);updatePlayerVision(w,p);const creationFx=structuredClone(w.s.fx);w.s.fx=[];const initial=JSON.parse(serialize(w.s));writeFileSync(join(out,'initial.json'),JSON.stringify(initial))
 const check=async(phase:string)=>{await idle();rendered.push({phase,fx:structuredClone(w.s.fx)});w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected)}
 const restore=async(phase:string)=>{await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas');await check(phase);wholeRoundtrips++}
 await page.goto('http://localhost:4317/?debug');await page.getByTestId('start').click();await page.waitForSelector('[data-testid=map] canvas');await page.evaluate(s=>{(window as unknown as Hook).__ashveil.world().s=s},initial)
 await page.keyboard.press('F2');await page.getByTestId('container-locks').scrollIntoViewIfNeeded();await check('initial-actual-generated-guard-chest-lock-and-original-tool');await shot('1328-native-actual-generated-guard-chest-locked-and-real-tool-work-quote')
 const next=w.s.nextId;await page.getByTestId('pry-container-'+pos.x+'-'+pos.y).click();assert.equal(playerAct(w,{type:'pryContainer',pos}),null);await check('actual-pry-thirty-turns-tool-wear-five-unlock-without-loot-generation');assert.equal(w.s.time,initial.time+3000);assert.equal(w.s.nextId,next);assert.equal(tileAt(w,pos).locked,false);assert.equal(tileAt(w,pos).cont,undefined);assert.equal(player(w).equip.main!.durability,95)
 await page.keyboard.press('Escape');await page.keyboard.press('i');await page.getByTestId('slot-main').hover();await shot('1329-native-unlocked-original-chest-no-loot-yet-and-original-tool-durability');await restore('entire185-restored-unlocked-chest-original-tool-and-no-generated-contents')
 await page.keyboard.press('i');await page.keyboard.press('s');assert.equal(playerAct(w,{type:'search'}),null);await check('actual-separate-normal-search-opens-original-chest-once');assert.equal(tileAt(w,pos).searched,true);assert.equal(tileAt(w,pos).cont?.opened,true);assert.ok(tileAt(w,pos).cont!.items.length>0);await page.getByTestId('loot').waitFor();await shot('1330-native-separate-real-search-original-six-by-four-chest-contents')
 const item=tileAt(w,pos).cont!.items[0],contentsBefore=structuredClone(tileAt(w,pos).cont!.items);await page.getByTestId('loot-'+item.def).first().dblclick();assert.equal(playerAct(w,{type:'lootTake',uid:item.uid}),null);await check('actual-original-chest-item-moved-with-original-uid-and-state');assert.ok(player(w).bag.some(i=>i.uid===item.uid));const expectedCount=contentsBefore.reduce((n,i)=>n+i.count,0)-item.count;assert.equal(tileAt(w,pos).cont!.items.reduce((n,i)=>n+i.count,0),expectedCount)
 await restore('entire185-restored-unlocked-original-chest-and-actual-taken-item');await page.keyboard.press('i');await shot('1331-native-restored-entire185-unlocked-chest-original-loot-and-original-taken-item')
 assert.equal(screenshots,4);assert.equal(wholeRoundtrips,2);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,initialTime:initial.time,finalTime:w.s.time,pos,knifeUid:knife.uid,lampUid:lamp.uid,takenUid:item.uid,creationFx,rendered,source:'INITIAL isolated terrain from actual generateDungeon output/player/finite original knife and lit lantern; actual F2 pry30turn/wear5/noLoot->whole restore->actual S search/loot take->whole restore; only headless expected normal renderer FX consumption modeled',errors},null,2));console.log(JSON.stringify({screenshots,wholeRoundtrips,save:SAVE_VERSION,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}
finally{await page.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* 종료됨 */}}
