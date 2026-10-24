import {mkdir,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {chromium} from '/workspace/ashveil/node_modules/playwright-core/index.mjs'

const base=fileURLToPath(new URL('.',import.meta.url)),output=base+'diagnostics/'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
const page=await browser.newPage({viewport:{width:1400,height:1200},deviceScaleFactor:1}),errors=[]
page.on('pageerror',error=>errors.push(String(error)))
await page.goto('http://127.0.0.1:49534/',{waitUntil:'networkidle'})
await page.waitForFunction(()=>window.diagnosticReady===true)
for(const scale of [3,6])for(let frame=0;frame<4;frame++){
  await page.evaluate(({frame,scale})=>window.setDiagnosticFrame(frame,scale),{frame,scale})
  for(const model of ['crow','crow-extra','bear'])await page.locator('#'+model).screenshot({path:output+model+'-frame'+frame+'-zoom'+scale+'.png'})
}
await writeFile(output+'browser-observation.json',JSON.stringify({url:page.url(),scope:'staging art canvas only; no game state, runtime, build, Full or World validation',errors,frames:[0,1,2,3],zoom:[3,6]},null,2)+'\n')
await browser.close()
