/** Actual standalone DOM, borrowed original pixels, stable pause and per-insect source changes. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from './native-preview'
type Observation={uid:number;visible:boolean;center:{x:number;y:number};representativeSprites:number;originalFrames:string[];tracked:{id:number;frame:string;x:number;y:number;visible:boolean}[];speed:number;moving:boolean;cohesion:number;sourceDestroyed:boolean}
const out=process.argv[2]??'test-results/autonomy-v370/preview-r1';mkdirSync(out,{recursive:true});const server=await startNativePreview(4390);let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined
const errors:string[]=[],rows:Observation[]=[]
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await page.goto(new URL('artbook/swarm/',server.url).href);await page.waitForFunction(()=>document.querySelector<HTMLCanvasElement>('#stage canvas')?.dataset.ready==='true')
 const observe=()=>page.evaluate(()=>(window as unknown as{observe_swarm_preview():Observation}).observe_swarm_preview())
 for(let i=0;i<18;i++){await page.waitForTimeout(65);rows.push(await observe())}assert.equal(new Set(rows.map(r=>r.tracked[0].frame)).size,4);assert.ok(rows.every(r=>!r.sourceDestroyed&&r.representativeSprites===48));await page.screenshot({path:join(out,'dense-original-flight.png')})
 await page.locator('#speed').selectOption('0');await page.waitForTimeout(80);const frozen=await observe();await page.waitForTimeout(350);assert.deepEqual((await observe()).tracked,frozen.tracked)
 await page.locator('#speed').selectOption('1');await page.locator('#cohesion').focus();await page.keyboard.press('Home');for(let i=0;i<25;i++)await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);const loose=await observe();assert.equal(loose.cohesion,25);assert.equal(loose.representativeSprites,12);rows.push(loose);await page.screenshot({path:join(out,'actual-loose.png')})
 await page.keyboard.press('Home');await page.waitForTimeout(100);assert.equal((await observe()).visible,false);await page.keyboard.press('End');await page.locator('#play').click()
 for(const speed of ['0.5','1','2']){await page.locator('#speed').selectOption(speed);for(let i=0;i<20;i++){await page.waitForTimeout(70);rows.push(await observe())}}
 await page.locator('#play').click();await page.waitForTimeout(700);await page.screenshot({path:join(out,'actual-move-stop.png')});assert.deepEqual(errors,[]);assert.ok(rows.every(r=>!r.sourceDestroyed));writeFileSync(join(out,'audit.json'),JSON.stringify({version:370,isolatedArt:true,sourceOriginals:1,sourceRegions:4,authoredDirections:1,actualDOMControls:true,stableZeroSpeed:true,trackedIndividualFourPoses:true,observations:rows,errors,scope:'1x four-pose individual flight, actual pause/25%/0%/100% slider inputs and0.5/1/2x move/stop. Presentation only; no real game quantities/behavior or release approval.'},null,2)+'\n');console.log(JSON.stringify({observations:rows.length,errors}))
}finally{await browser?.close();server.stop()}
