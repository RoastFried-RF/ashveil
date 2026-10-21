import {ref} from 'vue'
import {packagesFromFiles} from '../core/defs'
import {createModInstallation} from './mod-installation'
import {browserModDisk} from './mod-disk'
import {inspectModTextureImages} from './mod-texture-images'

const coreFiles=import.meta.glob('../content/**/*.json',{eager:true,query:'?raw',import:'default'})
const modFiles=import.meta.glob('../../mods/**/*.json',{eager:true,query:'?raw',import:'default'})
const scriptFiles=import.meta.glob('../../mods/**/scripts/**/*.js',{eager:true,query:'?raw',import:'default'})
const textureUrls=import.meta.glob('../../mods/**/textures/**/*.png',{eager:true,query:'?inline',import:'default'})
const textureFiles=Object.fromEntries(Object.entries(textureUrls).map(([path,url])=>{if(typeof url!=='string'||!url.startsWith('data:image/png;base64,'))throw Error('모드 PNG 인라인 원문이 필요하다: '+path);return[path,url.slice('data:image/png;base64,'.length)]}))
export const packages=packagesFromFiles({...coreFiles,...modFiles,...scriptFiles,...textureFiles})
export const packagesRevision=ref(0)
export const modInstallation=createModInstallation(packages,browserModDisk(),()=>{packagesRevision.value++},async db=>{
 await inspectModTextureImages(db.modTextures)
 if(db.scriptSources.length){const{attachQuickJSScripts}=await import('../scripting/attach');await attachQuickJSScripts(db)}
})
