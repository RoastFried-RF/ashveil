/** Read-only CDP CPU sampling. Synthetic workbench; no game World exists. */
import { chromium } from 'playwright-core'
import {mkdirSync,existsSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const [out,url]=process.argv.slice(2);assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[]
page.on('pageerror',e=>errors.push(e.message))
try{
 await page.goto(url);await page.waitForSelector('canvas[data-ready=true]');await page.locator('#preset').selectOption('traveler');await page.locator('#motion').selectOption('idle');await page.locator('#guides').uncheck();await page.locator('#scale').selectOption('4')
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start')
 const frames=await page.evaluate(()=>new Promise(resolve=>{const times=[],start=performance.now();let prev=start;function frame(now){times.push(now-prev);prev=now;if(now-start<5000)requestAnimationFrame(frame);else resolve(times)}requestAnimationFrame(frame)}))
 const {profile}=await cdp.send('Profiler.stop');writeFileSync(out+'/profile.cpuprofile',JSON.stringify(profile));const byId=new Map(profile.nodes.map(n=>[n.id,n])),self=new Map();for(let i=0;i<profile.samples.length;i++){const n=byId.get(profile.samples[i]),f=n.callFrame,k=f.functionName+' '+f.url+':'+f.lineNumber;self.set(k,(self.get(k)??0)+profile.timeDeltas[i])}
 const sorted=frames.toSorted((a,b)=>a-b),at=q=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))];const summary={syntheticOnly:true,seconds:(profile.endTime-profile.startTime)/1e6,frames:frames.length,medianFrameMs:at(.5),p95FrameMs:at(.95),selfTop:[...self].sort((a,b)=>b[1]-a[1]).slice(0,25),errors};writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary))
}finally{await browser.close()}
