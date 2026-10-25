/** Verify every retained audit state; does not replay, repair or migrate its physical world. */
import {readdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {deserialize,serialize,stateHash} from '../src/core/save'
const root=process.argv[2],output=process.argv[3]
if(!root||!output||existsSync(output))throw Error('새 출력 경로가 필요하다: verify-world-saves-v388 <states-dir> <new-report.json>')
const files=readdirSync(root).filter(f=>/-initial\.json$|-final\.json$/.test(f)).sort(),rows=[]
assert.ok(files.length>0,'retained state files required')
for(const file of files){
 const raw=readFileSync(join(root,file),'utf8'),s=deserialize(raw),seed=file.replace(/-(initial|final)\.json$/,''),phase=file.includes('-initial.')?'initial':'final',expected=JSON.parse(readFileSync(join(root,seed+'-hashes.json'),'utf8'))
 assert.deepEqual(JSON.parse(serialize(s)),JSON.parse(raw),file+' full round-trip')
 assert.equal(stateHash(s),expected[phase+'Hash'],file+' original complete state hash')
 rows.push({file,hash:stateHash(s),turn:s.time/100})
}
writeFileSync(output,JSON.stringify({completeStateFiles:files.length,wholeRoundTripExact:true,originalHashesExact:true,rows},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({completeStateFiles:files.length,wholeRoundTripExact:true,originalHashesExact:true}))
