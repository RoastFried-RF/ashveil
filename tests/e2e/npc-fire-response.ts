import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {npcFireResponseNativeFixture,type NpcFireResponsePhase} from '../npc-fire-response-fixture'
import {drinkVolume} from '../../src/core/wash-water'
import {db} from '../helpers'
const outDir=process.argv[2]??'test-results/npc-fire-response-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World;refresh():void}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas')
 const check=await p.evaluate(s=>{const h=(window as unknown as Hook).__ashveil;h.world().s=s;const before=JSON.parse(JSON.stringify(s));h.refresh();return{before,after:JSON.parse(JSON.stringify(h.world().s))}},w.s)
 assert.deepEqual(check.before,JSON.parse(JSON.stringify(w.s)));assert.deepEqual(check.after,check.before);await p.waitForTimeout(300);return p
}
async function restore(p:Page,label:string){const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));assert.deepEqual(after,before)}
let page:Page|undefined,screenshots=0
async function shot(p:Page,name:string){await p.waitForTimeout(600);await p.locator('[data-testid=map] canvas').screenshot({path:outDir+'/'+name+'.png',animations:'disabled'});screenshots++}
try{
 const rows:unknown[]=[]
 for(const phase of ['before','quenched','pending']as NpcFireResponsePhase[]){
  const d=npcFireResponseNativeFixture(phase);assert.equal(d.w.db,db);page=await initial(d.w);let queues:unknown,actualUiTurns:number|undefined,actualPendingTurns:number|undefined
  if(phase==='before'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[]as World['s']['fx']};assert.equal(before.map.tiles[d.treePos.y*before.map.w+d.treePos.x]!.terrainFire,undefined);await shot(page,'787-native-original-ally-has-original-one-liter-bottle-before-genuine-default-fire')
   for(let i=0;i<2;i++){
    assert.equal(playerAct(expected,{type:'wait'}),null);q.after.push(...expected.s.fx.splice(0));await page.keyboard.press('.');await idle(page);const actual=await read(page);writeFileSync(outDir+'/actual-ui-wait-'+(i+1)+'.json',JSON.stringify(actual));writeFileSync(outDir+'/headless-wait-'+(i+1)+'.json',JSON.stringify(expected.s));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));await shot(page,i===0?'788-native-actual-first-wait-default-spark-before-npc-quench-turn':'789-native-actual-second-wait-same-npc-uses-five-hundred-ml-one-turn-and-no-player-water')
   }
   const actual=await read(page),npc=actual.creatures.find(c=>c.id===d.npc.id)!;actualUiTurns=(actual.time-before.time)/100;assert.equal(actualUiTurns,2);assert.deepEqual(npc.pos,d.initialNpcPos);assert.deepEqual(npc.body.wounds,[]);assert.equal(actual.map.tiles[d.treePos.y*actual.map.w+d.treePos.x]!.terrainFire,undefined);assert.equal(drinkVolume({db:d.w.db,s:actual},npc.bag.find(i=>i.uid===d.npcBottle.uid)!),500);assert.equal(drinkVolume({db:d.w.db,s:actual},actual.creatures.find(c=>c.id===actual.playerId)!.bag.find(i=>i.uid===d.bottle.uid)!),1000);queues=q
  }
  if(phase==='pending'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[]as World['s']['fx']};assert.ok(before.simulationPending);runUntilInput(expected);q.after=expected.s.fx.splice(0);queues=q;actualPendingTurns=(expected.s.time-before.time)/100;assert.equal(actualPendingTurns,20);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before))
   await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page);writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(expected.s));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));await shot(page,'790-native-same-npc-bottle-quench-and-pending-save-twenty-more-real-turns-whole-exact')
  }
  await restore(page,'same-original-npc-water-'+phase);rows.push({phase,proof:d.proof,actualUiTurns,actualPendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.equal(screenshots,4);assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,wholeRoundtrips:3,screenshots,genuineDefaultSparkChance:.02,actualUiTwoWaitTurnsWholeExact:true,npcSameOriginalPosition:true,npcOriginalBottleRemainingMl:500,playerOriginalBottleRemainingMl:1000,npcNoNewWound:true,actualPendingWholeExact:true,rows,consoleErrors:errors},null,2));console.log('OK: npc-fire-response fourshots/threewhole120;genuine-default.02/actualUI2waitT/sameNPCwater500ml1T/playerwater1000/noBurn/pending20wholeexact/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
