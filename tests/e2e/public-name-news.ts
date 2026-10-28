import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import type {Action} from '../../src/core/actions'
import {publicNameNativeFixture,type PublicNamePhase} from '../public-name-news-fixture'
const outDir=process.argv[2]??'test-results/public-name-news-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World;refresh():void}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s))as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');const check=await p.evaluate(s=>{const h=(window as unknown as Hook).__ashveil;h.world().s=s;const before=JSON.parse(JSON.stringify(s));h.refresh();return{before,after:JSON.parse(JSON.stringify(h.world().s))}},w.s);assert.deepEqual(check.before,JSON.parse(JSON.stringify(w.s)));assert.deepEqual(check.after,check.before);return p}
async function restore(p:Page,label:string){const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));assert.deepEqual(after,before)}
let screenshots=0,page:Page|undefined
async function open(p:Page){if(!await p.getByTestId('win-society').isVisible()){await p.keyboard.press('Shift+n');await p.getByTestId('win-society').waitFor()}}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,label:string){await p.waitForTimeout(500);await p.getByTestId('win-society').screenshot({path:outDir+'/'+label+'.png',animations:'disabled'});screenshots++}
async function action(p:Page,action:Action,input:()=>Promise<unknown>,label:string,db:World['db']){const before=await read(p),expected:World={db,s:structuredClone(before)},fxBefore=expected.s.fx.splice(0);assert.equal(playerAct(expected,action),null);const fxAfter=expected.s.fx.splice(0);await input();await idle(p);const actual=await read(p);writeFileSync(outDir+'/'+label+'-actual.json',JSON.stringify(actual));writeFileSync(outDir+'/'+label+'-expected.json',JSON.stringify(expected.s));writeFileSync(outDir+'/'+label+'-renderer-fx.json',JSON.stringify({fxBefore,fxAfter}));assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));return(actual.time-before.time)/100}
try{
 const proofs:unknown[]=[]
 for(const phase of ['source','good','bad','pending']as PublicNamePhase[]){
  const d=publicNameNativeFixture(phase);page=await initial(d.w);let postTurns:number|undefined,heardTurns:number|undefined,pendingTurns:number|undefined
  if(phase==='source'){
   assert.equal((await read(page)).overworld!.rumorNetwork,undefined);postTurns=await action(page,{type:'move',dir:6},()=>page!.keyboard.press('ArrowLeft'),'actual-one-turn-hostile-bump-attack-public-witness-source',d.w.db);assert.equal(postTurns,1);const state=await read(page);assert.equal(state.overworld!.rumorNetwork!.towns[d.site]!.length,1);assert.ok(state.overworld!.rumorNetwork!.pending.length>0);assert.deepEqual(state.knowledge.rumors,[]);const report=state.overworld!.rumorNetwork!.towns[d.site]![0]!;assert.equal(report.reputation!.subject.id,d.p.id);assert.ok(report.source.includes('현장 목격'));await open(page);await page.getByRole('button',{name:'세력·소식',exact:true}).click();await shot(page,'819-native-actual-one-turn-bump-attack-local-witness-starts-public-name-network')
  }
  if(phase==='good'||phase==='bad'){
   await open(page);assert.equal(await page.getByTestId('first-impression').count(),0);const before=await read(page);assert.deepEqual(before.knowledge.rumors,[]);heardTurns=await action(page,{type:'talk',target:d.keeper.id},()=>page!.getByTestId('talk-person').click(),'actual-'+phase+'-first-meeting-one-turn',d.w.db);assert.equal(heardTurns,1);const state=await read(page),memory=state.creatures.find(c=>c.id===d.keeper.id)!.firstImpressions![d.p.id]!;assert.equal(memory.score,phase==='good'?10:-10);assert.equal(memory.attitude,phase==='good'?'warm':'wary');assert.ok(memory.terms.some(t=>t.kind==='rumor'));const text=await page.getByTestId('first-impression').innerText();assert.ok(text.includes('소식을 이미 들은'));assert.ok(text.includes(phase==='good'?'반갑게':'경계'));assert.equal(state.knowledge.rumors!.length,1);await shot(page,phase==='good'?'820-native-actual-first-talk-arrived-good-name-warm-response':'821-native-actual-first-talk-arrived-bad-name-wary-response')
  }
  const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},fxBefore=expected.s.fx.splice(0)
  if(phase==='pending'){
   assert.equal(before.simulationPending,true);const at=expected.s.time;runUntilInput(expected);const fxAfter=expected.s.fx.splice(0);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page);pendingTurns=(actual.time-at)/100;assert.equal(pendingTurns,19);assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));assert.equal(actual.knowledge.rumors!.length,1);assert.equal(actual.creatures.find(c=>c.id===d.keeper.id)!.firstImpressions![d.p.id]!.score,-10);writeFileSync(outDir+'/pending-whole-comparison.json',JSON.stringify({actual,expected:expected.s,fxBefore,fxAfter}));await open(page);await shot(page,'822-native-name-first-meeting-pending-save-nineteen-turns-whole-exact')
  }
  if(phase!=='pending'){await close(page);await restore(page,phase)}proofs.push({...d.proof,postTurns,heardTurns,pendingTurns,save:SAVE_VERSION});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/summary.json',JSON.stringify({proofs,screenshots,wholeRoundtrips:4,errors},null,2));console.log(JSON.stringify({proofs,screenshots,wholeRoundtrips:4,errors},null,2))
}finally{await page?.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* already stopped */}}
