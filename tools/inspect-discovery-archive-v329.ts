/** Declared known/believed observations and fragile player. Actual wait/combat death and archive UI. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {prisonerFixture} from '../tests/prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {buildReport} from '../src/core/report'
import {newGame,runUntilInput} from '../src/core/game'
import {serialize} from '../src/core/save'
import {START_TURN,type World} from '../src/core/ctx'
import type {ItemDef,PillEffectDef} from '../src/core/types'
import {startNativePreview} from './native-preview'
type Hook={__ashveil:{world():World}}
const out=process.argv[2]??'test-results/autonomy-v329/native';mkdirSync(out,{recursive:true})
function fixture(){
 const {w,p}=prisonerFixture(),s=w.s;s.time=START_TURN*100;p.nextAct=s.time;s.creatures=[p];s.overworld=undefined;s.maps={};s.offCreatures={};s.map.kind='dungeon';s.map.depth=3;s.map.name='발견 기록·연대기 유한 초기 방';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];p.name='기록을 남길 떠돌이';p.hp=1
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0})
 const enemy=createCreature(w,'Creature.Reaver',{x:21,y:20});enemy.stats={str:20,agi:20,per:20,vit:10,wil:10};enemy.nextAct=s.time+100;enemy.ai.mode='hunt';enemy.ai.target=p.id;s.creatures.push(enemy)
 const appearance=Object.keys(s.knowledge.pillMap)[0],truth=s.knowledge.pillMap[appearance],belief=w.db.all<PillEffectDef>('PillEffect').find(d=>d.id!==truth)!,book=w.db.all<ItemDef>('Item').find(d=>!!d.book)!
 s.knowledge.pillKnown={};s.knowledge.pillBeliefs={[appearance]:{belief:belief.id,confidence:'likely',ruledOut:[],evidence:[{turn:Math.floor(s.time/100),method:'examine',text:'실험 전 선언한 당시의 추정 기록'}]}}
 p.recipes=['Recipe.Bandage'];p.booksRead=[book.id];p.fieldNotes=Array.from({length:14},(_,i)=>({key:'declared-note-'+i,title:'원정 관찰 '+i,text:'당시 읽은 유한한 현장 기록 '+i,turn:Math.floor(s.time/100),deviceUid:i+1}))
 invalidateLights(w);updatePlayerVision(w,p)
 const old=buildReport(w,p,'death','이전 보고서 유한 자료');delete old.discoveries;old.name='옛 기록의 떠돌이';old.epitaph='옛 기록의 떠돌이 · 발견 목록이 없던 이전 보고서'
 const history=[...Array.from({length:14},(_,i)=>({at:'declared-content-'+i,seed:'declared-history',kind:'content',turn:i,from:'원래 구성',to:'변경 구성'})),{at:'declared-old-death',seed:'declared-old-seed',kind:'death',report:old}]
 const fresh={db:w.db,s:newGame(w.db,{seed:s.seed,mods:w.db.loadedMods,characterRoll:0,overworld:true,legacyResidents:[]})};runUntilInput(fresh)
 return{initial:serialize(s),history,seed:s.seed,appearance,belief:belief.label,fresh:fresh.s,enemy:enemy.id}
}
const server=await startNativePreview(4362),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({acceptDownloads:true}),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const read=()=>page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s)
async function idle(){await page.waitForFunction(()=>{const w=(window as unknown as Hook).__ashveil.world();return !!w.s.over||!w.s.simulationPending&&!w.s.creatures.find(c=>c.id===w.s.playerId)!.activity},{},{timeout:60000})}
try{
 await page.goto(server.url)
 for(const[width,height]of[[1440,1080],[1366,768]]){
  const f=fixture(),prefix='archive-'+width;writeFileSync(join(out,prefix+'-initial.json'),f.initial);writeFileSync(join(out,prefix+'-declared-history.json'),JSON.stringify(f.history));await page.setViewportSize({width,height});await page.evaluate(({raw,history})=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.setItem('ashveil.chronicle.v1',JSON.stringify(history));localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:0,screenShake:false,torchFlicker:false,mapZoom:3}))},{raw:f.initial,history:f.history})
  await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');let waits=0;for(;waits<40;waits++){if((await read()).over)break;await page.keyboard.press('Period');await idle()}
  const ended=await read();assert.equal(ended.over?.kind,'death');assert.ok(ended.time>JSON.parse(f.initial).time);const report=page.getByTestId('report'),archive=report.getByTestId('discovery-archive');await archive.locator(':scope > summary').click();await archive.getByTestId('discovery-archive-kind').selectOption('identification');assert.match(await archive.innerText(),new RegExp(f.belief));assert.match(await archive.innerText(),/당시 추정/);await archive.scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-death-belief.png')})
  const downloadPromise=page.waitForEvent('download');await report.getByRole('button',{name:'보고서 파일 저장',exact:true}).click();const download=await downloadPromise,path=join(out,prefix+'-report.txt');await download.saveAs(path);const exported=readFileSync(path,'utf8');assert.match(exported,/당시 추정/);assert.match(exported,/원정 관찰 13/)
  await report.getByRole('button',{name:'연대기에 새기고 돌아가기',exact:true}).click();const chron=page.getByTestId('chronicle');await chron.getByTestId('chronicle-next').click();await chron.getByTestId('chronicle-next').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-older-page.png')});await chron.getByTestId('chronicle-search').fill('원정 관찰 13');assert.equal(await chron.getByTestId('chronicle-entry').count(),1);const life=chron.getByTestId('chronicle-life');await life.locator(':scope > summary').click();const stored=life.getByTestId('discovery-archive');await stored.locator(':scope > summary').click();await stored.getByTestId('discovery-archive-kind').selectOption('fieldNote');await stored.getByTestId('discovery-archive-next').click();await stored.scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-chronicle-discoveries.png')})
  await chron.getByTestId('chronicle-search').fill('옛 기록의 떠돌이');const legacy=chron.getByTestId('chronicle-life');await legacy.locator(':scope > summary').click();await legacy.getByTestId('discovery-archive').locator(':scope > summary').click();await legacy.getByTestId('discovery-archive-legacy').waitFor();await legacy.scrollIntoViewIfNeeded();await page.screenshot({path:join(out,prefix+'-legacy-empty.png')})
  await page.getByTestId('seed').fill(f.seed);await page.getByTestId('start').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(()=>!(window as unknown as Hook).__ashveil.world().s.over);const fresh=await read(),p=fresh.creatures.find(c=>c.id===fresh.playerId)!,expected=f.fresh.creatures.find(c=>c.id===f.fresh.playerId)!;assert.deepEqual(fresh.knowledge,f.fresh.knowledge);assert.deepEqual(p.recipes,expected.recipes);assert.deepEqual(p.booksRead,expected.booksRead);assert.deepEqual(p.fieldNotes,expected.fieldNotes);assert.deepEqual(p.skills,expected.skills);writeFileSync(join(out,prefix+'-ended.json'),JSON.stringify(ended));writeFileSync(join(out,prefix+'-fresh.json'),JSON.stringify(fresh));runs.push({width,height,actualWaitInputs:waits,actualDeathTU:ended.time,enemy:f.enemy,discoveries:ended.over!.report.discoveries!.records.length,wrongBeliefRetained:true,downloadedReport:true,olderChroniclePage:true,legacyNotInferred:true,newCharacterKnowledgeExactlyFresh:true,errors:[]});await page.getByRole('button',{name:'타이틀',exact:true}).click()
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,noPostLoadWorldWrites:true,runs,errors,scope:'Two actual wait/combat deaths, report download, old-page/search/filter/pagination and fresh-character knowledge comparisons. Earlier history and known/believed facts are declared initial fixtures; no prior natural discoveries claimed.'},null,2)+'\n');console.log(JSON.stringify({runs:runs.length,errors}))
}catch(error){try{writeFileSync(join(out,'failure-state.json'),JSON.stringify(await read()))}catch{/* title may not be loaded */}await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());writeFileSync(join(out,'errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
