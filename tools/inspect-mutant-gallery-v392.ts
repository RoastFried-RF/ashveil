/** Read-only synthetic actual HumanView models. Never creates a Core World. */
import{chromium}from'playwright-core'
import assert from'node:assert/strict'
import{mkdirSync,existsSync,writeFileSync}from'node:fs'
import{join}from'node:path'
const out=process.argv[2],url=process.argv[3];assert.ok(out&&url);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1100,height:1000}}),errors:string[]=[],rows:unknown[]=[]
const outfit=process.argv.find(arg=>arg.startsWith('--outfit='))?.slice(9)??'base';assert.ok(['base','traveler','guard'].includes(outfit));const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7)
const available=[['shade','shade0'],['shade','shade1'],['shade','shade2'],['shade',''],['shade','shade_chief'],['withered',''],['withered','priest'],['spore','spore0'],['spore','spore1'],...(process.argv.includes('--include-human')?[['human','']]:[])]
const models=only?available.filter(([body,head])=>only.split(',').includes(head||body)):available;assert.ok(models.length)
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 await page.goto(url);await page.waitForSelector('canvas[data-ready=true]');await page.locator('#play').click();await page.locator('#guides').uncheck();await page.locator('#scale').selectOption('12');await page.locator('#preset').selectOption(outfit)
 for(const[body,head]of models){await page.locator('#body').selectOption(body);await page.locator('#head').selectOption(head)
  for(const direction of['down','left','right','up']){await page.locator('#direction').selectOption(direction);await page.locator('#missing').selectOption('');await page.locator('#missing-extra').selectOption([]);await page.locator('#motion').selectOption('idle');await page.waitForTimeout(60)
   const data=await page.evaluate(()=>(window as unknown as{inspect_human_preview():{coreWorldCreated:boolean;errors:string[];views:{base:string;parts:{owner:string;role:string;source:string}[];footSources:Record<string,{sole:number[]}>;footProjection:Record<string,{actual:number[]}>}[]}}).inspect_human_preview());assert.equal(data.coreWorldCreated,false);assert.deepEqual(data.errors,[]);for(const view of data.views){assert.ok(view.base.includes(body));assert.equal(view.parts.filter(p=>p.role==='loss-mark').length,0);if(outfit!=='base')for(const owner of['Skull','Chest','LeftFoot','RightFoot'])assert.ok(view.parts.some(p=>p.owner===owner&&p.role==='clothing'),'actual clothing owner '+owner);for(const side of['left','right'])assert.ok(Math.hypot(view.footSources[side].sole[0]-view.footProjection[side].actual[0],view.footSources[side].sole[1]-view.footProjection[side].actual[1])<1e-7)}
   const name=body+'-'+(head||'base')+'-'+direction;writeFileSync(join(out,name+'.json'),JSON.stringify(data));await page.locator('#stage').screenshot({path:join(out,name+'.png')});rows.push({name,body,head,direction})
  }
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'audit.json'),JSON.stringify({syntheticOnly:true,coreWorldCreated:false,outfit,observations:rows.length,rows,errors},null,2));console.log(JSON.stringify({observations:rows.length,errors}))
}catch(e){await page.screenshot({path:join(out,'failure.png')});writeFileSync(join(out,'failure.txt'),String(e));throw e}finally{await browser.close()}
