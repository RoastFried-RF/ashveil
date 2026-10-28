// 월드 지도도 당시 관찰이다. 조회/옛 seen 목록으로 현재 원격 지형을 공개하거나 과거 기록을 만들지 않는다.
import {capacity} from './body'
import {log,player,turnOf,type World} from './ctx'
import {cheb} from './geom'
import {revealWorld} from './overworld'
import {canObserveTerrain} from './fov'
import type {WorldCell,WorldObservation} from './types'
export function worldSurveyError(w:World,arrival=false):string|null{
 const p=player(w),m=w.s.overworld
 if(!m||w.s.map.kind!=='surface')return '지상의 세계 지도에서 주변을 살펴야 한다'
 if(!p.alive||p.asleep||p.unconscious||p.captivity||capacity(w,p,'consciousness')<.5||!canObserveTerrain(w,p))return '깨어서 실제 주변을 볼 수 있어야 한다'
 if(!arrival&&m.currentRegion&&!w.s.map.exits.some(pos=>cheb(p.pos,pos)<=1))return '지상 출입구 곁이나 바깥길에서 주변을 살펴야 한다'
 return null
}
export function surveyWorld(w:World):string|null{const error=worldSurveyError(w);if(error)return error;revealWorld(w.s.overworld!,turnOf(w),'survey');log(w,'info','주변 월드 지형을 실제로 살펴 당시 지도 기록을 갱신했다.');return null}
export function worldObservation(w:World,index:number):WorldObservation|undefined{
 const m=w.s.overworld,r=m?.worldObservations?.[index]
 return m&&Number.isSafeInteger(index)&&index>=0&&index<m.cells.length&&r&&Number.isFinite(r.at)&&r.at>=0&&r.at<=turnOf(w)?r:undefined
}
/** 경로 예상도 이미 기록한 지형만 사용한다. 모르는 칸을 현재 원격 값으로 메우지 않는다. */
export function worldWithRecordedTerrain(w:World):World{
 const m=w.s.overworld;if(!m)return w
 const unknown:WorldCell={altitude:0,temperature:0,veil:0,rain:0,biome:'Biome.Greymoor',sea:true,resources:{wood:0,herbs:0,ore:0,game:0,scrap:0}}
 return{db:w.db,s:{...w.s,overworld:{...m,cells:m.cells.map((_,i)=>{const o=worldObservation(w,i);return o?{...unknown,...o.cell}:unknown})}}}
}
