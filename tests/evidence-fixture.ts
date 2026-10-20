import {zeroVaultFixture} from './zero-vault-fixture'
import {playerAct} from '../src/core/game'
import {perform} from '../src/core/actions'
import {studyBook} from '../src/core/skills'
import {updatePlayerVision} from '../src/core/fov'
export function evidenceFixture(){
 const d=zeroVaultFixture();const{w,p,s}=d
 const error=playerAct(w,{type:'deviceWork',pos:d.mechanism,uid:d.device.uid,operation:'breach'});if(error)throw Error(error)
 if(!d.device.completed.includes('breach'))throw Error('초기 금고의 실제 봉인 작업이 중단되었다')
 p.pos={x:22,y:8};updatePlayerVision(w,p);if(playerAct(w,{type:'search'}))throw Error('원본 상자 수색 실패');if(!perform(w,p,{type:'lootAll'}).ok)throw Error('원본 문서 반출 실패')
 for(const def of ['Item.CalvisJournal','Item.CorporateCodePlate'])studyBook(w,p,def,true)
 p.pos={x:6,y:15};const upstairs=playerAct(w,{type:'stairs'});if(upstairs)throw Error(upstairs)
 const guards=s.creatures.filter(c=>c.def==='Creature.SettlementGuard'),reformer=guards[0],loyal=guards[1];if(!reformer||!loyal)throw Error('실제 초소 경비가 부족하다')
 for(const [i,c] of s.creatures.filter(c=>c.id!==p.id).entries()){c.asleep=false;c.unconscious=false;c.age=undefined;c.effects=[];c.nextAct=s.time+200;c.needs.fatigue=10;c.pos={x:37+i%2,y:19+Math.floor(i/2)};c.home={...c.pos}}
 p.pos={x:32,y:17};reformer.pos={x:31,y:17};reformer.home={...reformer.pos};reformer.traits=['Trait.TenderHearted'];loyal.pos={x:33,y:17};loyal.home={...loyal.pos};loyal.traits=['Trait.Pious'];updatePlayerVision(w,p)
 const papers=p.bag.filter(i=>['Item.CalvisJournal','Item.CorporateCodePlate'].includes(i.def))
 return{...d,reformer,loyal,papers,rule:'Evidence.Calvis'}
}
