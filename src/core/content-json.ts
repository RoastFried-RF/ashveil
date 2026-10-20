/** 원문 JSON의 중복 키·BOM·문법을 값 손실 전에 검사한다. 엔진/파일 시스템과 독립적이다. */
export class ContentJsonError extends Error {
  readonly line:number
  readonly column:number
  constructor(readonly file:string,readonly offset:number,text:string,message:string){
    const lines=text.slice(0,offset).split('\n'),line=lines.length,column=lines.at(-1)!.length+1
    super(`${file}:${line}:${column}: ${message}`)
    this.name='ContentJsonError';this.line=line;this.column=column
  }
}
export function parseContentJson(text:string,file='JSON'):unknown {
  let at=0
  const fail=(message:string,offset=at):never=>{throw new ContentJsonError(file,offset,text,message)}
  const space=()=>{while(at<text.length&&[' ','\t','\r','\n'].includes(text[at]))at++}
  const string=():string=>{
    const start=at++
    while(at<text.length){
      const code=text.charCodeAt(at++)
      if(code===34)return JSON.parse(text.slice(start,at)) as string
      if(code<32)fail('문자열에 이스케이프하지 않은 제어 문자가 있다',at-1)
      if(code!==92)continue
      const escaped=text[at++]
      if(escaped==='u'){
        if(!/^[0-9a-fA-F]{4}$/.test(text.slice(at,at+4)))fail('유니코드 이스케이프에는16진수4자리가 필요하다',at)
        at+=4
      }else if(!escaped||!'"\\/bfnrt'.includes(escaped))fail('잘못된 문자열 이스케이프',at-1)
    }
    return fail('문자열이 닫히지 않았다',start)
  }
  const number=/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y
  const value=(depth:number):void=>{
    if(depth>512)fail('JSON 중첩은512단계 이하여야 한다')
    space()
    const token=text[at]
    if(token==='"'){string();return}
    if(token==='{'){
      at++;space();const keys=new Set<string>()
      if(text[at]==='}'){at++;return}
      while(at<text.length){
        if(text[at]!=='"')fail('객체 키는 큰따옴표 문자열이어야 한다')
        const start=at,key=string()
        if(keys.has(key))fail('중복 JSON 키: '+JSON.stringify(key),start)
        keys.add(key);space()
        if(text[at++]!==':')fail('객체 키 뒤에 콜론이 필요하다',at-1)
        value(depth+1);space()
        const end=text[at++]
        if(end==='}')return
        if(end!==',')fail('객체 항목 뒤에 쉼표 또는 닫는 중괄호가 필요하다',at-1)
        space()
      }
      fail('객체가 닫히지 않았다')
    }
    if(token==='['){
      at++;space()
      if(text[at]===']'){at++;return}
      while(at<text.length){
        value(depth+1);space();const end=text[at++]
        if(end===']')return
        if(end!==',')fail('배열 항목 뒤에 쉼표 또는 닫는 대괄호가 필요하다',at-1)
        space()
      }
      fail('배열이 닫히지 않았다')
    }
    for(const literal of ['true','false','null'])if(text.startsWith(literal,at)){at+=literal.length;return}
    number.lastIndex=at;const match=number.exec(text)
    if(match){if(!Number.isFinite(Number(match[0])))fail('유한 범위를 넘은 JSON 숫자');at=number.lastIndex;return}
    fail(at>=text.length?'JSON 값이 필요하다':'잘못된 JSON 값')
  }
  if(text.charCodeAt(0)===0xfeff)fail('UTF-8 BOM을 제거해야 한다',0)
  value(0);space()
  if(at!==text.length)fail('JSON 값 뒤에 다른 문자가 있다')
  return JSON.parse(text) as unknown
}
