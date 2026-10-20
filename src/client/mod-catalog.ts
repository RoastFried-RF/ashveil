import {ref} from 'vue'
import {packagesFromFiles} from '../core/defs'
import {createModInstallation} from './mod-installation'
import {browserModDisk} from './mod-disk'

const coreFiles=import.meta.glob('../content/**/*.json',{eager:true,query:'?raw',import:'default'})
const modFiles=import.meta.glob('../../mods/**/*.json',{eager:true,query:'?raw',import:'default'})
const scriptFiles=import.meta.glob('../../mods/**/scripts/**/*.js',{eager:true,query:'?raw',import:'default'})
export const packages=packagesFromFiles({...coreFiles,...modFiles,...scriptFiles})
export const packagesRevision=ref(0)
export const modInstallation=createModInstallation(packages,browserModDisk(),()=>{packagesRevision.value++},async db=>{
 if(db.scriptSources.length){const{attachQuickJSScripts}=await import('../scripting/attach');await attachQuickJSScripts(db)}
})
