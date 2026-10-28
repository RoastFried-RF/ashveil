import { preferences } from './preferences'
import { translate, type MessageValue } from './locales/message'

/** Explicit display boundary; preference reads participate in Vue dependency tracking. */
export const t = (source: string, ...values: MessageValue[]) => translate(source, preferences.language, ...values)

/** Only labels produced by the physical-key formatter, never arbitrary game text. */
export const keyLabel = (source: string) => source.replaceAll('숫자패드', t('숫자패드')).replaceAll('공백', t('공백')).replaceAll('미배정', t('미배정'))
