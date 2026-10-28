// Actual browser Canvas2D compositing of the production helper, with independent pixel expectations.
import { chromium } from 'playwright-core'
import ts from 'typescript'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out=process.argv[2];if(!out||existsSync(out))throw Error('Fresh output directory required')
mkdirSync(out,{recursive:true})
const source=readFileSync('src/client/render/projected-fog.ts','utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
writeFileSync(join(out,'production-helper.js'),compiled)
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
try{
 const page=await browser.newPage();await page.addScriptTag({content:'globalThis.__name=(fn)=>fn;{const exports={};'+compiled+';globalThis.projectFog=exports.projectVisibleFog;}'})
 const result=await page.evaluate(()=>{
  const source=document.createElement('canvas');source.width=5;source.height=1;const src=source.getContext('2d')!,pixels=src.createImageData(5,1)
  for(let x=0;x<5;x++)pixels.data.set([200,100,50,[255,0,128,255,0][x]],x*4)
  src.putImageData(pixels,0,0)
  const destination=document.createElement('canvas');destination.width=9;destination.height=3;const ctx=destination.getContext('2d')!
  const texture={frame:{x:1,y:0,width:3,height:1},source:{resource:source}},draw=(base:number,flip=false)=>{
   ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.clearRect(0,0,9,3);ctx.fillStyle='#040408';ctx.fillRect(0,0,9,3)
   const sprite={texture,x:flip?6:3,y:2,scale:{x:flip?-1:1,y:1},anchor:{x:0,y:1}}
   ;(globalThis as unknown as {projectFog(ctx:CanvasRenderingContext2D,sprite:unknown,alpha:number):void}).projectFog(ctx,sprite,base)
   return Array.from({length:9},(_,x)=>Array.from(ctx.getImageData(x,1,1,1).data))
  }
  return{day:draw(0),dark:draw(.4),flipped:draw(.4,true),opaque:draw(1)}
 })
 // Frame excludes source x0; target x3 is transparent, x4 is alpha128, x5 is opaque.
 assert.equal(result.day[3][3],255);assert.ok(Math.abs(result.day[4][3]-127)<=1);assert.equal(result.day[5][3],0)
 assert.equal(result.dark[3][3],255);assert.ok(Math.abs(result.dark[4][3]-(127+.4*128))<=2);assert.ok(Math.abs(result.dark[5][3]-102)<=1)
 assert.equal(result.flipped[5][3],255);assert.ok(Math.abs(result.flipped[4][3]-(127+.4*128))<=2);assert.ok(Math.abs(result.flipped[3][3]-102)<=1)
 assert.ok(result.opaque.every(pixel=>pixel[3]===255));assert.equal(result.day[2][3],255);assert.equal(result.day[6][3],255)
 for(const row of [result.dark[4],result.dark[5]])assert.ok(row[0]<=6&&row[1]<=6&&row[2]<=10)
 writeFileSync(join(out,'audit.json'),JSON.stringify({checks:14,result,limits:'Isolated actual Canvas2D helper test; no game state mutation, no simulation or native-scene substitute.'},null,2));console.log('PASS projected fog: 14 pixel/frame/anchor/flip/privacy checks')
}finally{await browser.close()}
