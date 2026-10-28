// Actual public DOM controls only. Read JSON/text/canvas; never inject rig/Core state.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import {chromium} from '/workspace/ashveil/node_modules/playwright-core/index.mjs';
const base='/workspace/.ashveil-planned/v374-crawler-runtime',out=base+'/observations',port=6394;
const stage=process.argv[2]??'initial';await fs.mkdir(out+'/'+stage,{recursive:true});
let server,browser;const browserErrors=[],serverLog=[],samples=[],shots=[],steps=[];const start=Date.now();
const nap=ms=>new Promise(r=>setTimeout(r,ms));
try{
 server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',base+'/site'],{stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',b=>{if(serverLog.length<80)serverLog.push(String(b));});
 for(let i=0;i<50;i++){try{if((await fetch(`http://127.0.0.1:${port}/`)).ok)break;}catch{}await nap(100);}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1460,height:1080}});page.on('pageerror',e=>browserErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text());});
 await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#audit-json')?.textContent.length>100);
 const read=async tag=>{const s=JSON.parse(await page.locator('#audit-json').textContent());samples.push({tag,wallMs:Date.now()-start,state:s});return s;};
 const observe=async(tag,ms)=>{const until=Date.now()+ms;while(Date.now()<until){await read(tag);await nap(120);}const end=await read(tag);steps.push({tag,wallMs:Date.now()-start,distance:end.distance,time:end.time,running:end.running,speed:end.speed,stance:end.legs.filter(l=>l.contact).length});return end;};
 const shot=async name=>{const path=`${out}/${stage}/${name}.png`;await page.locator('#scene').screenshot({path});shots.push(path);};
 await observe('initial-rest',300);await shot('01-rest');
 await page.locator('#east').click();await page.locator('#go').click();await observe('straight-1x',2600);await shot('02-straight');
 await page.locator('#speed').selectOption('0.5');await observe('straight-half',1700);
 await page.locator('#diagonal').click();await observe('diagonal-half',2600);await shot('03-diagonal');
 await page.locator('#speed').selectOption('1');await page.locator('#left90').click();await observe('left90-1x',3000);await shot('04-left-turn');
 await page.locator('#stop').click();const stop=await observe('stop-settle',1000);await shot('05-stopped');
 await page.locator('#go').click();const restart=await observe('restart-1x',1600);
 await page.locator('#speed').selectOption('2');await observe('move-2x',1900);await page.locator('#right90').click();await observe('right90-2x',3300);await shot('06-fast-turn');
 await page.locator('#speed').selectOption('0');await observe('freeze-0x',900);await shot('07-frozen');
 await page.locator('#mouth').selectOption('open');await observe('open-head-frozen',250);await shot('08-open-head');
 await page.locator('#speed').selectOption('1');await observe('resume-after-zero',1200);await page.locator('#stop').click();const final=await observe('final-stop-settle',900);
 await page.locator('#mirror').uncheck();await observe('unreflected-single-surface',250);await shot('09-unreflected');await page.locator('#debug').uncheck();await shot('10-clean');
 const ownershipRows=await page.locator('#ownership tbody tr').count();
 const apply=(m,p)=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const expectedBodies=['Segment1','Segment2','Segment3','Segment4','Segment5','Segment6','Segment7','TailSegment8'];const previous=new Map();
 const metrics={sampleCount:samples.length,ownershipViolations:[],maxReachFromRenderedHook:0,maxReportedReach:0,maxRenderedStanceVsAnchor:0,maxSameEpochAnchorMutation:0,maxSameEpochRenderedDrift:0,maxUpperProximalMismatch:0,maxKneeSourceJoinMismatch:0,maxHookSourceMismatch:0,maxLinkLengthMismatch:0,minStance:16,maxSwing:0,ownedBodies:8,ownedLegs:16,sourceOriginals:1,sourceRegions:6,newAuthoredArt:0};
 for(const sample of samples){const s=sample.state;
  if(s.bodies.map(b=>b.id).join(',')!==expectedBodies.join(',')||s.bodies.filter(b=>b.source==='middlePlate').length!==7||s.bodies.filter(b=>b.source==='tailPlate').length!==1||s.legs.length!==16||new Set(s.legs.map(l=>l.id)).size!==16)metrics.ownershipViolations.push({tag:sample.tag,frame:s.frame});
  metrics.minStance=Math.min(metrics.minStance,s.legs.filter(l=>l.contact).length);metrics.maxSwing=Math.max(metrics.maxSwing,s.legs.filter(l=>!l.contact).length);
  for(const l of s.legs){const owner=l.index===7?'TailSegment8':`Segment${l.index+1}`,expected=`Segment${l.index+1}${l.side===-1?'Left':'Right'}Leg`;if(l.ownerId!==owner||l.id!==expected)metrics.ownershipViolations.push({id:l.id,owner:l.ownerId});
   const upperA=apply(l.upperMatrix,s.sourcePoints.upperA),upperB=apply(l.upperMatrix,s.sourcePoints.upperB),lowerA=apply(l.lowerMatrix,s.sourcePoints.lowerA),hook=apply(l.lowerMatrix,s.sourcePoints.lowerB);
   metrics.maxUpperProximalMismatch=Math.max(metrics.maxUpperProximalMismatch,distance(upperA,l.hip));metrics.maxKneeSourceJoinMismatch=Math.max(metrics.maxKneeSourceJoinMismatch,distance(upperB,lowerA));metrics.maxHookSourceMismatch=Math.max(metrics.maxHookSourceMismatch,distance(hook,l.end));metrics.maxReachFromRenderedHook=Math.max(metrics.maxReachFromRenderedHook,distance(hook,l.foot));metrics.maxReportedReach=Math.max(metrics.maxReportedReach,l.error);metrics.maxLinkLengthMismatch=Math.max(metrics.maxLinkLengthMismatch,Math.abs(distance(upperA,upperB)-s.configuration.upper),Math.abs(distance(lowerA,hook)-s.configuration.lower));
   if(l.contact){metrics.maxRenderedStanceVsAnchor=Math.max(metrics.maxRenderedStanceVsAnchor,distance(hook,l.anchor));const key=s.sceneOwner+':'+l.id+':'+l.epoch,p=previous.get(key);if(p){metrics.maxSameEpochAnchorMutation=Math.max(metrics.maxSameEpochAnchorMutation,distance(l.anchor,p.anchor));metrics.maxSameEpochRenderedDrift=Math.max(metrics.maxSameEpochRenderedDrift,distance(hook,p.hook));}previous.set(key,{anchor:l.anchor,hook});}
  }
 }
 const frozen=samples.filter(s=>s.tag==='freeze-0x').map(s=>s.state),stopped=samples.filter(s=>s.tag==='stop-settle').map(s=>s.state),a=frozen[0],b=frozen.at(-1);
 const freeze={distanceDelta:b.distance-a.distance,simulationTimeDelta:b.time-a.time,rootDelta:distance(a.root,b.root),maxHookDelta:Math.max(...a.legs.map((l,i)=>distance(l.renderedHook,b.legs[i].renderedHook)))};
 const stopObservation={settledStance:stop.legs.filter(l=>l.contact).length,settledSwing:stop.legs.filter(l=>!l.contact).length,rootDistanceAfterStop:stopped.at(-1).distance-stopped[0].distance,sceneOwnerRetainedOnRestart:stop.sceneOwner===restart.sceneOwner,distanceContinuedOnRestart:restart.distance>stop.distance,finalSettledStance:final.legs.filter(l=>l.contact).length};
 const report={kind:'read-only-public-DOM-observation',stage,newImageGenCalls:0,mutatedStateThroughAPI:false,controls:'Actual locator.click/selectOption/uncheck only; audit-json/read and canvas screenshot',sourceSha256:final.sourceSha256,ownershipRows,metrics,freeze,stopObservation,steps,shots,browserErrors,limits:['2D display-only fixedlinks/path/curvaturelimit;notphysical3D','head command90deg is immediate but trajectorycurvaturelimits actualturn;notgameinputintegration','mapwalls/occupancy/wholebodyworldscale notimplemented','sourcecaps/socketdepth and lowerfootcontactproxy assumptions','rotated/reflectedonepaintedsurface,notnewviews','noCorepoison/ceiling/drop/curl/damage']};
 await fs.writeFile(out+'/'+stage+'/dom-samples.json',JSON.stringify(samples));await fs.writeFile(out+'/'+stage+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({stage,metrics,freeze,stopObservation,browserErrors,shots:shots.length},null,2));
}finally{
 if(browser)await browser.close();if(server&&!server.killed)server.kill('SIGTERM');if(server)await Promise.race([new Promise(r=>server.once('exit',r)),nap(1000)]);
 await fs.writeFile(out+'/'+stage+'/server-lifecycle.json',JSON.stringify({port,scope:base+'/site',ownProcessTerminated:true,browserClosed:true,serverLog,sharedServersTouched:false},null,2));
}
