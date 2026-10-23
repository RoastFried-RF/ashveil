// Native PNG review in the public artbook. No game-world writes or reference pixels.
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {chromium} from 'playwright-core'
const out=process.argv[2]??'test-results/artbook-v319';mkdirSync(out,{recursive:true})
const server=spawn('python3',['-m','http.server','4339','--bind','127.0.0.1','--directory','public'],{stdio:'ignore'}),errors=[],screens=[]
let browser
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 const page=await browser.newPage({viewport:{width:1440,height:1080}})
 page.on('pageerror',error=>errors.push(error.message));page.on('console',entry=>{if(entry.type()==='error')errors.push(entry.text())})
 await page.goto('http://127.0.0.1:4339/artbook/');await page.waitForSelector('.card');await page.locator('#playing').click()
 const capture=async name=>{await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));await page.screenshot({path:out+'/'+name+'.png',fullPage:true});screens.push(name+'.png')}
 for(const direction of ['down','left','right','up']){await page.selectOption('#direction',direction);await capture('actors-idle-'+direction)}
 for(const mode of ['walk','attack']){await page.selectOption('#mode',mode);await page.selectOption('#frame',mode==='walk'?'2':'2');await capture('actors-'+mode+'-up')}
 await page.locator('[data-kind=portraits]').click();await capture('portraits')
 await page.locator('[data-kind=items]').click();await page.locator('#fresh').check();await capture('weapons')
 await page.locator('#fresh').uncheck()
 for(const kind of ['terrain','abilities','ui']){await page.locator('[data-kind='+kind+']').click();await capture(kind+'-first-page')}
 await page.setViewportSize({width:390,height:844});await page.locator('[data-kind=actors]').click();await page.locator('#search').fill('떠돌이');await capture('mobile-actor')
 if(errors.length)throw Error(errors.join('\n'))
 writeFileSync(out+'/audit.json',JSON.stringify({nativePNGs:true,screens,errors,scope:'Original artbook display review only; no core/world/save tests.'},null,2)+'\n')
 console.log(JSON.stringify({out,screens:screens.length,errors}))
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
