// 이미 빌드한 현재 체크아웃을 자체 preview에서 검사하고 서버를 정리한다.
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {startNativePreview} from './native-preview'

const prefix=process.argv[2]
if(!prefix||process.argv.length>3)throw Error('사용법: pnpm game:preview-check 새출력경로접두사 (먼저 pnpm build)')
const server=await startNativePreview()
try{
 for(const[width,height]of [[1440,1080],[1366,768]])await new Promise<void>((done,fail)=>{
  const child=spawn(process.execPath,[resolve('tools/game-harness.mjs'),'--url',server.url,'--scenario','smoke','--width',String(width),'--height',String(height),'--out',resolve(prefix+'-'+width)],{stdio:'inherit'})
  child.once('error',fail);child.once('exit',(code,signal)=>code===0?done():fail(Error('브라우저 하네스 실패: '+(signal??code))))
 })
}finally{server.stop()}
