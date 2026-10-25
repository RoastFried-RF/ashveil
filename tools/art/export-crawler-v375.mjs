/** Parent invokes this public-viewer-only export after the shared implementation is frozen. */
import {spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
const r=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','tools/art/crawler-preview-v375/vite.config.ts'],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1)
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex'),path='public/sprites/original/direction-v375/crawler-parts-v372.png',sha256=hash(path)
if(sha256!=='d79e58402ddfe288399997088a83bd85ee08d171e83b7dcfc342fdaf49d29d2f')throw Error('Crawler original changed')
if(!readdirSync('public/artbook/crawler/assets').some(p=>p.endsWith('.png')&&hash('public/artbook/crawler/assets/'+p)===sha256))throw Error('Public original is missing')
writeFileSync('public/artbook/crawler/provenance.json',JSON.stringify({version:375,sourceOriginal:path,sha256,sourceOriginals:1,newOriginals:0,sourceRegions:6,authoredDirections:1,sharedDrawInstances:41,authoredFullBodyWalkFrames:0,viewSource:{path:'src/client/render/crawler-view.ts',sha256:hash('src/client/render/crawler-view.ts')},motionSource:{path:'src/client/render/crawler-motion.ts',sha256:hash('src/client/render/crawler-motion.ts')},scope:'Shared actual game display class, exact supplied interpolation root, 8body/16owned legs. Isolated DOM presentation only; not Core poison/AI/collision behavior or release approval. One dorsal source rotated/reflected; source contacts and hidden joint axes are inferred.'},null,2)+'\n')
