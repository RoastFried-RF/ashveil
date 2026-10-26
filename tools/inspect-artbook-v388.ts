import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {startNativePreview} from './native-preview'
const out=process.argv[2]??'test-results/autonomy-v388/artbook-r1',url=process.argv[3];mkdirSync(out,{recursive:true})
const server=url?undefined:await startNativePreview(4390),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors:string[]=[],rows:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await page.goto(url??new URL('artbook/',server!.url).href);await page.locator('#tabs').getByRole('button',{name:'물품',exact:true}).click();await page.locator('#search').fill('의료 가방');const card=page.locator('.card').first();await card.waitFor();let initial:{width:number;height:number}|undefined
  for(const zoom of ['1','2','4','native']){
   await page.locator('#zoom').selectOption(zoom);await card.locator('img').evaluate(async node=>{const img=node as HTMLImageElement;await img.decode();if(!img.complete||!img.naturalWidth)throw Error('도감 원화 디코딩 미완료')});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));const frame=(await card.locator('.frame').boundingBox())!,view=await card.locator('.view').evaluate(e=>({w:e.clientWidth,h:e.clientHeight,scrollW:e.scrollWidth,scrollH:e.scrollHeight}));if(zoom==='1')initial=frame;else if(zoom!=='native'){assert.ok(Math.abs(frame.width/initial!.width-Number(zoom))<.02);assert.ok(Math.abs(frame.height/initial!.height-Number(zoom))<.02)}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);rows.push({width,zoom,frame,view});await page.screenshot({path:join(out,width+'-'+zoom+'.png')})
  }
  const view=card.locator('.view');await view.click({position:{x:10,y:10}});const old=await view.evaluate(e=>e.scrollTop);await page.keyboard.press('ArrowDown');await page.waitForTimeout(150);assert.ok(await view.evaluate(e=>e.scrollTop)>old,'focused original crop must be scrollable');rows.push({width,keyboardScrolled:true})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({actualInputs:true,rows,errors},null,2));console.log(JSON.stringify({rows:rows.length,errors}))
}catch(e){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());throw e}finally{await browser.close();server?.stop()}
