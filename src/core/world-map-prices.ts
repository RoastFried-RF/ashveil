// 지도 가격은 공개된 문서 메타데이터로만 계산한다. 현재 지형/진위/플레이어 독서 여부는 가격의 근거가 아니다.
import {turnOf,type World} from './ctx'
import {cartographyDef} from './cartography'
import {validWorldMapDocument} from './world-cartography'
import type {ItemInst} from './types'
export function worldMapMarketValue(w:World,it:ItemInst):number|undefined{
 const rule=cartographyDef(w).worldPrices,d=it.note?.worldMapDocument,m=w.s.overworld
 if(!rule||it.def!==cartographyDef(w).writing?.paper||it.count!==1||it.note?.kind!=='map'||!d||!validWorldMapDocument(d)||!m||d.worldSeed!==w.s.seed||d.w!==m.w||d.h!==m.h||d.writtenAt>turnOf(w))return
 const cells=new Set(d.cells.map(c=>c.x+','+c.y)).size
 return Math.max(w.db.item(it.def).value??0,rule.basePrice+cells*rule.pricePerCell*d.reliability/100)
}
