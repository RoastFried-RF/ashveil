// resolve는 읽기 전용 최종 Def 조회, validate는 실제 데이터·격리 스크립트 등록 검사다.
import { inspectDefinitions } from '../src/core/definition-inspection'
import { definitionFieldValue } from '../src/core/definition-provenance'
import { readPackages } from './loadContent'
import { validateDefinitionPackages } from './definition-validation'

const args=process.argv.slice(2),json=args.includes('--json'),positional=args.filter(s=>s!=='--json')
const [command,id,...enabled]=positional
if(!['resolve','validate','pack'].includes(command??'')||(command==='resolve'||command==='pack')&&!id||command==='pack'&&positional.length>3||args.some(s=>s.startsWith('--')&&s!=='--json')){
  const error='사용법: pnpm defs resolve <Def.Id> [modId ...] [--json] 또는 pnpm defs validate [modId ...] [--json] 또는 pnpm defs pack <modId> [출력.zip] [--json]'
  console.error(json?JSON.stringify({error}):error);process.exitCode=1
}else if(command==='pack'){
  try{
    if(enabled[0]&&!enabled[0].endsWith('.zip'))throw Error('pack 출력 파일은 .zip이어야 한다')
    const{packageMod}=await import('./package-mod'),{createQuickJSScriptHost}=await import('../src/scripting/quickjs'),scriptHost=await createQuickJSScriptHost(),result=packageMod(id,{out:enabled[0],format:'zip',scriptHost})
    console.log(JSON.stringify(result,null,2))
  }catch(error){const message=(error as Error).message;console.error(json?JSON.stringify({error:message}):message);process.exitCode=1}
}else if(command==='validate'){
  try{
    const result=await validateDefinitionPackages(readPackages(),positional.slice(1))
    if(json)console.log(JSON.stringify(result,null,2))
    else{
      console.log(`로드: ${result.report.order.join(' → ')} · 정의 ${result.definitions}개 · ${result.loadHash}`)
      console.log(`패치 미리보기: 적용 ${result.patchAudit.counts.applied} · 조건 건너뜀 ${result.patchAudit.counts.skipped} · 실패 ${result.patchAudit.counts.failed}`)
      for(const e of result.report.errors)console.error('오류: '+e)
      for(const e of [...result.report.warnings,...result.patchAudit.warnings.map(w=>w.message)])console.warn('경고: '+e)
      for(const p of result.patchAudit.patches)console.log(`${p.modId} · ${p.file??'파일 정보 없음'} · 항목 ${p.entry+1} · ${p.status==='applied'?'적용':p.status==='skipped'?'건너뜀':'실패'} ${p.operation.target}${p.operation.path} · 실제 원시값 차이 ${p.changes.length}${p.reason?' · '+p.reason:''}`)
      console.log(result.valid?'검증 통과':'검증 실패')
    }
    if(!result.valid)process.exitCode=1
  }catch(error){const message=(error as Error).message;console.error(json?JSON.stringify({error:message}):message);process.exitCode=1}
}else{
  try{
    const model=inspectDefinitions(readPackages(),enabled),detail=model.detail(id)
    const result={id,loadHash:model.loadHash,report:model.report,...(detail?{definition:detail.resolved,lineage:detail.lineage,fields:detail.fields.map(f=>({...f,value:definitionFieldValue(detail.resolved,f.path)})),patches:detail.patches}:{error:'정의 없음: '+id})}
    if(json)console.log(JSON.stringify(result,null,2))
    else{
      console.log(`로드: ${model.report.order.join(' → ')} · ${model.loadHash}`)
      for(const error of model.report.errors)console.error('오류: '+error)
      for(const warning of model.report.warnings)console.error('경고: '+warning)
      if(!detail)console.error('정의 없음: '+id)
      else{
        console.log(JSON.stringify(detail.resolved,null,2)??'해석된 정의 없음')
        console.log('\n필드별 출처 · 경로는 JSON Pointer · 항목은 JSON 배열의 1부터 센 위치')
        for(const f of detail.fields.map(field=>({...field,value:definitionFieldValue(detail.resolved,field.path)}))){const s=f.source;console.log(`${f.path||'/'} = ${JSON.stringify(f.value)} ← ${s.modId} · ${s.file??'파일 정보 없음'} · 항목 ${s.entry+1} · ${s.kind==='patch'?'패치':'정의'} ${s.definitionId} · ${s.sourcePath||'/'}${s.operation?' · '+s.operation.op+' '+s.operation.path:''}`)}
      }
    }
    if(!detail?.resolved||model.report.errors.length)process.exitCode=1
  }catch(error){const message=(error as Error).message;console.error(json?JSON.stringify({error:message}):message);process.exitCode=1}
}
