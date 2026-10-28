import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {playerAct,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import type {Action} from '../../src/core/actions'
import {publicOutbreakNativeFixture,type PublicOutbreakPhase} from '../public-outbreak-news-fixture'
const outDir=process.argv[2]??'test-results/public-outbreak-news-browser';mkdirSync(outDir,{recursive:true})
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
 for(const phase of ['announcement','arrival','pending']as PublicOutbreakPhase[]){
  const d=publicOutbreakNativeFixture(phase);page=await initial(d.w);let postTurns:number|undefined,heardTurns:number|undefined,pendingTurns:number|undefined
  if(phase==='announcement'){
   assert.equal((await read(page)).overworld!.rumorNetwork,undefined);await open(page);assert.equal(await page.getByTestId('rumor-network-panel').count(),0);await shot(page,'814-native-initial-new-quarantine-decision-before-real-six-am-application');await close(page)
   postTurns=await action(page,{type:'wait'},()=>page!.keyboard.press('.'),'actual-six-am-one-turn-quarantine-application-and-public-announcement',d.w.db);assert.equal(postTurns,1);const after=await read(page);assert.equal(after.map.quarantine,true);const announcement=after.overworld!.rumorNetwork!.towns[d.site]![0]!;assert.equal(announcement.writtenAt,after.time/100);assert.equal(announcement.source,d.m.sites.find(s=>s.id===d.site)!.label+'의 공개 공고');assert.equal(announcement.claims!.count,undefined);assert.equal(after.knowledge.rumors!.length,0);await open(page);heardTurns=await action(page,{type:'talk',target:d.keeper.id},()=>page!.getByTestId('talk-person').click(),'actual-local-quarantine-talk',d.w.db);assert.equal(heardTurns,1);assert.equal((await read(page)).knowledge.rumors!.length,1);assert.ok((await page.getByTestId('win-society').innerText()).includes('출입을 막고 있다'));await shot(page,'815-native-real-six-am-publication-followed-by-actual-n-talk-no-population-count')
  }
  if(phase==='arrival'){
   await open(page);await action(page,{type:'talk',target:d.keeper.id},()=>page!.getByTestId('talk-person').click(),'before-arrival-talk-no-network-news',d.w.db);assert.deepEqual((await read(page)).knowledge.rumors,[]);assert.equal(await page.getByTestId('heard-town-rumor').count(),0);await shot(page,'816-native-remote-public-announcement-not-yet-arrived-no-automatic-knowledge');await close(page)
   await action(page,{type:'wait'},()=>page!.keyboard.press('.'),'second-turn-network-arrival-without-auto-learning',d.w.db);assert.deepEqual((await read(page)).knowledge.rumors,[]);await open(page);heardTurns=await action(page,{type:'talk',target:d.keeper.id},()=>page!.getByTestId('talk-person').click(),'actual-after-arrival-one-turn-talk',d.w.db);assert.equal(heardTurns,1);const r=(await read(page)).knowledge.rumors![0]!;assert.equal(r.kind,'outbreak');assert.equal(r.outbreak!.disease,'Disease.GreyFever');assert.equal(r.relay!.accuracy,82);assert.equal(r.hop,1);assert.equal(r.claims!.count,undefined);const text=await page.getByTestId('heard-town-rumor').innerText();assert.ok(text.includes('회색열')&&text.includes('전해 들음'));assert.ok(!text.includes('82')&&!text.includes('인구'));await shot(page,'817-native-actual-remote-public-announcement-heard-only-after-arrival-n-talk')
  }
  const before=await read(page),expected:World={db:d.w.db,s:structuredClone(before)},fxBefore=expected.s.fx.splice(0)
  if(phase==='pending'){
   assert.equal(before.simulationPending,true);const at=expected.s.time;runUntilInput(expected);const fxAfter=expected.s.fx.splice(0);writeFileSync(outDir+'/pending-before-save.json',JSON.stringify(before));await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await idle(page);const actual=await read(page);pendingTurns=(actual.time-at)/100;assert.equal(pendingTurns,19);assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)));assert.deepEqual(actual.knowledge.rumors,[]);assert.equal(actual.overworld!.rumorNetwork!.towns[d.site]!.length,1);writeFileSync(outDir+'/pending-whole-comparison.json',JSON.stringify({actual,expected:expected.s,fxBefore,fxAfter}));await open(page);await shot(page,'818-native-public-announcement-pending-save-resumes-nineteen-turns-unheard')
  }
  if(phase!=='pending'){await close(page);await restore(page,phase)}proofs.push({...d.proof,postTurns,heardTurns,pendingTurns,save:SAVE_VERSION});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/summary.json',JSON.stringify({proofs,screenshots,wholeRoundtrips:3,errors},null,2));console.log(JSON.stringify({proofs,screenshots,wholeRoundtrips:3,errors},null,2))
}finally{await page?.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* already stopped */}}
