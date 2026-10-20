import {describe,expect,it} from 'vitest'
import {gameObservation} from '../src/client/game-observation'
import {serialize} from '../src/core/save'
import {tileAt,type World} from '../src/core/ctx'
import {prisonerFixture} from './prisoner-fixture'

describe('개발 하네스의 읽기 전용 관찰',()=>{
 it('타이틀에서는 남은 세계나 숨은 생성 데이터를 조회하지 않는다',()=>{const unreadable={get s(){throw Error('세계 조회 금지')}}as unknown as World;expect(gameObservation(unreadable,'title')).toMatchObject({mode:'title',worldLoaded:true});expect(gameObservation(null,'game')).toMatchObject({mode:'title',worldLoaded:false})})
 it('반복 관찰은 실제 전체 상태·난수·시간·UID·각인을 바꾸지 않는다',()=>{const{w,p,target}=prisonerFixture();w.s.visible=[p.pos.y*w.s.map.w+p.pos.x,target.pos.y*w.s.map.w+target.pos.x];const before=serialize(w.s);for(let i=0;i<3;i++){const observation=gameObservation(w,'game');expect(observation).toMatchObject({mode:'game',timeTU:w.s.time,player:{pos:p.pos,hp:p.hp},visibleCreatures:[{id:target.id,pos:target.pos}]});expect(serialize(w.s)).toBe(before)}})
 it('미탐색 지형과 보이지 않는 생물의 이름·체력은 읽지 않는다',()=>{const{w,p,target}=prisonerFixture();const visible=p.pos.y*w.s.map.w+p.pos.x,hidden=target.pos.y*w.s.map.w+target.pos.x;w.s.visible=[visible];const tile=w.s.map.tiles[hidden];delete tile.seen;delete tile.observed;Object.defineProperty(tile,'t',{get(){throw Error('숨은 지형 조회')}});Object.defineProperty(target,'name',{get(){throw Error('숨은 이름 조회')}});Object.defineProperty(target,'hp',{get(){throw Error('숨은 체력 조회')}});expect(gameObservation(w,'game')).toMatchObject({map:{visibleTiles:[{x:p.pos.x,y:p.pos.y}]},visibleCreatures:[]})})
 it('보이는 닫힌 상자도 실제 내부 물품은 읽거나 공개하지 않는다',()=>{const{w,p}=prisonerFixture();w.s.visible=[p.pos.y*w.s.map.w+p.pos.x];const tile=tileAt(w,p.pos);tile.cont={kind:'chest',opened:false,get items():never{throw Error('닫힌 상자 내부 조회')}};const observation=gameObservation(w,'game');expect(observation).toMatchObject({map:{visibleTiles:[{container:{opened:false}}]}})})
})
