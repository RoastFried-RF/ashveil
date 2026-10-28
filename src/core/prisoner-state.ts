import { turnOf, type World } from './ctx'
import type { Creature, PrisonerDef, PrisonerCareDef } from './types'
export const prisonerDef=(w:World)=>w.db.get<PrisonerDef>('Prisoner.Hearth')
export const prisonerCareDef=(w:World)=>w.db.get<PrisonerCareDef>('PrisonerCare.Hearth')
export const mercyActive=(w:World,c:Creature)=>!!c.mercy&&turnOf(w)<c.mercy.until
