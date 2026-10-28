/** Export an isolated experiment. It does not alter sprites/Def/main artbook. */
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import ts from 'typescript'
const out=resolve(process.argv[2]??'/workspace/.ashveil-planned/v356-sower-rig-prototype/site')
mkdirSync(out,{recursive:true})
const original='tools/art/direction-v356/front-original/originals/sower-front-rig-components-v1.png'
const sha=createHash('sha256').update(readFileSync(original)).digest('hex')
if(sha!=='01c034f0dc67699cabc91b55798013446ddbb4fb281fbbdbcb452faa4153dff2')throw Error('원문 SHA 불일치')
copyFileSync(original,join(out,'sower-front-rig-components-v1.png'))
copyFileSync('tools/art/sower-rig-v356/index.html',join(out,'index.html'))
for(const [input,output]of [['src/client/render/articulated-gait.ts','articulated-gait.js'],['tools/art/sower-rig-v356/workbench.ts','workbench.js']]){
 const source=readFileSync(input,'utf8').replace("'../../../src/client/render/articulated-gait'","'./articulated-gait.js'")
 writeFileSync(join(out,output),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText)
}
writeFileSync(join(out,'provenance.json'),JSON.stringify({version:356,source:original,sha256:sha,uniqueSourceRegions:4,authoredWalkFrames:0,clientOnly:true,frontOnly:true,releaseApproved:false,activeGame:false},null,2)+'\n')
console.log(JSON.stringify({out,sha256:sha,regions:4,activeGame:false}))
