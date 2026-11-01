import { preferences } from './preferences'
import { translate, type MessageValue } from './locales/message'
import { translateDef,translateItemAttack,translateRecipeMaterialSlot,translateDeviceOperation } from './locales/content'
import{translateCraftingIssue}from'./locales/crafting'
import{translateFieldIssue}from'./locales/field'
import{translateFieldWorkIssue}from'./locales/field-work'
import{displayBaseTaskSummary,translateBaseOrderLabel,translateBaseTaskStatus,translateBaseGearActivity}from'./locales/base-camp'
import{displayCampClock,translateRetirementIssue,translateRetirementLabel}from'./locales/resident-camp'
import{translateEndingRule,translateEndingIssue}from'./locales/expedition-records'

/** Explicit display boundary; preference reads participate in Vue dependency tracking. */
export const t = (source: string, ...values: MessageValue[]) => translate(source, preferences.language, ...values)

/** Def ID + exact source guard; never call this on a creature/person instance. */
export const defText = (def:Parameters<typeof translateDef>[0], field:Parameters<typeof translateDef>[1] = 'label') => translateDef(def, field, preferences.language)
export const itemAttackText = (id:string,attack:Parameters<typeof translateItemAttack>[1]) => translateItemAttack(id,attack,preferences.language)
export const recipeMaterialSlotText=(id:string,slot:Parameters<typeof translateRecipeMaterialSlot>[1])=>translateRecipeMaterialSlot(id,slot,preferences.language)
export const craftingIssueText=(error:Parameters<typeof translateCraftingIssue>[0],recipe?:Parameters<typeof translateCraftingIssue>[1])=>translateCraftingIssue(error,recipe,preferences.language)
export const fieldIssueText=(error:Parameters<typeof translateFieldIssue>[0],context?:Parameters<typeof translateFieldIssue>[1])=>translateFieldIssue(error,context,preferences.language)
export const fieldWorkIssueText=(error:Parameters<typeof translateFieldWorkIssue>[0],context?:Parameters<typeof translateFieldWorkIssue>[1])=>translateFieldWorkIssue(error,context,preferences.language)
export const deviceOperationText=(id:string,operation:Parameters<typeof translateDeviceOperation>[1])=>translateDeviceOperation(id,operation,preferences.language)
export const baseSummaryText=(w:Parameters<typeof displayBaseTaskSummary>[0],task:Parameters<typeof displayBaseTaskSummary>[1])=>displayBaseTaskSummary(w,task,preferences.language)
export const baseOrderText=(w:Parameters<typeof translateBaseOrderLabel>[0],task:Parameters<typeof translateBaseOrderLabel>[1])=>translateBaseOrderLabel(w,task,preferences.language)
export const baseTaskText=(w:Parameters<typeof translateBaseTaskStatus>[0],c:Parameters<typeof translateBaseTaskStatus>[1],source:string)=>translateBaseTaskStatus(w,c,source,preferences.language)
export const baseGearText=(w:Parameters<typeof translateBaseGearActivity>[0],c:Parameters<typeof translateBaseGearActivity>[1])=>translateBaseGearActivity(w,c,preferences.language)
export const campClockText=(turn:number)=>displayCampClock(turn,preferences.language)
export const retirementIssueText=(error:Parameters<typeof translateRetirementIssue>[0],context:Parameters<typeof translateRetirementIssue>[1])=>translateRetirementIssue(error,context,preferences.language)
export const retirementLabelText=(kind:Parameters<typeof translateRetirementLabel>[0],label:string)=>translateRetirementLabel(kind,label,preferences.language)
export const endingRuleText=(parentId:string,rule:Parameters<typeof translateEndingRule>[1],field:Parameters<typeof translateEndingRule>[2])=>translateEndingRule(parentId,rule,field,preferences.language)
export const endingIssueText=(error:Parameters<typeof translateEndingIssue>[0],requirements:string[])=>translateEndingIssue(error,requirements,preferences.language)

/** Only labels produced by the physical-key formatter, never arbitrary game text. */
export const keyLabel = (source: string) => source.replaceAll('숫자패드', t('숫자패드')).replaceAll('공백', t('공백')).replaceAll('미배정', t('미배정'))
