import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import {localMapObservationNativeFixture,type LocalMapObservationPhase} from '../local-map-observation-fixture'
const outDir=process.argv[2]??'test-results/local-map-observation-browser';mkdirSync(outDir,{recursive:true})
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
async function mapOpen(p:Page){await p.keyboard.press('m');await p.getByTestId('win-map').waitFor();await p.getByTestId('local-map-canvas').waitFor();await p.waitForTimeout(100);assert.ok(!(await p.getByTestId('win-map').innerText()).includes('지하 2층'))}
async function point(p:Page,pos:{x:number;y:number}){const canvas=p.getByTestId('local-map-canvas'),box=(await canvas.boundingBox())!;await p.mouse.move(box.x+pos.x*4+2,box.y+pos.y*4+2);return p.getByTestId('local-map-observation').innerText()}
const pixel=(p:Page,pos:{x:number;y:number})=>p.getByTestId('local-map-canvas').evaluate((canvas,pos)=>Array.from((canvas as HTMLCanvasElement).getContext('2d')!.getImageData(pos.x*4+2,pos.y*4+2,1,1).data),pos)
async function shot(p:Page,name:string){await p.waitForTimeout(600);await p.getByTestId('win-map').screenshot({path:outDir+'/'+name+'.png',animations:'disabled'});screenshots++}
try{
 const rows:unknown[]=[]
 for(const phase of ['remembered','revealed','pending']as LocalMapObservationPhase[]){
  const d=localMapObservationNativeFixture(phase);page=await initial(d.w);let queues:unknown,actualUiTurns:number|undefined,actualPendingTurns:number|undefined
  if(phase==='remembered'){
   const before=await read(page);await mapOpen(page);const text=await point(page,d.target),rememberedPixel=await pixel(page,d.target);assert.ok(text.includes('기억'));assert.ok(text.includes('관찰'));assert.deepEqual(rememberedPixel,[90,86,76,255]);await shot(page,'791-native-local-map-last-observation-time-and-no-hidden-current-blood');assert.deepEqual(await read(page),before)
   assert.ok((await point(page,d.unknown)).includes('미탐색'));await shot(page,'792-native-local-map-unknown-cell-does-not-reveal-current-chest');assert.deepEqual(await read(page),before);await page.keyboard.press('Escape');await page.getByTestId('win-map').waitFor({state:'hidden'})
   const expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[]as World['s']['fx']};for(let i=0;i<2;i++)assert.equal(playerAct(expected,{type:'move',dir:2}),null);q.after=expected.s.fx.splice(0);queues=q
   await page.keyboard.press('ArrowRight');await idle(page);await page.keyboard.press('ArrowRight');await idle(page);const actual=await read(page);writeFileSync(outDir+'/actual-ui-two-turns.json',JSON.stringify(actual));writeFileSync(outDir+'/headless-two-turns.json',JSON.stringify(expected.s));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));actualUiTurns=(actual.time-before.time)/100;assert.equal(actualUiTurns,2)
   await mapOpen(page);assert.ok((await point(page,d.target)).includes('지금 보임'));assert.deepEqual(await pixel(page,d.target),[106,42,36,255]);await shot(page,'793-native-local-map-after-actual-two-inputs-current-visible-blood-and-observation')
  }
  if(phase==='pending'){
   const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},q={before:expected.s.fx.splice(0),after:[]as World['s']['fx']};assert.ok(before.simulationPending);runUntilInput(expected);q.after=expected.s.fx.splice(0);queues=q;actualPendingTurns=(expected.s.time-before.time)/100;assert.equal(actualPendingTurns,19);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before))
   await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page);writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));writeFileSync(outDir+'/pending-headless-rendered-expected.json',JSON.stringify(expected.s));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));await mapOpen(page);await point(page,d.target);await shot(page,'794-native-local-map-pending-save-nineteen-more-real-turns-whole-exact')
  }
  if(await page.getByTestId('win-map').isVisible())await page.keyboard.press('Escape');await restore(page,'same-original-local-map-'+phase);rows.push({phase,proof:d.proof,actualUiTurns,actualPendingTurns,renderedQueues:queues});await page.close();page=undefined
 }
 assert.equal(screenshots,4);assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,wholeRoundtrips:3,screenshots,actualUiTwoTurnsWholeExact:true,actualPendingNineteenTurnsWholeExact:true,queriesWholeStateUnchanged:true,hiddenBloodMapPixel:[90,86,76,255],visibleBloodMapPixel:[106,42,36,255],initialPriorExplorationExplicit:true,rows,consoleErrors:errors},null,2));console.log('OK: local-map fourUIwindowshots/threewhole120;actualhiddenbloodredacted/observationtime/unknownchesthidden/UI2Topensdoorvisibleblood/querywholeunchanged/pending19wholeexact/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await page.getByTestId('win-map').screenshot({path:outDir+'/failure.png'}).catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
