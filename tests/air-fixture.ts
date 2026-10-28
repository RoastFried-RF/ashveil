import {tileAt} from '../src/core/ctx'
import {syncRegionalWeather} from '../src/core/environment'
import {updatePlayerVision} from '../src/core/fov'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
export function airFixture(){
 const d=clinicalDiseaseFixture('actual-ash-air');tileAt(d.w,d.p.pos).roof=false;d.s.weather='ashgale';d.s.weatherUntil=1e12;d.s.wind={x:0,y:0};syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 return d
}
