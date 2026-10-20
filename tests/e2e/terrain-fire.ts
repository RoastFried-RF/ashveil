import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {terrainFireNativeFixture,type TerrainFirePhase} from '../terrain-fire-fixture'
import type {CampfireDef} from '../../src/core/types'
import {drinkVolume} from '../../src/core/wash-water'
const outDir=process.argv[2]??'test-results/terrain-fire-browser';mkdirSync(outDir,{recursive:true})
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
async function shot(p:Page,name:string){await p.waitForTimeout(800);const pane=p.getByTestId('win-craft');if(await pane.isVisible())await pane.screenshot({path:outDir+'/'+name+'.png',animations:'disabled'});else await p.locator('[data-testid=map] canvas').screenshot({path:outDir+'/'+name+'.png',animations:'disabled'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));assert.deepEqual(after,before)}
let page:Page|undefined
try{
 const phases:TerrainFirePhase[]=['unlit','burning','spread','burned','extinguished','pending','uiExtinguish'],rows:unknown[]=[]
 for(const phase of phases){
  const d=terrainFireNativeFixture(phase);assert.equal(d.proof.actualTurns,({unlit:0,burning:240,spread:470,burned:840,extinguished:244,pending:241,uiExtinguish:243})[phase]);assert.equal(d.w.db.get<CampfireDef>('Campfire.Hearth').wildfire!.sparkChance,.02);page=await initial(d.w);let queues:unknown,actualUiTurns:number|undefined
  if(phase==='pending'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[] as World['s']['fx']};assert.ok(before.simulationPending);runUntilInput(expected);q.after=expected.s.fx.splice(0);queues=q;assert.equal((expected.s.time-before.time)/100,19)
   writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(want));assert.deepEqual(actual,want)
  }
  await close(page)
  const names={unlit:'760-native-original-cold-campfire-kit-and-two-dry-trees-no-flame-no-wood-use',burning:'761-native-actual-default-two-percent-spark-after-one-hundred-work-and-one-hundred-forty-real-wait-turns-original-tree-burning',spread:'762-native-two-hundred-thirty-more-real-turns-original-flame-spreads-to-original-adjacent-tree-with-parent-fire-id',burned:'763-native-six-hundred-more-real-burning-turns-original-tree-depleted-to-ground-no-harvestable-wood',extinguished:'764-native-original-water-bottle-five-hundred-ml-used-one-real-turn-extinguishing-preserves-partial-fuel',pending:'765-native-original-live-tree-fire-save-nineteen-more-real-turns-whole-exact-fuel-flames-and-wood',uiExtinguish:'766-native-original-burning-tree-actual-nearby-water-extinguishing-button-and-real-five-hundred-ml-cost'}
  if(phase==='unlit'||phase==='extinguished'||phase==='uiExtinguish'){await page.getByRole('button',{name:/제작/}).click();await page.getByTestId('win-craft').waitFor();if(phase==='uiExtinguish')await page.getByTestId('put-out-terrain-'+d.treePos.x+'-'+d.treePos.y).scrollIntoViewIfNeeded()}
  await shot(page,names[phase])
  if(phase==='uiExtinguish'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[] as World['s']['fx']};assert.equal(playerAct(expected,{type:'putOutTerrainFire',pos:d.treePos}),null);q.after=expected.s.fx.splice(0);queues=q
   await page.getByTestId('put-out-terrain-'+d.treePos.x+'-'+d.treePos.y).click();await idle(page);const actual=await read(page);assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));actualUiTurns=(actual.time-before.time)/100;assert.equal(actualUiTurns,1);await shot(page,'767-native-actual-extinguish-ui-one-turn-whole-exact-original-bottle-id-and-five-hundred-ml-remain')
  }
  const actual=await read(page),p=actual.creatures.find(c=>c.id===actual.playerId)!,w={db:d.w.db,s:actual},tree=actual.map.tiles[d.treePos.y*actual.map.w+d.treePos.x]!,second=actual.map.tiles[d.secondPos.y*actual.map.w+d.secondPos.x]!,water=p.bag.find(i=>i.uid===d.bottle.uid)!,wood=p.bag.filter(i=>i.def==='Item.Wood').reduce((n,i)=>n+i.count,0)
  assert.ok(p.alive);assert.equal(actual.version,SAVE_VERSION);assert.equal(water.uid,d.proof.initialBottleUid);assert.equal(wood,phase==='unlit'?3:2);assert.equal(drinkVolume(w,water),phase==='extinguished'||phase==='uiExtinguish'?500:1000)
  if(phase==='unlit')assert.equal(tree.terrainFire,undefined)
  else if(phase==='burned'){assert.equal(tree.t,'Terrain.Earth');assert.equal(tree.terrainFire,undefined);assert.equal(w.db.terrain(tree.t).gather,undefined)}
  else if(phase==='extinguished'||phase==='uiExtinguish'){assert.equal(tree.terrainFire,undefined);assert.ok(tree.combustionRemaining!.remaining<600);assert.ok(tree.fireWetUntil!>actual.time/100)}
  else assert.equal(tree.terrainFire!.sourceUid,d.kit.uid)
  if(phase==='spread')assert.equal(second.terrainFire!.sourceUid,d.proof.firstFireId)
  await restore(page,'same-original-terrain-fire-'+phase);rows.push({phase,proof:d.proof,tree,second,actualWood:wood,actualWaterMl:drinkVolume(w,water),actualUiTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,wholeRoundtrips:7,screenshots:8,defaultSparkChance:.02,actualIgnitionWorkTurns:100,actualFirstFireTurns:240,actualSpreadMoreTurns:230,actualBurnMoreTurns:600,actualUiExtinguishTurns:1,actualWaterMl:500,uiExtinguishWholeExactAfterRendering:true,actualPendingTurns:19,pendingBrowserWholeExactAfterRendering:true,viewportShotsUseWorldCanvasAndUiWindows:true,rows,consoleErrors:errors},null,2));console.log('OK: seven original actual terrainfire scenes/eightcanvas-or-UI-windowshots/sevenwhole119;default.02;real100work+140wait/230/600T;actualUIwater500ml1Twholeexact/pending19wholeexact;console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
