import {chromium} from 'playwright-core'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'

const input=process.argv[2],out=process.argv[3];if(!input||!out)throw Error('Specify catalogue HTML and fresh output directory')
mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium'}),page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[],network:string[]=[],rows:unknown[]=[]
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())})
try{
 // Earlier recorded runs proved managed Chromium blocks file URLs. Load exact
 // standalone bytes in a fresh blank page; avoid racing its policy error page.
 await page.setContent(readFileSync(input,'utf8'))
 await page.waitForFunction(()=>!!(window as unknown as {__artCatalogStats?:{ready:boolean}}).__artCatalogStats?.ready)
 let screenshots=0,rendered=0
 for(const[kind,total]of Object.entries({items:206,terrains:85,creatures:33,abilities:28,ui:26})){
  await page.locator('[data-kind="'+kind+'"]').click()
  for(let i=0;i<Math.ceil(total/48);i++){
   const canvases=await page.locator('.card canvas').evaluateAll(cs=>cs.map(c=>{const x=c as HTMLCanvasElement;return{width:x.width,height:x.height,nonempty:x.getContext('2d')!.getImageData(0,0,x.width,x.height).data.some((n,i)=>i%4===3&&n>0)}}))
   assert.ok(canvases.length&&canvases.every(c=>c.nonempty));rendered+=canvases.length;rows.push({kind,page:i,canvases})
   await page.screenshot({path:join(out,kind+'-'+i+'.png'),fullPage:true});screenshots++
   if(i+1<Math.ceil(total/48))await page.locator('#next').click()
  }
 }
 await page.locator('[data-kind=creatures]').click();await page.locator('#mode').selectOption('attack');await page.locator('#dir').selectOption('up');await page.locator('#animate').check();await page.waitForTimeout(350);await page.screenshot({path:join(out,'creatures-attack-up.png'),fullPage:true});screenshots++
 for(const mode of ['idle','walk','attack'])for(const dir of ['up','down','left','right']){await page.locator('#mode').selectOption(mode);await page.locator('#dir').selectOption(dir)}
 const selects=page.locator('.variant');for(let i=0;i<await selects.count();i++){const s=selects.nth(i),n=await s.locator('option').count();for(let j=0;j<n;j++)await s.selectOption({index:j})}
 await page.locator('#search').fill('굴쥐');assert.equal(await page.locator('.card').count(),1)
 await page.locator('#search').fill('no-matching-original-302');assert.equal(await page.locator('.card').count(),0)
 await page.setViewportSize({width:390,height:844});await page.locator('#search').fill('');await page.screenshot({path:join(out,'creatures-mobile.png'),fullPage:true});screenshots++
 assert.equal(rendered,378);assert.equal(screenshots,12);assert.deepEqual(errors,[]);assert.deepEqual(network,[])
 writeFileSync(join(out,'audit.json'),JSON.stringify({input,managedFileURLPolicyKnownBlocked:true,validationMethod:'Exact standalone HTML bytes loaded with setContent in a fresh blank page because prior recorded runs prove managed Chromium blocks file URLs. All embedded images load with zero HTTP requests. Direct file URL opening not validated in the final run.',rendered,screenshots,allNonempty:true,allDirectionsAndModes:true,allVariantOptionsSelected:true,errors,network,rows},null,2));console.log(JSON.stringify({rendered,screenshots,errors,network}))
}finally{await browser.close()}
