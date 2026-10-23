import {expect,it} from 'vitest'
import {buildDiscoveryArchive} from '../src/core/discovery-archive'
import {bestiaryEntry} from '../src/core/bestiary-state'
import {newGame} from '../src/core/game'
import {buildReport} from '../src/core/report'
import {stateHash} from '../src/core/save'
import {formatExpeditionReport} from '../src/client/report-export'
import type {ItemDef,PillEffectDef} from '../src/core/types'
import {prisonerFixture} from './prisoner-fixture'
function fixture(){
 const {w,p}=prisonerFixture(),appearance=Object.keys(w.s.knowledge.pillMap)[0],truth=w.s.knowledge.pillMap[appearance],belief=w.db.all<PillEffectDef>('PillEffect').find(d=>d.id!==truth)!,book=w.db.all<ItemDef>('Item').find(d=>!!d.book)!
 w.s.knowledge.pillKnown={};w.s.knowledge.pillBeliefs={[appearance]:{belief:belief.id,confidence:'likely',ruledOut:[],evidence:[{turn:Math.floor(w.s.time/100),method:'examine',text:'당시 남긴 추정 기록'}]}}
 w.s.knowledge.bestiary={'Creature.BurrowRat':{seen:1,fought:0,killed:0,observeTurns:1,encounters:1,survived:false,specimen:{def:'Creature.BurrowRat',blood:999999,maxHp:{}}}}
 p.recipes=['Recipe.Bandage'];p.booksRead=[book.id];p.fieldNotes=[{key:'declared-observation',title:'원래 현장 기록',text:'당시 실제로 읽은 문구',turn:Math.floor(w.s.time/100),deviceUid:1}]
 const hidden=structuredClone(w.s.map);hidden.id='unknown';hidden.name='UNSEEN_SECRET';for(const tile of hidden.tiles)tile.seen=false;w.s.maps={unknown:hidden};w.s.overworld=undefined
 return{w,p,appearance,truth,belief,book}
}
it('archives what was actually believed without reading the secret pill table or exposing unseen map/specimen values',()=>{
 const {w,p,appearance,belief}=fixture(),before=stateHash(w.s),secret=w.s.knowledge.pillMap
 Object.defineProperty(w.s.knowledge,'pillMap',{configurable:true,enumerable:true,get(){throw Error('secret table must not be read')}})
 const archive=buildDiscoveryArchive(w,p)!
 Object.defineProperty(w.s.knowledge,'pillMap',{configurable:true,enumerable:true,writable:true,value:secret})
 expect(stateHash(w.s)).toBe(before);expect(archive.records.find(r=>r.kind==='identification'&&r.id===appearance)?.details[0]).toBe('당시 추정: '+belief.label)
 expect(archive.records.find(r=>r.kind==='bestiary')?.title).toBe(bestiaryEntry(w,'Creature.BurrowRat')!.silhouette);expect(JSON.stringify(archive)).not.toContain('999999');expect(JSON.stringify(archive)).not.toContain('UNSEEN_SECRET')
})
it('a report owns historical copies, exports its discoveries and leaves fresh character knowledge unchanged',()=>{
 const {w,p}=fixture(),baseline=stateHash(newGame(w.db,{seed:'archive-does-not-grant'})),before=stateHash(w.s),report=buildReport(w,p,'death','선언한 보고서 검사')
 expect(stateHash(w.s)).toBe(before);p.fieldNotes![0].text='현재 달라진 문구';p.recipes=[];expect(report.discoveries!.records.find(r=>r.kind==='fieldNote')!.details).toEqual(['당시 실제로 읽은 문구'])
 const exported=formatExpeditionReport({report,seed:w.s.seed});expect(exported).toContain('당시 추정');expect(exported).toContain('당시 실제로 읽은 문구');expect(exported).toContain('새 인물의 지식·능력·물품으로 옮기지 않는다');expect(stateHash(newGame(w.db,{seed:'archive-does-not-grant'}))).toBe(baseline)
 const legacy={...report};delete legacy.discoveries;expect(formatExpeditionReport({report:legacy,seed:w.s.seed})).not.toContain('발견·학습 기록')
})
it('reports the exact omitted count at its technical cap without changing source notes',()=>{
 const {w,p}=fixture();p.recipes=[];p.booksRead=[];p.fieldMaps=[];w.s.maps={};for(const t of w.s.map.tiles)t.seen=false;w.s.knowledge.bestiary={};w.s.knowledge.pillKnown={};w.s.knowledge.pillBeliefs={};w.s.knowledge.rumors=[];w.s.knowledge.interactions=[]
 p.fieldNotes=Array.from({length:1003},(_,i)=>({key:'note-'+i,title:'기록 '+i,text:'유한한 초기 기록',turn:0,deviceUid:i+1}));const before=stateHash(w.s),archive=buildDiscoveryArchive(w,p)!;expect(archive.records).toHaveLength(1000);expect(archive.omitted).toBe(3);expect(stateHash(w.s)).toBe(before)
})
