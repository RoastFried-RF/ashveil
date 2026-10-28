import {npcRelationsFixture} from './npc-relations-fixture'
import {bountyContractsFixture} from './bounty-contracts-fixture'
export function npcIdentityFixture(phase:'unknown'|'known'|'pending'='unknown'){
 const d=npcRelationsFixture(phase==='unknown'?'listen':'heard')
 if(phase==='pending'){d.act({type:'rest',turns:20},1);d.proof.initialRendererFx.push(...d.s.fx.splice(0))}
 return d
}
export function legacyNpcIdentityFixture(){
 const d=bountyContractsFixture('npc-identity-actual')
 // 원래217 대조와 같은 구형 포맷이다. 새 이름 메타데이터/분리 난수만 제거한다.
 for(const c of d.s.creatures)delete c.npcIdentity
 for(const key of Object.keys(d.s.rng))if(key.startsWith('world.npc-identity.'))delete d.s.rng[key as keyof typeof d.s.rng]
 d.s.version=155
 return{...d,a:d.trader,proof:{controlledLegacy155Format:true,originalActorIds:d.s.creatures.map(c=>c.id),initialRendererFx:d.s.fx.splice(0)}}
}
