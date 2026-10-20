import { existsSync,readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import manifest from '../src/client/sprites.json'
import { loadDb } from '../tools/loadContent'
function supplied(name:string){
  if(existsSync('public/tiles/'+name+'.png'))return true
  const frame=(manifest.frames as unknown as Record<string,[string,number,number,number,number]>)[name]
  if(!frame)return false
  const [sheet,x,y,w,h]=frame,file=(manifest.sheets as Record<string,string>)[sheet]
  if(!file||!existsSync('public/'+file)||x<0||y<0||w<1||h<1)return false
  const png=readFileSync('public/'+file)
  return png.length>=24&&png.subarray(1,4).toString()==='PNG'&&x+w<=png.readUInt32BE(16)&&y+h<=png.readUInt32BE(20)
}
describe('클라이언트 시작에 필요한 콘텐츠 아이콘', () => {
  it('코어와 샘플 모드의 모든 아이템은 실제 타일 또는 유효한 시트 영역을 참조한다', () => {
    for (const mods of [[], ['sample.grim']]) {
      const { db } = loadDb(mods)
      const absent = db.all('Item').filter((d) => !supplied(db.item(d.id).sprite)).map((d) => d.id+': '+db.item(d.id).sprite)
      expect(absent).toEqual([])
    }
  })
})
