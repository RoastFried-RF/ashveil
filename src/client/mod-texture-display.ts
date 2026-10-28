import {shallowRef} from 'vue'
// 현재 승인된 World의 불변 DB 스냅샷만 읽는다. 설치 후보는 화면에 노출하지 않는다.
const active=shallowRef<Readonly<Record<string,string>>>({})
export function setDisplayedModTextures(textures:Readonly<Record<string,string>>){active.value=textures}
export function modTextureUrl(name:string):string|undefined{const source=active.value[name];return source===undefined?undefined:'data:image/png;base64,'+source}
