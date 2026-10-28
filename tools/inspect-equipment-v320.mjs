// Review actual native PNG frames through the standalone artbook, using its own controls.
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {chromium} from 'playwright-core'
const out=process.argv[2]??'test-results/equipment-v320';mkdirSync(out,{recursive:true})
const server=spawn('python3',['-m','http.server','4341','--bind','127.0.0.1','--directory','public'],{stdio:'ignore'}),errors=[],screens=[];let browser
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',error=>errors.push(error.message));page.on('console',entry=>{if(entry.type()==='error')errors.push(entry.text())})
 await page.goto('http://127.0.0.1:4341/artbook/');await page.waitForSelector('.card');await page.locator('[data-kind=items]').click();await page.locator('#search').fill('v320');await page.selectOption('#zoom','3')
 const capture=async name=>{await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));await page.screenshot({path:out+'/'+name+'.png',fullPage:true});screens.push(name+'.png')}
 if(!await page.locator('#count').textContent().then(text=>text.includes('50개')))throw Error('Expected all50 new equipment icons')
 await capture('equipment-01');await page.locator('#next').click();await capture('equipment-02')
 await page.setViewportSize({width:390,height:844});await page.locator('#search').fill('가죽 코트');await capture('mobile-coat')
 if(errors.length)throw Error(errors.join('\n'));writeFileSync(out+'/audit.json',JSON.stringify({nativePNGs:true,items:50,screens,errors,scope:'Native equipment artwork, search, pagination and small-screen display. No full/world/save tests.'},null,2)+'\n');console.log(JSON.stringify({out,screens,errors}))
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
