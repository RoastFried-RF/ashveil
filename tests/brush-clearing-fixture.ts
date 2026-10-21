import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {tileAt,turnOf,TURNS_PER_DAY} from '../src/core/ctx'
import {makeItem} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
/** 실제 생성 몸/마체테/종자를 사용하는 유한 초기 방. 과거 채집·장비 획득을 재현하지 않는다. */
export function brushClearingNativeFixture(){
 const d=clinicalDiseaseFixture('brush-clearing-native-296',false),{w,s,p}=d
 s.map.kind='dungeon';s.map.depth=3;s.map.name='덤불을 베어 같은 흙에 심기';s.map.ambient=1;s.map.lights=[];s.storyteller.budget=-1e9;p.facing=0;p.needs.nutritionDay=Math.floor(turnOf(w)/TURNS_PER_DAY)
 const north={x:20,y:19},east={x:21,y:20},n=tileAt(w,north),e=tileAt(w,east)
 n.t=e.t='Terrain.AshBerryBush';n.gatherAt=turnOf(w)+100;delete e.gatherAt
 const machete=d.add('Item.Machete'),seeds=d.add('Item.ShadeSeeds',2),salt=makeItem(w,'Item.Salt',3),wood=makeItem(w,'Item.Wood',2)
 e.items.push(salt,wood);s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
 return{...d,north,east,machete,seeds,salt,wood}
}
