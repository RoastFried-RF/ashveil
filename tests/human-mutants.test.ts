import{it,expect}from'vitest'
import{readFileSync}from'node:fs'
import{humanArtFor,humanModels}from'../src/client/render/human-art'
import{humanDirections,humanOwners,humanSpecFrameKeys,humanWithHead,humanDigitSuffixes}from'../src/client/render/human-spec'
import{humanPose,hTransform,hpLength,hpSub}from'../src/client/render/human-model'
import{HumanGait}from'../src/client/render/human-gait'
import{digitLossMarks,lossAdjustedFoot}from'../src/client/render/human-details'
import{atlasPlan,type AtlasManifest}from'../src/client/render/atlas-plan'
import{humanSurfaceState}from'../src/client/render/human-state'
import{prisonerFixture}from'./prisoner-fixture'
import{serialize}from'../src/core/save'
const m=JSON.parse(readFileSync('src/client/sprites.json','utf8'))as AtlasManifest
const variants=['shade0','shade1','shade2','shade3','shade_chief','withered','withered_priest','spore0','spore1']
it('binds nine actual aliases to three distinct living bodies and nine distinct frontal faces, preserving historical clips',()=>{
 const bodies=new Set<string>(),heads=new Set<string>()
 for(const name of variants){const c=m.chars[name],spec=humanWithHead(humanArtFor(c.humanSpec),c.humanHead);expect(c.human).toBe(true);bodies.add(spec.id);heads.add(spec.base.down.head.frame);expect(c.portrait).toBe(spec.base.down.head.frame);expect(c.walk.down.length).toBeGreaterThan(0)}
 expect(bodies.size).toBe(3);expect(heads.size).toBe(9);expect(()=>humanArtFor('unregistered')).toThrow('Unknown registered human body')
})
it('requests selected mutant body/head/garment/loss sources; explicit diagnostics retain every prosthetic original',()=>{
 for(const name of variants){const c=m.chars[name],spec=humanArtFor(c.humanSpec),plan=atlasPlan(m,[],[name]);for(const key of humanSpecFrameKeys(spec,new Set()))expect(plan.sheets).toContain(m.frames[key][0]);const explicit=atlasPlan(m,humanSpecFrameKeys(spec),[name]);for(const key of humanSpecFrameKeys(spec))expect(explicit.sheets).toContain(m.frames[key][0]);for(const other of['shade','withered','spore'])if(other!==c.humanSpec)expect(plan.sheets).not.toContain('av392_mutant_'+other)}
 for(const kind of['shade','withered','spore'])expect(atlasPlan(m,[],[]).sheets).not.toContain('av392_mutant_'+kind)
})
it('keeps all authored head/arm/leg source landmarks inside the actual registered frame and the full-arm ownership split at the elbow',()=>{
 for(const key of['shade','withered','spore'])for(const direction of humanDirections){const b=humanArtFor(key).base[direction]
  for(const source of[b.head,b.torso,...Object.values(b.upper),...Object.values(b.forearm),...Object.values(b.legs)]){const[, , ,w,h]=m.frames[source.frame];for(const p of[source.a,source.b,...source.clip??[]]){expect(p[0]).toBeGreaterThanOrEqual(0);expect(p[0]).toBeLessThanOrEqual(w);expect(p[1]).toBeGreaterThanOrEqual(0);expect(p[1]).toBeLessThanOrEqual(h)}}
  for(const side of['left','right']as const){expect(b.upper[side].frame).toBe(b.forearm[side].frame);expect(b.upper[side].b).toEqual(b.forearm[side].a);expect(Math.max(...b.upper[side].clip!.map(p=>p[1]))).toBeGreaterThan(b.upper[side].b[1]);expect(Math.min(...b.forearm[side].clip!.map(p=>p[1]))).toBeLessThan(b.forearm[side].a[1])}
 }
})
it('retains fixed world stance anchors at each body size and uses uniformly scaled observed soles through actions and missing toes',()=>{
 const{w,p}=prisonerFixture();p.body.missing=['LeftToe1','RightToe3'];const before=serialize(w.s),surface=humanSurfaceState(w,p,humanOwners)!
 for(const key of['shade','withered','spore']){const spec=humanArtFor(key),gait=new HumanGait(spec.motionScale),seen=new Map<string,number[]>()
  for(let i=0;i<240;i++){const direction=humanDirections[Math.floor(i/60)],root:[number,number]=[i*.11,i*.06],feet=gait.update({root:{x:root[0],y:root[1]},facing:direction,moving:true,dtMs:16,instant:false}),b=spec.base[direction],sources={left:lossAdjustedFoot(spec,b.feet!.left,'left',surface.parts),right:lossAdjustedFoot(spec,b.feet!.right,'right',surface.parts)},pose=humanPose(b,{direction,root,mode:i%2?'walk':'attack',phase:i/240,stride:i*.007,moving:true,crouched:false,prone:false,alive:true,fall:0,footSources:sources},feet)
   for(const side of['left','right']as const){const foot=feet[side],id=side+':'+feet.epoch+':'+foot.plantId;if(foot.contact){if(seen.has(id))expect([foot.x,foot.y]).toEqual(seen.get(id));else seen.set(id,[foot.x,foot.y])}const bone=pose.bones[(side==='left'?'Left':'Right')+'Foot'];expect(hpLength(hpSub(hTransform(bone.matrix,sources[side].b),[foot.x-root[0],foot.y-root[1]-foot.lift]))).toBeLessThan(1e-9);expect(bone.matrix[0]).toBe(bone.matrix[3]);expect(bone.matrix[1]).toBe(0)}
  }expect(gait.update({root:{x:26.29,y:14.34},facing:'down',moving:false,dtMs:16,instant:false}).maxStanceDrift).toBe(0)
 }
 expect(serialize(w.s)).toBe(before)
})
it('uses the actual parent source and anatomical side for every fine hand loss on all three bodies',()=>{
 const{w,p}=prisonerFixture()
 for(const key of['shade','withered','spore'])for(const direction of humanDirections)for(const side of['left','right']as const)for(const suffix of humanDigitSuffixes){const spec=humanArtFor(key),owner=(side==='left'?'Left':'Right')+suffix;p.body.missing=[owner];const surface=humanSurfaceState(w,p,humanOwners)!,marks=digitLossMarks(spec,spec.base[direction].forearm[side],side,surface.parts);expect(marks.map(m=>m.owner)).toEqual([owner]);expect(marks[0].triangles!.length).toBeGreaterThan(0)}
})
it('keeps the ordinary human projection unchanged when new optional source sizing is absent',()=>{
 const normal=humanModels.human;expect(normal.motionScale).toBeUndefined();for(const direction of humanDirections){const b=normal.base[direction];expect(b.hipHeight).toBeUndefined();expect(b.torso.scale).toBeUndefined();for(const side of['left','right']as const)expect(b.upper[side].scale).toBeUndefined()}
})
