import {expect,it} from 'vitest'
import {applyContentTransition} from '../src/core/content-transition'
import {contentChangeReview} from '../src/core/content-compatibility'
import {applyRecipeRenames,recipeRenamePlan} from '../src/core/recipe-renames'
import {activityStep} from '../src/core/actions'
import {startCraft} from '../src/core/crafting'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {recipeRenamesFixture,newRecipeId,oldRecipeId} from './recipe-renames-fixture'
it('reviews every supported current recipe reference without changing original state, identities, progress or historical text',()=>{
 const {s,current,p,worker}=recipeRenamesFixture();p.history.push({turn:Math.floor(s.time/100),kind:'treat',text:oldRecipeId});const before=serialize(s),plan=recipeRenamePlan(s,current)
 expect(plan.errors).toEqual([]);expect(plan.counts).toEqual({known:1,jobs:1,batches:0,orders:1,queued:1});expect(contentChangeReview(s,current)).toMatchObject({canContinue:true,renamedRecipes:[{from:oldRecipeId,to:newRecipeId}]});expect(serialize(s)).toBe(before)
 const expected=JSON.parse(before);expected.creatures.find((c:{id:number})=>c.id===p.id).recipes=[newRecipeId];expected.creatures.find((c:{id:number})=>c.id===p.id).workJob.recipe=newRecipeId;expected.map.baseCamp.tasks[worker.id].recipe=newRecipeId;expected.map.baseCamp.queues[worker.id][0].recipe=newRecipeId
 expect(applyRecipeRenames(s,current)).toBeNull();expect(JSON.parse(serialize(s))).toEqual(expected);expect(serialize(deserialize(serialize(s)))).toBe(serialize(s))
})
it('approved equal-contract rename resumes the original material-bound work and produces exactly one real output',()=>{
 const {w,s,p,cloth,current}=recipeRenamesFixture(),initial=cloth.count,total=p.workJob!.total;expect(applyContentTransition({db:current,s})).toBeNull();w.db=current
 expect(p.workJob).toMatchObject({recipe:newRecipeId,progress:1,total});expect(startCraft(w,p,newRecipeId,1)).toBeNull()
 const copy={db:current,s:deserialize(serialize(s))},other=copy.s.creatures.find(c=>c.id===p.id)!
 for(const[world,actor]of[[w,p],[copy,other]]as const)for(let n=0;actor.activity&&n<1000;n++)activityStep(world,actor)
 expect(stateHash(copy.s)).toBe(stateHash(s));expect(p.workJob).toBeUndefined();expect(p.bag.filter(i=>i.def==='Item.Bandage').reduce((n,i)=>n+i.count,0)).toBe(1);expect(cloth.count).toBe(initial-2);expect(s.achievementsDisabled).toBe(true)
})
it('rejects changed or absent original active-work rules atomically, and rejects unknown plugin references',()=>{
 for(const condition of ['changed','noRecord','plugin','duplicate']as const){
  const {s,p,current}=recipeRenamesFixture(condition==='changed')
  if(condition==='noRecord')delete s.contentRecipeContracts
  if(condition==='plugin')s.scriptState={hashes:{custom:'original-source'},mods:{custom:{recipe:oldRecipeId}},disabled:[],errors:[]}
  if(condition==='duplicate')p.recipes!.push(newRecipeId)
  const before=serialize(s);expect(applyRecipeRenames(s,current)).not.toBeNull();expect(serialize(s)).toBe(before);expect(contentChangeReview(s,current).canContinue).toBe(false)
 }
})
it('old saves without active batches may rename unstarted orders and knowledge but gain no progress or materials',()=>{
 const {s,p,current}=recipeRenamesFixture();delete s.contentRecipeContracts;p.workJob=undefined;const before=stateHash(s),plan=recipeRenamePlan(s,current);expect(plan.errors).toEqual([]);expect(stateHash(s)).toBe(before);expect(applyRecipeRenames(s,current)).toBeNull();expect(p.recipes).toEqual([newRecipeId]);expect(p.workJob).toBeUndefined()
})
