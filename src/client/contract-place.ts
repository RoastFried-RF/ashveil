import type {RegionLayoutDef,RegionSiteDef,World} from '../core'
/** 의뢰서의 공개 주소를 콘텐츠 이름으로 표시한다. 원격 현장 상태를 읽지 않는다. */
export function contractPlace(w:World,region:string,mapId:string){
 const site=w.db.tryGet<RegionSiteDef>(region),name=site?.defType==='RegionSite'?site.label:'알려진 지역',root=site?.layout?w.db.tryGet<RegionLayoutDef>(site.layout):undefined,sub=root?.submaps?.find(s=>s.mapId===mapId),layout=sub?w.db.tryGet<RegionLayoutDef>(sub.layout):root?.mapId===mapId?root:undefined
 const floor=/^crypt([1-3])$/.exec(mapId),map=layout?.defType==='RegionLayout'?layout.label:mapId==='surface'?'지상':floor?`지하 ${floor[1]}층`:'알려진 현장'
 return name+' / '+map
}
