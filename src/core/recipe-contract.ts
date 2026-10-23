import {contentLoadHash} from './load-hash'
import type {RecipeDef} from './types'
/** Presentation/identity may change; every recorded mechanical field must remain equal. */
export function recipeContract(r:RecipeDef){
 return contentLoadHash(Object.fromEntries(Object.entries(r).filter(([key])=>!['id','label','description','parent'].includes(key))))
}
