import{describe,it,expect}from'vitest'
import{humanArt}from'../src/client/render/human-art'
import{humanDirections,humanFineOwners,humanOwners,humanFootSource,humanWithHead,humanToeSuffixes,type HumanPoint}from'../src/client/render/human-spec'
import{detailMaskPieces,digitLossMarks,faceLossMarks,lossAdjustedFoot,lossMarkMatrix,polygonArea,type HumanLossMark}from'../src/client/render/human-details'
import{hAt,hTransform,humanPose,hpLength,hpSub}from'../src/client/render/human-model'
import{humanSurfaceState}from'../src/client/render/human-state'
import{prisonerFixture}from'./prisoner-fixture'
import{makeItem}from'../src/core/items'
import{serialize}from'../src/core/save'
import manifest from'../src/client/sprites.json'
const inside=(p:HumanPoint,poly:readonly HumanPoint[])=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
const mark=(polygon:HumanPoint[]):HumanLossMark=>({polygon,owner:'LeftIndex',patch:'finger_cap',layer:'skin',cap:[0,0],width:1})
describe('visible source-owned fine anatomy',()=>{
 it('compound overlapping losses remove their union once, including a concave source clip',()=>{
  const square:HumanPoint[]=[[0,0],[16,0],[16,16],[0,16]],l:HumanPoint[]=[[0,0],[16,0],[16,8],[8,8],[8,16],[0,16]],a=mark([[2,2],[10,2],[10,10],[2,10]]),b=mark([[6,6],[14,6],[14,14],[6,14]]),hole=mark([[4,4],[12,4],[12,12],[4,12]])
  for(const[clip,marks,area]of [[square,[a,b],144],[l,[hole],144]]as const){const pieces=detailMaskPieces(clip,marks);expect(pieces.reduce((sum,p)=>sum+polygonArea(p),0)).toBeCloseTo(area,7);for(let y=.31;y<16;y+=.71)for(let x=.27;x<16;x+=.73){const p:[number,number]=[x,y];expect(pieces.some(poly=>inside(p,poly))).toBe(inside(p,clip)&&!marks.some(m=>inside(p,m.polygon)))}}
  expect(detailMaskPieces(square,[b,a]).reduce((sum,p)=>sum+polygonArea(p),0)).toBeCloseTo(144,7)
 })
 it('allocates each actual missing digit to its own side without changing any physical state',()=>{
  for(const owner of humanFineOwners){const{w,p,s}=prisonerFixture();p.body.missing=[owner];const before=serialize(s),surface=humanSurfaceState(w,p,humanOwners)!;expect(surface.parts[owner]).toMatchObject({flesh:false,present:false});const side=owner.startsWith('Left')?'left':'right',other=side==='left'?'right':'left',foot=owner.includes('Toe')
   for(const direction of humanDirections){const base=humanArt.base[direction],source=foot?humanFootSource(base,side):base.forearm[side],marks=digitLossMarks(humanArt,source,side,surface.parts,foot);expect(marks.every(m=>m.owner===owner)).toBe(true);expect(digitLossMarks(humanArt,foot?humanFootSource(base,other):base.forearm[other],other,surface.parts,foot)).toEqual([]);if(!foot||direction==='down')expect(marks).toHaveLength(1)}
   expect(serialize(s)).toBe(before)
  }
 })
 it('whole-limb loss and actual prosthetics stay authoritative for the fine descendants',()=>{
  const{w,p}=prisonerFixture();p.body.missing=['RightHand','LeftShin'];const item=makeItem(w,'Item.PioneerArm');p.body.prosthetics={RightHand:{def:'Prosthetic.PioneerArm',item,installedAt:1,servicedAt:1,powerUntil:1e9}};const before=serialize(w.s),surface=humanSurfaceState(w,p,humanOwners)!;for(const suffix of ['Thumb','Index','Middle','Ring','Pinky'])expect(surface.parts['Right'+suffix].flesh).toBe(false);for(const suffix of humanToeSuffixes)expect(surface.parts['Left'+suffix]).toMatchObject({flesh:false,present:false});expect(surface.parts.RightHand).toMatchObject({flesh:false,replacement:{uid:item.uid}});expect(serialize(w.s)).toBe(before)
 })
 it('uses eight separate observed foot crops; frontal big toes point toward the anatomical inner edge',()=>{
  const keys=new Set<string>();for(const direction of humanDirections)for(const side of['left','right']as const){const source=humanFootSource(humanArt.base[direction],side);keys.add(source.frame);expect(source.solePinned).toBe(true);expect(manifest.frames[source.frame as keyof typeof manifest.frames]).toBeDefined()}
  expect(keys.size).toBe(8);for(const side of['left','right']as const){const source=humanFootSource(humanArt.base.down,side),toe=humanArt.details!.footDetails[source.frame].cuts.Toe1!;expect(Math.sign(toe.cap[0]-source.a[0])).toBe(side==='left'?-1:1)}
 })
 it('pins the measured visible sole and ankle for all32toe-loss masks without rotating or stretching the original',()=>{
  const{w,p}=prisonerFixture(),feet={left:{x:2,y:0,lift:0,contact:true,present:true,swing:false},right:{x:-2,y:0,lift:0,contact:true,present:true,swing:false}}
  for(const direction of humanDirections)for(let mask=0;mask<32;mask++){p.body.missing=humanToeSuffixes.flatMap((suffix,i)=>mask&(1<<i)?['Left'+suffix,'Right'+suffix]:[]);const surface=humanSurfaceState(w,p,humanOwners)!,footSources={left:lossAdjustedFoot(humanArt,humanFootSource(humanArt.base[direction],'left'),'left',surface.parts),right:lossAdjustedFoot(humanArt,humanFootSource(humanArt.base[direction],'right'),'right',surface.parts)},pose=humanPose(humanArt.base[direction],{direction,root:[0,0],mode:'idle',phase:0,stride:0,moving:false,crouched:false,prone:false,alive:true,fall:0,footSources},feet)
   for(const side of['left','right']as const){const source=footSources[side],bone=pose.bones[(side==='left'?'Left':'Right')+'Foot'];expect(hpLength(hpSub(hTransform(bone.matrix,source.b),[feet[side].x,feet[side].y]))).toBeLessThan(1e-10);expect(hpLength(hpSub(hTransform(bone.matrix,source.a),bone.a))).toBeLessThan(1e-10);expect(bone.matrix[1]).toBe(0);expect(bone.matrix[2]).toBe(0);expect(bone.matrix[0]).toBe(bone.matrix[3]);expect(source.b[1]).toBeCloseTo(humanArt.details!.footDetails[source.frame].soleYByMissingMask[mask],8);if(direction==='up')expect(digitLossMarks(humanArt,source,side,surface.parts,true)).toEqual([])}
  }
 })
 it('masks visible face losses for every role and keeps source patches pinned to their own feature, never to a hidden back face',()=>{
  const{w,p}=prisonerFixture();p.body.missing=['LeftEye','RightEye','Nose','Jaw','LeftEar','RightEar'];const surface=humanSurfaceState(w,p,humanOwners)!
  for(const role of['',...Object.keys(humanArt.heads!)])for(const direction of humanDirections){const source=humanWithHead(humanArt,role).base[direction].head,frame=manifest.frames[source.frame as keyof typeof manifest.frames],size={w:frame[3]as number,h:frame[4]as number},marks=faceLossMarks(source,direction,size,surface.parts),parent=hAt(source.a,[0,-20],source.scale??.06)
   if(direction==='up'){expect(marks).toEqual([]);continue}
   expect(marks.filter(m=>m.owner.endsWith('Eye'))).toHaveLength(direction==='down'?2:1)
   for(const m of marks){const patch=humanArt.details!.patches[m.patch],matrix=lossMarkMatrix(parent,m,patch);expect(hpLength(hpSub(hTransform(matrix,patch.a),hTransform(parent,m.cap)))).toBeLessThan(1e-10)}
   const rect:[number,number][]=[[0,0],[size.w,0],[size.w,size.h],[0,size.h]];expect(detailMaskPieces(rect,marks).every(poly=>polygonArea(poly)>0)).toBe(true);if(source.face)expect(detailMaskPieces(source.face,marks).every(poly=>polygonArea(poly)>0)).toBe(true)
  }
 })
})
