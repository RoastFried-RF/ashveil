// Native 검사가 자신이 띄운 동결 빌드만 사용하도록 한다. 이미 점유한 포트는 실패다.
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'

export async function startNativePreview(port=4317,root=process.cwd()){
 if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('잘못된 preview 포트')
 const child=spawn(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'preview','--port',String(port),'--strictPort'],{cwd:root,stdio:'pipe',detached:true})
 const stop=()=>{if(child.pid)try{if(process.platform==='win32')child.kill('SIGTERM');else process.kill(-child.pid,'SIGTERM')}catch{/* 이미 종료됨 */}}
 try{
  await new Promise<void>((done,fail)=>{
   let output='',finished=false
   const finish=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);if(error)fail(error);else done()}
   const timer=setTimeout(()=>finish(Error('자체 preview 시작 시간 초과: '+output)),10000)
   child.once('error',error=>finish(error));child.once('exit',code=>finish(Error('자체 preview 종료 '+code+': '+output)))
   child.stdout.on('data',chunk=>{output=(output+String(chunk)).slice(-8192);if(output.includes('localhost:'+port)||output.includes('127.0.0.1:'+port))finish()})
   child.stderr.on('data',chunk=>{output=(output+String(chunk)).slice(-8192)})
  })
  return{url:'http://localhost:'+port+'/?debug',stop}
 }catch(error){stop();throw error}
}
