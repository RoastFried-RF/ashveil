/** DOM inputs only; synthetic workbench observations are not Core acceptance. */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import type {HumanPreviewCatalog} from './art/human-preview-v389'
import type {HumanView} from '../src/client/render/human-view'
type Observation={ready:boolean;errors:string[];catalog:HumanPreviewCatalog;views:ReturnType<HumanView['inspect']>[];surface:{clothing:{uid:number;def:string}[]};controls:{root:number[];phase:number}}
type Hook={inspect_human_preview():Observation}
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],rows:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
async function observe(label:string,screenshot=false){await page.waitForTimeout(40);const data=await page.evaluate(()=>(window as unknown as Hook).inspect_human_preview());assert.deepEqual(data.errors,[]);rows.push({label,data});if(screenshot)await page.locator('#stage').screenshot({path:join(out,label+'.png')});return data}
try{
 await page.goto(url);await page.waitForSelector('canvas[data-ready=true]');await page.locator('#play').click();await page.locator('#guides').uncheck();const initial=await observe('initial');assert.equal(initial.catalog.garments.length,25)
 for(const direction of ['down','left','right','up']){
  await page.locator('#direction').selectOption(direction)
  for(const preset of await page.locator('#preset option').evaluateAll(nodes=>nodes.map(node=>(node as HTMLOptionElement).value).filter(value=>value!=='custom'))){await page.locator('#preset').selectOption(preset);await observe(direction+'-'+preset,true)}
 }
 for(const head of await page.locator('#head option').evaluateAll(nodes=>nodes.map(node=>(node as HTMLOptionElement).value).filter(Boolean))){await page.locator('#head').selectOption(head);for(const direction of ['down','left','right','up']){await page.locator('#direction').selectOption(direction);for(const preset of ['base','traveler']){await page.locator('#preset').selectOption(preset);const data=await observe('head-'+head+'-'+direction+'-'+preset,true);assert.equal(data.views[0]!.headRole,head)}}}
 await page.locator('#head').selectOption('')
 await page.locator('#preset').selectOption('base');await page.locator('#direction').selectOption('down')
 for(const garment of initial.catalog.garments){
  await page.locator('#preset').selectOption('base');await page.locator(`input[data-garment="${garment.id}"]`).check();const data=await observe('item-'+garment.id,true),state=data.surface.clothing.find(c=>c.def===garment.id);assert.ok(state);assert.ok(data.views[0]!.parts.some(p=>p.uid===state.uid),garment.id)
  if(['Item.OpticalGoggles','Item.AshMask','Item.LeatherBelt'].includes(garment.id))for(const direction of ['left','right','up']){await page.locator('#direction').selectOption(direction);await observe('item-'+garment.id+'-'+direction,true)}
  await page.locator('#direction').selectOption('down')
 }
 await page.locator('#preset').selectOption('traveler');await page.locator('#half').check();await observe('half',true);await page.locator('#half').uncheck();await page.locator('#progress').selectOption('unequip');await observe('undressing',true);await page.locator('#progress').selectOption('');await page.locator('#durability').fill('15');await observe('damaged',true)
 await page.locator('#preset').selectOption('base');await page.locator('#durability').fill('100')
 for(const rule of initial.catalog.prosthetics){await page.locator('#replacement').selectOption(rule.id);for(const root of rule.targets){await page.locator('#replacement-root').selectOption(root);await page.locator('#missing').selectOption(root);const data=await observe(rule.id+'-'+root,true);assert.equal(data.views[0]!.parts.filter(p=>p.role==='prosthetic').length,1)}await page.locator('#missing').selectOption('')}
 await page.locator('#replacement').selectOption('');await page.locator('#missing').selectOption('LeftHand');const lost=await observe('missing-hand',true);assert.equal(lost.views[0]!.parts.some(p=>p.owner==='LeftHand'&&p.role==='flesh'),false);assert.ok(lost.views[0]!.parts.some(p=>p.owner==='LeftForearm'&&p.role==='flesh'));await page.locator('#missing').selectOption('')
 for(const mode of ['walk','crouchWalk','attack','block','work','use','shoot','throw','crouchDown','stand','hurt','fall','sleep','rise','interact']){await page.locator('#motion').selectOption(mode);await page.locator('#phase').fill('500');await observe('mode-'+mode,true)}
 await page.locator('#motion').selectOption('walk');await page.locator('#play').click()
 for(const speed of ['0','0.5','1','2']){await page.locator('#speed').selectOption(speed);const before=await observe('speed-'+speed+'-before');await page.waitForTimeout(500);const after=await observe('speed-'+speed+'-after',true);if(speed==='0')assert.deepEqual(after.controls.root,before.controls.root);else assert.notDeepEqual(after.controls.root,before.controls.root)}
 await page.setViewportSize({width:390,height:844});await observe('narrow',true);assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({diagnosticOnly:true,wholeStateEvidence:false,rows,errors}));console.log(JSON.stringify({observations:rows.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),String(error)+'\n'+await page.locator('body').innerText());throw error}finally{await browser.close()}
