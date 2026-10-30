import { preferences } from './preferences'
import { translate, type MessageValue } from './locales/message'
import { translateDef,translateItemAttack } from './locales/content'

/** Explicit display boundary; preference reads participate in Vue dependency tracking. */
export const t = (source: string, ...values: MessageValue[]) => translate(source, preferences.language, ...values)

/** Def ID + exact source guard; never call this on a creature/person instance. */
export const defText = (def:Parameters<typeof translateDef>[0], field:Parameters<typeof translateDef>[1] = 'label') => translateDef(def, field, preferences.language)
export const itemAttackText = (id:string,attack:Parameters<typeof translateItemAttack>[1]) => translateItemAttack(id,attack,preferences.language)

/** Only labels produced by the physical-key formatter, never arbitrary game text. */
export const keyLabel = (source: string) => source.replaceAll('숫자패드', t('숫자패드')).replaceAll('공백', t('공백')).replaceAll('미배정', t('미배정'))
