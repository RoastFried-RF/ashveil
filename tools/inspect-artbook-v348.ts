/** Public original-art workbench; only real DOM inputs, no game-state hooks. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from './native-preview'

const out=process.argv[2]??'test-results/autonomy-v348/artbook-native'
mkdirSync(out,{recursive:true})
const server=await startNativePreview(4379),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],cases:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 await page.goto(new URL('/artbook/motion/',server.url).href)
 await page.waitForFunction(()=>document.querySelector<HTMLCanvasElement>('#after')?.dataset.key)
 await page.locator('#play').click()
 for(const role of['cinder_bear']){
  await page.locator('#model').selectOption(role)
  await page.waitForFunction(role=>document.querySelector<HTMLCanvasElement>('#after')?.dataset.key?.includes(role),role)
  assert.equal(await page.locator('#weapon').isDisabled(),true)
  for(const mode of['idle','walk','work','hurt','fall','rise','sleep','attack']){
   await page.locator('#motion').selectOption(mode)
   for(const direction of['down','left','right','up']){
    await page.locator('#direction').selectOption(direction)
    await page.locator('#scrub').press('Home');const box=await page.locator('#scrub').boundingBox();assert.ok(box);await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5)
    await page.waitForFunction(({role,mode,direction})=>{const canvas=document.querySelector<HTMLCanvasElement>('#after');return canvas?.dataset.mode===mode&&Number(canvas.dataset.index)>0&&canvas.dataset.key?.includes(role)&&canvas.dataset.key?.includes(direction)},{role,mode,direction})
    const state=await page.locator('#after').evaluate(canvas=>({...((canvas as HTMLCanvasElement).dataset)}))
    assert.equal(await page.locator('#before').getAttribute('data-mode'),'missing');assert.ok((await page.locator('#before-stat').innerText()).includes('신규 생물'))
    assert.equal(state.count,'4');cases.push({role,mode,direction,...state})
    if(direction==='down'||mode==='fall'||mode==='rise')await page.screenshot({path:join(out,role+'-'+mode+'-'+direction+'.png')})
   }
  }
  await page.locator('#motion').selectOption('attack');assert.equal(await page.locator('#attack-mode').isDisabled(),false);await page.locator('#attack-mode').selectOption('bite')
  for(const direction of['down','left','right','up']){await page.locator('#direction').selectOption(direction);const box=await page.locator('#scrub').boundingBox();assert.ok(box);await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);await page.waitForFunction(direction=>document.querySelector<HTMLCanvasElement>('#after')?.dataset.key?.includes('_bite_'+direction),direction);const state=await page.locator('#after').evaluate(canvas=>({...((canvas as HTMLCanvasElement).dataset)}));assert.equal(state.count,'4');cases.push({role,mode:'attack',variant:'bite',direction,...state});await page.screenshot({path:join(out,role+'-bite-'+direction+'.png')})}
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({publicPage:true,actualDOMInputs:true,cases,errors,scope:'One original quadruped body: eight motion families/four directions plus independently authored bite attack variant. Four source frames per clip, not dense12gait approval. No invented previous model or human equipment. Static workbench, not actual game locomotion or release approval.'},null,2)+'\n');console.log(JSON.stringify({cases:cases.length,errors}))
}finally{await page.close();await browser.close();server.stop()}
