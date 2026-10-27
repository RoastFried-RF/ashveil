/** Gallery controls only: synthetic geometry evidence, no Core World or whole-state claim. */
import{chromium}from'playwright-core'
import assert from'node:assert/strict'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{join}from'node:path'
import type{HumanView}from'../src/client/render/human-view'
type View=NonNullable<ReturnType<HumanView['inspect']>>
type Data={ready:boolean;errors:string[];views:View[];surface:{parts:Record<string,{flesh:boolean;present:boolean}>};coreWorldCreated:boolean}
type Hook={inspect_human_preview():Data}
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors:string[]=[],rows:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
const face=['LeftEye','RightEye','Nose','Jaw','LeftEar','RightEar'],fingers=['Thumb','Index','Middle','Ring','Pinky'],toes=['Toe1','Toe2','Toe3','Toe4','Toe5']
const cases=[{name:'intact',missing:[]},{name:'left-thumb',missing:['LeftThumb']},{name:'left-index',missing:['LeftIndex']},{name:'right-pinky',missing:['RightPinky']},{name:'left-toe1',missing:['LeftToe1']},{name:'right-toe1',missing:['RightToe1']},{name:'left-all-toes',missing:toes.map(t=>'Left'+t)},{name:'right-all-fingers',missing:fingers.map(t=>'Right'+t)},{name:'face',missing:face},{name:'compound-roots',missing:['LeftUpperArm','RightShin','LeftIndex','RightToe1','Nose']},{name:'covered',missing:['LeftThumb','RightToe1']},{name:'skull',missing:['Skull']}]
async function read(){await page.waitForTimeout(45);const d=await page.evaluate(()=>(window as unknown as Hook).inspect_human_preview());assert.equal(d.coreWorldCreated,false);assert.deepEqual(d.errors,[]);for(const view of d.views)for(const side of['left','right']as const)assert.ok(Math.hypot(view.footSources[side].sole[0]-view.footProjection[side].actual[0],view.footSources[side].sole[1]-view.footProjection[side].actual[1])<1e-7);return d}
try{
 await page.goto(url);await page.waitForSelector('canvas[data-ready=true]');await page.locator('#play').click();await page.locator('#guides').uncheck();await page.locator('#scale').selectOption('12')
 for(const direction of['down','left','right','up']){
  await page.locator('#direction').selectOption(direction)
  for(const scene of cases){
   await page.locator('#head').selectOption('');await page.locator('#preset').selectOption('base');await page.locator('#missing').selectOption(scene.missing[0]??'');await page.locator('#missing-extra').selectOption(scene.missing.slice(1))
   if(scene.name==='covered')for(const id of['Item.Gloves','Item.Boots'])await page.locator('input[data-garment="'+id+'"]').check()
   const d=await read(),parts=d.views[0].parts,marks=parts.filter(p=>p.role==='loss-mark'),label=direction+'-'+scene.name
   if(scene.name==='intact')assert.equal(marks.length,0)
   if(['left-thumb','left-index','right-pinky'].includes(scene.name)){assert.deepEqual(marks.map(p=>p.owner),scene.missing);const parent=scene.missing[0].startsWith('Left')?'LeftHand':'RightHand';assert.deepEqual(parts.find(p=>p.owner===parent&&p.role==='flesh')!.losses,scene.missing)}
   if(scene.name==='face')assert.equal(marks.length,direction==='up'?0:direction==='down'?6:4)
   if(scene.name==='left-all-toes')assert.equal(marks.length,direction==='up'?0:direction==='right'?1:5)
   if(scene.name==='right-all-fingers')assert.equal(marks.length,5)
   if(scene.name==='covered')assert.equal(marks.length,0)
   if(scene.name==='compound-roots'){assert.ok(!parts.some(p=>p.owner.startsWith('Left')&&p.role==='loss-mark'));assert.ok(!parts.some(p=>p.owner.startsWith('RightToe')&&p.role==='loss-mark'));assert.ok(!parts.some(p=>['LeftUpperArm','LeftForearm','LeftHand','RightShin','RightFoot'].includes(p.owner)&&p.role==='flesh'))}
   if(scene.name==='skull'){assert.ok(parts.some(p=>p.owner==='Neck'&&p.role==='flesh'));assert.ok(!parts.some(p=>p.owner==='Skull'||p.role==='loss-mark'))}
   writeFileSync(join(out,label+'.json'),JSON.stringify(d));await page.locator('#stage').screenshot({path:join(out,label+'.png')});rows.push({label,marks:marks.map(p=>({owner:p.owner,source:p.source})),footSources:d.views[0].footSources})
  }
 }
 for(const role of['worker','healer','trader','guard','reaver'])for(const direction of['down','left','right']){
  await page.locator('#head').selectOption(role);await page.locator('#preset').selectOption('base');await page.locator('#direction').selectOption(direction);await page.locator('#missing').selectOption(face[0]);await page.locator('#missing-extra').selectOption(face.slice(1));const d=await read(),label=role+'-'+direction+'-face';assert.equal(d.views[0].parts.filter(p=>p.role==='loss-mark').length,direction==='down'?6:4);writeFileSync(join(out,label+'.json'),JSON.stringify(d));await page.locator('#stage').screenshot({path:join(out,label+'.png')});rows.push({label,marks:d.views[0].parts.filter(p=>p.role==='loss-mark')})
 }
 await page.setViewportSize({width:390,height:1000});await page.locator('#head').selectOption('');await page.locator('#missing').selectOption('LeftThumb');await page.locator('#missing-extra').selectOption(['RightToe1']);await page.locator('#direction').selectOption('down');await read();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(out,'390-controls.png')})
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({syntheticOnly:true,coreWorldCreated:false,wholeStateEvidence:false,rows,errors},null,2));console.log(JSON.stringify({observations:rows.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),String(error)+'\n'+await page.locator('body').innerText());throw error}finally{await browser.close()}
