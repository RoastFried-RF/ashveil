import {configureScriptHost} from '../core/script-hooks'
import type {DefDatabase} from '../core/defs'
import {createQuickJSScriptHost} from './quickjs'
export async function attachQuickJSScripts(db:DefDatabase){
 if(!db.scriptSources.length)return
 const errors=configureScriptHost(db,await createQuickJSScriptHost())
 if(errors.length)throw Error(errors.join('\n'))
}
