import {chromium} from '/workspace/ashveil/node_modules/playwright-core/index.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
const root='/workspace/.ashveil-planned/v333-wildlife-art',dir=root+'/screenshots';mkdirSync(dir,{recursive:true})
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
const page=await browser.newPage({viewport:{width:1440,height:1780},deviceScaleFactor:1}),errors:string[]=[]
page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
await page.goto('http://127.0.0.1:6347/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.reviewReady===true)
for(let n=0;n<4;n++){
 await page.evaluate(phase=>window.setReviewPhase(phase),n/4)
 await page.screenshot({path:dir+`/phase-${n}.png`,fullPage:true})
}
const observations=await page.evaluate(()=>({title:document.title,canvasCount:document.querySelectorAll('canvas').length,mainGameLoaded:document.querySelector('#app')!==null,url:location.href}))
writeFileSync(dir+'/browser-observation.json',JSON.stringify({scope:'staging diagnostic only; no main game loaded',errors,observations,screenshots:[0,1,2,3].map(n=>'phase-'+n+'.png')},null,2)+'\n')
await browser.close();console.log(JSON.stringify({errors,observations}))
