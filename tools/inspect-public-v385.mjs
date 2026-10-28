import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
const root=process.argv[2]??'https://roastfried-rf.github.io/ashveil/',out=process.argv[3]??'test-results/autonomy-v385/public-browser-r1'
mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 await page.goto(root+'?revision=v385',{waitUntil:'networkidle'});assert.ok((await page.locator('body').innerText()).includes('ASHVEIL'));await page.screenshot({path:out+'/title.png'})
 await page.goto(root+'artbook/?revision=v385',{waitUntil:'networkidle'});await page.waitForSelector('.card');await page.locator('[data-kind=items]').click();await page.locator('#search').fill('v384');await page.waitForFunction(()=>document.querySelectorAll('.card').length===6);await page.locator('#fresh').check();assert.equal(await page.locator('.card').count(),6)
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));const count=await page.locator('#count').innerText();assert.ok(count.includes('0.385-dev'))
 const labels=await page.locator('.card .info b').allTextContents();for(const name of ['막대 의족','관절 의족','갈고리 손','유리 눈','개척 의수','정원사 이식지'])assert.ok(labels.includes(name),name+' in '+labels.join(','))
 await page.screenshot({path:out+'/prosthetic-artbook.png',fullPage:true});await page.setViewportSize({width:390,height:844})
 await page.waitForFunction(()=>[...document.querySelectorAll('.card .frame')].every(node=>{const f=node.getBoundingClientRect(),v=node.parentElement.getBoundingClientRect();return f.width<=v.width&&f.height<=v.height}))
 const mobileFit=await page.locator('.card .frame').evaluateAll(nodes=>nodes.map(node=>{const f=node.getBoundingClientRect(),v=node.parentElement.getBoundingClientRect();return{frame:[f.width,f.height],card:[v.width,v.height],fits:f.width<=v.width&&f.height<=v.height}}));assert.ok(mobileFit.every(f=>f.fits))
 await page.screenshot({path:out+'/prosthetic-artbook-mobile.png',fullPage:true});assert.deepEqual(errors,[])
 writeFileSync(out+'/audit.json',JSON.stringify({root,actualDOM:true,gameTitle:true,newItems:6,recentFilterPreservesAllSix:true,catalogVersion:'0.385-dev',viewports:[[1440,1080],[390,844]],mobileFit,labels,count,errors,scope:'Actual title and read-only original-art catalog. Main gameplay verified separately on immutable matching runtime.'},null,2)+'\n');console.log(JSON.stringify({items:labels.length,errors}))
}catch(e){await page.screenshot({path:out+'/failure.png'});writeFileSync(out+'/failure.txt',await page.locator('body').innerText());writeFileSync(out+'/errors.json',JSON.stringify(errors));throw e}finally{await page.close();await browser.close()}
