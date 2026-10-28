import stationaryWork from './art/direction-v362/work-original/stationary-registration-anchors.json'
import directionalWork from './art/direction-v362/work-original/joint-registration.json'
import directionalRegistration from './art/direction-v362/directional-original/joint-registration.json'
import workRegistration from './art/direction-v360/work-original/joint-registration.json'
/** Real Pixi renderer / DOM controls / borrowed source ownership; no game-state injection. */
import {createServer} from 'node:http'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {resolve,join,extname} from 'node:path'
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import type {RigPose} from '../src/client/render/articulated-gait'
type Matrix=number[]
type Observation={facing:'front'|'left'|'right'|'back';pose:RigPose;playing:boolean;speed:number;workIndex:number;workSeconds:number;renderer:number;borrowedTextureDestroyed:boolean;sourceDestroyed:boolean;view:{sprites:number;liveTextures:number;sourceCount:number;body:Matrix;chassis:string;chassisBlend:number;legs:Record<string,{upper:Matrix;lower:Matrix;foot:Matrix}>};frames:number;replacements:number}
const site=resolve(process.env.ASHVEIL_RIG_SITE??'/workspace/.ashveil-planned/v360-sower-pixi/site'),out=resolve(process.argv[2]??'test-results/autonomy-v360/pixi-native-r1');mkdirSync(out,{recursive:true})
const server=createServer((req,res)=>{try{const rel=decodeURIComponent(new URL(req.url??'/','http://localhost').pathname),p=resolve(site,'.'+(rel==='/'?'/index.html':rel));if(!p.startsWith(site+'/')){res.writeHead(403);res.end();return}res.setHeader('Content-Type',({'.js':'text/javascript','.png':'image/png','.css':'text/css'} as Record<string,string>)[extname(p)]??'text/html');res.end(readFileSync(p))}catch{res.writeHead(404);res.end()}})
await new Promise<void>(done=>server.listen(6382,'127.0.0.1',done))
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined
const errors:string[]=[],observations:Observation[]=[];let maxPinError=0
const transform=(m:Matrix,p:{x:number;y:number})=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]})
function check(o:Observation,work=false){
 assert.equal(o.view.sprites,work?14:13);assert.equal(o.view.liveTextures,work?14:13);assert.equal(o.view.sourceCount,work?2:1);assert.equal(o.borrowedTextureDestroyed,false);assert.equal(o.sourceDestroyed,false)
 const expected=(p:{x:number;y:number;z:number})=>({x:p.x-o.pose.root.x,y:(p.y-o.pose.root.y-p.z)*Math.SQRT1_2})
 const pair=(actual:{x:number;y:number},target:{x:number;y:number})=>{maxPinError=Math.max(maxPinError,Math.hypot(actual.x-target.x,actual.y-target.y))}
 for(const leg of o.pose.legs){
  const m=o.view.legs[leg.id],source=o.facing==='front'?null:directionalRegistration.directions[o.facing].parts
  const p=(v:readonly number[])=>({x:v[0],y:v[1]})
  pair(transform(m.upper,p(source?.upper.joints.proximal.crop??[99,82])),expected(leg.hip));pair(transform(m.upper,p(source?.upper.joints.distal.crop??[89,407])),expected(leg.knee));pair(transform(m.lower,p(source?.lower.joints.proximal.crop??[55,83])),expected(leg.knee));pair(transform(m.lower,p(source?.lower.joints.distal.crop??[72,451])),expected(leg.ankle));pair(transform(m.foot,p(source?.foot.sole.cropPoint??[193,241])),expected(leg.sole))
 }
 if(work&&o.view.chassis!=='idle'&&o.facing==='front'){
  const frame=workRegistration.poses.find(f=>f.state===o.view.chassis);assert.ok(frame)
  for(const [landmark,id]of [['nearScreenLeft','RF'],['nearScreenRight','LF']] as const){const p=frame.landmarks[landmark].crop;pair(transform(o.view.body,{x:p[0],y:p[1]}),expected(o.pose.legs.find(l=>l.id===id)!.hip))}
 }
 if(work&&o.view.chassis!=='idle'&&o.facing!=='front'){
  const facing=o.facing,spec=directionalWork.directions[facing],index=spec.poses.findIndex(p=>p.state===o.view.chassis);assert.ok(index>=0)
  const registration=stationaryWork.directions[facing],pins=registration.work[index].anchors,base=Object.values(registration.baseV357),pivot={left:[432,453],right:[356,423],back:[418.5,376.5]}[facing],body=expected(o.pose.body)
  for(let i=0;i<2;i++)pair(transform(o.view.body,{x:pins[i].crop[0],y:pins[i].crop[1]}),{x:body.x+(base[i][0]-pivot[0])*.07,y:body.y+(base[i][1]-pivot[1])*.07})
 }
 observations.push(o)
}
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1000}})
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
 await page.goto('http://127.0.0.1:6382/');await page.waitForFunction(()=>document.querySelector<HTMLCanvasElement>('#stage canvas')?.dataset.ready==='true')
 const observe=()=>page.evaluate(()=>{const w=window as unknown as{observe_pixi_rig:()=>Observation};return w.observe_pixi_rig()})
 check(await observe());await page.screenshot({path:join(out,'pixi-original-front.png')})
 await page.locator('#play').click()
 for(let i=0;i<35;i++){await page.waitForTimeout(100);check(await observe())}
 await page.locator('#play').click();await page.waitForTimeout(650);check(await observe());assert.equal(observations.at(-1)!.pose.swing,null)
 for(let i=0;i<15;i++)await page.locator('#replace').click();await page.waitForTimeout(100);check(await observe());assert.equal(observations.at(-1)!.replacements,15)
 for(const speed of['0.5','1','2'])for(const direction of['0','1','2','3']){
  await page.locator('#direction').selectOption(direction);await page.locator('#speed').selectOption(speed);await page.locator('#play').click();await page.waitForTimeout(850);check(await observe());await page.locator('#play').click();await page.waitForTimeout(650);check(await observe())
  if(speed==='2')await page.screenshot({path:join(out,'pixi-speed2-translation-'+direction+'.png')})
 }
 const beforeWork=await observe(),workPhases=new Set<number>()
 await page.locator('#work').click()
 for(let i=0;i<35;i++){
  await page.waitForTimeout(80);const o=await observe();check(o,true);assert.deepEqual(o.pose.legs.map(l=>l.sole),beforeWork.pose.legs.map(l=>l.sole))
  if(o.workIndex>=0&&o.view.chassisBlend>.95&&!workPhases.has(o.workIndex)){workPhases.add(o.workIndex);await page.screenshot({path:join(out,'pixi-work-phase-'+o.workIndex+'.png')})}
 }
 assert.equal(workPhases.size,4);assert.equal((await observe()).view.chassis,'idle')
 await page.locator('#work').click();await page.waitForTimeout(500);await page.locator('#play').click();await page.waitForTimeout(250);check(await observe(),true);assert.equal((await observe()).workIndex,-1);assert.equal((await observe()).view.chassis,'idle');await page.locator('#play').click()
 for(const [facing,direction]of [['left','2'],['right','4'],['back','3']] as const){
  await page.locator('#direction').selectOption(direction);await page.locator('#facing').selectOption(facing);await page.locator('#speed').selectOption('1');await page.waitForTimeout(100);check(await observe());assert.equal(await page.locator('#work').isDisabled(),false);await page.screenshot({path:join(out,facing+'-calibrated-rest.png')})
  await page.locator('#play').click()
  for(let i=0;i<25;i++){await page.waitForTimeout(100);check(await observe());if(i===13)await page.screenshot({path:join(out,facing+'-calibrated-walk.png')})}
  await page.locator('#play').click();await page.waitForTimeout(650);const settled=await observe();check(settled);assert.equal(settled.pose.swing,null)
  const before=await observe(),phases=new Set<number>();await page.locator('#work').click()
  for(let i=0;i<35;i++){await page.waitForTimeout(80);const o=await observe();check(o,true);assert.deepEqual(o.pose.legs.map(l=>l.sole),before.pose.legs.map(l=>l.sole));if(o.workIndex>=0&&o.view.chassisBlend>.95&&!phases.has(o.workIndex)){phases.add(o.workIndex);await page.screenshot({path:join(out,facing+'-work-phase-'+o.workIndex+'.png')})}}
  assert.equal(phases.size,4);assert.equal((await observe()).view.chassis,'idle')
  await page.locator('#work').click();await page.waitForTimeout(500);await page.locator('#play').click();await page.waitForTimeout(250);check(await observe(),true);assert.equal((await observe()).workIndex,-1);await page.locator('#play').click();await page.waitForTimeout(650)

 }
 assert.deepEqual(errors,[]);assert.ok(maxPinError<1e-5,'원화 핀과 실제 Pixi 변환 일치: Pixi near-singular decomposition tolerance0.00001px')
 const result={version:364,pinTolerancePixels:1e-5,isolated:true,activeGame:false,originalSourceRegions:30,originalPngs:8,workFunctionalStates:3,workSourceRegions:14,authoredWalkFrames:0,authoredFullBodyWorkFrames:0,actualDOMInputs:true,observations,errors,maxPinError,scope:'Actual Pixi WebGL view; source-pin matrices and live borrowed original ownership across fifteen real DOM view replacements. View-specific inferred2.5D layouts, no continuous yaw/same3D skeleton approval. Four-direction work; fourteen unique registered chassis originals (three functional states per facing, left/right recovery explicitly shares phase0) blend over the same planted legs and can be interrupted by actual DOM movement controls. All four separate chassis/part sheets selected through DOM; anatomical hip assignments are parent design inferences and BACK bearing opposite surfaces remain unproven; no gameplay/atlas integration or release approval.'}
 writeFileSync(join(out,'audit.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}))
}catch(error){writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),errors,observations},null,2)+'\n');throw error}finally{await browser?.close();await new Promise<void>((done,fail)=>server.close(e=>e?fail(e):done()))}
