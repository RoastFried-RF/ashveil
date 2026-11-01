import{clock}from'../../core/ctx'
import{translate,type Language}from'./message'

/** Uses numeric Core clock fields; never parses saved text or changes the clock. */
export function displayCampClock(turn:number,language:Language):string{
 const c=clock(turn)
 return translate('{0}일차 {1}:{2}',language,c.day,String(c.hour).padStart(2,'0'),String(c.minute).padStart(2,'0'))
}

type RetirementContext={minHousingDays:number;savings:number}
/** Exact quote + actual policy/quote amounts. Unknown or changed text stays literal. */
export function translateRetirementIssue(error:string|null|undefined,context:RetirementContext,language:Language):string{
 if(!error)return''
 if(error===`이 여관의 실제 침대를 앞으로${context.minHousingDays}일 이상 빌려야 한다`)return translate('이 여관의 실제 침대를 앞으로{0}일 이상 빌려야 한다',language,context.minHousingDays)
 if(error===`앞으로의 생활비${context.savings}전이 부족하다`)return translate('앞으로의 생활비{0}전이 부족하다',language,context.savings)
 return translate(error,language)
}

const retirementLabels={peaceful:'평온한 은퇴',wounded:'상처 입은 은퇴',legend:'전설의 은퇴'}
export function translateRetirementLabel(kind:keyof typeof retirementLabels,label:string,language:Language):string{
 return label===retirementLabels[kind]?translate(label,language):label
}
