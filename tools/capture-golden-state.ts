// 골든 기대값은 고치지 않고, 검토할 실제 초기/최종 전체 상태를 별도 파일에 기록한다.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {loadDb} from './loadContent'
import {newGame} from '../src/core/game'
import {serialize,stateHash} from '../src/core/save'
import {replayOp,type GoldenVector} from './replay'

const output=process.argv[2]
if(!output)throw Error('출력 경로가 필요하다: pnpm exec tsx tools/capture-golden-state.ts test-results/새이름.json')
const target=resolve(output)
if(existsSync(target))throw Error('기존 결과를 덮어쓰지 않는다: '+target)
const{db,report}=loadDb();if(report.errors.length)throw Error(report.errors.join('\n'))
const vectors=['golden','world-golden'].flatMap(name=>JSON.parse(readFileSync('tests/fixtures/'+name+'.json','utf8')) as GoldenVector[])
const rows=vectors.map(vector=>{
 const w={db,s:newGame(db,{seed:vector.seed,background:vector.background,overworld:vector.overworld})},initial=JSON.parse(serialize(w.s)),initialHash=stateHash(w.s)
 const errors=vector.ops.map(op=>replayOp(w,op))
 return{name:vector.name,initial,initialHash,state:JSON.parse(serialize(w.s)),hash:stateHash(w.s),errors}
})
mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify(rows),'utf8')
console.log(JSON.stringify({output:target,vectors:rows.length,expectedFixturesUnchanged:true,rows:rows.map(row=>({name:row.name,initialHash:row.initialHash,hash:row.hash,commands:row.errors.length}))}))
