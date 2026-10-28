/** Real owned child/HTTP checks. Node 24 can import this dependency-free TS helper. */
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
import {startNativePreview} from './native-preview.ts'

const out = process.argv[2] && resolve(process.argv[2])
assert.ok(out && !existsSync(out), 'Use a new assigned output directory')
mkdirSync(out, {recursive:true})
const rows = []
const live = pid => {try {process.kill(pid,0);return true} catch {return false}}
async function closed(pid) {for(let i=0;i<100&&live(pid);i++)await delay(20);assert.equal(live(pid),false,'Owned preview still alive')}
async function listen(server) {await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,done)});return server.address().port}
async function freePort() {const server=createServer();const port=await listen(server);await new Promise(done=>server.close(done));return port}
function fixture(name, colored=false) {
  const root=join(out,name),bin=join(root,'node_modules/vite/bin')
  mkdirSync(bin,{recursive:true})
  writeFileSync(join(root,'node_modules/vite/package.json'),'{"type":"commonjs"}')
  writeFileSync(join(bin,'vite.js'),`
const http=require('node:http'),fs=require('node:fs');
if(!process.argv.includes('--strictPort'))process.exit(2);
const port=Number(process.argv[process.argv.indexOf('--port')+1]);
fs.writeFileSync('pid.txt',String(process.pid));
const server=http.createServer((_req,res)=>res.end(${JSON.stringify(name)}));
server.once('error',()=>process.exit(1));
server.listen(port,()=>{
 if(${colored}){process.stdout.write('  \\x1b[32mLocal\\x1b[0m: http://localhost:\\x1b[1m');setTimeout(()=>process.stdout.write(port+'\\x1b[0m/\\n'),20)}
 else console.log('Local: http://localhost:'+port+'/');
});
`)
  return root
}

try {
  for (const colored of [false,true]) {
    const label=colored?'colored split output':'plain output',root=fixture(label,colored),port=await freePort()
    const server=await startNativePreview(port,root),pid=Number(readFileSync(join(root,'pid.txt'),'utf8'))
    try {assert.equal(await (await fetch(server.url)).text(),label)} finally {server.stop();await closed(pid)}
    rows.push({label,port,ownHTTPResponse:true,ownedProcessStopped:true})
  }
  const unrelated=createServer((_req,res)=>res.end('existing owner')),port=await listen(unrelated)
  try {
    const root=fixture('occupied port')
    await assert.rejects(startNativePreview(port,root),/자체 preview 종료/)
    assert.equal(await (await fetch('http://localhost:'+port)).text(),'existing owner')
    await closed(Number(readFileSync(join(root,'pid.txt'),'utf8')))
    rows.push({label:'occupied port',originalOwnerStillServing:true,failedChildStopped:true})
    const missing=join(out,'missing executable');mkdirSync(missing)
    await assert.rejects(startNativePreview(await freePort(),missing),/자체 preview 종료/)
    assert.equal(await (await fetch('http://localhost:'+port)).text(),'existing owner')
    rows.push({label:'missing Vite entry',rejected:true,originalOwnerStillServing:true})
  } finally {await new Promise(done=>unrelated.close(done))}
  writeFileSync(join(out,'audit.json'),JSON.stringify({status:'passed',rows},null,2))
  console.log(JSON.stringify({status:'passed',checks:rows.length}))
} catch(error) {
  writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),rows},null,2))
  throw error
}
