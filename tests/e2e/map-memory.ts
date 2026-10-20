import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {mapMemoryNativeFixture,type MapMemoryPhase} from '../map-memory-fixture'
const outDir=process.argv[2]??'test-results/map-memory-browser';mkdirSync(outDir,{recursive:true})
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
async function hover(p:Page,x:number){await p.mouse.move(x,468);await p.getByTestId('hover').waitFor();return p.getByTestId('hover').innerText()}
let page:Page|undefined,screenshots=0
async function shot(p:Page,name:string,tooltip=false){await p.waitForTimeout(600);await (tooltip?p.getByTestId('hover'):p.locator('[data-testid=map] canvas')).screenshot({path:outDir+'/'+name+'.png',animations:'disabled'});screenshots++}
try{
 const rows:unknown[]=[]
 for(const phase of ['remembered','revealed','pending']as MapMemoryPhase[]){
  const d=mapMemoryNativeFixture(phase);page=await initial(d.w);let queues:unknown,actualUiTurns:number|undefined,actualPendingTurns:number|undefined
  if(phase==='remembered'){
   const before=await read(page),text=await hover(page,816);assert.ok(text.includes('나무'));assert.ok(text.includes('기억 속의 모습'));assert.ok(text.includes('관찰'));await shot(page,'777-native-last-observed-tree-behind-closed-door');await shot(page,'778-native-hover-same-tree-and-original-observation-time',true);assert.deepEqual(await read(page),before)
   const unknownText=await hover(page,976);assert.ok(unknownText.includes('미탐색'));assert.ok(!unknownText.includes('상자'));await shot(page,'779-native-unknown-cell-does-not-reveal-original-hidden-chest',true);assert.deepEqual(await read(page),before)
   const expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[]as World['s']['fx']};for(let i=0;i<2;i++)assert.equal(playerAct(expected,{type:'move',dir:2}),null);q.after=expected.s.fx.splice(0);queues=q
   await page.keyboard.press('ArrowRight');await idle(page);await page.keyboard.press('ArrowRight');await idle(page);await page.waitForTimeout(600);const actual=await read(page);writeFileSync(outDir+'/actual-ui-two-turns.json',JSON.stringify(actual));writeFileSync(outDir+'/headless-two-turns.json',JSON.stringify(expected.s));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));actualUiTurns=(actual.time-before.time)/100;assert.equal(actualUiTurns,2)
   const revealed=await hover(page,816);assert.ok(revealed.includes(d.w.db.terrain('Terrain.Earth').label));assert.ok(!revealed.includes('기억 속의 모습'));await shot(page,'780-native-actual-two-arrow-inputs-open-door-and-reveal-current-earth');await shot(page,'781-native-hover-current-earth-after-actual-observation',true)
  }
  if(phase==='pending'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[]as World['s']['fx']};assert.ok(before.simulationPending);runUntilInput(expected);q.after=expected.s.fx.splice(0);queues=q;actualPendingTurns=(expected.s.time-before.time)/100;assert.equal(actualPendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before))
   await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page);writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(expected.s));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));await shot(page,'782-native-map-memory-pending-save-nineteen-more-real-turns-whole-exact')
  }
  await restore(page,'same-observed-map-'+phase);rows.push({phase,proof:d.proof,actualUiTurns,actualPendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.equal(screenshots,6);assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,wholeRoundtrips:3,screenshots,actualUiTwoTurnsWholeExact:true,actualPendingNineteenTurnsWholeExact:true,queriesWholeStateUnchanged:true,initialPriorExplorationExplicit:true,rows,consoleErrors:errors},null,2));console.log('OK: map-memory sixshots/threewhole120;actualUI2Topensdoor/updatessameobservedtree-to-earth/unknownchesthidden/querywholeunchanged/pending19wholeexact/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
