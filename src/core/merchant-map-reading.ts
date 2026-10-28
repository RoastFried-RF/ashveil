// 상인은 실제 자기 상점 곁에서 자기 시장의 원래 지도만 읽는다. 개인 지식은 자동 공개하지 않는다.
import {turnOf,type World} from './ctx'
import {marketFor} from './economy'
import {cheb} from './geom'
import {hasLos} from './fov'
import {cartographyDef,validMapDocument} from './cartography'
import {validWorldMapDocument} from './world-cartography'
import {noteReadingError,readNote} from './rumors'
import {rumorList} from './rumor-state'
import type {Creature,ItemInst} from './types'
import type {Action} from './actions'
export function merchantMapReadingError(w:World,c:Creature,uid:number):string|null{
 if(c.id===w.s.playerId||!w.s.creatures.includes(c)||c.mapId!==undefined&&c.mapId!==w.s.map.id)return '실제 현지 상인만 자기 시장 지도를 읽을 수 있다'
 const market=marketFor(w,c),paper=market?.items.find(i=>i.uid===uid)
 if(!cartographyDef(w).independent?.readMarketMaps||!market||market.mobile||c.traderSite!==w.s.overworld?.currentRegion||!c.home||cheb(c.pos,c.home)>1||!hasLos(w,c.pos,c.home)||c.activity||c.ai.route?.length)return '하던 일을 마치고 자기 정착지 상점 곁에 있어야 한다'
 if(!paper||paper.count!==1||paper.def!==cartographyDef(w).writing?.paper||paper.note?.kind!=='map'||!mapContent(w,paper))return '자기 시장의 원래 지도1장이 필요하다'
 const error=noteReadingError(w,c,paper);if(error)return error
 if(rumorList(w,c).some(r=>r.id===paper.note!.id&&(r.regionId??'Region.GreyCloister')===(paper.note!.regionId??'Region.GreyCloister')))return '이미 읽은 자기 상점 지도다'
 return null
}
function mapContent(w:World,paper:ItemInst):boolean{
 const r=paper.note;if(!r||!Number.isFinite(r.writtenAt)||r.writtenAt<0||r.writtenAt>turnOf(w))return false
 const local=r.mapDocument,world=r.worldMapDocument,m=w.s.overworld
 return !!(local&&validMapDocument(local)&&local.writtenAt<=turnOf(w)||world&&validWorldMapDocument(world)&&m&&world.worldSeed===w.s.seed&&world.w===m.w&&world.h===m.h&&world.writtenAt<=turnOf(w))
}
export function merchantMapReadingAction(w:World,c:Creature):Action|null{
 const paper=marketFor(w,c)?.items.find(i=>i.note?.kind==='map'&&(i.note.mapDocument||i.note.worldMapDocument)&&!merchantMapReadingError(w,c,i.uid))
 return paper?{type:'readMarketMap',uid:paper.uid}:null
}
export function readMerchantMap(w:World,c:Creature,uid:number):string|null{
 const error=merchantMapReadingError(w,c,uid);if(error)return error
 readNote(w,c,marketFor(w,c)!.items.find(i=>i.uid===uid)!);return null
}
