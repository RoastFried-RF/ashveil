/** Own private Vite/Pixi preview only. Real DOM inputs; read-only observation; finally cleanup. */
import {spawn} from 'node:child_process'
import {chromium} from 'playwright-core'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import type {CrawlerView,CrawlerPresentation} from '../src/client/render/crawler-view'
type Point={x:number;y:number}
type Observation={pose:NonNullable<ReturnType<CrawlerView['inspect']>>;suppliedRoot:Point;logical:Point;speed:number;running:boolean;moving:boolean;heading:number;state:CrawlerPresentation;framesSeen:number;lastPointer:{point:Point;hit:boolean}|null;sourceDestroyed:boolean}
const out=process.argv[2]??'test-results/autonomy-v375/crawler-preview-r1';mkdirSync(out,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','tools/art/crawler-preview-v375/vite.config.ts','--host','127.0.0.1','--port','6396','--strictPort'],{stdio:['ignore','pipe','pipe']}),messages:string[]=[],errors:string[]=[],rows:{tag:string;value:Observation}[]=[]
server.stdout.on('data',d=>messages.push(String(d)));server.stderr.on('data',d=>messages.push(String(d)))
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,completed=false,checks:Record<string,unknown>={}
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
const hitOnly=process.argv.includes('--hit-only')
const layout=JSON.parse(readFileSync('src/client/sprites.json','utf8')).chars.av375_conduit_crawler.crawler.layout as {firstOffset:number;pitch:number}
try{
 let listening=false
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Private Vite exited: '+messages.join(''));if(messages.join('').includes('127.0.0.1:6396/')){listening=true;break}await new Promise(r=>setTimeout(r,60))}
 assert.ok(listening,'This private Vite must confirm its own URL before observation')
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1400,height:1150}});page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
 await page.goto('http://127.0.0.1:6396/');await page.waitForFunction(()=>document.querySelector<HTMLCanvasElement>('#stage canvas')?.dataset.ready==='true')
 const frames=()=>page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
 const observe=async(tag:string)=>{const value=await page.evaluate(()=>(window as unknown as{observe_crawler_preview():Observation}).observe_crawler_preview());rows.push({tag,value});return value}
 const sample=async(tag:string,count=14)=>{for(let i=0;i<count;i++){await page.waitForTimeout(55);await observe(tag)}}
 await observe('rest');await page.screenshot({path:out+'/01-rest.png'})
 const box=await page.locator('#stage canvas').boundingBox();assert.ok(box)
 const pointer=async(x:number,y:number,expected:boolean,tag:string)=>{await page.mouse.move(box.x+x*box.width/1100,box.y+y*box.height/510);await frames();const o=await observe(tag);assert.equal(o.lastPointer?.hit,expected)}
 await pointer(680-layout.firstOffset*5,255,true,'opaque-plate-hit');await pointer(680,160,false,'transparent-padding-miss');await pointer(680-(layout.firstOffset+6*layout.pitch)*5,255,true,'visible-tail-prefix-hit');await page.locator('#fog').check();await frames();await pointer(680-(layout.firstOffset+6*layout.pitch)*5,255,false,'fov-hidden-body-miss');await page.screenshot({path:out+'/00-hit-mask.png'});await page.locator('#fog').uncheck();await frames()
 if(!hitOnly){
 await page.locator('#go').click();await sample('straight');await page.screenshot({path:out+'/02-straight.png'})
 await page.locator('#turn').click();await sample('instant90',22);await page.screenshot({path:out+'/03-turn.png'})
 await page.locator('#diagonal').click();await page.locator('#speed').selectOption('0.5');await sample('diagonal-half',14)
 await page.locator('#speed').selectOption('2');await sample('double-speed',14);await page.screenshot({path:out+'/04-diagonal.png'})
 await page.locator('#speed').selectOption('0');await page.waitForFunction(()=>(window as unknown as{observe_crawler_preview():Observation}).observe_crawler_preview().speed===0);await frames();const freeze=await observe('zero-before');await page.waitForTimeout(450);await frames();const frozen=await observe('zero-after');assert.deepEqual(frozen.pose,freeze.pose);assert.deepEqual(frozen.suppliedRoot,freeze.suppliedRoot)
 await page.locator('#stop').click();await page.locator('#speed').selectOption('1');await page.waitForFunction(()=>{const o=(window as unknown as{observe_crawler_preview():Observation}).observe_crawler_preview();return !o.running&&!o.moving&&o.pose.legs.every(l=>l.contact)});await frames();const stopped=await observe('stopped-before');await page.waitForTimeout(350);const settled=await observe('stopped-after');assert.deepEqual(settled.pose,stopped.pose)
 await page.locator('#go').click();await sample('restart',4);const restarted=await observe('restarted');assert.equal(restarted.pose.owner,settled.pose.owner);assert.ok(restarted.pose.distance>settled.pose.distance)
 await page.locator('#stop').click();await page.waitForFunction(()=>(window as unknown as{observe_crawler_preview():Observation}).observe_crawler_preview().moving===false)
 await page.locator('#attack').click();await page.waitForFunction(()=>(window as unknown as{observe_crawler_preview():Observation}).observe_crawler_preview().pose.sourceFrame==='av375_crawler_head_open');await observe('attack');await page.screenshot({path:out+'/05-jaws.png'})
 await page.locator('#hurt').click();await sample('hurt',2)
 await page.locator('#leg-missing').check();await page.locator('#leg-damage').check();await frames();const damage=await observe('actual-dom-part-controls');assert.equal(damage.pose.legs.find(l=>l.id==='Segment1LeftLeg')!.visible,false);assert.equal(damage.pose.legs.find(l=>l.id==='Segment1RightLeg')!.visible,true);assert.equal(damage.pose.legs.find(l=>l.id==='Segment1RightLeg')!.contact,false)
 await page.locator('#segment-missing').selectOption('Segment4');await frames();const missing=await observe('severed-prefix');assert.equal(missing.pose.body.filter(b=>b.visible).length,3);assert.equal(missing.pose.legs.filter(l=>l.visible).length,5);await page.screenshot({path:out+'/06-parts.png'})
 await page.locator('#reset').click();await page.locator('#mode').selectOption('ceiling');await page.waitForTimeout(320);const ceiling=await observe('ceiling');assert.equal(ceiling.pose.lift,5);await page.screenshot({path:out+'/07-ceiling.png'})
 await page.locator('#mode').selectOption('floor');await page.waitForTimeout(320);const floor=await observe('floor-after-drop');assert.equal(floor.pose.lift,0)
 await page.locator('#fog').check();await frames();const fog=await observe('fov-wall-clip');assert.ok(fog.pose.clipRects?.length);await page.screenshot({path:out+'/08-clip.png'})
 await page.locator('#fog').uncheck();await page.locator('#dead').check();await frames();const dead=await observe('death');assert.ok(dead.pose.legs.every(l=>!l.contact));await page.screenshot({path:out+'/09-dead.png'})
 }
 let maxRootError=0,maxReachError=0,maxSameEpochAnchorMutation=0,maxStableContactDrift=0
 for(const {value:o}of rows){maxRootError=Math.max(maxRootError,distance(o.pose.root,o.suppliedRoot));maxReachError=Math.max(maxReachError,...o.pose.legs.map(l=>l.error));assert.equal(o.pose.legs.length,16);assert.equal(new Set(o.pose.legs.map(l=>l.id)).size,16);assert.equal(o.pose.liveTextures,41);assert.equal(o.sourceDestroyed,false);for(const l of o.pose.legs){assert.equal(l.ownerId,o.pose.body[l.index].id);if(l.contact)maxStableContactDrift=Math.max(maxStableContactDrift,distance(l.end,l.anchor))}}
 for(let i=1;i<rows.length;i++){const a=rows[i-1].value.pose,b=rows[i].value.pose;if(a.owner!==b.owner)continue;for(const l of b.legs){const old=a.legs.find(p=>p.id===l.id)!;if(old.contact&&l.contact&&old.epoch===l.epoch)maxSameEpochAnchorMutation=Math.max(maxSameEpochAnchorMutation,distance(old.anchor,l.anchor))}}
 assert.equal(maxRootError,0);assert.equal(maxSameEpochAnchorMutation,0);assert.ok(maxStableContactDrift<1e-8);assert.deepEqual(errors,[])
 checks={samples:rows.length,actualDomControls:true,opaqueBodyHit:true,transparentPaddingMiss:true,hiddenBodyMiss:true,...(hitOnly?{}:{zeroSpeedStable:true,stopStable:true,restartSameOwner:true,missingVsDamaged:true,ceilingLiftAndDrop:true,fovWallMask:true,deathNoContacts:true}),maxRootError,maxReachError,maxSameEpochAnchorMutation,maxStableContactDrift,sourcePngs:1,sourceRegions:6,newSourcePngs:0,sourceDirections:1,sharedDrawInstances:41,scope:hitOnly?'Focused actual pointer hit/padding/FOV check only; previous movement report is separate.':'Shared game renderer isolated DOM presentation only. Core/finite initial fixture/Native/build/full/release are not exercised here.'};completed=true;console.log(JSON.stringify(checks))
}finally{
 await browser?.close();server.kill('SIGTERM');await new Promise<void>(resolve=>{if(server.exitCode!==null)resolve();else{server.once('exit',()=>resolve());setTimeout(()=>{if(server.exitCode===null)server.kill('SIGKILL');resolve()},2000)}})
 writeFileSync(out+'/audit.json',JSON.stringify({completed,checks,errors,observations:rows},null,2)+'\n');writeFileSync(out+'/server-lifecycle.json',JSON.stringify({port:6396,pid:server.pid,ownPrivateVite:true,browserClosed:true,signal:server.signalCode,exitCode:server.exitCode,messages},null,2)+'\n')
}
