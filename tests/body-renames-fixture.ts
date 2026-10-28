import{readPackages}from'../tools/loadContent'
import{loadMods}from'../src/core/defs'
import{newGame,runUntilInput}from'../src/core/game'
import{player,isPassable,creatureAt}from'../src/core/ctx'
import{cheb}from'../src/core/geom'
import{createCreature}from'../src/core/creatures'
import{updatePlayerVision}from'../src/core/fov'
import{observeBestiary}from'../src/core/bestiary'
import type{BodyDef}from'../src/core/types'
export const oldBodyId='SampleMigration.Body.OldQuadruped',newBodyId='SampleMigration.Body.RenamedQuadruped',bodyCreatureId='SampleMigration.Creature.BodyRat'
/** 이전 몸/개체 정의를 먼저 로드해 실제 생성한 초기 몸이다. 원래 몸 상태를 직접 바꾸지 않는다. */
export function bodyRenamesFixture(shapeMismatch=false){
 const packages=readPackages(),current=loadMods(packages,['sample-body-renames']),oldPackages=readPackages(),old=oldPackages.find(x=>x.manifest.id==='sample-body-renames')!;old.manifest.version='0.9.0';delete old.renames
 const body=old.defs.find(x=>x.id===newBodyId)!;body.id=oldBodyId;if(shapeMismatch)body.parent=current.db.all<BodyDef>('Body').find(x=>x.kind==='humanoid')!.id;Object.assign(old.defs.find(x=>x.id===bodyCreatureId)!,{body:oldBodyId})
 const loaded=loadMods(oldPackages,['sample-body-renames']);if(loaded.report.errors.length||current.report.errors.length)throw Error([...loaded.report.errors,...current.report.errors].join('\n'));const w={db:loaded.db,s:newGame(loaded.db,{seed:'actual-original-body-id-renames',overworld:true})};runUntilInput(w);const p=player(w),pos=w.s.visible.map(i=>({x:i%w.s.map.w,y:Math.floor(i/w.s.map.w)})).filter(pos=>cheb(pos,p.pos)>=1&&cheb(pos,p.pos)<=2&&isPassable(w,pos)&&!creatureAt(w,pos)).sort((a,b)=>cheb(a,p.pos)-cheb(b,p.pos)||a.y-b.y||a.x-b.x)[0];if(!pos)throw Error('실제 빈 현재 관찰 칸이 필요하다')
 const creature=createCreature(w,bodyCreatureId,pos,'원래 몸을 가진 굴쥐');w.s.creatures.push(creature);updatePlayerVision(w,p);observeBestiary(w,false);return{w,p,creature,current:current.db,packages,oldPackages}
}
