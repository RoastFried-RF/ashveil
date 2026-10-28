// 별도 검증 빌드에 설치한 잘못된 모드를 UI로 선택한다. 배포 콘텐츠에는 넣지 않는다.
import {chromium,type Page} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {loadDb} from '../../tools/loadContent'
import {newGame,runUntilInput,SAVE_VERSION} from '../../src/core/game'
import type {World} from '../../src/core/ctx'
const out=process.argv[2]??'test-results/mod-start-guard-browser';mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const saved=(p:Page)=>p.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('ashveil',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
  try{return await new Promise<{raw:string;mirror:string|null}>((resolve,reject)=>{const tx=db.transaction('imprint','readonly'),req=tx.objectStore('imprint').get('current');tx.oncomplete=()=>resolve(req.result);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
})
const read=(p:Page)=>p.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as {__ashveil:{world():World}}).__ashveil.world().s))as World['s'])
try{
  await page.goto('http://localhost:4317/?debug');await page.getByTestId('seed').fill('mod-guard-native');await page.getByTestId('start').click();await page.waitForSelector('[data-testid=map] canvas')
  const actual=await read(page),{db}=loadDb([]),expected:World={db,s:newGame(db,{seed:'mod-guard-native',overworld:true,mods:db.loadedMods,characterRoll:0,legacyResidents:[]})};runUntilInput(expected);const creationFx=expected.s.fx.splice(0);assert.deepEqual(actual,JSON.parse(JSON.stringify(expected.s)))
  await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.getByTestId('start').waitFor();const original=await saved(page);assert.deepEqual(JSON.parse(original.raw),actual)
  const bad=page.getByRole('checkbox',{name:/검증 전용 잘못된 사건/});await bad.check();await page.getByTestId('mod-errors').waitFor();assert.match(await page.getByTestId('mod-errors').innerText(),/fromPopulation/);assert.equal(await page.getByTestId('start').isDisabled(),true);assert.equal(await page.getByTestId('creation-preview').count(),0);assert.deepEqual(await saved(page),original)
  await page.getByTestId('mod-errors').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/932-native-invalid-installed-mod-errors-block-start-preserve-original-imprint.png'})
  await bad.uncheck();await page.getByTestId('creation-preview').waitFor();assert.equal(await page.getByTestId('start').isEnabled(),true);assert.equal(await page.getByTestId('mod-errors').count(),0);assert.deepEqual(await saved(page),original)
  await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map] canvas');assert.deepEqual(await read(page),actual);await page.getByTestId('btn-journal').click();await page.getByTestId('win-journal').waitFor();await page.screenshot({path:out+'/933-native-disable-invalid-mod-and-continue-original-whole-world-exact.png'});await page.keyboard.press('Escape');await page.getByRole('button',{name:'타이틀',exact:true}).click()
  // 유효한 초기 각인에 필요한 모드가 현재 설치되지 않은 경우. 과거 제거 입력을 꾸미지 않는다.
  const missing=structuredClone(original),state=JSON.parse(missing.raw);state.mods=['core','missing.saved.mod'];missing.raw=JSON.stringify(state);missing.mirror=missing.raw.length<=1000000?missing.raw:'{"ashveilIndexedDB":1}'
  await page.evaluate(async record=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('ashveil',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
    try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('imprint','readwrite');tx.objectStore('imprint').put(record,'current');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)})}finally{db.close()}
    localStorage.setItem('ashveil.imprint.v1',record.mirror!)
  },missing)
  await page.reload();await page.getByTestId('continue').click();await page.locator('p').filter({hasText:'missing.saved.mod'}).waitFor();assert.match(await page.locator('p').filter({hasText:'missing.saved.mod'}).innerText(),/각인을 읽지 못했다/);assert.equal(await page.locator('[data-testid=map] canvas').count(),0);assert.deepEqual(await saved(page),missing);assert.equal(await page.evaluate(()=>localStorage.getItem('ashveil.imprint.v1')),missing.mirror)
  await page.locator('p').filter({hasText:'missing.saved.mod'}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/934-native-required-saved-mod-missing-no-core-substitution-original-disk-and-mirror-preserved.png'})
  assert.deepEqual(errors,[]);writeFileSync(out+'/audit.json',JSON.stringify({screenshots:3,wholeRoundtrips:1,save:SAVE_VERSION,creationFx,invalidInstalledModBlocked:true,invalidSelectionPreservesWholeImprint:true,disableAndContinueWholeExact:true,initialMissingSavedModDeclared:true,missingModDiskAndMirrorPreserved:true,errors},null,2));writeFileSync(out+'/whole-state.json',JSON.stringify({actual,expected:expected.s,original,missing}));console.log('PASS: 3 actual screens; valid whole creation/restore; invalid mod blocked; missing saved mod disk/mirror preserved; console 0')
}catch(e){writeFileSync(out+'/failure-body.txt',await page.locator('body').innerText());await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}finally{await page.close();await browser.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM')}catch{/* already stopped */}}
