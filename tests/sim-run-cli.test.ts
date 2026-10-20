import {describe,it,expect,afterEach} from 'vitest'
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync} from 'node:child_process'
const roots:string[]=[]
const run=(...args:string[])=>spawnSync(process.execPath,['--import','tsx','tools/ashveil-sim.ts',...args],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024})
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})})
describe('시드/모드/기간 지정 시뮬레이션 CLI 실제 실행',()=>{
 it('실제 JSON/파일 보고서는 같은 내용이며 해시/모드/종료 TU를 포함하고 기존 보고서는 보존한다',()=>{
  const root=mkdtempSync(join(tmpdir(),'ashveil-sim-run-'));roots.push(root);const out=join(root,'report.json'),args=['run','--seed','actual-cli-simulation','--mods','sample-patrol-contract','--days','0.0001','--bots','2','--out',out,'--json'],result=run(...args);expect(result.status,result.stderr).toBe(0);const body=JSON.parse(result.stdout);expect(JSON.parse(readFileSync(out,'utf8'))).toEqual(body);expect(body.mods.map((mod:{id:string})=>mod.id)).toEqual(['core','sample-patrol-contract']);expect(body.rows.map((row:{seed:string})=>row.seed)).toEqual(['actual-cli-simulation:0','actual-cli-simulation:1']);expect(body.rows.every((row:{actualTU:number;endTU:number;initialHash:string;hash:string})=>row.actualTU===row.endTU&&/^[0-9a-f]{8}$/.test(row.hash)&&/^[0-9a-f]{8}$/.test(row.initialHash))).toBe(true);writeFileSync(out,'keep report');const duplicate=run(...args);expect(duplicate.status).toBe(1);expect(JSON.parse(duplicate.stderr).error).toContain('덮어쓰지');expect(readFileSync(out,'utf8')).toBe('keep report')
 },30000)
 it('사람용 출력/던전 모드도 실제 콘텐츠와 동일 시드 결과를 표시한다',()=>{const result=run('run','--seed','human-cli','--days','0.0001','--dungeon');expect(result.status,result.stderr).toBe(0);expect(result.stdout).toContain('실제 콘텐츠: sha256-');expect(result.stdout).toContain('human-cli: 생존(시간 종료)');expect(result.stdout).toContain('사건')},30000)
 it('잘못된 인자/없는 모드는 구조화한 오류와 실패 종료를 반환한다',()=>{for(const args of [['run','--seed','x','--days','0'],['run','--seed','x','--days','0.000000001'],['run','--seed','x','--mods','missing-mod','--days','0.0001']]){const result=run(...args,'--json');expect(result.status).toBe(1);expect(JSON.parse(result.stderr).error.length).toBeGreaterThan(0);expect(result.stdout).toBe('')}},30000)
})
