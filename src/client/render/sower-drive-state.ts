/** Read-only bridge from actual machine anatomy to four borrowed display instances. */
import {isMissing,partDamage,partEff,type Creature,type World} from '../../core'
import {SOWER_DRIVE_OWNERS,type RigDriveStates} from './articulated-gait'

export function sowerDriveState(w:World,c:Creature):RigDriveStates|undefined{
 const ids=new Set(w.db.body(c.body.def).parts.map(p=>p.id))
 // A different modded four-leg rig does not acquire invented Body.Sower owners.
 if(!Object.values(SOWER_DRIVE_OWNERS).every(id=>ids.has(id)))return
 return Object.fromEntries(Object.entries(SOWER_DRIVE_OWNERS).map(([leg,id])=>[leg,{
  present:!isMissing(w,c,id),efficiency:partEff(w,c,id),
  damage:Math.max(0,Math.min(1,partDamage(c,id)/Math.max(1,c.body.maxHp[id]??1))),
 }]))
}
