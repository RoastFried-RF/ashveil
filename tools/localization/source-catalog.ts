/** Read-only Korean source inventory. It never translates or rewrites source. */
import {createHash} from 'node:crypto'
import {existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync} from 'node:fs'
import {dirname, extname, isAbsolute, join, relative, resolve, sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import ts from 'typescript'
import {compileTemplate, parse as parseSfc} from 'vue/compiler-sfc'

export type Usage = 'ui' | 'log' | 'content' | 'candidate'
export interface Occurrence {
  file: string
  line: number
  column: number
  context: string
  usage: Usage
  expressions?: string[]
}
export interface CatalogEntry {
  id: string
  kind: 'literal' | 'format'
  parts: string[]
  occurrences: Occurrence[]
}
export interface Exclusion {file: string; line: number; reason: string}
export interface Inventory {
  version: 1
  entries: CatalogEntry[]
  excluded: Exclusion[]
  inputs: Record<string, string>
  policy: string
}
const KOREAN = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/
const DISPLAY_KEYS = new Set(['label', 'description', 'note', 'text', 'title', 'summary', 'reason', 'warning', 'message', 'hint', 'tooltip', 'question', 'answer', 'lore'])
const TECHNICAL_KEYS = new Set(['id', 'def', 'defType', 'parent', 'sprite', 'char', 'type', 'kind', 'path', 'op', 'class', 'style', 'key', 'testid', 'data-testid', 'role', 'slot', 'ref', 'src', 'href', 'url', 'import', 'entry', 'hash'])
const DISPLAY_ATTRIBUTES = new Set(['title', 'aria-label', 'aria-description', 'aria-valuetext', 'placeholder', 'alt', 'label', 'description', 'summary', 'empty-text'])
const PERSONAL_ARRAY = /^(?:NAMES|PERSONAL_NAMES|GIVEN_NAMES|FIRST_NAMES|SURNAMES)$/i
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')

function propertyName(node: ts.PropertyName): string | undefined {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node) ? node.text : undefined
}
function origin(source: string, file: string, offset: number): Pick<Occurrence, 'file' | 'line' | 'column'> {
  const prefix = source.slice(0, Math.max(0, offset)), lines = prefix.split('\n')
  return {file, line: lines.length, column: lines.at(-1)!.length + 1}
}
function isWithin(child: string, parent: string) {
  const rest = relative(parent, child)
  return rest !== '' && rest !== '..' && !rest.startsWith('..' + sep) && !isAbsolute(rest)
}

export class SourceCatalog {
  private entries = new Map<string, CatalogEntry>()
  private excluded: Exclusion[] = []
  private inputs: Record<string, string> = {}
  private add(parts: string[], expressions: string[], occurrence: Occurrence) {
    if (!parts.some(part => KOREAN.test(part))) return
    const kind = expressions.length ? 'format' : 'literal'
    const id = (kind === 'format' ? 'f-' : 'l-') + hash(JSON.stringify(parts)).slice(0, 20)
    const entry = this.entries.get(id) ?? {id, kind, parts, occurrences: []}
    if (JSON.stringify(entry.parts) !== JSON.stringify(parts)) throw Error('Catalog ID collision: ' + id)
    const at = expressions.length ? {...occurrence, expressions} : occurrence
    if (!entry.occurrences.some(old => JSON.stringify(old) === JSON.stringify(at))) entry.occurrences.push(at)
    this.entries.set(id, entry)
  }
  private exclude(file: string, source: string, offset: number, reason: string) {
    const loc = origin(source, file, offset)
    this.excluded.push({file, line: loc.line, reason})
  }
  collect(file: string, source: string) {
    if (this.inputs[file] !== undefined) throw Error('Duplicate source file: ' + file)
    this.inputs[file] = hash(source)
    if (file.endsWith('.vue')) this.vue(file, source)
    else if (file.endsWith('.json')) {
      JSON.parse(source) // Reject invalid JSON instead of silently accepting TypeScript recovery.
      this.typescript(file, source, source, 0, true)
    } else this.typescript(file, source, source, 0, false)
  }
  result(): Inventory {
    const entries = [...this.entries.values()].sort((a, b) => a.id.localeCompare(b.id))
    for (const entry of entries) entry.occurrences.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || a.context.localeCompare(b.context))
    return {version: 1, entries, excluded: [...this.excluded].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.reason.localeCompare(b.reason)), inputs: Object.fromEntries(Object.entries(this.inputs).sort(([a], [b]) => a.localeCompare(b))), policy: 'tools/localization/README.md'}
  }
  private typescript(file: string, snippet: string, source: string, base: number, json: boolean, usage?: Usage, context = 'typescript') {
    const ast = ts.createSourceFile(file.endsWith('.json') && !json ? 'expression.ts' : file, snippet, ts.ScriptTarget.Latest, true, json ? ts.ScriptKind.JSON : ts.ScriptKind.TS)
    const diagnostics = (ast as ts.SourceFile & {parseDiagnostics?: readonly ts.Diagnostic[]}).parseDiagnostics ?? []
    if (diagnostics.length) throw Error(file + ': ' + ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n'))
    const at = (node: ts.Node) => origin(source, file, base + node.getStart(ast))
    const ancestors = (node: ts.Node) => {const result: ts.Node[] = []; for (let p = node.parent; p; p = p.parent) result.push(p); return result}
    const exclusion = (node: ts.Node): string | undefined => {
      for (const p of ancestors(node)) {
        if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && PERSONAL_ARRAY.test(p.name.text) && p.initializer && ts.isArrayLiteralExpression(p.initializer)) return 'personal-name-pool'
        if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isImportTypeNode(p)) return 'module-path'
        if (ts.isTypeNode(p)) return 'type-only'
        if (ts.isPropertyAssignment(p)) {
          const key = propertyName(p.name)
          if (p.name === node) return 'property-key'
          if (key === 'name' && !(json && file.endsWith('/manifest.json'))) return 'possible-personal-name'
          if (key && TECHNICAL_KEYS.has(key)) return 'technical-property:' + key
        }
        if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return 'lookup-key'
        if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) return 'comparison-key'
      }
      return undefined
    }
    const contextFor = (node: ts.Node): {usage: Usage; context: string} => {
      for (const p of ancestors(node)) {
        if (ts.isCallExpression(p)) {
          const call = p.expression.getText(ast)
          if (/^(?:log|toast|notify|confirm|alert|speakText)$/.test(call)) return {usage: call === 'log' ? 'log' : 'ui', context: 'call:' + call}
        }
        if (json && ts.isPropertyAssignment(p)) {
          let key = propertyName(p.name)
          if (key === 'value' && ts.isObjectLiteralExpression(p.parent)) {
            const patchPath = p.parent.properties.find(prop => ts.isPropertyAssignment(prop) && propertyName(prop.name) === 'path')
            if (patchPath && ts.isPropertyAssignment(patchPath) && ts.isStringLiteral(patchPath.initializer)) key = patchPath.initializer.text.split('/').at(-1)
          }
          if (key && (DISPLAY_KEYS.has(key) || key === 'name' && file.endsWith('/manifest.json'))) return {usage: 'content', context: 'json:' + key}
        }
      }
      return {usage: usage ?? (file.startsWith('src/client/') ? 'ui' : 'candidate'), context}
    }
    const isString = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    const stringRoot = (node: ts.Expression): boolean => isString(node) || ts.isTemplateExpression(node) || ts.isParenthesizedExpression(node) && stringRoot(node.expression) || ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken && (stringRoot(node.left) || stringRoot(node.right))
    const pieces = (node: ts.Expression): {parts: string[]; expressions: string[]} => {
      if (isString(node)) return {parts: [node.text], expressions: []}
      if (ts.isParenthesizedExpression(node) && stringRoot(node.expression)) return pieces(node.expression)
      if (ts.isTemplateExpression(node)) return {parts: [node.head.text, ...node.templateSpans.map(span => span.literal.text)], expressions: node.templateSpans.map(span => span.expression.getText(ast))}
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken && stringRoot(node)) {
        const left = pieces(node.left), right = pieces(node.right)
        return {parts: [...left.parts.slice(0, -1), left.parts.at(-1)! + right.parts[0], ...right.parts.slice(1)], expressions: [...left.expressions, ...right.expressions]}
      }
      return {parts: ['', ''], expressions: [node.getText(ast)]}
    }
    const captured = new Set<ts.Node>()
    const visit = (node: ts.Node) => {
      if ((isString(node) || ts.isTemplateExpression(node) || ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken && stringRoot(node)) && !captured.has(node)) {
        const expression = node as ts.Expression, value = pieces(expression)
        if (value.parts.some(part => KOREAN.test(part))) {
          const reason = exclusion(node)
          if (reason) this.exclude(file, source, base + node.getStart(ast), reason)
          else this.add(value.parts, value.expressions, {...at(node), ...contextFor(node)})
          // The root carries its literal fragments. Still inspect dynamic expressions,
          // e.g. `${alive ? '생존' : '사망'}` needs two separate literal candidates.
          const mark = (child: ts.Node) => {if (isString(child) || ts.isTemplateExpression(child) || ts.isBinaryExpression(child) && stringRoot(child)) captured.add(child); ts.forEachChild(child, mark)}
          mark(node)
          const unmark = (child: ts.Node) => {captured.delete(child);ts.forEachChild(child, unmark)}
          const dynamic = (child: ts.Node) => {
            if (ts.isTemplateExpression(child)) for (const span of child.templateSpans) unmark(span.expression)
            else if (ts.isBinaryExpression(child) && child.operatorToken.kind === ts.SyntaxKind.PlusToken && stringRoot(child)) {
              for (const operand of [child.left, child.right]) if (!stringRoot(operand)) unmark(operand)
            }
            ts.forEachChild(child, dynamic)
          }
          dynamic(node)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(ast)
  }
  private vue(file: string, source: string) {
    const parsed = parseSfc(source, {filename: file})
    if (parsed.errors.length) throw Error(file + ': ' + String(parsed.errors[0]))
    const {descriptor} = parsed
    for (const script of [descriptor.script, descriptor.scriptSetup]) if (script) this.typescript(file, script.content, source, script.loc.start.offset, false)
    if (!descriptor.template) return
    const template = descriptor.template, base = template.loc.start.offset
    const expression = (text: string, offset: number, hint: string, statements = false) => this.typescript(file, statements ? text : '(' + text + ')', source, base + offset - (statements ? 0 : 1), false, 'ui', hint)
    const output = compileTemplate({source: template.content, filename: file, id: 'source-catalog', compilerOptions: {nodeTransforms: [node => {
      if (node.type !== 0 && node.type !== 1) return
      if (node.type === 1 && ['script', 'style'].includes(node.tag)) return
      let group: typeof node.children = []
      const flush = () => {
        if (!group.length) return
        const parts = [''], expressions: string[] = []
        for (const child of group) {
          if (child.type === 2) parts[parts.length - 1] += child.content
          else if (child.type === 5) {expressions.push(child.content.loc.source);parts.push('')}
        }
        this.add(parts, expressions, {...origin(source, file, base + group[0].loc.start.offset), usage: 'ui', context: 'vue:text'})
        group = []
      }
      for (const child of node.children) {
        if (child.type === 2 || child.type === 5) {
          group.push(child)
          if (child.type === 5) expression(child.content.loc.source, child.content.loc.start.offset, 'vue:interpolation')
        } else flush()
      }
      flush()
      if (node.type !== 1) return
      for (const prop of node.props) {
        if (prop.type === 6 && prop.value && KOREAN.test(prop.value.content)) {
          if (DISPLAY_ATTRIBUTES.has(prop.name)) this.add([prop.value.content], [], {...origin(source, file, base + prop.value.loc.start.offset), usage: 'ui', context: 'vue:attribute:' + prop.name})
          else this.exclude(file, source, base + prop.loc.start.offset, 'non-display-attribute:' + prop.name)
        } else if (prop.type === 7 && prop.exp) {
          // Read strings in render expressions/handlers, but not v-for bindings or
          // non-display bound attributes (model, keys, CSS, URLs, identifiers).
          const argument = prop.arg?.type === 4 ? prop.arg.content : undefined
          if (prop.name === 'bind' && argument && !DISPLAY_ATTRIBUTES.has(argument)) {
            if (KOREAN.test(prop.exp.loc.source)) this.exclude(file, source, base + prop.loc.start.offset, 'non-display-binding:' + argument)
          } else if (prop.name !== 'for' && prop.name !== 'model') expression(prop.exp.loc.source, prop.exp.loc.start.offset, 'vue:directive:' + prop.name, prop.name === 'on')
        }
      }
    }]}})
    if (output.errors.length) throw Error(file + ': template: ' + String(output.errors[0]))
  }
}

export function collectRepository(root: string): Inventory {
  const catalog = new SourceCatalog(), realRoot = realpathSync(root)
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name), file = relative(realRoot, full).split(sep).join('/')
      if (entry.isSymbolicLink()) throw Error('Source symlink requires explicit review: ' + file)
      if (entry.isDirectory()) {if (!['node_modules', 'locales'].includes(entry.name)) visit(full)}
      else if (['.ts', '.vue', '.json'].includes(extname(entry.name)) && !entry.name.endsWith('.d.ts') && !/^src\/client\/locale(?:-global)?\.ts$/.test(file)) {
        const bytes = readFileSync(full), source = bytes.toString('utf8')
        if (!Buffer.from(source, 'utf8').equals(bytes)) throw Error('Source is not valid UTF-8: ' + file)
        catalog.collect(file, source)
      }
    }
  }
  for (const dir of ['src', 'mods']) if (existsSync(join(realRoot, dir))) {
    if (lstatSync(join(realRoot, dir)).isSymbolicLink()) throw Error('Source symlink requires explicit review: ' + dir)
    visit(join(realRoot, dir))
  }
  return catalog.result()
}

export function writeInventory(root: string, out: string) {
  const rootPath = realpathSync(root), outPath = resolve(out), resultsRoot = join(rootPath, 'test-results')
  if (!isWithin(outPath, resultsRoot)) throw Error('--out must be a fresh directory below this checkout/test-results')
  if (existsSync(outPath)) throw Error('Output already exists: ' + outPath)
  // Resolve existing ancestors before mkdir to reject output symlink escapes.
  let ancestor = dirname(outPath)
  while (!existsSync(ancestor)) ancestor = dirname(ancestor)
  if (!isWithin(realpathSync(ancestor), rootPath) && realpathSync(ancestor) !== rootPath) throw Error('Output ancestor escapes checkout')
  if (rootPath.split(sep).includes('.ashveil-checkpoints') || existsSync(rootPath + '-manifest.json')) throw Error('Do not write catalog output inside an immutable checkpoint')
  if (existsSync(resultsRoot) && realpathSync(resultsRoot) !== resultsRoot) throw Error('test-results must not be a symlink')
  if (ancestor !== rootPath && realpathSync(ancestor) !== resultsRoot && !isWithin(realpathSync(ancestor), resultsRoot)) throw Error('Output ancestor escapes test-results')
  const inventory = collectRepository(rootPath)
  for (const [file, expected] of Object.entries(inventory.inputs)) if (hash(readFileSync(join(rootPath, file))) !== expected) throw Error('Source changed while collecting: ' + file)
  mkdirSync(dirname(outPath), {recursive: true})
  mkdirSync(outPath, {recursive: false})
  writeFileSync(join(outPath, 'catalog.json'), JSON.stringify(inventory, null, 2) + '\n', {flag: 'wx'})
  const summary = {version: inventory.version, inputFiles: Object.keys(inventory.inputs).length, entries: inventory.entries.length, literals: inventory.entries.filter(entry => entry.kind === 'literal').length, formats: inventory.entries.filter(entry => entry.kind === 'format').length, occurrences: inventory.entries.reduce((n, entry) => n + entry.occurrences.length, 0), exclusions: inventory.excluded.length, byUsage: Object.fromEntries(['ui', 'log', 'content', 'candidate'].map(usage => [usage, inventory.entries.filter(entry => entry.occurrences.some(at => at.usage === usage)).length])), inputBytesUnchanged: true}
  writeFileSync(join(outPath, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', {flag: 'wx'})
  return summary
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--out') throw Error('Usage: node --import tsx tools/localization/source-catalog.ts --out test-results/NEW_DIRECTORY')
    console.log(JSON.stringify(writeInventory(process.cwd(), process.argv[3])))
  } catch (error) {console.error(error instanceof Error ? error.message : String(error));process.exitCode = 1}
}
