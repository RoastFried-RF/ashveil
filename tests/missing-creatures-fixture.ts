import {readPackages} from '../tools/loadContent'
import {loadMods} from '../src/core/defs'
import {newGame,runUntilInput} from '../src/core/game'
import {createCreature} from '../src/core/creatures'
import {player,isPassable,creatureAt} from '../src/core/ctx'
import {cheb} from '../src/core/geom'
export const missingCreatureId='SampleRemoval.Creature.Rat'
/** 실제 이전 모드 정의와 실제 생성자의 선언된 초기 배치. 과거 출생/전투/사망을 꾸미지 않는다. */
export function missingCreaturesFixture(){
 const packages=readPackages(),old=loadMods([...packages,{manifest:{id:'removed-creature',name:'원래 생물 모드',version:'1.0.0',dependencies:['core']},defs:[{defType:'Creature',id:missingCreatureId,parent:'Creature.BurrowRat',label:'원래 굴쥐'}],patches:[]}],['removed-creature']),current=loadMods(packages,[])
 if(old.report.errors.length||current.report.errors.length)throw Error([...old.report.errors,...current.report.errors].join('\n'))
 const w={db:old.db,s:newGame(old.db,{seed:'actual-missing-creature',overworld:true})};runUntilInput(w);const p=player(w),pos=w.s.visible.map(i=>({x:i%w.s.map.w,y:Math.floor(i/w.s.map.w)})).filter(pos=>cheb(pos,p.pos)>=1&&cheb(pos,p.pos)<=2&&isPassable(w,pos)&&!creatureAt(w,pos)).sort((a,b)=>cheb(a,p.pos)-cheb(b,p.pos)||a.y-b.y||a.x-b.x)[0]
 if(!pos)throw Error('실제 빈 초기 배치 칸이 필요하다')
 const creature=createCreature(w,missingCreatureId,pos,'원래 모드의 굴쥐');w.s.creatures.push(creature)
 return{w,p,creature,current:current.db}
}
