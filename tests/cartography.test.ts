import {describe,expect,it} from 'vitest'
import {cartographyFixture,cartographyNativeFixture,initialMapReport} from './cartography-fixture'
import {knownMapDocuments,mapClaims,validMapDocument,drawRoomDocument} from '../src/core/cartography'
import {writeNote,readNote} from '../src/core/rumors'
import {learnRumor} from '../src/core/rumor-state'
import {stateHash,serialize,deserialize} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {turnOf,tileAt,type World} from '../src/core/ctx'
import {updatePlayerVision,invalidateLights} from '../src/core/fov'
import {createCreature} from '../src/core/creatures'
import {makeItem} from '../src/core/items'
import {generateDungeon} from '../src/core/mapgen'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {beaconsFixture} from './beacons-fixture'
import {startBeaconSignal,beaconTick,rumorSignalKey} from '../src/core/beacons'
import {finishBase} from './base-camp-fixture'
describe('당시의 지도 주장과 실제 탐험의 기록',()=>{
 it('원래 지도를 가지고만 있으면 미방문층/문서 지식을 만들지 않는다',()=>{const d=cartographyNativeFixture('unread');expect(d.proof.actualTurns).toBe(0);expect(knownMapDocuments(d.w)).toEqual([]);expect(d.s.maps.crypt2).toBeUndefined()})
 it('원래 지도 쪽지를 실제1턴 읽어야 작성자/시점/신뢰도/오차/당시 위치를 배운다',()=>{const d=cartographyNativeFixture('read');expect(d.proof.actualTurns).toBe(1);expect(knownMapDocuments(d.w,'crypt2')).toMatchObject([{id:'initial-surveyor-map',document:{author:'이전 조사자',writtenAt:0,reliability:60,error:2,rooms:[{x:7,y:8}]}}]);expect(mapClaims(d.w,'crypt2')[0]).toMatchObject({status:'unverified',conflict:false});expect(d.p.bag.find(i=>i.uid===d.proof.noteUid)).toBeDefined();expect(d.s.maps.crypt2).toBeUndefined()})
 it('새 내용 조회는 전체 상태/난수/시각/미방문 지형을 만들지 않는다',()=>{const d=cartographyNativeFixture('read'),before=stateHash(d.s);for(let i=0;i<5;i++){knownMapDocuments(d.w);mapClaims(d.w,'crypt2')}expect(stateHash(d.s)).toBe(before)})
 it('서로 다른 위치를 그린 두 지도는 덮어쓰지 않고 두 주장에 충돌을 표시한다',()=>{const d=cartographyNativeFixture('conflict'),claims=mapClaims(d.w,'crypt2');expect(d.proof.actualTurns).toBe(2);expect(claims).toHaveLength(2);expect(claims.map(r=>r.x)).toEqual([7,12]);expect(claims.every(r=>r.conflict&&r.status==='unverified')).toBe(true)})
 it.each([['verified','verified'],['contradicted','contradicted']]as const)('실제 알려진 탐험 기록의 %s 증거가 지도보다 우선한다',(phase,status)=>{const d=cartographyNativeFixture(phase);expect(mapClaims(d.w,d.s.map.id,d.s.map)[0]!.status).toBe(status);expect(knownMapDocuments(d.w)[0]!.document).toEqual(d.proof.initialDocument)})
 it('아직 발견하지 않은 실제 방이나 원격 지형을 조회하여 거짓 지도를 판별하지 않는다',()=>{const d=cartographyNativeFixture('read'),unknown={...d.s.map,id:'crypt2',rooms:[{name:'서쪽 창고',type:'storage',x:15,y:8,w:5,h:4,discovered:false}]};expect(mapClaims(d.w,'crypt2',unknown)[0]!.status).toBe('unverified')})
 it('방 식별 기록이 없는 옛 지도는 다른 동명 방만 보고 거짓이라고 단정하지 않는다',()=>{const d=cartographyFixture(),r=initialMapReport(d.s.map.id);delete r.mapDocument!.rooms[0]!.roomIndex;learnRumor(d.w,d.p,r);d.s.map.rooms.push({name:'서쪽 창고',type:'storage',x:15,y:8,w:5,h:4,discovered:true});expect(mapClaims(d.w,d.s.map.id,d.s.map)[0]!.status).toBe('unverified')})
 it('원래 쪽지를 다시 읽거나 이후 원본을 바꾸어도 배운 당시 지도는 바꾸지 않는다',()=>{const d=cartographyNativeFixture('read'),before=JSON.stringify(d.s.knowledge);d.note.note!.mapDocument!.rooms[0]!.x=20;d.note.note!.mapDocument!.writtenAt=999;expect(readNote(d.w,d.p,d.note)).toBe(false);expect(JSON.stringify(d.s.knowledge)).toBe(before)})
 it('NPC가 읽은 지도는 개인 지식이며 플레이어에게 미방문층을 알려 주지 않는다',()=>{const d=cartographyFixture(),c=createCreature(d.w,'Creature.LanternResident',{x:1,y:1}),note=d.addReport(initialMapReport());d.s.creatures.push(c);readNote(d.w,c,note);expect(c.knownRumors).toHaveLength(1);expect(knownMapDocuments(d.w)).toEqual([])})
 it('일부가 누락된 빈 지도도 출처와 정확도를 가진 원본 문서로 남는다',()=>{const d=cartographyFixture(),report=initialMapReport();report.mapDocument!.rooms=[];learnRumor(d.w,d.p,report);expect(knownMapDocuments(d.w)).toHaveLength(1);expect(mapClaims(d.w,'crypt2')).toEqual([])})
 it('최초 실제 시야의 지형/시점을 기록하고 같은 시점 조회는 전체 상태가 같다',()=>{const d=cartographyFixture(),tile=tileAt(d.w,d.p.pos);expect(tile.observed).toMatchObject({terrain:'Terrain.Earth',at:turnOf(d.w)});const before=stateHash(d.s);updatePlayerVision(d.w,d.p);expect(stateHash(d.s)).toBe(before)})
 it('보이지 않는 곳의 현재 지형 변경은 마지막 관찰 기록을 덮어쓰지 않는다',()=>{const d=cartographyFixture(),old=tileAt(d.w,d.p.pos),snapshot=structuredClone(old.observed);d.p.pos={x:40,y:30};d.s.time+=100;old.t='Terrain.RuinWall';invalidateLights(d.w);updatePlayerVision(d.w,d.p);expect(old.observed).toEqual(snapshot)})
 it('맹인/잠든/실신한 사람의 시야 갱신은 새 시각 기록을 만들지 않는다',()=>{for(const mode of ['blind','sleep','unconscious']){const d=cartographyFixture(),t=tileAt(d.w,d.p.pos);delete t.observed;if(mode==='blind')d.p.body.missing=['LeftEye','RightEye'];if(mode==='sleep')d.p.asleep=true;if(mode==='unconscious')d.p.unconscious=true;updatePlayerVision(d.w,d.p);expect(t.observed,mode).toBeUndefined()}})
 it('실제 새 서가 쪽지는 원래 story 난수로 정한 단서를 유지하고 독립 지도 난수를 쓴다',()=>{const d=cartographyFixture(),map=generateDungeon(d.w,1).map,note=makeItem(d.w,'Item.Note');writeNote(d.w,note,map,'Terrain.Shelf');expect(note.note!.kind).toBe('room');expect(note.note!.mapDocument).toBeDefined();expect(validMapDocument(note.note!.mapDocument!)).toBe(true);expect(d.s.rng['items.cartography.'+note.uid]).toBeDefined();const before=stateHash(d.s);writeNote(d.w,note,map,'Terrain.Shelf');expect(stateHash(d.s)).toBe(before)})
 it('지도 그림의 오차/누락 난수는 world/body/story의 현재 흐름을 소비하지 않는다',()=>{const d=cartographyFixture(),r=initialMapReport();r.mapW=48;r.mapH=36;r.rect={x:7,y:8,w:5,h:4};const before=structuredClone(d.s.rng);drawRoomDocument(d.w,900,r);for(const key of ['world','body','story'])expect(d.s.rng[key]).toEqual(before[key])})
 it('실제 봉화는 원본 중첩 지도를 전송하며 늦게 받은 기록도 작성 시점을 갱신하지 않는다',()=>{const d=beaconsFixture(),r=initialMapReport();r.regionId=d.site.id;d.s.knowledge.rumors=[r];expect(startBeaconSignal(d.w,d.p,d.from.address.pos,d.from.address.uid,d.to.address,rumorSignalKey(r))).toBeNull();finishBase(d.w,d.p);d.s.time+=100*100;beaconTick(d.w);expect(d.to.state.inbox[0]!.rumor.mapDocument).toEqual(r.mapDocument);expect(d.to.state.inbox[0]!.rumor.writtenAt).toBe(0)})
 it('지도 획득 후 미완료19턴 저장 재개는 전체 몸/지식/관찰/난수가 같다',()=>{const d=cartographyNativeFixture('pending'),copy:World={db:d.w.db,s:deserialize(serialize(d.s))},at=d.s.time;runUntilInput(d.w);runUntilInput(copy);expect((d.s.time-at)/100).toBe(19);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)))})
 it('잘못된 지도 크기/오차/빈 방 경계는 화면에서 원격 진실로 사용하지 않는다',()=>{const d=cartographyFixture(),r=initialMapReport();r.mapDocument!.w=0;learnRumor(d.w,d.p,r);expect(knownMapDocuments(d.w)).toEqual([])})
 it('구형114의 옛 지도에 과거 관찰 시점/저자를 추정하지 않는다',()=>{const d=cartographyFixture(),raw=JSON.parse(serialize(d.s));raw.version=114;for(const t of raw.map.tiles)delete t.observed;const copy=deserialize(JSON.stringify(raw));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:114}).toEqual(raw);expect(copy.map.tiles.every(t=>t.observed===undefined)).toBe(true)})
 it('범위를 벗어난 지도 콘텐츠 설정은 모드 검증에서 거절한다',()=>{const id='bad-map',m=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Cartography.Hearth',path:'/noteError',value:6}]}],[id]);expect(m.report.errors.length).toBeGreaterThan(0)})
})
