/** Exercise the public preview's real controls; inspect decoded PNG/canvas frames. */
import {chromium} from 'playwright-core'
import {mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {startNativePreview} from './native-preview'
const out=process.argv[2]??'test-results/motion-v323/gallery';mkdirSync(out,{recursive:true})
const server=await startNativePreview(4354),browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1400,height:1000}}),errors:string[]=[],runs:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 await page.goto(new URL('artbook/motion/',server.url).href);await page.waitForFunction(()=>document.getElementById('status')?.textContent?.startsWith('발 기준'))
 await page.locator('#play').click();const roles=await page.locator('#model option').evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value))
 for(const role of roles){
  await page.locator('#model').selectOption(role);await page.waitForFunction(()=>document.getElementById('status')?.textContent?.startsWith('발 기준'));await page.locator('#motion').selectOption('walk')
  for(const dir of['down','left','right','up']){
   await page.locator('#direction').selectOption(dir);await page.locator('#next').click();await page.waitForFunction(()=>document.getElementById('after')?.dataset.index==='1')
   assert.equal(await page.locator('#after').getAttribute('data-count'),'12')
  }
  await page.locator('#direction').selectOption('left');await page.locator('#scrub').fill('420');await page.screenshot({path:join(out,role+'-walk.png')})
  const modes=await page.locator('#motion option:enabled').evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value).filter(n=>n!=='sequence'))
  for(const mode of modes){await page.locator('#motion').selectOption(mode);await page.locator('#scrub').fill('1000');await page.waitForFunction(mode=>{const d=document.getElementById('after')?.dataset;return d?.mode===mode&&Number(d.index)===Number(d.count)-1},mode);const count=Number(await page.locator('#after').getAttribute('data-count'));assert.ok(count>0);assert.equal(Number(await page.locator('#after').getAttribute('data-index')),count-1);runs.push({role,mode,count})}
  await page.locator('#motion').selectOption('sequence');await page.locator('#sequence').selectOption('ground');await page.locator('#scrub').fill('600');await page.screenshot({path:join(out,role+'-ground.png')})
 }
 // Sequence stepping uses current clip phase, not the overall timeline offset.
 await page.locator('#model').selectOption('wanderer');await page.waitForFunction(()=>document.getElementById('status')?.textContent?.startsWith('발 기준'));await page.locator('#sequence').selectOption('crouch');await page.locator('#scrub').fill('350');await page.locator('#next').click();assert.equal(await page.locator('#motion').inputValue(),'crouchWalk');assert.ok(await page.locator('#sequence').isDisabled())
 // Every registered carry item is decoded in all directions; human melee selects an actual mode.
 await page.locator('#motion').selectOption('walk');await page.waitForFunction(()=>document.getElementById('after')?.dataset.mode==='walk')
 assert.equal(await page.locator('#after').getAttribute('data-duration'),'720');assert.equal(await page.locator('#before').getAttribute('data-duration'),'300')
 const weapons=await page.locator('#weapon option').evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value).filter(Boolean));let gearPoses=0
 for(const weapon of weapons){
  await page.locator('#weapon').selectOption(weapon);await page.waitForFunction(()=>document.getElementById('status')?.textContent?.startsWith('발 기준'));await page.locator('#motion').selectOption('attack')
  for(const dir of['down','left','right','up']){await page.locator('#direction').selectOption(dir);await page.locator('#scrub').fill('450');await page.waitForFunction(()=>document.getElementById('after')?.dataset.mode==='attack');await page.waitForTimeout(20);gearPoses++}
  if(['Item.RustyKnife','Item.Greatsword','Item.RebarSpear','Item.Bow','Item.LightCrossbow','Item.StoneHammer'].includes(weapon))await page.screenshot({path:join(out,weapon.slice(5)+'-equipment.png')})
 }
 await page.locator('#weapon').selectOption('Item.RustyKnife');await page.locator('#attack-mode').selectOption('stab');await page.locator('#scrub').fill('0');await page.locator('#next').click();await page.waitForFunction(()=>document.getElementById('after')?.dataset.index==='1');assert.equal(await page.locator('#after').getAttribute('data-style'),'thrust')
 await page.locator('#attack-mode').selectOption('slash');await page.locator('#scrub').fill('450');await page.waitForFunction(()=>document.getElementById('after')?.dataset.style==='slash');assert.equal(await page.locator('#after').getAttribute('data-duration'),'520')
 await page.locator('#model').selectOption('hound');assert.ok(await page.locator('#weapon').isDisabled());await page.locator('#model').selectOption('wanderer');await page.waitForFunction(()=>document.getElementById('status')?.textContent?.startsWith('발 기준'))
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(out,'mobile.png'),fullPage:true});assert.deepEqual(errors,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({roles:roles.length,runs,equipmentItems:weapons.length,equipmentDirectionPoses:gearPoses,walkDurations:[300,720],attackModeControls:true,errors,scope:'Public motion controls and last-frame bounds for every offered family. Screenshots are selected walk/ground poses, not every original pose.'},null,2));console.log(JSON.stringify({roles:roles.length,clips:runs.length,gearPoses,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png'),fullPage:true});writeFileSync(join(out,'failure.txt'),await page.locator('body').innerText());throw error}finally{await page.close();await browser.close();server.stop()}
