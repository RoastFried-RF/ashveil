/** Standalone public workbench bundles the exact game HumanView and unchanged atlas URLs. */
import {spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
mkdirSync('tools/art/human-preview-v389',{recursive:true})
writeFileSync('tools/art/human-preview-v389/index.html',readFileSync('tools/art/human-preview-v389.html','utf8').replace('src="./human-preview-v389.ts"','src="../human-preview-v389.ts"'))
for(const args of [['node_modules/vite/bin/vite.js','build','--config','tools/art/human-preview-v389/vite.config.ts'],['--import','tsx','tools/art/export-human-preview-v389.ts']]){const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1)}
