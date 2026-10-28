import {writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {readPackages} from './loadContent'
import {simulateContent,validateSimulationOptions,type SimulationOptions} from './sim-run'

export function parseSimulationArgs(args:string[]){
 if(args[0]!=='run')throw Error('사용법: pnpm sim:run run --seed <시드> --days <일수> [--mods id ...] [--bots N] [--dungeon] [--background id] [--storyteller key] [--reroll 0|1] [--json] [--out 파일.json]')
 const options:SimulationOptions={seed:'',mods:[],days:3,bots:1,overworld:true,characterRoll:0},seen=new Set<string>();let json=false,out:string|undefined
 const value=(at:number)=>{const found=args[at+1];if(!found||found.startsWith('--'))throw Error(args[at]+' 값이 필요하다');return found}
 for(let at=1;at<args.length;at++){
  const arg=args[at];if(seen.has(arg))throw Error('겹치는 옵션: '+arg);seen.add(arg)
  if(arg==='--json'){json=true;continue}
  if(arg==='--dungeon'||arg==='--world'){if(seen.has(arg==='--world'?'--dungeon':'--world'))throw Error('월드/던전 모드를 동시에 지정할 수 없다');options.overworld=arg==='--world';continue}
  if(arg==='--mods'){const mods:string[]=[];while(args[at+1]&&!args[at+1].startsWith('--'))mods.push(...args[++at].split(','));if(!mods.length)throw Error('--mods 목록이 필요하다');options.mods=mods;continue}
  if(!['--seed','--days','--bots','--background','--storyteller','--reroll','--out'].includes(arg))throw Error('알 수 없는 옵션: '+arg)
  const selected=value(at);at++
  if(arg==='--seed')options.seed=selected
  else if(arg==='--days')options.days=Number(selected)
  else if(arg==='--bots')options.bots=Number(selected)
  else if(arg==='--background')options.background=selected
  else if(arg==='--storyteller')options.storyteller=selected
  else if(arg==='--reroll'){const n=Number(selected);if(n!==0&&n!==1)throw Error('재굴림은0 또는1이다');options.characterRoll=n}
  else out=selected
 }
 validateSimulationOptions(options);return{options,json,out}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),json=args.includes('--json')
 try{
  const parsed=parseSimulationArgs(args),result=await simulateContent(readPackages(),parsed.options),body=JSON.stringify(result,null,2)+'\n'
  if(parsed.out)try{writeFileSync(resolve(parsed.out),body,{flag:'wx'})}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw Error('이미 있는 시뮬레이션 보고서를 덮어쓰지 않는다: '+parsed.out,{cause:error});throw error}
  if(parsed.json)process.stdout.write(body)
  else{
   console.log('실제 콘텐츠: '+result.loadHash+' · 적용 '+result.mods?.map(mod=>mod.id+'@'+mod.version).join(' → '))
   for(const row of result.rows)console.log(row.seed+': '+row.cause+' · '+row.days.toFixed(6)+'일 · '+row.initialHash+' → '+row.hash)
   console.log('사인: '+JSON.stringify(result.causes)+' · 평균 '+result.averageDays.toFixed(6)+'일 · 사건 '+JSON.stringify(result.events))
   for(const warning of result.warnings)console.warn('경고: '+warning)
  }
 }catch(error){const message=(error as Error).message;console.error(json?JSON.stringify({error:message}):message);process.exitCode=1}
}
