import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdirSync,readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import type {World} from '../../src/core/ctx'
const out=process.argv[2]??'test-results/aquatic-visual-browser',saved=JSON.parse(readFileSync(process.argv[3],'utf8')) as World['s'];mkdirSync(out,{recursive:true})
const server=spawn('npx',['vite','preview','--port','4317','--strictPort'],{stdio:'pipe',detached:true});await new Promise(r=>setTimeout(r,2500))
const browser=await chromium.launch({executablePath:'/workspace/.ashveil-tools/chromium',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']}),errors:string[]=[]
type Hook={__ashveil:{world():World}}
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
try{
 await page.goto('http://localhost:4317/?debug');await page.click('[data-testid=start]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate(s=>((window as unknown as Hook).__ashveil.world().s = s),saved);await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(4000);let state=await page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)));assert.deepEqual(state,saved);await page.screenshot({path:`${out}/370-resolved-real-pending-rescue-save-renders-after-native-continue-and-font-ready.png`})
 await page.getByRole('button',{name:'타이틀',exact:true}).click();await page.reload();await page.click('[data-testid=continue]');await page.waitForSelector('[data-testid=map] canvas');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(4000);state=await page.evaluate(()=>JSON.parse(JSON.stringify((window as unknown as Hook).__ashveil.world().s)));assert.deepEqual(state,saved);await page.screenshot({path:`${out}/371-same-resolved-real-rescue-renders-after-second-whole-native-continue.png`});assert.deepEqual(errors,[]);console.log('OK: two native continued exact resolved-rescue Save57 states/fonts ready/unchanged simulation clock/console0')
}finally{await browser.close();if(server.pid)process.kill(-server.pid,'SIGTERM')}
