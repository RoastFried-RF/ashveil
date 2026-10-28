// Native atlas and public comparison review. No game state access.
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
const out=process.argv[2]??'test-results/art-quality-v321/artbook'
mkdirSync(out,{recursive:true})
const server=spawn('python3',['-m','http.server','4347','--bind','127.0.0.1','--directory','public'],{stdio:'ignore'}),errors=[],screens=[],poses=[]
let browser
try{
 for(let n=0;n<40;n++){try{const r=await fetch('http://127.0.0.1:4347/artbook/catalog.json');if(r.ok)break}catch{/* The private preview may still be starting. */}await new Promise(r=>setTimeout(r,50))}
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
 const page=await browser.newPage({viewport:{width:1440,height:1080}})
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
 const capture=async name=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:out+'/'+name+'.png',fullPage:true});screens.push(name+'.png')}
 await page.goto('http://127.0.0.1:4347/artbook/');await page.waitForSelector('.card');await page.locator('#playing').click();assert.equal(await page.locator('.card').count(),13)
 for(const mode of ['idle','walk','attack'])for(const dir of ['down','left','right','up']){
  await page.selectOption('#mode',mode);await page.selectOption('#direction',dir)
  for(const frame of ['0','1','2','3']){
   await page.selectOption('#frame',frame);await page.waitForTimeout(35)
   const cards=await page.locator('.card').evaluateAll(cards=>cards.map(c=>{const n=c.querySelector('.frame'),v=c.querySelector('.view'),img=n.querySelector('img');return{source:img.src,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,viewHeight:v.getBoundingClientRect().height}}))
   assert(cards.every(c=>c.source.includes('direction-v321')&&c.width<=222.1&&c.height<=c.viewHeight));poses.push({mode,dir,frame,cards:cards.length})
  }
  await page.selectOption('#frame','2');await page.waitForTimeout(50)
  if(mode==='attack'||(mode==='walk'&&dir==='left')||(mode==='idle'&&dir==='down'))await capture(mode+'-'+dir)
 }
 await page.locator('[data-kind=portraits]').click();assert.equal(await page.locator('.card').count(),8);await capture('portraits')
 await page.goto('http://127.0.0.1:4347/artbook/comparison/');await page.waitForSelector('#after')
 for(const scene of ['room','field','torch'])for(const size of ['1440','1366']){
  await page.selectOption('#scene',scene);await page.selectOption('#size',size);await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0))
  assert((await page.locator('#after').getAttribute('src')).includes(scene+'-'+size));await page.locator('#new').click();assert.equal(await page.locator('#split').inputValue(),'100');await page.locator('#old').click();assert.equal(await page.locator('#split').inputValue(),'0')
  await page.locator('#split').fill('50');await page.locator('#split').dispatchEvent('input')
  if(size==='1440'&&scene==='field')await capture('comparison-field')
 }
 await page.setViewportSize({width:390,height:844});await page.selectOption('#scene','room');await capture('comparison-mobile')
 assert.deepEqual(errors,[]);writeFileSync(out+'/audit.json',JSON.stringify({screens,poses,errors,scope:'13 role models in4 directions/3 modes/4 selected frames; atlas presentation and comparison controls only, not combat/world regression.'},null,2)+'\n');console.log(JSON.stringify({out,screens:screens.length,poseChecks:poses.length,errors}))
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
