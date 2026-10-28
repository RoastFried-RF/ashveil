import {describe,it,expect} from 'vitest'
import {mapFloorCommissionsFixture,mapFloorCommissionsNativeFixture} from './map-floor-commissions-fixture'
import {knownSurveyMaps,mapSurveyOffers} from '../src/core/map-commissions'
import {playerAct,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {generateDungeon} from '../src/core/mapgen'
import {player,type World} from '../src/core/ctx'
import {makeWorld} from './helpers'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
describe('실제 탐험 또는 읽은 지도에서 알게 된 던전 층 정찰 의뢰',()=>{
 it('원래 지도 쪽지를 들고만 있으면 그 층의 지도 의뢰를 게시하지 않는다',()=>{const d=mapFloorCommissionsNativeFixture('unread');expect(d.proof.actualTurns).toBe(0);expect(d.floorOffer()).toBeUndefined();expect(d.s.maps.crypt2).toBeUndefined();expect(knownSurveyMaps(d.w).some(x=>x.mapId==='crypt2')).toBe(false)})
 it('원래 쪽지를 실제1턴 읽으면 명시된 지역/층만 의뢰에 넣고 미방문 지형은 만들지 않는다',()=>{const d=mapFloorCommissionsNativeFixture('read');expect(d.proof.actualTurns).toBe(1);expect(d.floorOffer()).toMatchObject({region:'Region.GreyCloister',mapId:'crypt2'});expect(d.floorOffer()!.label).toContain('지하 2층');expect(d.s.maps.crypt2).toBeUndefined();expect(d.s.overworld!.scenes['Region.GreyCloister']!.maps.crypt2).toBeUndefined()})
 it('신뢰도 낮은 지도라도 알려진 층의 의뢰일 뿐 실제 정답을 원격 조회하지 않는다',()=>{const d=mapFloorCommissionsFixture();d.report.note!.mapDocument!.reliability=1;d.report.note!.mapDocument!.rooms=[];d.act({type:'read',uid:d.report.uid});expect(d.floorOffer()).toBeDefined();expect(d.s.maps.crypt2).toBeUndefined()})
 it('새 층 목록·의뢰 조회는 전체 상태와 난수와 세계 시간을 바꾸지 않는다',()=>{const d=mapFloorCommissionsNativeFixture('read'),before=stateHash(d.s);for(let i=0;i<5;i++){knownSurveyMaps(d.w);mapSurveyOffers(d.w,d.p,d.trader)}expect(stateHash(d.s)).toBe(before)})
 it('실제 계단 입력으로 탐험한 층도 자신의 알려진 목록에 넣는다',()=>{const w=makeWorld('survey-entered-floor','Bg.Hunter',true),p=player(w),link=w.s.map.links.find(l=>l.to==='crypt1')!;p.pos={...link.pos};p.nextAct=w.s.time;expect(playerAct(w,{type:'stairs'})).toBeNull();expect(w.s.map.id).toBe('crypt1');expect(knownSurveyMaps(w).some(x=>x.region==='Region.GreyCloister'&&x.mapId==='crypt1')).toBe(true);expect(knownSurveyMaps(w).some(x=>x.mapId==='crypt3')).toBe(false)})
 it('캐시에만 미리 생성되어 있고 보지 못한 층은 탐험한 것으로 취급하지 않는다',()=>{const d=mapFloorCommissionsFixture(),map=generateDungeon(d.w,3).map;for(const t of map.tiles)t.seen=false;for(const r of map.rooms)r.discovered=false;d.s.maps.crypt3=map;const before=stateHash(d.s);expect(knownSurveyMaps(d.w).some(x=>x.mapId==='crypt3')).toBe(false);expect(stateHash(d.s)).toBe(before)})
 it('같은 지도 문서를 다시 읽거나 같은 층의 사본이 있어도 같은 지역/층 의뢰는 하나다',()=>{const d=mapFloorCommissionsNativeFixture('read');d.s.knowledge.rumors!.push({...structuredClone(d.report.note!),id:'second-same-floor'});expect(mapSurveyOffers(d.w,d.p,d.trader).filter(x=>x.region==='Region.GreyCloister'&&x.mapId==='crypt2')).toHaveLength(1)})
 it('층 보수는 같은 지역 지상 보수에 콘텐츠의 깊이 보수만 더한다',()=>{const d=mapFloorCommissionsNativeFixture('read'),all=mapSurveyOffers(d.w,d.p,d.trader),surface=all.find(x=>x.region==='Region.GreyCloister'&&x.mapId==='surface')!,floor=d.floorOffer()!;expect(floor.reward-surface.reward).toBe(20);expect(floor.deadlineTurns).toBe(surface.deadlineTurns)})
 it('실제2턴 읽기/수락은 해당 층을 묶고 원래 시장 보수를 예치한다',()=>{const d=mapFloorCommissionsNativeFixture('accepted'),r=d.s.overworld!.contracts!.find(r=>r.id===d.proof.contractId)!;expect(d.proof.actualTurns).toBe(2);expect(r).toMatchObject({kind:'surveyMap',region:'Region.GreyCloister',mapId:'crypt2',escrow:d.proof.reward});expect(d.p.money).toBe(d.proof.initialMoney);expect(d.market.money).toBe(d.proof.initialBank-d.proof.reward!);expect(d.s.maps.crypt2).toBeUndefined();expect(d.report.note!.mapDocument).toEqual(d.proof.originalDocument)})
 it('미완료 휴식 저장 후19턴을 더 진행해도 예치금과 원본/미방문 층이 전체 같다',()=>{const d=mapFloorCommissionsNativeFixture('pending'),copy:World={db:d.w.db,s:deserialize(serialize(d.s))},at=d.s.time;runUntilInput(d.w);runUntilInput(copy);expect((d.s.time-at)/100).toBe(19);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.s.maps.crypt2).toBeUndefined()})
 it('구형117에는 알려지지 않은 과거 층/의뢰를 추정하지 않는다',()=>{const d=mapFloorCommissionsFixture(),old=JSON.parse(serialize(d.s));old.version=117;const restored=deserialize(JSON.stringify(old));expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:117}).toEqual(old)})
 it('잘못된 층 보수는 모드 검사에서 거절한다',()=>{const id='bad-map-depth',m=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Cartography.Hearth',path:'/commission/depthReward',value:-1}]}],[id]);expect(m.report.errors.length).toBeGreaterThan(0)})
})
