/** Selected final visual review at normalized attack phases; no world mutations. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from './native-preview'
const out=process.argv[2]??'test-results/motion-v323/review';mkdirSync(out,{recursive:true})
const server=await startNativePreview(4356),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1400,height:1100}}),errors:string[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 await page.goto(server.url);await page.getByText('ASHVEIL · v0.323-dev · 잿빛 숲').waitFor();await page.screenshot({path:join(out,'title.png')})
 await page.goto(new URL('artbook/',server.url).href);await page.waitForFunction(()=>document.getElementById('count')?.textContent?.includes('0.323-dev'));await page.locator('#mode').selectOption('walk');await page.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('#grid img')].every(img=>img.complete&&img.naturalWidth>0));await page.screenshot({path:join(out,'artbook-walk.png')})
 await page.goto(new URL('artbook/motion/',server.url).href);await page.waitForFunction(()=>document.getElementById('status')?.textContent?.startsWith('발 기준'));await page.locator('#play').click();await page.locator('#motion').selectOption('attack');await page.locator('#offhand').selectOption('')
 const phases=[0,160,300,430,510,720,900,999],shots:{weapon:string;direction:string;src:string[]}[]=[]
 for(const weapon of['Item.RustyKnife','Item.Greatsword','Item.RebarSpear'])for(const direction of['right','down']){
  await page.locator('#weapon').selectOption(weapon);await page.waitForFunction(()=>document.getElementById('status')?.textContent?.startsWith('발 기준'));await page.locator('#direction').selectOption(direction);const src:string[]=[]
  for(const phase of phases){await page.locator('#scrub').fill(String(phase));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));src.push(await page.locator('#after').evaluate(node=>(node as HTMLCanvasElement).toDataURL()))}
  shots.push({weapon,direction,src})
 }
 // Unload the preview and its RAF before replacing the diagnostic document.
 await page.goto('about:blank')
 await page.evaluate(shots=>{
  const section=document.createElement('section');section.id='review';section.style.cssText='background:#17191b;color:#d6cebb;padding:12px;width:1360px;font:14px system-ui';document.body.replaceChildren(section)
  for(const row of shots){const title=document.createElement('p');title.textContent=row.weapon+' · '+row.direction;section.append(title);const strip=document.createElement('div');strip.style.display='flex';for(const src of row.src){const img=new Image();img.src=src;img.style.cssText='width:167px;height:140px;image-rendering:pixelated';strip.append(img)}section.append(strip)}
 },shots)
 await page.locator('#review img').evaluateAll(nodes=>Promise.all(nodes.map(n=>(n as HTMLImageElement).decode())));await page.locator('#review').screenshot({path:join(out,'attack-phases.png')})
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({titleVersion:323,artbookVersion:'0.323-dev',phases,weaponDirectionRows:shots.map(({weapon,direction})=>({weapon,direction})),errors,scope:'Six selected gear/direction phase strips, plus title/artbook. Visual review artifact, not a whole-world regression.'},null,2)+'\n');console.log(JSON.stringify({rows:shots.length,phases:phases.length,errors}))
}finally{await page.close();await browser.close();server.stop()}
