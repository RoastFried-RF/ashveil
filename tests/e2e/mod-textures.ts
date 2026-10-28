import {chromium} from 'playwright-core'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {crc32} from 'node:zlib'
import assert from 'node:assert/strict'
import {startNativePreview} from '../../tools/native-preview'
import {packageMod} from '../../tools/package-mod'
import {zipContent} from '../../tools/zip-content'
import {loadDb} from '../../tools/loadContent'
import {clinicalDiseaseFixture} from '../clinical-diseases-fixture'
import {playerAct,SAVE_VERSION} from '../../src/core/game'
import {serialize} from '../../src/core/save'
import {makeItem} from '../../src/core/items'
import {invalidateLights,updatePlayerVision} from '../../src/core/fov'
import {applyContentTransition} from '../../src/core/content-transition'
import {initializeScriptState} from '../../src/core/script-hooks'
import {tileAt,player,type World} from '../../src/core/ctx'
const out=resolve(process.argv[2]??'test-results/mod-textures-browser-v293');mkdirSync(out,{recursive:true})
const id='sample-original-textures',key='mod:'+id+'/textures/salt-pouch.png',archive=join(out,'sample-original-textures.zip'),metadata=packageMod(id,{out:archive,format:'zip'}),png=readFileSync('mods/'+id+'/textures/salt-pouch.png')
writeFileSync(join(out,'actual-cli-package.json'),JSON.stringify(metadata,null,2))
// ZIP/PNG의 CRC는 유효하지만 픽셀 압축은 손상된 부정 입력. 브라우저 설치 전에 거절해야 한다.
const broken=Buffer.from(png);let at=8
while(at<broken.length){const size=broken.readUInt32BE(at);if(broken.toString('ascii',at+4,at+8)==='IDAT'){broken[at+8]^=255;broken.writeUInt32BE(crc32(broken.subarray(at+4,at+8+size)),at+8+size);break}at+=size+12}
const badArchive=join(out,'invalid-compressed-pixels.zip');writeFileSync(badArchive,zipContent(metadata.files.map(f=>({path:f.path,bytes:f.path.endsWith('/textures/salt-pouch.png')?broken:readFileSync('mods/'+f.path)}))))
const{db,report}=loadDb([id]);assert.deepEqual(report.errors,[])
const d=clinicalDiseaseFixture('mod-textures-native-293',false,db),w=d.w,salt=d.add('Item.Salt',2),knife=d.add('Item.RustyKnife'),floor=makeItem(w,'Item.Salt',1),start=w.s.time
tileAt(w,{x:21,y:20}).items.push(floor);w.s.map.name='모드 원본 PNG·소금 보존 검증실';w.s.fx=[];invalidateLights(w);updatePlayerVision(w,d.p)
const initial=serialize(w.s);writeFileSync(join(out,'finite198-initial-original-salt-bag2-floor1.json'),initial)
const server=await startNativePreview(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
let screenshots=0,roundtrips=0,phases=0
const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)))
const idle=()=>page.waitForFunction(()=>{const{s}=(window as unknown as Hook).__ashveil.world();return !s.simulationPending&&s.fx.length===0})
const close=async()=>{for(let i=0;i<8&&await page.locator('[data-testid^="win-"]:visible').count();i++)await page.keyboard.press('Escape')}
const shot=async(name:string)=>{await page.mouse.move(100,40);await page.screenshot({path:join(out,name+'.png')});screenshots++}
const check=async(phase:string)=>{await idle();w.s.fx=[];const actual=await read(),expected=JSON.parse(serialize(w.s));writeFileSync(join(out,phase+'-actual.json'),JSON.stringify(actual));writeFileSync(join(out,phase+'-expected.json'),JSON.stringify(expected));assert.deepEqual(actual,expected);phases++}
const restore=async(phase:string)=>{await close();await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check(phase);roundtrips++}
const assertIcon=async(active:boolean)=>{const img=page.getByTestId('item-Item.Salt').locator('img');await img.waitFor();assert.equal(await img.evaluate((image)=>{const i=image as HTMLImageElement;return i.complete&&i.naturalWidth>0}),true);const src=await img.getAttribute('src');if(active)assert.equal(src,'data:image/png;base64,'+png.toString('base64'));else assert.match(src??'',/ashveil-salt\.png/)}
try{
 await page.goto(server.url);await page.getByTestId('mod-import-archive').setInputFiles(badArchive);await page.getByTestId('mod-import-error').waitFor();assert.match(await page.getByTestId('mod-import-error').innerText(),/PNG 픽셀/);assert.equal(await page.getByTestId('mod-import-review').count(),0);await page.getByTestId('mod-import').scrollIntoViewIfNeeded();await shot('1432-native-invalid-compressed-png-rejected-before-install')
 await page.getByTestId('mod-import-archive').setInputFiles(archive);await page.getByTestId('mod-import-review').waitFor();assert.match(await page.getByTestId('mod-import-review').innerText(),/16×16 원본 PNG 1개/);assert.match(await page.getByTestId('mod-import-hash').innerText(),new RegExp(db.modManifest()!.find(m=>m.id===id)!.hash));await page.getByTestId('mod-import-review').scrollIntoViewIfNeeded();await shot('1433-native-actual-cli-zip-one-png-and-exact-content-hash-review');await page.getByTestId('mod-import-install').click();await page.getByTestId('installed-mod-'+id).waitFor();assert.equal(await page.getByTestId('new-mod-'+id).isChecked(),false)
 await page.reload();await page.getByTestId('installed-mod-'+id).waitFor();assert.equal(await page.getByTestId('new-mod-'+id).isChecked(),false);await page.getByTestId('mod-import').scrollIntoViewIfNeeded();await shot('1434-native-png-package-persists-after-restart-and-stays-unselected')
 await page.evaluate(raw=>localStorage.setItem('ashveil.imprint.v1',raw),initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check('actual-title198-mod-png-same-original-three-salt-units');await shot('1435-native-actual-mod-png-on-map-adjacent-original-salt')
 await page.keyboard.press('ArrowRight');assert.equal(playerAct(w,{type:'move',dir:2}),null);await idle();await page.keyboard.press('i');await assertIcon(true);await page.locator('[data-floor-uid="'+floor.uid+'"]').dblclick();assert.equal(playerAct(w,{type:'pickup',uid:floor.uid}),null);await check('actual-east-one-turn-and-free-original-floor-salt-pickup');await shot('1436-native-actual-mod-png-inventory-original-three-salt-preserved')
 await restore('whole198-mod-png-restored-same-original-items-and-hash');await page.setViewportSize({width:1366,height:768});await page.keyboard.press('i');await assertIcon(true);await shot('1437-native-small-restored-same-original-mod-png')
 await close();await page.keyboard.press('F3');await page.getByTestId('live-content-reload').locator(':scope > summary').click();await page.getByTestId('live-mod-'+id).uncheck();await page.getByTestId('live-content-review').click();await page.getByTestId('content-change-review').waitFor();await check('actual-mod-removal-review-entire-world-unchanged');await page.getByTestId('content-change-review').scrollIntoViewIfNeeded();await shot('1438-native-explicit-current-world-mod-image-removal-review')
 w.db=loadDb([]).db;assert.equal(applyContentTransition(w),null);initializeScriptState(w);updatePlayerVision(w,player(w));await page.getByTestId('content-change-accept').click();await page.getByTestId('live-content-message').waitFor();await page.keyboard.press('Escape');await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await check('actual-base-content-applied-same-physical-world-and-original-salt');await page.keyboard.press('i');await assertIcon(false);await shot('1439-native-base-salt-icon-restored-after-real-content-apply')
 await restore('whole198-base-image-restored-same-physical-items');await page.keyboard.press('i');await assertIcon(false);await shot('1440-native-base-original-salt-survives-whole198-restore')
 assert.equal(w.s.time-start,100);assert.equal(screenshots,9);assert.equal(roundtrips,2);assert.equal(phases,6);assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({save:SAVE_VERSION,screenshots,roundtrips,phases,actualInputTU:100,initialTime:start,finalTime:w.s.time,saltUid:salt.uid,floorSaltUid:floor.uid,knifeUid:knife.uid,key,archive:metadata,errors,source:'Actual CLI ZIP/original16PNG: valid CRC but bad compressed pixels rejected by real browser decoder before install; valid explicit install/restart remains unselected. Finite actual clinical initial bag2+floor1 salt/defaultknife, not crafted/looted-history; no postload world/item/time/RNG injection. Actual TitleContinue/east1T/freepickup/whole198restore/smallviewport/real removal review+apply/remount+baseicon/whole198restore. Six independent Node whole comparisons; not general character/sheet/font/audio modding.'},null,2));console.log(JSON.stringify({screenshots,roundtrips,phases,actualInputTU:100,errors}))
}catch(error){writeFileSync(join(out,'failure-body.txt'),await page.locator('body').innerText());writeFileSync(join(out,'failure-errors.json'),JSON.stringify(errors));await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error}finally{await page.close();await browser.close();server.stop()}
