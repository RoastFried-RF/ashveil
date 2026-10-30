import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {readPackages} from '../tools/loadContent'
import {loadMods} from '../src/core/defs'
import {encodeModFile} from '../src/core/mod-textures'

describe('native filesystem content parity',()=>{
  it('loads actual scripts and PNG bytes through native paths before selecting mods',()=>{
    const packages=readPackages()
    const script=packages.find(p=>p.manifest.id==='sample-script-hooks')!
    expect(script).toBeDefined()
    expect(script.scripts).toHaveLength(1)
    expect(script.scripts![0].file).toBe(script.manifest.scripts!.entry)
    expect(script.scripts![0].source).toBe(readFileSync(join('mods','sample-script-hooks',script.manifest.scripts!.entry!),'utf8'))
    const textures=packages.find(p=>p.manifest.id==='sample-original-textures')!
    expect(textures).toBeDefined()
    expect(Object.keys(textures.textures??{}).length).toBeGreaterThan(0)
    for(const [path,value]of Object.entries(textures.textures!)){
      expect(value).toBe(encodeModFile(path,readFileSync(join('mods','sample-original-textures',path))))
    }
    const loaded=loadMods(packages)
    expect(loaded.report.errors).toEqual([])
  })
})
