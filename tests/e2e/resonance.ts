import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {isDeepStrictEqual} from 'node:util'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {startNativePreview} from '../../tools/native-preview'
import {resonanceFixture} from '../resonance-fixture'
import {resonanceSpireFixture} from '../resonance-spire-fixture'
import {activeThoughts,deserialize,player,playerAct,resonanceState,serialize,type World} from '../../src/core'
import {applyContentTransition} from '../../src/core/content-transition'
import {SAVE_VERSION} from '../../src/core/game'

const out=process.argv[2],width=Number(process.argv[3]??1440),height=width===1366?768:1080
if(!out||existsSync(out))throw Error('Fresh output directory required')
mkdirSync(out,{recursive:true})
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width,height}})
type Hook={__ashveil:{world():World};render_game_to_text():string}
const errors:string[]=[],checks:string[]=[],images:string[]=[],actions:unknown[]=[],fixtures:unknown[]=[]
let w!:World,restores=0
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function check(name:string){
 await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0},{},{timeout:90000})
 w.s.fx=[]
 const actual=await page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s))),expected=JSON.parse(serialize(w.s))
 writeFileSync(join(out,name+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,name+'-expected.json'),JSON.stringify(expected))
 assert.ok(isDeepStrictEqual(actual,expected),'Entire world mismatch: '+name);checks.push(name);console.log('PASS',name)
 const dto=JSON.parse(await page.evaluate(()=>(window as unknown as Hook).render_game_to_text()))
 assert.deepEqual(dto.heardResonance,resonanceState(w,player(w)))
 assert.deepEqual(Object.keys(dto.heardResonance).sort(),['machine','tower'])
}
async function shot(name:string){await page.mouse.move(100,40);await page.waitForTimeout(300);await page.screenshot({path:join(out,name+'.png')});images.push(name+'.png')}
async function initial(world:World,proof:unknown,name:string,raw=serialize(world.s),review=false){
 w=world;fixtures.push(proof);writeFileSync(join(out,name+'-declared-initial.json'),raw)
 await page.goto(server.url);await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.removeItem('ashveil.preferences.v1')},raw);await page.reload();await page.getByTestId('continue').click()
 if(review){
  await page.getByTestId('content-change-accept').waitFor();await shot('2420-old205-content-review');await page.keyboard.press('Escape');await page.getByTestId('continue').click();await page.getByTestId('content-change-accept').click()
 }
 await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(name)
}
async function restore(name:string){await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(name);restores++}
async function input(name:string,action:Parameters<typeof playerAct>[1],fn:()=>Promise<unknown>){const start=w.s.time;assert.equal(playerAct(w,action,300000),null);await fn();await page.waitForFunction(tu=>(window as unknown as Hook).__ashveil.world().s.time===tu,w.s.time,{timeout:90000});await check(name);actions.push({name,action,tu:w.s.time-start})}
try{
 await page.goto(server.url);await page.getByTestId('seed').fill('resonance-natural-103');await page.locator('button.title-background').filter({hasText:'파문된 순례자'}).click();const preview=page.getByTestId('creation-preview');await preview.getByText('울림 듣는 자',{exact:true}).waitFor();assert.match(await preview.getByText('울림 듣는 자',{exact:true}).getAttribute('title')??'',/15칸/);await preview.scrollIntoViewIfNeeded();await shot('2400-natural-title-trait-and-description')
 const d=resonanceFixture();await initial(d.w,d.proof,'at-fifteen');assert.equal(resonanceState(w,player(w)).machine,true);await page.getByText('기계 정비음',{exact:true}).waitFor();await shot('2401-heard-at-fifteen-no-visible-machine')
 await page.getByTestId('map').focus();await input('sixteen-steps-silence',{type:'move',dir:6},()=>page.keyboard.press('ArrowLeft'));assert.equal(resonanceState(w,player(w)).machine,false);assert.equal(await page.getByText('기계 정비음',{exact:true}).count(),0);await shot('2402-silence-at-sixteen');await restore('silent205-restored');await shot('2403-silent-restored')
 await page.getByTestId('map').focus();await input('fifteen-heard-again',{type:'move',dir:2},()=>page.keyboard.press('ArrowRight'));assert.equal(resonanceState(w,player(w)).machine,true);await shot('2404-heard-again');await restore('heard205-restored');await shot('2405-heard-restored')
 const tower=resonanceSpireFixture();await initial(tower.w,tower.proof,'real-spire-before-stop');assert.ok(activeThoughts(w,player(w)).some(t=>t.def==='Thought.TowerResonance'&&t.mood===-3));await page.getByText('탑의 고음',{exact:true}).waitFor();await shot('2410-operating-spire-headache')
 await page.keyboard.press('F2');const panel=page.getByTestId('field-device-'+tower.device.uid);await panel.scrollIntoViewIfNeeded();await shot('2411-real-original-code-stop-job')
 await input('actual120-turn-tower-stop',{type:'deviceWork',pos:tower.pos,uid:tower.device.uid,operation:'stop'},()=>panel.locator('[data-device-operation="stop"]').click());assert.equal((actions.at(-1)as{tu:number}).tu,12000);assert.equal(resonanceState(w,player(w)).tower,false);assert.ok(!activeThoughts(w,player(w)).some(t=>t.def==='Thought.TowerResonance'));assert.equal(tower.device.energy,20);assert.ok(player(w).bag.some(i=>i.uid===tower.plate.uid));await shot('2412-stopped-original-tower-headache-removed');await page.keyboard.press('Escape');await shot('2413-stopped-status');await restore('stopped205-restored');await shot('2414-stopped-restored')
 if(process.argv[4]){
  const raw=readFileSync(process.argv[4],'utf8'),s=deserialize(raw),legacy:World={db:w.db,s};assert.equal(s.version,SAVE_VERSION);assert.equal(applyContentTransition(legacy),null)
  await initial(legacy,{original205Raw:process.argv[4],noTraitOrBodyInjection:true},'old205-content-transition',raw,true);await shot('2421-old205-original-body-kept');await page.getByTestId('map').focus();await input('old205-actual-wait',{type:'wait'},()=>page.keyboard.press('Period'));await shot('2422-old205-after-actual-wait');await restore('old205-current-config-restored');await shot('2423-old205-current-restored')
 }
 assert.deepEqual(errors,[]);const audit={width,height,wholePairs:checks.length,restores,checks,images,actions,fixtures,errors};writeFileSync(join(out,'audit.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify({width,wholePairs:checks.length,restores,images:images.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());throw error}finally{await page.close();await browser.close();server.stop()}
