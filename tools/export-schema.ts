// TypeScript의 실제 Def 타입을 언어 독립 JSON Schema(2020-12)로 내보낸다.
// pnpm exec tsx tools/export-schema.ts [출력 파일=docs/schema/defs.schema.json]
import ts from 'typescript'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

type Schema = Record<string, unknown>
export function defSchema(): Schema {
  const file = resolve('src/core/types.ts')
  const program = ts.createProgram([file], { strict: true, target: ts.ScriptTarget.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, skipLibCheck: true })
  const checker = program.getTypeChecker(), source = program.getSourceFile(file)!
  const definitions: Record<string, Schema> = {}
  const nameOf = (t: ts.Type) => {
    const symbol = t.getSymbol()
    if (t.aliasSymbol && t.aliasSymbol.name !== symbol?.name) return undefined
    return symbol?.declarations?.some((d) => d.getSourceFile().fileName.includes('/src/core/')) && !symbol.name.startsWith('__') ? symbol.name : undefined
  }
  const convert = (t: ts.Type, inline = false): Schema => {
    if (t.isUnion()) {
      const types = t.types.filter((x) => !(x.flags & ts.TypeFlags.Undefined))
      if (types.length === 1) return convert(types[0])
      if (types.every((x) => x.isLiteral())) return { enum: types.map((x) => (x as ts.LiteralType).value) }
      if (types.every((x) => x.flags & ts.TypeFlags.BooleanLike)) return { type: 'boolean' }
      return { anyOf: types.map((x) => convert(x)) }
    }
    if (t.isStringLiteral() || t.isNumberLiteral()) return { const: t.value }
    if (t.flags & ts.TypeFlags.String) return { type: 'string' }
    if (t.flags & ts.TypeFlags.Number) return { type: 'number' }
    if (t.flags & ts.TypeFlags.BooleanLike) return { const: checker.typeToString(t) === 'true' }
    if (t.flags & ts.TypeFlags.Null) return { type: 'null' }
    if (t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return {}
    if (checker.isTupleType(t)) {
      const tuple = t as ts.TypeReference, args = checker.getTypeArguments(tuple)
      return { type: 'array', prefixItems: args.map((x) => convert(x)), minItems: args.length, maxItems: args.length }
    }
    if (checker.isArrayType(t)) return { type: 'array', items: convert(checker.getTypeArguments(t as ts.TypeReference)[0]) }
    const name = nameOf(t)
    if (name && !inline) {
      if (!definitions[name]) { definitions[name] = {}; definitions[name] = convert(t, true) }
      return { $ref: `#/$defs/${name}` }
    }
    const properties: Record<string, Schema> = {}, required: string[] = []
    for (const p of checker.getPropertiesOfType(t)) {
      const declaration = p.valueDeclaration ?? p.declarations?.[0] ?? source
      properties[p.name] = convert(checker.getTypeOfSymbolAtLocation(p, declaration))
      if (!(p.flags & ts.SymbolFlags.Optional)) required.push(p.name)
    }
    const index = checker.getIndexTypeOfType(t, ts.IndexKind.String)
    const result: Schema = { type: 'object', properties }
    if (index) result.additionalProperties = convert(index)
    if (required.length) result.required = required
    // 원본 Def 파일은 상속 전이다. 부모가 있거나 abstract면 나머지 필드는 상속될 수 있다.
    if ('defType' in properties && name?.endsWith('Def')) {
      delete result.required
      result.allOf = [{ if: { anyOf: [{ required: ['parent'] }, { required: ['abstract'], properties: { abstract: { const: true } } }] }, then: { required: ['id', 'defType'] }, else: { required } }]
    }
    return result
  }
  const alias = source.statements.find((n): n is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(n) && n.name.text === 'AnyDef')!
  const schema = convert(checker.getTypeAtLocation(alias))
  // 원본 자식은 일부 키를 삭제하거나 배열을 합성할 수 있다. 완성된 새 배열 원소는 원래 타입을 검사한다.
  const nullable=(s:Schema):Schema=>({anyOf:[s,{type:'null'}]})
  const inherited=(s:Schema):Schema=>{
    if(typeof s.$ref==='string'){
      const name=s.$ref.slice('#/$defs/'.length),raw='Inherited_'+name
      if(!definitions[raw]){definitions[raw]={};definitions[raw]=inherited(definitions[name])}
      return{$ref:'#/$defs/'+raw}
    }
    if(s.type==='array'){
      const item=s.items??(Array.isArray(s.prefixItems)?{anyOf:s.prefixItems}:{})
      const arrays={type:'array',items:item},remove={type:'array',items:{anyOf:[item,{type:'object',required:['id'],properties:{id:{}},additionalProperties:false}]}}
      return{anyOf:[s,{type:'object',properties:{$append:arrays,$prepend:arrays,$remove:remove},additionalProperties:false,anyOf:[{required:['$append']},{required:['$prepend']},{required:['$remove']}]}]}
    }
    if(s.type==='object'){
      const result:Schema={...s,properties:{...Object.fromEntries(Object.entries((s.properties??{})as Record<string,Schema>).map(([k,v])=>[k,nullable(inherited(v))])),$inherit:{const:false}}}
      delete result.required;delete result.allOf
      if(typeof s.additionalProperties==='object'&&s.additionalProperties)result.additionalProperties=nullable(inherited(s.additionalProperties as Schema))
      return result
    }
    if(Array.isArray(s.anyOf))return{...s,anyOf:s.anyOf.map(v=>inherited(v as Schema))}
    return s
  }
  for(const [name,def]of Object.entries(definitions)){
    const properties=def.properties as Record<string,Schema>|undefined
    if(!name.endsWith('Def')||!properties?.defType||!Array.isArray(def.allOf))continue
    const condition=def.allOf[0]as {if:Schema;then:Schema;else:Schema}
    const raw=Object.fromEntries(Object.entries(properties).map(([k,v])=>[k,['id','defType','parent','abstract','override','_mod'].includes(k)?v:nullable(inherited(v))]))
    delete def.properties
    def.allOf=[{...condition,then:{...condition.then,properties:raw},else:{...condition.else,properties}}]
  }
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://ashveil.dev/schema/defs.schema.json', title: 'ASHVEIL Def 목록', description: 'tools/export-schema.ts가 src/core/types.ts에서 생성. 상속 후 참조·범위 검사는 validate-defs도 실행한다.', type: 'array', items: schema, $defs: definitions }
}
if (process.argv[1]?.endsWith('export-schema.ts')) {
  const out = process.argv[2] ?? 'docs/schema/defs.schema.json'
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(defSchema(), null, 2) + '\n')
  console.log(out)
}
