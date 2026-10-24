import {ref} from 'vue'
const owners=new Set<object>()
export const mapAssetsLoading=ref(false)
export function setMapAssetsLoading(owner:object,active:boolean){if(active)owners.add(owner);else owners.delete(owner);mapAssetsLoading.value=owners.size>0}
