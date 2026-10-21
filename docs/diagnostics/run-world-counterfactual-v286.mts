import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {join} from 'node:path'
const frozen='/workspace/.ashveil-checkpoints/v286-final',out='/workspace/ashveil/test-results/sim-v286-counterfactual';mkdirSync(out,{recursive:true})
const baseline=JSON.parse(readFileSync('/workspace/ashveil/docs/sim-latest.json','utf8')),actual=JSON.parse(readFileSync('/workspace/ashveil/test-results/sim-v286/summary.json','utf8')),seeds=actual.rows.filter((r:any)=>JSON.stringify(r)!==JSON.stringify(baseline.rows.find((o:any)=>o.seed===r.seed))).map((r:any)=>r.seed)
let source=readFileSync(frozen+'/tools/sim.ts','utf8');const originalSha=createHash('sha256').update(source).digest('hex')
source=source.replace(/from '\.\.\//g,`from '${frozen}/`).replace("from './loadContent'",`from '${frozen}/tools/loadContent'`)
source=source.replace('const { db, report } = loadDb()',`const loaded=loadDb(),report=loaded.report,originalDb=loaded.db;\n// Read-only counterfactual DB view suppresses ONLY the new optional door placement.\nconst db=new Proxy(originalDb,{get(t,p){if(p==='tryGet')return(id:string)=>id==='Terrain.RustedDoorClosed'?undefined:t.tryGet(id);const x=Reflect.get(t,p,t);return typeof x==='function'?x.bind(t):x}})`)
source=source.replace('const seed = `sim-${i + seedStart}`',`const seed=JSON.parse(process.env.ASHVEIL_AUDIT_SEEDS!)[i]`)
if(!source.includes('ASHVEIL_AUDIT_SEEDS')||!source.includes('new Proxy(originalDb'))throw Error('diagnostic source replacement missing')
const script=out+'/source.mts';writeFileSync(script,source)
const workers=4,groups=Array.from({length:workers},(_,i)=>seeds.filter((_:any,j:number)=>j%workers===i)),start=performance.now()
await Promise.all(groups.map((group,i)=>new Promise<void>((done,fail)=>{const child=spawn(process.execPath,['--import','tsx',script,String(group.length),'3','0','--json',join(out,`group-${i}.json`),'--world'],{cwd:frozen,env:{...process.env,ASHVEIL_AUDIT_SEEDS:JSON.stringify(group)},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',fail);child.on('exit',code=>{writeFileSync(join(out,`group-${i}.log`),log);code===0?done():fail(Error(log));console.log('counterfactual group',i,'complete',group)})})))
const rows=groups.flatMap((_,i)=>JSON.parse(readFileSync(join(out,`group-${i}.json`),'utf8')).rows),results=rows.map((r:any)=>({seed:r.seed,wholeResultRowExact284:JSON.stringify(r)===JSON.stringify(baseline.rows.find((o:any)=>o.seed===r.seed))}))
const result={mode:'readonly DB counterfactual skips ONLY new optional door placement; original frozen286 sim.ts and all other production code unchanged',originalSimSha256:originalSha,seeds,workers,seconds:(performance.now()-start)/1000,rows,results,allAffectedWholeResultRowsExact284:results.every((r:any)=>r.wholeResultRowExact284)};writeFileSync(join(out,'summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({seconds:result.seconds,seeds,results}));if(!result.allAffectedWholeResultRowsExact284)throw Error('remaining differences need further causal audit')
