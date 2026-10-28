import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {woodDoorFireNativeFixture,type WoodDoorPhase} from '../wood-door-fire-fixture'
import {db} from '../helpers'
import type {CampfireDef} from '../../src/core/types'
import {drinkVolume} from '../../src/core/wash-water'
const outDir=process.argv[2]??'test-results/wood-door-fire-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World;refresh():void}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas')
 const check=await p.evaluate(s=>{const h=(window as unknown as Hook).__ashveil;h.world().s=s;const before=JSON.parse(JSON.stringify(h.world().s));h.refresh();return{before,after:JSON.parse(JSON.stringify(h.world().s))}},w.s)
 assert.deepEqual(check.before,JSON.parse(JSON.stringify(w.s)));assert.deepEqual(check.after,check.before);await p.waitForTimeout(100);assert.equal((await read(p)).time,w.s.time);return p
}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);const craft=p.getByTestId('win-craft'),body=p.getByTestId('win-body'),pane=await craft.isVisible()?craft:body;if(await pane.isVisible())await pane.screenshot({path:outDir+'/'+name+'.png',animations:'disabled'});else await p.locator('[data-testid=map] canvas').screenshot({path:outDir+'/'+name+'.png',animations:'disabled'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));assert.deepEqual(after,before)}
let page:Page|undefined
let screenshots=0
async function snap(p:Page,name:string){await shot(p,name);screenshots++}
try{
 const phases:WoodDoorPhase[]=['unlit','burning','opened','reclosed','burned','quenched','pending','pendingOpen'],rows:unknown[]=[]
 for(const phase of phases){
  const d=woodDoorFireNativeFixture(phase);assert.equal(d.w.db,db);assert.equal(d.w.db.get<CampfireDef>('Campfire.Hearth').wildfire!.sparkChance,.02);assert.equal(d.proof.actualTurns,({unlit:0,burning:160,opened:163,reclosed:164,burned:760,quenched:164,pending:161,pendingOpen:164})[phase]);page=await initial(d.w);let queues:unknown,actualUiTurns:number|undefined,actualPendingTurns:number|undefined
  if(d.proof.pending){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[] as World['s']['fx']};assert.ok(before.simulationPending);runUntilInput(expected);q.after=expected.s.fx.splice(0);queues=q;actualPendingTurns=(expected.s.time-before.time)/100;assert.equal(actualPendingTurns,phase==='pendingOpen'?16:19)
   writeFileSync(outDir+'/'+phase+'-before-save.json',JSON.stringify(before));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/'+phase+'-browser-actual.json',JSON.stringify(actual));writeFileSync(outDir+'/'+phase+'-headless-rendered-expected.json',JSON.stringify(want));assert.deepEqual(actual,want)
  }
  await close(page)
  if(['unlit','opened','quenched'].includes(phase)){await page.getByRole('button',{name:/제작/}).click();await page.getByTestId('win-craft').waitFor();if(phase==='opened')await page.getByTestId('put-out-terrain-'+d.doorPos.x+'-'+d.doorPos.y).scrollIntoViewIfNeeded()}
  if(phase==='pendingOpen'){await page.keyboard.press('Shift+B');await page.getByTestId('win-body').waitFor();await page.getByTestId('wounds').scrollIntoViewIfNeeded()}
  const names={unlit:'768-native-original-generated-family-home-wooden-door-and-cold-original-fire-kit',burning:'769-native-genuine-default-spark-original-generated-wood-door-burning-after-one-hundred-fifty-work-and-ten-wait-turns',opened:'770-native-real-one-turn-door-opening-keeps-original-flame-id-time-and-remaining-fuel',reclosed:'772-native-real-door-closing-retains-original-fire-and-decreasing-material',burned:'773-native-original-wooden-door-six-hundred-real-burning-turns-becomes-passable-ground-without-new-loot',quenched:'774-native-original-open-wood-door-quenched-with-five-hundred-ml-same-bottle-and-partial-material',pending:'775-native-closed-burning-door-save-nineteen-more-real-turns-whole-exact',pendingOpen:'776-native-open-burning-door-save-sixteen-more-real-turns-to-one-real-burn-and-existing-injury-stop-whole-exact'}
  await snap(page,names[phase])
  if(phase==='opened'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[] as World['s']['fx']};assert.equal(playerAct(expected,{type:'putOutTerrainFire',pos:d.doorPos}),null);q.after=expected.s.fx.splice(0);queues=q;await page.getByTestId('put-out-terrain-'+d.doorPos.x+'-'+d.doorPos.y).click();await idle(page);const actual=await read(page);assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));actualUiTurns=(actual.time-before.time)/100;assert.equal(actualUiTurns,1);await snap(page,'771-native-actual-open-wood-door-extinguish-button-one-turn-same-original-water-uid-and-five-hundred-ml-remain')
  }
  const actual=await read(page),p=actual.creatures.find(c=>c.id===actual.playerId)!,w={db:d.w.db,s:actual},door=actual.map.tiles[d.doorPos.y*actual.map.w+d.doorPos.x]!,water=p.bag.find(i=>i.uid===d.bottle.uid)!,wood=p.bag.filter(i=>i.def==='Item.Wood').reduce((n,i)=>n+i.count,0)
  assert.ok(p.alive);assert.equal(actual.version,SAVE_VERSION);assert.equal(actual.map.layout,'RegionLayout.BlackwoodVillage');assert.equal(wood,phase==='unlit'?3:2);assert.equal(water.uid,d.bottle.uid);assert.equal(drinkVolume(w,water),phase==='opened'||phase==='quenched'?500:1000)
  if(phase==='unlit')assert.equal(door.terrainFire,undefined)
  else if(phase==='burned'){assert.equal(door.t,'Terrain.Earth');assert.equal(door.terrainFire,undefined);assert.ok(w.db.terrain(door.t).passable);assert.equal(door.items.length,0)}
  else if(phase==='opened'||phase==='quenched'){assert.equal(door.t,'Terrain.WoodDoorOpen');assert.equal(door.terrainFire,undefined);assert.ok(door.combustionRemaining!.remaining<600)}
  else{assert.equal(door.terrainFire!.id,d.proof.firstFireId);assert.equal(door.terrainFire!.sourceUid,d.kit.uid);assert.equal(door.terrainFire!.family,'wood-door');assert.equal(door.terrainFire!.total,600)}
  if(phase==='reclosed')assert.equal(door.t,'Terrain.WoodDoorClosed')
  if(phase==='pendingOpen'){assert.equal(door.t,'Terrain.WoodDoorOpen');assert.equal(p.body.wounds.filter(w=>w.def==='Wound.Burn').length,1);assert.equal(p.activity,undefined);assert.ok(actual.log.at(-1)!.text.includes('다쳤다'))}
  await restore(page,'same-original-generated-wood-door-'+phase);rows.push({phase,proof:d.proof,door,actualUiTurns,actualPendingTurns,actualWaterMl:drinkVolume(w,water),actualHp:p.hp,renderedQueues:queues});await page.close();page=undefined
 }
 assert.equal(screenshots,9);assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,wholeRoundtrips:8,screenshots,genuineDefaultSparkChance:.02,actualWorkTurns:150,actualWaitBeforeFire:10,actualDoorOpenAndCloseEachTurns:1,actualBurnMoreTurns:600,actualUiWaterTurns:1,actualUiWaterMl:500,actualPendingClosedTurns:19,actualPendingOpenTurns:16,bothPendingBrowserWholeExactAfterRendering:true,uiDoorExtinguishWholeExactAfterRendering:true,originalRegionalFactoryLayout:'RegionLayout.BlackwoodVillage',initialPriorExplorationExplicit:true,rows,consoleErrors:errors},null,2));console.log('OK: eight original regionalfactory wooddoor scenes/nineshots/eightwhole120;genuinedefault.02;real150work+10wait/openclose1T/burn600/UIwater500ml1Twholeexact/pending19&16injurystopwholeexact;console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
