import {expect,it} from 'vitest'
import {capacity,addWound} from '../src/core/body'
import {createCreature} from '../src/core/creatures'
import {resolveAttack} from '../src/core/combat'
import {player} from '../src/core/ctx'
import {meleeWield} from '../src/core/items'
import {makeWorld} from './helpers'
it.each(['Creature.AshHound','Creature.AshHoundAlpha','Creature.BurrowRat'])('%s bites with its actual jaw, without acquiring imaginary hands',(id)=>{
 const w=makeWorld('actual-bite-capacity-'+id),p=player(w),c=createCreature(w,id,{x:20,y:20});p.pos={x:21,y:20};w.s.creatures=[p,c];c.equip={}
 expect(capacity(w,c,'manipulation')).toBe(0);expect(capacity(w,c,'bite')).toBeGreaterThan(.1);expect(meleeWield(w,c)?.atk.damageType).toBe('bite')
 p.asleep=true;for(let n=0;n<12&&!p.body.wounds.some(w=>w.def==='Wound.Bite');n++)resolveAttack(w,c,p)
 expect(p.body.wounds.some(w=>w.def==='Wound.Bite'&&w.sourceId===c.id)).toBe(true)
 const jaw=w.db.body(c.body.def).parts.find(p=>(p.capacities?.bite??0)>0)!
 addWound(w,c,{def:'Wound.Bruise',part:jaw.id,severity:c.body.maxHp[jaw.id]+1,source:'감사: 실제 턱 기능 상실'})
 expect(capacity(w,c,'bite')).toBe(0);expect(meleeWield(w,c)).toBeUndefined()
})

it('all loaded healthy natural attacks have the actual anatomy they require',()=>{
 const w=makeWorld('all-natural-capacities')
 for(const d of w.db.all<import('../src/core/types').CreatureDef>('Creature')){
  if(d.abstract)continue
  const c=createCreature(w,d.id,{x:20,y:20})
  for(const a of [d.naturalAttack,...d.naturalAttacks??[]])if(a?.requiresCapacity)expect(capacity(w,c,a.requiresCapacity),d.id+': '+a.label+' requires '+a.requiresCapacity).toBeGreaterThanOrEqual(.1)
 }
})
