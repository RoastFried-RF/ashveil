/** Presentation only. Never translates names, mutates Defs or rewrites saved logs. */
import english from './en.json'

export type Language = 'ko' | 'en'
export type MessageValue = string | number
const messages: Readonly<Record<string, string>> = english

export function translate(source: string, language: Language, ...values: MessageValue[]): string {
  const message = language === 'en' && Object.hasOwn(messages, source) ? messages[source] : source
  // Replace once: braces, HTML and dollar signs inside values remain literal data.
  return message.replace(/\{(\d+)\}/g, (token, index: string) => Object.hasOwn(values, index) ? String(values[Number(index)]) : token)
}
