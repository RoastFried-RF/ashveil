/** Public original-art workbench; only real DOM inputs, no game-state hooks. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from './native-preview'

const out=process.argv[2]??'test-results/autonomy-v333/artbook-native'
mkdirSync(out,{recursive:true})
const server=await startNativePreview(4366),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],cases:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 await page.goto(new URL('/artbook/motion/',server.url).href)
 await page.waitForFunction(()=>document.querySelector<HTMLCanvasElement>('#after')?.dataset.key)
 await page.locator('#play').click()
 for(const role of['ashhorn_stag','tuskhog']){
  await page.locator('#model').selectOption(role)
  await page.waitForFunction(role=>document.querySelector<HTMLCanvasElement>('#after')?.dataset.key?.includes(role),role)
  assert.equal(await page.locator('#weapon').isDisabled(),true)
  for(const mode of['walk','work','attack',...(role==='tuskhog'?['wallow']:[])]){
   await page.locator('#motion').selectOption(mode)
   for(const direction of['down','left','right','up']){
    await page.locator('#direction').selectOption(direction)
    await page.locator('#scrub').press('Home');const box=await page.locator('#scrub').boundingBox();assert.ok(box);await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5)
    await page.waitForFunction(({role,mode,direction})=>{const canvas=document.querySelector<HTMLCanvasElement>('#after');return canvas?.dataset.mode===mode&&Number(canvas.dataset.index)>0&&canvas.dataset.key?.includes(role)&&canvas.dataset.key?.includes(direction)},{role,mode,direction})
    const state=await page.locator('#after').evaluate(canvas=>({...((canvas as HTMLCanvasElement).dataset)}))
    assert.equal(await page.locator('#before').getAttribute('data-mode'),'missing');assert.ok((await page.locator('#before-stat').innerText()).includes('신규 생물'))
    assert.equal(state.count,mode==='wallow'?'6':'4');cases.push({role,mode,direction,...state})
    if(direction==='down'||mode==='wallow')await page.screenshot({path:join(out,role+'-'+mode+'-'+direction+'.png')})
   }
  }
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({publicPage:true,actualDOMInputs:true,cases,errors,scope:'Two new original bodies, four directions; walk/work/attack and boar wallow; no invented prior model or equipped human weapon. Static workbench review, not game locomotion/performance approval.'},null,2)+'\n');console.log(JSON.stringify({cases:cases.length,errors}))
}finally{await page.close();await browser.close();server.stop()}
