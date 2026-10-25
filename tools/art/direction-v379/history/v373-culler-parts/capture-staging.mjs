import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const root='/workspace/.ashveil-planned/v373-culler-parts';
const {chromium}=createRequire('/workspace/ashveil/package.json')('playwright-core');
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1750,height:1080},deviceScaleFactor:1});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='v373.invalid'&&u.pathname==='/source.png')return route.fulfill({body:await fs.readFile(path.join(root,'originals/culler-front-parts-v1.png')),contentType:'image/png'});
  return route.abort();
 });
 await page.setContent((await fs.readFile(path.join(root,'review.html'),'utf8')).replaceAll('/source.png','https://v373.invalid/source.png'));
 await page.waitForFunction(()=>Array.from(document.images).every(im=>im.complete));
 await page.waitForTimeout(200);
 for(const id of ['chassis','driveUpper','driveLower','foot','scytheUpper','scytheBlade'])await page.locator(`#${id}`).screenshot({path:path.join(root,`diagnostics/${id}-source-review.png`)});
 await fs.writeFile(path.join(root,'diagnostics/browser-observation.json'),JSON.stringify({mainGameLoaded:false,sourceImageRequestsOnly:true,sourcePixelEdits:0,captureKind:'static source crop and SVG diagnostic annotations only',ids:['chassis','driveUpper','driveLower','foot','scytheUpper','scytheBlade']},null,2)+'\n');
}finally{await browser.close();await fs.writeFile(path.join(root,'diagnostics/own-lifecycle.json'),JSON.stringify({ownBrowserClosed:true,httpServerStarted:false,mainGameLoaded:false},null,2)+'\n');}
