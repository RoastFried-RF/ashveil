import { prisonerFixture } from './prisoner-fixture'
import { serialize, deserialize } from '../src/core/save'
import { player, tileAt } from '../src/core/ctx'
import { updatePlayerVision, invalidateLights } from '../src/core/fov'
import type { World } from '../src/core/ctx'

export function checkpointFixture(mode='SaveMode.Study',lethal=false){
 const d=prisonerFixture(),{w,s,p,target}=d
 if(mode!=='SaveMode.Imprint'){s.saveMode=mode;s.achievementsDisabled=true}
 s.map.name='저장 방식 검토';s.map.kind='dungeon';s.map.links=[];s.map.exits=[];s.map.props=[]
 s.creatures=lethal?[p,target]:[p];p.hp=lethal?1:p.hp
 if(lethal){target.ai.mode='hunt';target.ai.target=p.id;target.nextAct=s.time+100;target.stats={str:20,agi:20,per:20,vit:20,wil:20};s.rng.combat=[0,0,0,0]}
 // 처음부터 선언한 유한 환경이다. 실제 불/모드/적/체력/RNG를 로드 후 교체하지 않는다.
 tileAt(w,p.pos).t='Terrain.Campfire';invalidateLights(w);updatePlayerVision(w,p);s.fx=[]
 const result:World={db:w.db,s:deserialize(serialize(s))}
 return{w:result,proof:{mode,lethal,player:{id:p.id,pos:p.pos,hp:p.hp},campfire:s.map.lights,enemy:lethal?{id:target.id,pos:target.pos,nextAct:target.nextAct,stats:target.stats,ai:target.ai}:null,initialRng:s.rng,limits:'Declared finite initial save through real Title Continue. Initial HP1/ready hostile and combat RNG[0,0,0,0] only in lethal fixture. No postload world/time/body/RNG injection. Native death comes from actual wait input.'},p:player(result)}
}
