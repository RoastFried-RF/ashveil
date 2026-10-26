/** Synthetic diagnostic only. Actual DOM changes; observe the emitted attachment and head landmarks. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import type {HumanView} from '../src/client/render/human-view'
type View=NonNullable<ReturnType<HumanView['inspect']>>
type Hook={inspect_human_preview():{ready:boolean;errors:string[];views:View[];surface:{clothing:{uid:number;def:string}[]}}}
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],rows:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 await page.goto(url);await page.waitForSelector('canvas[data-ready=true]');await page.locator('#play').click();await page.locator('#guides').uncheck()
 for(const role of await page.locator('#head option').evaluateAll(nodes=>nodes.map(node=>(node as HTMLOptionElement).value)))for(const direction of ['down','left','right','up'])for(const outfit of ['goggles','mask','both']){
  await page.locator('#head').selectOption(role);await page.locator('#direction').selectOption(direction);await page.locator('#preset').selectOption('base')
  for(const id of outfit==='goggles'?['Item.OpticalGoggles']:outfit==='mask'?['Item.AshMask']:['Item.OpticalGoggles','Item.AshMask'])await page.locator(`input[data-garment="${id}"]`).check()
  await page.waitForTimeout(40);const data=await page.evaluate(()=>(window as unknown as Hook).inspect_human_preview());assert.deepEqual(data.errors,[])
  for(const item of data.surface.clothing){const part=data.views[0].parts.find(part=>part.uid===item.uid);assert.ok(part);if(direction==='up')continue;assert.ok(part.mount);const near=direction==='left'?'left':direction==='right'?'right':undefined,eyes=data.views[0].sourceLandmarks.eyes as Record<string,[number,number]>,target=item.def==='Item.AshMask'?data.views[0].sourceLandmarks.mouth:near?eyes[near]:[(eyes.left[0]+eyes.right[0])/2,(eyes.left[1]+eyes.right[1])/2];assert.ok(target);assert.ok(Math.hypot(part.mount[0]-target[0],part.mount[1]-target[1])<1e-7)}
  const label=(role||'wanderer')+'-'+direction+'-'+outfit;await page.locator('#stage').screenshot({path:join(out,label+'.png')});rows.push({label,data})
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({diagnosticOnly:true,wholeStateEvidence:false,rows,errors}));console.log(JSON.stringify({rows:rows.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),String(error)+'\n'+await page.locator('body').innerText());throw error}finally{await browser.close()}
