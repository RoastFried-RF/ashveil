/** Day/night finite field, real blocked movement/gather/save, never writes a loaded World. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {rockFixture} from '../tests/rock-art-fixture'
import {playerAct} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import type {World} from '../src/core/ctx'
import type {MapRenderer} from '../src/client/render/MapRenderer'
type View=NonNullable<ReturnType<MapRenderer['presentation']>>
type Hook={__ashveil:{world():World};render_game_presentation():View}
const[out,url]=process.argv.slice(2);assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],pairs:{label:string;hash:string}[]=[],runs:unknown[]=[];page.setDefaultTimeout(120000);let current='start'
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function compare(w:World,label:string){await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.waitForFunction(t=>{const s=(window as unknown as Hook).__ashveil.world().s;return!s.simulationPending&&s.time===t},w.s.time);await page.waitForFunction(()=>(window as unknown as Hook).__ashveil.world().s.fx.length===0);w.s.fx=[];const actual=await page.evaluate(()=>(window as unknown as Hook).__ashveil.world().s);writeFileSync(join(out,label+'-actual.json'),serialize(actual));writeFileSync(join(out,label+'-expected.json'),serialize(w.s));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(serialize(w.s)),label);pairs.push({label,hash:stateHash(actual)});return page.evaluate(()=>(window as unknown as Hook).render_game_presentation())}
try{
 await page.goto(url)
 for(const[width,height]of[[1366,768],[390,844]])for(const night of [false,true]){
  current=(night?'night':'day')+'-'+width;const d=rockFixture(night),initial=serialize(d.s),w:World={db:d.w.db,s:deserialize(initial)};writeFileSync(join(out,current+'-initial.json'),initial);await page.setViewportSize({width,height});await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:3}))},initial);await page.reload();await page.getByTestId('continue').click();const view=await compare(w,current+'-loaded');assert.equal(new Set(view.rocks.map(r=>r.frame)).size,6);writeFileSync(join(out,current+'-visible-presentation.json'),JSON.stringify(view,null,2));await page.getByRole('button',{name:'타이틀',exact:true}).hover();await page.screenshot({path:join(out,current+'-field.png')})
  await page.keyboard.press('ArrowRight');assert.ok(playerAct(w,{type:'move',dir:2}));await compare(w,current+'-blocked-movement');await page.keyboard.press('F2');await page.getByTestId('craft-tab-field').click();const gather=page.getByRole('button',{name:'돌 조각 채집 (30턴)',exact:true});assert.equal(await gather.count(),1);await compare(w,current+'-gather-review');await gather.click();assert.equal(playerAct(w,{type:'gather',pos:d.target}),null);await compare(w,current+'-gathered');const stone=w.s.creatures.find(c=>c.id===w.s.playerId)!.bag.find(i=>i.def==='Item.Stone')!;assert.equal(stone.count,1);await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).hover();await page.screenshot({path:join(out,current+'-gathered.png')});await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').click();await compare(w,current+'-continued');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.getByRole('button',{name:'타이틀',exact:true}).click();runs.push({night,width,height,visibleVariants:6,collisionAndGatherRealInputs:true,originalStoneUID:stone.uid,stoneQuantity:1,titleRestoreWholeExact:true})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({finiteInitial:true,postTitleWorldWrites:false,wholePairs:pairs.length,runs,pairs,errors},null,2));console.log(JSON.stringify({scenes:runs.length,wholePairs:pairs.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),runs,pairs,errors},null,2));writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());throw error}finally{await browser.close()}
