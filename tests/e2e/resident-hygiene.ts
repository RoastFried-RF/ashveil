import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import assert from 'node:assert/strict'
import {type World} from '../../src/core/ctx'
import {hasEffect} from '../../src/core/traits'
import {cheb,DIRS,dirIndex} from '../../src/core/geom'
import {findPath} from '../../src/core/path'
import {creatureAt,inBounds,terrainAt} from '../../src/core/ctx'
import {runUntilInput} from '../../src/core/game'
import {SAVE_VERSION} from '../../src/core/game'
import {residentHygieneNativeFixture} from '../resident-hygiene-fixture'
const outDir=process.argv[2]??'test-results/resident-hygiene-browser';mkdirSync(outDir,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)) as World['s'])
const idle=(p:Page)=>p.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&!s.creatures.find(c=>c.id===s.playerId)!.activity},{},{timeout:300000})
async function initial(w:World){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await p.goto('http://localhost:4317/?debug');await p.click('[data-testid=start]');await p.waitForSelector('[data-testid=map] canvas');const installed=await p.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),w.s);assert.deepEqual(JSON.parse(JSON.stringify(installed)),JSON.parse(JSON.stringify(w.s)));if(w.s.simulationPending){await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');await idle(p)}else{const at=w.s.time;await p.keyboard.press('i');await p.getByTestId('win-inv').waitFor();await p.keyboard.press('Control+s');await p.keyboard.press('Escape');assert.equal((await read(p)).time,at)}return p}
async function close(p:Page){for(let i=0;i<6&&await p.locator('[data-testid^="win-"]:visible').count();i++)await p.keyboard.press('Escape')}
async function shot(p:Page,name:string){await p.waitForTimeout(800);await p.screenshot({path:outDir+'/'+name+'.png'})}
async function restore(p:Page,label:string){await close(p);const before=await read(p);assert.equal(before.version,SAVE_VERSION);await p.getByRole('button',{name:'타이틀',exact:true}).click();await p.reload();await p.click('[data-testid=continue]');await p.waitForSelector('[data-testid=map] canvas');const after=await read(p);writeFileSync(outDir+'/'+label+'-before.json',JSON.stringify(before));writeFileSync(outDir+'/'+label+'-after.json',JSON.stringify(after));if(!isDeepStrictEqual(after,before))throw Error('whole Save86 drift; before/after files saved');return after}

async function person(p:Page,id:number){await close(p);await p.keyboard.press('N');await p.getByTestId('win-society').waitFor();await p.locator('[data-person-id="'+id+'"]').click();await p.getByTestId('resident-hygiene').waitFor()}
async function follow(p:Page,db:World['db'],id:number){
 await close(p)
 for(let i=0;i<30;i++){
  const s=await read(p),w={db,s},self=s.creatures.find(c=>c.id===s.playerId)!,target=s.creatures.find(c=>c.id===id)!
  if(cheb(self.pos,target.pos)<=1)return
  const paths=DIRS.map(v=>({x:target.pos.x+v.x,y:target.pos.y+v.y})).filter(pos=>inBounds(w,pos)&&terrainAt(w,pos).passable&&(!creatureAt(w,pos)||creatureAt(w,pos)?.id===self.id)).map(pos=>findPath(w,self.pos,pos,{avoidCreatures:true,selfId:self.id})).filter((path):path is NonNullable<typeof path>=>!!path?.length).sort((a,b)=>a.length-b.length),next=paths[0]?.[0]
  assert.ok(next);const dir=dirIndex(next.x-self.pos.x,next.y-self.pos.y),keys=['ArrowUp','Numpad9','ArrowRight','Numpad3','ArrowDown','Numpad1','ArrowLeft','Numpad7'];await p.keyboard.press(keys[dir]);await idle(p)
 }
 throw Error('actual observer could not walk beside resident')
}
let page:Page|undefined
try{
 const phases=['initial','body','bodyDone','bedding','clean','pending']as const,shots=[
 '558-native-original-carrier-one-real-rest-turn-contaminates-same-owned-bed-before-actual-resident-cleaning',
 '559-native-resident-walks-to-real-well-and-washes-body-for-two-hundred-turns-with-two-original-one-litre-bottles',
 '560-native-actually-washed-body-clears-lice-but-same-observed-owned-bed-still-needs-separate-two-litres',
 '561-native-same-resident-refills-original-bottles-and-actually-washes-observed-owned-bed-for-two-hundred-more-turns',
 '562-native-actual-body-and-owned-bed-cleaning-spends-four-litres-and-keeps-both-original-empty-bottle-uids',
 '563-native-continue-resumes-original-pending-resident-work-once-and-finishes-both-real-two-litre-washes']
 const rows:object[]=[];let originalEmptyBottleUids:number[]=[];const renderedQueues:object[]=[]
 for(let i=0;i<phases.length;i++){
  const phase=phases[i],d=residentHygieneNativeFixture(phase),bedKey=d.bed.pos.y*d.s.map.w+d.bed.pos.x,expected:World|undefined=phase==='pending'?{db:d.w.db,s:structuredClone(d.s)}:undefined
  if(expected){
   const before=expected.s.fx.splice(0);runUntilInput(expected)
   const after=expected.s.fx.splice(0)
   writeFileSync(outDir+'/pending-renderer-consumed-events.json',JSON.stringify({before,after}))
   assert.equal(before.filter(fx=>fx.k==='move').length,4)
   assert.equal(before.filter(fx=>fx.k==='xp'&&fx.id===d.s.playerId&&fx.v===5).length,1)
   assert.equal(after.length,3);assert.ok(after.every(fx=>fx.k==='move'&&fx.id===d.c.id))
   renderedQueues.push({phase,before,after})
   
  }
  if(i===0)originalEmptyBottleUids=d.bottles.map(b=>b.uid)
  page=await initial(d.w);let s=await read(page),c=s.creatures.find(c=>c.id===d.c.id)!,bed=s.map.tiles[bedKey];const water=()=>c.bag.reduce((n,it)=>n+(!d.w.db.item(it.def).drink?.alcohol?(d.w.db.item(it.def).drink?.water??0)*(it.uses??1):0),0)
  assert.deepEqual(c.bag.filter(it=>d.bottles.some(b=>b.uid===it.uid)).map(it=>it.uid),d.bottles.map(b=>b.uid))
  if(phase==='initial'){assert.equal(c.needs.hygiene,0);assert.equal(water(),0);assert.equal(hasEffect(c,'lice',Math.floor(s.time/100)),true);assert.equal(bed.beddingLice!.source,c.id);assert.equal(bed.beddingLice!.at,14401)}
  if(phase==='body'){assert.equal(c.activity!.kind,'wash');assert.equal(c.activity!.total,200);assert.equal(water(),2000);assert.equal(c.needs.hygiene,0);assert.ok(bed.beddingLice)}
  if(phase==='bodyDone'){assert.equal(c.needs.hygiene,60);assert.equal(hasEffect(c,'lice',Math.floor(s.time/100)),false);assert.ok(bed.beddingLice);assert.equal(water(),2000)}
  if(phase==='bedding'){assert.equal(c.activity!.kind,'washBedding');assert.equal(c.activity!.total,200);assert.equal(c.needs.hygiene,60);assert.equal(water(),2000);assert.ok(bed.beddingLice)}
  if(phase==='clean'||phase==='pending'){assert.equal(c.needs.hygiene,60);assert.equal(water(),0);assert.equal(hasEffect(c,'lice',Math.floor(s.time/100)),false);assert.equal(bed.beddingLice,undefined);assert.ok((bed.beddingWetness??0)>0);assert.ok(c.bag.filter(it=>d.bottles.some(b=>b.uid===it.uid)).every(it=>it.uses===0&&it.def==='Item.WaterBottle'))}
  if(expected){const actual=await read(page),want=JSON.parse(JSON.stringify(expected.s));writeFileSync(outDir+'/pending-headless-expected.json',JSON.stringify(want));writeFileSync(outDir+'/pending-browser-actual.json',JSON.stringify(actual));assert.deepEqual(actual,want);assert.equal(actual.time-d.s.time,50000);await follow(page,d.w.db,c.id);s=await read(page);c=s.creatures.find(c=>c.id===d.c.id)!;bed=s.map.tiles[bedKey]}
  await person(page,c.id)
  if(phase==='body')await page.getByTestId('resident-hygiene-activity').getByText(/몸 씻기/).waitFor()
  if(phase==='bedding')await page.getByTestId('resident-hygiene-activity').getByText(/침구 세탁/).waitFor()
  if(phase==='initial')await page.getByTestId('resident-hygiene').getByText(/몸에 이가 있음/).waitFor()
  if(phase==='clean'||phase==='pending'||phase==='bodyDone')await page.getByTestId('resident-hygiene').getByText(/몸이 깨끗함/).waitFor()
  await shot(page,shots[i]);await restore(page,'same-original-resident-'+phase);rows.push({phase,time:s.time,originalBottleUids:d.bottles.map(b=>b.uid),actualNpcActivity:c.activity?.kind,actualRemaining:c.activity?.remaining,actualWaterMl:water(),hygiene:c.needs.hygiene,actualBedWetness:bed.beddingWetness});await page.close();page=undefined
 }
 assert.deepEqual(errors,[]);writeFileSync(outDir+'/audit.json',JSON.stringify({save:SAVE_VERSION,actualBodyWashTurns:200,actualBeddingWashTurns:200,actualTotalWaterMlSpent:4000,originalEmptyBottleUids,actualCarrierRestTurns:1,bedSourceAt:14401,actualPendingPlayerTurns:500,pendingBrowserWholeExactAfterRendering:true,renderQueueConsumptionOnly:true,renderedQueues,wholeRoundtrips:6,screenshots:6,rows,consoleErrors:errors},null,2));console.log('OK: actual original carrier rest1/observed same bed/resident real walks/two original1L bottles/body200T2L+bed200T2L/actual4L/same emptyUIDs/visible NPC activity/pending500T whole exact headless/six whole86/six screens/console0')
}catch(error){writeFileSync(outDir+'/failure-console.json',JSON.stringify(errors));if(page){await shot(page,'failure').catch(()=>{});const s=await read(page).catch(()=>undefined);if(s)writeFileSync(outDir+'/failure-state.json',JSON.stringify(s))}throw error}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
