// Node 환경용 콘텐츠 로더 (테스트·시뮬·검증 CLI 공용)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadMods, packagesFromFiles, type ModPackage } from '../src/core/defs'

function walk(dir: string, out: Record<string, unknown>) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (f.endsWith('.json')) out[p] = readFileSync(p, 'utf8')
    else if(f.endsWith('.js')&&p.split('/').includes('scripts'))out[p]=readFileSync(p,'utf8')
  }
}

export function readPackages(root = process.cwd()): ModPackage[] {
  const files: Record<string, unknown> = {}
  walk(join(root, 'src/content'), files)
  if (existsSync(join(root, 'mods'))) walk(join(root, 'mods'), files)
  return packagesFromFiles(files)
}

export function loadDb(enabled: string[] = [], root = process.cwd()) {
  return loadMods(readPackages(root), enabled)
}
