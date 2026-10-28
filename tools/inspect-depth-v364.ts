/** Load the unchanged archived result of23 actual route inputs; no post-load world edits. */
import {chromium} from 'playwright-core'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import assert from 'node:assert/strict'
import {stateHash,serialize,deserialize} from '../src/core/save'
import {startNativePreview} from './native-preview'
const out=resolve(process.argv[2]),initial=serialize(deserialize(readFileSync(process.argv[3],'utf8')));mkdirSync(out,{recursive:true})
const server=await startNativePreview(4386,process.argv[4]);let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined
try{
 browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await page.goto(server.url)
 await page.evaluate(initial=>{localStorage.setItem('ashveil.imprint.v1',initial);localStorage.setItem('ashveil.preferences.v1',JSON.stringify({animationSpeed:1,screenShake:false,torchFlicker:false,mapZoom:2}))},initial);await page.reload();await page.getByTestId('continue').click();await page.waitForSelector('[data-testid=map][data-ready=true] canvas');await page.getByRole('button',{name:'간략',exact:true}).click();await page.waitForTimeout(400)
 const actual=await page.evaluate(()=>{const h=window as unknown as{__ashveil:{world():{s:unknown}}};return h.__ashveil.world().s}) as Parameters<typeof serialize>[0]
 assert.equal(stateHash(actual),stateHash(deserialize(initial)));assert.deepEqual(JSON.parse(serialize(actual)),JSON.parse(initial));assert.deepEqual(errors,[]);await page.screenshot({path:join(out,'same-depth-player-readable.png')});writeFileSync(join(out,'audit.json'),JSON.stringify({source:'Unchanged archived actual route-end world',onlyTitleLoadAndBriefLogButton:true,noPostLoadWorldWrites:true,wholeHash:stateHash(actual),errors,scope:'Same-ground-depth rendering correction; no additional campaign or behavior simulation.'},null,2)+'\n');console.log(JSON.stringify({wholeHash:stateHash(actual),errors}))
}finally{await browser?.close();server.stop()}
