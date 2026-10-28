import {describe,it,expect} from 'vitest'
import {rumorNetworkFixture} from './rumor-network-fixture'
import {rumorConnections,postRumor,rumorNetworkTick} from '../src/core/rumor-network'
import {worldRoute} from '../src/core/overworld'
import {turnOf,TURNS_PER_DAY} from '../src/core/ctx'
import {stateHash,serialize,deserialize} from '../src/core/save'
function topology(){
 const d=rumorNetworkFixture(),others=d.m.sites.filter(s=>s.kind==='settlement'&&s.id!==d.site&&d.m.simulation!.settlements[s.id]).slice(0,2),source=d.m.sites.find(s=>s.id===d.site)!,land=d.m.cells.find(c=>!c.sea)!
 // 합성 단위 검사 지형이다. 원래 생성된 세계/실제 여행이라고 주장하지 않는다.
 d.m.w=7;d.m.h=5;d.m.cells=Array.from({length:35},()=>({...structuredClone(land),sea:false,road:false}));source.cell={x:1,y:1};others[0]!.cell={x:5,y:1};others[1]!.cell={x:1,y:3};d.m.sites=[source,...others];d.m.position={...source.cell}
 return{...d,source,target:others[0]!,near:others[1]!}
}
describe('실제 육로로 잇는 공개 소식 그래프',()=>{
 it('바다가 끊은 정착지는 월드 직선 거리가 가까워도 연결/전송하지 않는다',()=>{const d=topology();for(let y=0;y<5;y++)d.m.cells[y*7+3]!.sea=true;expect(worldRoute(d.w,d.source.cell,d.target.cell)).toBeNull();const before=stateHash(d.s);expect(rumorConnections(d.w,d.site)).toEqual([{site:d.near.id,distance:2}]);expect(stateHash(d.s)).toBe(before);postRumor(d.w,d.p,d.keeper,d.report.id);expect(d.m.rumorNetwork!.pending.map(p=>p.to)).toEqual([d.near.id])})
 it('바다를 돌아가는 육로의 실제 칸 수로 지연을 계산한다',()=>{const d=topology();for(let y=0;y<4;y++)d.m.cells[y*7+3]!.sea=true;const route=worldRoute(d.w,d.source.cell,d.target.cell)!;expect(route.cells).toHaveLength(10);expect(rumorConnections(d.w,d.site)).toContainEqual({site:d.target.id,distance:10});const at=turnOf(d.w);postRumor(d.w,d.p,d.keeper,d.report.id);const packet=d.m.rumorNetwork!.pending.find(p=>p.to===d.target.id)!;expect(packet.due-at).toBeGreaterThanOrEqual((10/6.4+.5)*TURNS_PER_DAY);expect(packet.due-at).toBeLessThanOrEqual(Math.ceil((10/6.4+2)*TURNS_PER_DAY))})
 it('육로가 없는 섬에서도 현지 게시1회는 가능하지만 가상 선박/소식은 생기지 않는다',()=>{const d=topology();for(const pos of[{x:0,y:1},{x:2,y:1},{x:1,y:0},{x:1,y:2}])d.m.cells[pos.y*7+pos.x]!.sea=true;const boats=structuredClone(d.s.map.vessel);expect(postRumor(d.w,d.p,d.keeper,d.report.id)).toBeNull();expect(d.m.rumorNetwork!.towns[d.site]).toHaveLength(1);expect(d.m.rumorNetwork!.pending).toEqual([]);expect(d.s.map.vessel).toEqual(boats)})
 it('조회는 미방문 지역/탐험/난수/시간/캐러밴을 만들지 않는다',()=>{const d=rumorNetworkFixture(),before=serialize(d.s);for(let i=0;i<3;i++)rumorConnections(d.w,d.site);expect(serialize(d.s)).toBe(before)})
 it('기존 대기 소식의 예정시각/내용을 새 경로로 소급 계산하지 않는다',()=>{const d=topology();postRumor(d.w,d.p,d.keeper,d.report.id);const prior=structuredClone(d.m.rumorNetwork!.pending);for(let y=0;y<5;y++)d.m.cells[y*7+3]!.sea=true;expect(rumorConnections(d.w,d.site).some(r=>r.site===d.target.id)).toBe(false);expect(d.m.rumorNetwork!.pending).toEqual(prior);const restored={db:d.w.db,s:deserialize(serialize(d.s))};expect(restored.s.overworld!.rumorNetwork!.pending).toEqual(prior);rumorNetworkTick(d.w);rumorNetworkTick(restored);expect(serialize(restored.s)).toBe(serialize(d.s));const ordered=(xs:typeof prior)=>xs.slice().sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);expect(ordered(restored.s.overworld!.rumorNetwork!.pending)).toEqual(ordered(prior))})
})
