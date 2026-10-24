/** Isolated original-part rig: actual DOM controls + read-only pose observations. */
import {createServer} from 'node:http'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {join,resolve,extname} from 'node:path'
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import type {RigPose} from '../src/client/render/articulated-gait'
type Observation={frontOnly:boolean;authoredRegions:number;authoredWalkFrames:number;playing:boolean;frames:number;pose:RigPose}
const site=resolve(process.argv[2]??'/workspace/.ashveil-planned/v356-sower-rig-prototype/site'),out=resolve(process.argv[3]??'test-results/autonomy-v356/native-r1');mkdirSync(out,{recursive:true})
const server=createServer((req,res)=>{try{const rel=decodeURIComponent(new URL(req.url??'/', 'http://localhost').pathname),path=resolve(site,'.'+(rel==='/'?'/index.html':rel));if(!path.startsWith(site+'/')){res.writeHead(403);res.end();return}res.setHeader('Content-Type',extname(path)==='.js'?'text/javascript':extname(path)==='.png'?'image/png':'text/html');res.end(readFileSync(path))}catch{res.writeHead(404);res.end()}})
await new Promise<void>(done=>server.listen(6381,'127.0.0.1',done))
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined
const observations:Observation[]=[],errors:string[]=[],captures=new Set<string>()
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:6381/');await page.waitForFunction(()=>document.querySelector<HTMLCanvasElement>('#stage')?.dataset.frame==='0')
 const observe=()=>page.evaluate(()=>{const w=window as unknown as{observe_sower_rig:()=>Observation};return w.observe_sower_rig()})
 observations.push(await observe());await page.screenshot({path:join(out,'front-initial.png')});await page.locator('#play').click()
 for(let i=0;i<115;i++){
  await page.waitForTimeout(100);const state=await observe();observations.push(state)
  if(state.pose.swing&&!captures.has(state.pose.swing)&&state.pose.legs.find(l=>l.id===state.pose.swing)!.sole.z>2){captures.add(state.pose.swing);await page.screenshot({path:join(out,'front-swing-'+state.pose.swing+'.png')})}
 }
 await page.locator('#play').click();await page.waitForTimeout(650);const stopped=await observe();observations.push(stopped);assert.equal(stopped.pose.swing,null);await page.screenshot({path:join(out,'front-settled.png')})
 await page.waitForTimeout(200);const still=await observe();assert.deepEqual(still.pose,stopped.pose)
 await page.locator('#joints').check();await page.screenshot({path:join(out,'front-joints.png')})
 for(const heading of['1','2','3','4']){
  await page.locator('#heading').selectOption(heading);await page.locator('#play').click();await page.waitForTimeout(1250);observations.push(await observe());await page.locator('#play').click();await page.waitForTimeout(650);observations.push(await observe());await page.screenshot({path:join(out,'front-facing-translation-'+heading+'.png')})
 }
 for(const speed of['0.5','2']){
  await page.locator('#speed').selectOption(speed);await page.locator('#reset').click();await page.locator('#play').click()
  for(let i=0;i<12;i++){await page.waitForTimeout(100);observations.push(await observe())}
  await page.locator('#play').click();await page.waitForTimeout(650);observations.push(await observe());await page.screenshot({path:join(out,'front-speed-'+speed+'.png')})
 }
 assert.deepEqual(errors,[]);assert.equal(captures.size,4)
 let lockPairs=0,maxFootDrift=0
 for(let i=1;i<116;i++){const before=observations[i-1],after=observations[i];for(const foot of after.pose.legs){const old=before.pose.legs.find(l=>l.id===foot.id)!;if(foot.contact&&old.contact){const drift=Math.hypot(foot.sole.x-old.sole.x,foot.sole.y-old.sole.y,foot.sole.z-old.sole.z);maxFootDrift=Math.max(maxFootDrift,drift);lockPairs++}}}
 assert.ok(maxFootDrift<1e-7)
 const maxError=Math.max(...observations.flatMap(o=>o.pose.legs.map(l=>l.error))),outsideSupport=observations.filter(o=>o.pose.supportMargin<0).length
 assert.ok(maxError<1e-7,'물리 링크 도달 오류');assert.equal(outsideSupport,0,'가정한 무게중심의 지지 영역 이탈')
 const audit={version:356,actualDOMInputs:true,readOnlyObservation:true,isolatedWorkbench:true,gameplayChanged:false,releaseApproved:false,authoredRegions:4,authoredWalkFrames:0,capturedSwings:[...captures],observations,errors,metrics:{lockPairs,maxFootDrift,maxEndpointError:maxError,outsideSupportSamples:outsideSupport},scope:'FRONT artwork only, multiple ground translations. Stationary foot contacts and joint endpoints are measured. Support violations are reported, not accepted as balanced gait. No actual Core Sower or other-direction source approval.'}
 writeFileSync(join(out,'audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify({...audit,observations:observations.length}))
}catch(error){writeFileSync(join(out,'failure.json'),JSON.stringify({errors,error:String(error)},null,2)+'\n');throw error}finally{await browser?.close();await new Promise<void>((done,fail)=>server.close(e=>e?fail(e):done()))}
