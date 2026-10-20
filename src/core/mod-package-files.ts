import type {ModManifest} from './defs'

export const MOD_PACKAGE_BYTES=8*1024*1024
export const MOD_PACKAGE_FILES=512
export function validInstallableModId(id:unknown):id is string{return typeof id==='string'&&id!=='core'&&/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(id)}
export function safeModFilePath(path:string):boolean{return!!path&&!path.startsWith('/')&&!/[\\:]/.test(path)&&![...path].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)&&!path.split('/').some(p=>!p||p==='.'||p==='..')}
/** CLI 배포와 브라우저 가져오기가 같은 콘텐츠 파일만 취급한다. */
export function supportedModFile(path:string,manifest:Pick<ModManifest,'scripts'>):boolean{
 return path==='manifest.json'||['README.md','LICENSE','LICENSE.md','LICENSE.txt'].includes(path)||/^(defs|patches)\/.+\.json$/.test(path)||path==='migrations/rename.json'||[1,2].includes(manifest.scripts?.stage??0)&&path===manifest.scripts?.entry&&/^scripts\/.+\.js$/.test(path)
}
