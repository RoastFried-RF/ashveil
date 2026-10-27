/** Synthetic current HumanView parts only. No Core World is created or edited. */
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HumanView } from '../src/client/render/human-view'
type View=NonNullable<ReturnType<HumanView['inspect']>>
type Data={coreWorldCreated:boolean;errors:string[];views:View[];catalog:{prosthetics:{id:string;targets:string[]}[]}}
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const bodies=(process.argv.find(a=>a.startsWith('--bodies='))?.slice(9)??'human').split(','),quick=process.argv.includes('--quick')
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1100,height:1000}}),errors:string[]=[],rows:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
let current='startup'
try{
 await page.goto(url);await page.waitForSelector('canvas[data-ready=true]');await page.locator('#play').click();await page.locator('#guides').uncheck();await page.locator('#scale').selectOption('12');await page.locator('#preset').selectOption('base')
 const catalog=(await page.evaluate(()=>(window as unknown as{inspect_human_preview():Data}).inspect_human_preview())).catalog
 for(const body of bodies){await page.locator('#body').selectOption(body)
  for(const model of catalog.prosthetics){
   const targets=quick?(model.id==='Prosthetic.GardenerLimb'?['LeftUpperArm','RightThigh']:[model.targets[0]]):model.targets
   await page.locator('#replacement').selectOption(model.id)
   for(const root of targets){await page.locator('#replacement-root').selectOption(root)
    for(const direction of ['down','left','right','up']){
     current=body+'-'+model.id.split('.')[1]+'-'+root+'-'+direction
     await page.locator('#direction').selectOption(direction);await page.locator('#motion').selectOption('idle');await page.locator('#missing').selectOption('');await page.locator('#missing-extra').selectOption([])
     const data=await page.evaluate(()=>(window as unknown as{inspect_human_preview():Data}).inspect_human_preview())
     assert.equal(data.coreWorldCreated,false);assert.deepEqual(data.errors,[])
     for(const view of data.views){
      const joints=view.prostheticJoints,eye=root.endsWith('Eye'),hidden=eye&&(direction==='up'||direction==='left'&&root.startsWith('Right')||direction==='right'&&root.startsWith('Left'))
      assert.equal(joints.length>0,!hidden,current+' visible owned hardware')
      for(const joint of joints){assert.ok(joint.source.startsWith('av394_'));assert.equal(joint.uid,900001);assert.ok(!view.parts.some(p=>p.owner===joint.owner&&p.role==='flesh'))}
      for(const side of ['Left','Right'])for(const chain of [['UpperArm','Forearm','Hand'],['Thigh','Shin','Foot']])for(let i=1;i<chain.length;i++){
       const previous=joints.find(j=>j.owner===side+chain[i-1]),next=joints.find(j=>j.owner===side+chain[i])
       if(previous&&next)assert.ok(Math.hypot(previous.b[0]-next.a[0],previous.b[1]-next.a[1])<1e-7,current+' joint pin continuity')
      }
      for(const joint of joints.filter(j=>j.solePinned)){const side=joint.owner.startsWith('Right')?'right':'left',ground=view.footProjection[side].actual;assert.ok(Math.hypot(joint.b[0]-ground[0],joint.b[1]-ground[1])<1e-7,current+' actual sole pin')}
     }
     writeFileSync(join(out,current+'.json'),JSON.stringify(data));await page.locator('#stage').screenshot({path:join(out,current+'.png')});rows.push({body,model:model.id,root,direction,joints:data.views[2].prostheticJoints})
    }
   }
  }
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({syntheticOnly:true,coreWorldCreated:false,authoredActionFrames:false,observations:rows.length,rows,errors},null,2));console.log(JSON.stringify({observations:rows.length,errors}))
}catch(error){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.json'),JSON.stringify({current,error:String(error),rows,errors},null,2));throw error}finally{await browser.close()}
