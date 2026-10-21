import {describe,expect,it} from 'vitest'
import {creatureSprite} from '../src/client/render/creature-sprite'
import {createCreature} from '../src/core/creatures'
import {loadMods} from '../src/core/defs'
import {serialize,deserialize} from '../src/core/save'
import {readPackages} from '../tools/loadContent'
import {prisonerFixture} from './prisoner-fixture'
function setup(def='Creature.Settler'){const d=prisonerFixture(),npc=createCreature(d.w,def,{x:23,y:20});d.s.creatures.push(npc);return{...d,npc}}
function aliases(value:unknown){return loadMods([...readPackages(),{manifest:{id:'appearance-test',name:'표시',version:'1',dependencies:['core']},defs:[],patches:[{op:'replace',target:'Creature.Settler',path:'/characterAliases',value}]}],['appearance-test'])}
describe('실제 개체/플레이어/옛 외형을 보존하는 주민 표시',()=>{
 it('새 주민과 저장된 hero 주민의 표시만 바꾸고 전체 세계/난수/UID는 조회 전후 같다',()=>{const d=setup();expect(d.npc.sprite).toBe('hero');const before=serialize(d.s);expect(creatureSprite(d.w,d.npc)).toBe('resident_worker');expect(serialize(d.s)).toBe(before)})
 it('현재각인195전체복원 뒤에도 기존선택문자열과현재표시가각각보존된다',()=>{const d=setup(),restored=deserialize(serialize(d.s)),copy={db:d.w.db,s:restored},npc=restored.creatures.find(c=>c.id===d.npc.id)!;expect(serialize(restored)).toBe(serialize(d.s));expect(npc.sprite).toBe('hero');expect(creatureSprite(copy,npc)).toBe('resident_worker');expect(serialize(restored)).toBe(serialize(d.s))})
 it('플레이어와약탈자·이미다른외형을선택한주민은그대로다',()=>{const d=setup(),old=d.target.sprite;expect(creatureSprite(d.w,d.p)).toBe('hero');expect(creatureSprite(d.w,d.target)).toBe(old);d.npc.sprite='shade0';const before=serialize(d.s);expect(creatureSprite(d.w,d.npc)).toBe('shade0');expect(serialize(d.s)).toBe(before)})
 it('의사와두간병인자손은같은저장선택에서의원원본을읽는다',()=>{for(const def of['Creature.SettlementDoctor','Creature.SignalistHealer','Creature.LanternHealer']){const d=setup(def),before=serialize(d.s);expect(d.npc.sprite).toBe('hero');expect(creatureSprite(d.w,d.npc)).toBe('resident_healer');expect(serialize(d.s)).toBe(before)}})
 it('경비와세자손도같은원래hero선택에서경비표시만읽는다',()=>{for(const def of['Creature.SettlementGuard','Creature.SignalistGuard','Creature.LanternGuard','Creature.ZeroVaultWarden']){const d=setup(def),before=serialize(d.s);expect(d.npc.sprite).toBe('hero');expect(creatureSprite(d.w,d.npc)).toBe('resident_guard');expect(serialize(d.s)).toBe(before)}})
 it('교역상과두상인자손도원래hero를보존하며상인외형을읽는다',()=>{for(const def of['Creature.SettlementTrader','Creature.SignalistMerchant','Creature.LanternMerchant']){const d=setup(def),before=serialize(d.s);expect(d.npc.sprite).toBe('hero');expect(creatureSprite(d.w,d.npc)).toBe('resident_trader');expect(serialize(d.s)).toBe(before)}})
 it('정착한옛떠돌이의기존hero는상속된주민외형으로바꾸지않는다',()=>{const d=setup('Creature.RetiredWanderer');expect(d.npc.sprite).toBe('hero');expect(creatureSprite(d.w,d.npc)).toBe('hero')})
 it('별칭은한단계만읽어순환/자기대응을반복하지않는다',()=>{const d=setup(),loaded=aliases({hero:'other',other:'hero'});expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;expect(creatureSprite(d.w,d.npc)).toBe('other');d.npc.sprite='other';expect(creatureSprite(d.w,d.npc)).toBe('hero')})
 it('현재DB대응이바뀌어도같은원래개체/몸/소지품/표시선택을재생성하지않는다',()=>{const d=setup(),before=serialize(d.s),loaded=aliases({hero:'hero'});expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;expect(creatureSprite(d.w,d.npc)).toBe('hero');expect(serialize(d.s)).toBe(before)})
 it('기존null삭제규약으로표시대응을제거하면원래외형을그대로쓴다',()=>{const d=setup(),loaded=aliases(null);expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;const before=serialize(d.s);expect(creatureSprite(d.w,d.npc)).toBe('hero');expect(serialize(d.s)).toBe(before)})
 it('잘못된구조와빈키/빈표시/숫자대응은로더가거절한다',()=>{for(const value of[[],1,'bad',{'':'hero'},{hero:''},{hero:1}])expect(aliases(value).report.errors.join('\n')).toContain('characterAliases')})
})
