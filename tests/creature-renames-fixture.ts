import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{player,isPassable,creatureAt}from'../src/core/ctx'
import{cheb}from'../src/core/geom'
import{createCreature}from'../src/core/creatures'
import{updatePlayerVision}from'../src/core/fov'
import{observeBestiary}from'../src/core/bestiary'
import type{BodyDef}from'../src/core/types'
export const oldCreatureId='SampleMigration.Creature.OldRat',newCreatureId='SampleMigration.Creature.RenamedRat'
/** 실제 이전 모듈/정상 세계·선언된 초기 배치/현재 관찰만 사용한다. 과거 생성/전투를 주장하지 않는다. */
export function creatureRenamesFixture(bodyMismatch=false){
 const packages=readPackages(),current=loadMods(packages,['sample-creature-renames']),oldPackages=readPackages(),old=oldPackages.find(x=>x.manifest.id==='sample-creature-renames')!;old.manifest.version='0.9.0';delete old.renames
 const def=old.defs.find(x=>x.id===newCreatureId)!;def.id=oldCreatureId;if(bodyMismatch)Object.assign(def,{body:current.db.all<BodyDef>('Body').find(x=>x.kind==='humanoid')!.id});Object.assign(old.defs.find(x=>x.defType==='BestiaryEntry')!,{creatures:[oldCreatureId]})
 const loaded=loadMods(oldPackages,['sample-creature-renames']);if(loaded.report.errors.length||current.report.errors.length)throw Error([...loaded.report.errors,...current.report.errors].join('\n'))
 const w={db:loaded.db,s:newGame(loaded.db,{seed:'actual-creature-identity-renames',overworld:true})};runUntilInput(w);const p=player(w),pos=w.s.visible.map(i=>({x:i%w.s.map.w,y:Math.floor(i/w.s.map.w)})).filter(pos=>cheb(pos,p.pos)>=1&&cheb(pos,p.pos)<=2&&isPassable(w,pos)&&!creatureAt(w,pos)).sort((a,b)=>cheb(a,p.pos)-cheb(b,p.pos)||a.y-b.y||a.x-b.x)[0]
 if(!pos)throw Error('실제 빈 현재 관찰 칸이 필요하다');const creature=createCreature(w,oldCreatureId,pos,'기록된 원래 굴쥐');w.s.creatures.push(creature);updatePlayerVision(w,p);observeBestiary(w,false);return{w,p,creature,current:current.db,packages,oldPackages}
}
