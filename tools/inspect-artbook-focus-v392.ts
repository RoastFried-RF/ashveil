/** Real gallery controls, mouse wheel and keyboard; no game/world injection. */
import {chromium}from'playwright-core'
import assert from'node:assert/strict'
import{mkdirSync,existsSync,writeFileSync}from'node:fs'
import{join}from'node:path'
const out=process.argv[2],url=process.argv[3],baseline=process.argv.includes('--baseline');assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],rows:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 for(const width of[1440,390]){
  await page.setViewportSize({width,height:900});await page.goto(url);await page.locator('#tabs').getByRole('button',{name:'물품',exact:true}).click();await page.locator('#search').fill('의료 가방')
  async function ready(){await page.locator('.card img').first().evaluate(async n=>{await(n as HTMLImageElement).decode()});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))}
  const view=page.locator('.card .view').first(),read=()=>view.evaluate(e=>({x:e.scrollLeft,y:e.scrollTop,w:e.clientWidth,h:e.clientHeight,sw:e.scrollWidth,sh:e.scrollHeight,focusX:(e.scrollLeft+e.clientWidth/2)/e.scrollWidth,focusY:(e.scrollTop+e.clientHeight/2)/e.scrollHeight}))
  await page.locator('#zoom').selectOption('4');await ready();const first=await read();assert.ok(first.sw>first.w||first.sh>first.h)
  if(baseline){assert.ok(Math.abs(first.x-(first.sw-first.w)/2)>2||Math.abs(first.y-(first.sh-first.h)/2)>2,'baseline starts at edge')}
  else{assert.ok(Math.abs(first.x-(first.sw-first.w)/2)<=1);assert.ok(Math.abs(first.y-(first.sh-first.h)/2)<=1)}
  rows.push({width,zoom:4,first});await page.screenshot({path:join(out,width+'-first.png')})
  if(!baseline){
   await view.hover();await page.mouse.wheel(80,70);await page.waitForTimeout(200);const panned=await read();assert.ok(panned.x!==first.x||panned.y!==first.y)
   await page.locator('#zoom').selectOption('native');await ready();const next=await read();const clamp=(v:number,max:number)=>Math.max(0,Math.min(max,v));assert.ok(Math.abs(next.x-clamp(panned.focusX*next.sw-next.w/2,next.sw-next.w))<=1);assert.ok(Math.abs(next.y-clamp(panned.focusY*next.sh-next.h/2,next.sh-next.h))<=1)
   await view.click({position:{x:10,y:10}});const before=await read();await page.keyboard.press('ArrowUp');await page.waitForTimeout(180);const after=await read();assert.ok(after.y<before.y,'native viewport supports real keyboard scrolling');rows.push({width,panned,next,keyboard:true});await page.screenshot({path:join(out,width+'-native.png')})
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({baseline,actualControls:true,rows,errors},null,2));console.log(JSON.stringify({baseline,observations:rows.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),String(error)+'\n'+await page.locator('body').innerText());throw error}finally{await browser.close()}
