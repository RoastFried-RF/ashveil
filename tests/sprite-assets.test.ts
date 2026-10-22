import {describe,it,expect} from 'vitest'
import {mkdtempSync,copyFileSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {validateSpriteAssets} from '../tools/sprite-validation'
const png=resolve('public/sprites/original/items/ashveil-whitecap.png')
const basic=()=>({sheets:{crop:'image.png'},frames:{cap:['crop',0,0,32,32]},anims:{still:{frames:['cap'],fps:1}},chars:{},ui:{}})
function fixture(run:(root:string)=>void){const root=mkdtempSync(join(tmpdir(),'ashveil-sprite-check-'));try{copyFileSync(png,join(root,'image.png'));run(root)}finally{rmSync(root,{recursive:true,force:true})}}
describe('실제 스프라이트 자산 계약',()=>{
 it('전체 실제 배포 manifest의 PNG·프레임·애니메이션·캐릭터·UI 참조가 유효하다',()=>{const manifest=JSON.parse(readFileSync('src/client/sprites.json','utf8'));const d=validateSpriteAssets(resolve('public'),manifest);expect(d.errors).toEqual([]);expect(d.valid).toBe(true);expect(d.counts.characters).toBeGreaterThan(0)})
 it('정상32px 프레임과 같은 프레임을 쓰는 아이콘은 추가 파일을 요구하지 않는다',()=>fixture(root=>{const d=validateSpriteAssets(root,basic(),['cap','cap']);expect(d.valid).toBe(true);expect(d.counts.icons).toBe(1);expect(d.counts.uniquePngFiles).toBe(1)}))
 it('잘린 PNG와 실제 바이트 손상 CRC를 실패로 보고한다',()=>fixture(root=>{const bytes=readFileSync(png);writeFileSync(join(root,'image.png'),bytes.subarray(0,20));expect(validateSpriteAssets(root,basic()).errors.join()).toMatch(/PNG/);bytes[bytes.length-1]^=1;writeFileSync(join(root,'image.png'),bytes);expect(validateSpriteAssets(root,basic()).errors.join()).toMatch(/CRC/)}))
 it('유효 종료 청크 한 개 중복만 경고로 보존하고 다른 꼬리 데이터는 거절한다',()=>fixture(root=>{const bytes=readFileSync(png);writeFileSync(join(root,'image.png'),Buffer.concat([bytes,bytes.subarray(-12)]));const d=validateSpriteAssets(root,basic());expect(d.valid).toBe(true);expect(d.warnings).toHaveLength(1);writeFileSync(join(root,'image.png'),Buffer.concat([bytes,Buffer.from('unexpected')]));expect(validateSpriteAssets(root,basic()).errors.join()).toMatch(/알 수 없는 데이터/)}))
 it('시트 밖의 픽셀 영역과 누락된 애니메이션 프레임을 함께 찾는다',()=>fixture(root=>{const m=basic();m.frames.cap=['crop',1,0,32,32];m.anims.still.frames=['missing'];const d=validateSpriteAssets(root,m);expect(d.valid).toBe(false);expect(d.errors.join()).toMatch(/PNG 범위/);expect(d.errors.join()).toMatch(/등록되지 않은 frame missing/)}))
 it('외부 URL·상위 경로와 public에 없는 파일을 읽지 못하게 한다',()=>fixture(root=>{for(const path of['../outside.png','https://example.com/picture.png','/absolute.png','image.png?remote','%2e%2e/outside.png','image.png\u0000']){const m=basic();m.sheets.crop=path;expect(validateSpriteAssets(root,m).errors.join()).toMatch(/상대 PNG 경로/)}const d=validateSpriteAssets(root,basic(),['unavailable']);expect(d.errors.join()).toMatch(/tiles\/unavailable.png/)}))
 it('실제 캐릭터의 누락 방향·손상 앵커와 없는 생물표시 키를 검출한다',()=>fixture(root=>{const m={...basic(),chars:{bad:{walk:{down:['cap']},idle:{down:['cap']},anchor:[.5,2]}}};const d=validateSpriteAssets(root,m,[],['unavailable']);expect(d.valid).toBe(false);expect(d.errors.join()).toMatch(/walk.up/);expect(d.errors.join()).toMatch(/anchor/);expect(d.errors.join()).toMatch(/Creature: 등록되지 않은 char unavailable/)}))
 it('물품 목록에 없는 지형·렌더 전용 그림의 누락도 실제 파일까지 검사한다',()=>fixture(root=>{const d=validateSpriteAssets(root,basic(),[],[],{},['cap','missing_ground']);expect(d.valid).toBe(false);expect(d.counts.renderReferences).toBe(2);expect(d.errors.join()).toMatch(/render missing_ground.*tiles\/missing_ground.png/)}))
})
