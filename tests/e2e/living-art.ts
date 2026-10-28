import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { startNativePreview } from '../../tools/native-preview'
import { forestPrivacyFixture } from '../forest-art-fixture'
import { livingArtFixture } from '../living-art-fixture'
import { deserialize, player, playerAct, serialize, type World, type Action } from '../../src/core'
const out=process.argv[2];if(!out||existsSync(out))throw Error('Fresh output directory required')
mkdirSync(out,{recursive:true});const width=Number(process.argv[3]??1440),height=width===1366?768:1080
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width,height}})
type Hook={__ashveil:{world():World}}
const errors:string[]=[],checks:string[]=[],images:string[]=[],fixtures:unknown[]=[],actions:unknown[]=[],responses:{url:string;status:number}[]=[]
let d=livingArtFixture(),w=d.w,restores=0
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});page.on('response',r=>{if(r.url().includes('direction-v308/living-trees.png'))responses.push({url:r.url(),status:r.status()})})
async function check(name:string){
 await page.waitForFunction(()=>{const s=(window as unknown as Hook).__ashveil.world().s;return !s.simulationPending&&s.fx.length===0},{},{timeout:60000})
 w.s.fx=[];const actual=await page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s))),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,name+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,name+'-expected.json'),JSON.stringify(expected));assert.ok(isDeepStrictEqual(actual,expected),'Whole-state mismatch: '+name);checks.push(name);console.log('PASS',name)
}
async function shot(name:string){await page.mouse.move(100,40);await page.waitForTimeout(250);await page.screenshot({path:join(out,name+'.png')});images.push(name+'.png')}
async function initial(dark=false){d=livingArtFixture(dark);w=d.w;const raw=serialize(w.s);fixtures.push(d.proof);writeFileSync(join(out,(dark?'dark':'day')+'-declared-initial.json'),raw);await page.goto(server.url);await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.removeItem('ashveil.preferences.v1')},raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check((dark?'dark':'day')+'-initial')}
async function zoom(value:string){await page.keyboard.press('F3');await page.getByTestId('map-zoom').selectOption(value);await page.keyboard.press('Escape');await check('zoom-'+value+'-'+checks.length)}
async function input(name:string,a:Action,fn:()=>Promise<unknown>){const before=w.s.time;assert.equal(playerAct(w,a),null);const start=performance.now();await fn();await check(name);actions.push({name,action:a,tu:w.s.time-before,inputToWholeStateMs:performance.now()-start})}
async function roundtrip(name:string){await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('continue').waitFor();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(name);restores++}
try{
 await initial();await shot('2201-day-default');await zoom('2');await shot('2202-day-two-times');await zoom('vision');await shot('2203-day-vision-fit');await zoom('3');await shot('2204-day-three-times');await page.getByTestId('map').focus();await input('day-real-west-step',{type:'move',dir:6},()=>page.keyboard.press('ArrowLeft'));await shot('2205-day-real-step');await roundtrip('day-save205-restored');await shot('2206-day-restored')
 await initial(true);await shot('2207-dark-unlit');await page.keyboard.press('i');await page.locator('[data-inventory-item="'+d.torch+'"]').click({button:'right'});await input('actual-equipped-torch-on',{type:'toggleLight',uid:d.torch},()=>page.getByTestId('item-menu').getByRole('button',{name:'불 켜기',exact:true}).click());await page.keyboard.press('Escape');await shot('2208-dark-torch-bark');assert.equal(player(w).equip.main!.lit,true);await page.getByTestId('map').focus();await input('dark-real-wait',{type:'wait'},()=>page.keyboard.press('Period'))
 for(const blind of [false,true]){
  const scene=forestPrivacyFixture(blind);w=scene.w;fixtures.push(scene.proof);const raw=serialize(w.s);writeFileSync(join(out,(blind?'blind':'privacy')+'-declared-initial.json'),raw)
  await page.goto(server.url);await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.removeItem('ashveil.preferences.v1')},raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(blind?'blind-no-projected-props':'hidden-behind-visible-trees')
  for(const pos of [scene.proof.hiddenEnemy.pos,scene.proof.hiddenCrate.pos])assert.ok(!w.s.visible.includes(pos.y*w.s.map.w+pos.x))
  const observation=JSON.parse(await page.evaluate(()=>(window as unknown as {render_game_to_text():string}).render_game_to_text()))
  assert.ok(!observation.visibleCreatures.some((c:{id:number})=>c.id===scene.proof.hiddenEnemy.id))
  for(const pos of [scene.proof.hiddenEnemy.pos,scene.proof.hiddenCrate.pos])assert.ok(!observation.map.visibleTiles.some((t:{x:number;y:number})=>t.x===pos.x&&t.y===pos.y))
  if(blind){assert.deepEqual(w.s.visible,[]);await input('blind-real-wait',{type:'wait'},()=>page.keyboard.press('Period'));assert.deepEqual(w.s.visible,[])}
  await shot(blind?'2212-blind-no-tree-leak':'2211-hidden-enemy-and-crate')
 }
 if(process.argv[4]){
  const raw=readFileSync(process.argv[4],'utf8');w={db:w.db,s:deserialize(raw)};assert.equal(w.s.loadHash,w.db.loadHash);fixtures.push({kind:'actual-v307-browser-state-from-v306-new-study-game',source:process.argv[4],limits:'Original actual v306 Title/new Study save, continued by one actual wait and save205 restore in v307. Same Core/content hash; no synthetic acquisition or compatibility transition.'});await page.goto(server.url);await page.evaluate(raw=>{localStorage.setItem('ashveil.imprint.v1',raw);localStorage.removeItem('ashveil.preferences.v1')},raw);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');assert.equal(await page.getByTestId('content-change-review').count(),0);await check('actual-v307-whole-state-unchanged');await shot('2209-actual-v307-forest');await page.getByTestId('map').focus();await input('actual-v307-real-wait',{type:'wait'},()=>page.keyboard.press('Period'));await roundtrip('actual-v307-save205-restored');await shot('2210-actual-v307-restored')
 }
 assert.ok(responses.length>0&&responses.every(r=>r.status===200));assert.deepEqual(errors,[]);const audit={width,height,wholePairs:checks.length,restores,images,checks,actions,fixtures,responses,errors};writeFileSync(join(out,'audit.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify({width,wholePairs:checks.length,restores,images:images.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));throw error}finally{await page.close();await browser.close();server.stop()}
