import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {initializeStoryDirector,storyDirectorTick} from '../src/core/story-director'
import {playerAct,newGame} from '../src/core/game'
import {db} from './helpers'
import {updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize} from '../src/core/save'
import {type World} from '../src/core/ctx'
import type {Action} from '../src/core/actions'
export function storyDirectorFixture(persona='gradual'){
 const d=clinicalDiseaseFixture('story-director-actual',false);d.p.money=0
 initializeStoryDirector(d.w,persona)
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=s.creatures.find(c=>c.id===s.playerId)!,act=(action:Action,budget?:number)=>{const error=playerAct(w,action,budget);if(error)throw Error(error)}
 return{w,s,p,act,director:s.storyteller.director!,tick:()=>storyDirectorTick(w)}
}
export function storyDirectorNativeFixture(phase:'prepared'|'dispatched'|'pending'){
 for(let n=0;n<40;n++){
  const s=newGame(db,{seed:'director-ui-'+n,storyteller:'pursuit'}),w:World={db,s},at=35999*100
  s.time=at;s.weather='clear';s.weatherUntil=1e12;s.storyteller.lastEventTurn=0
  for(const c of s.creatures)c.nextAct=at
  const director=s.storyteller.director!;director.lastAt=35999;director.budgetTenths=540;s.storyteller.budget=54
  updatePlayerVision(w,s.creatures.find(c=>c.id===s.playerId)!)
  const candidate:World={db,s:deserialize(serialize(s))};const error=playerAct(candidate,{type:'wait'})
  if(error||candidate.s.storyteller.director!.lastMajorAt!==36000)continue
  const result=phase==='dispatched'?candidate:w
  if(phase==='pending'){const e=playerAct(result,{type:'rest',turns:20},1);if(e)throw Error(e)}
  return{w:result,proof:{phase,seed:s.seed,initialTime:at,declaredInitialBudget:54,initialBudgetIsNotPastIncomeClaim:true,originalCreatureIds:s.creatures.map(c=>c.id),originalNextId:s.nextId},director:result.s.storyteller.director!}
 }
 throw Error('actual default-rules strengthened patrol fixture unavailable')
}
