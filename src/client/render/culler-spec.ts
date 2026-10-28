/** Four independently authored six-part sheets. Planar graphic calibration, not measured 3D. */
export type CullerPoint={x:number;y:number}
export type CullerDir='down'|'left'|'right'|'up'
export const cullerDriveIds=['DriveRF','DriveRM','DriveRH','DriveLF','DriveLM','DriveLH'] as const
export type CullerDriveId=typeof cullerDriveIds[number]
export type CullerToolId='left'|'right'
export type CullerAttackKind=CullerToolId|'acid'|'net'
export const cullerPartIds=['Chassis','PowerCore','ControlCircuit','CoolingLoop','SensorHead','OpticalSensor','AcousticSensor','ThermalSensor','Antenna',...cullerDriveIds,'LeftScytheArm','LeftScytheBlade','RightScytheArm','RightScytheBlade','AcidTank','NetLauncher']
export const cullerToolParts=(id:CullerToolId)=>id==='left'?['LeftScytheArm','LeftScytheBlade'] as const:['RightScytheArm','RightScytheBlade'] as const
export interface CullerDirectionSpec {
 art:{
  chassis:{frame:string;pivot:CullerPoint;scale:number;offset:CullerPoint}
  driveUpper:{frame:string;proximal:CullerPoint;distal:CullerPoint}
  driveLower:{frame:string;proximal:CullerPoint;distal:CullerPoint}
  foot:{frame:string;ankle:CullerPoint;sole:CullerPoint;scale:number}
  scytheUpper:{frame:string;proximal:CullerPoint;distal:CullerPoint}
  scytheBlade:{frame:string;proximal:CullerPoint;tip:CullerPoint}
 }
 layout:{
  upper:number;lower:number;stride:number;swingTravel:number;settleSeconds:number;clearance:number;deathLower:number
  legs:Record<CullerDriveId,{hip:CullerPoint;sole:CullerPoint;bend:CullerPoint;far:boolean;mirror:boolean}>
  tools:Record<CullerToolId,{shoulder:CullerPoint;upper:number;blade:number;guard:[number,number];windup:[number,number];follow:[number,number];dead:[number,number];mirror:boolean;far:boolean}>
  emitters:Record<'acid'|'net',CullerPoint>
 }
 /** Source BACK appendage faces/toe-heel ownership remain unverified even when displayed. */
 physical3DVerified:false
}
export interface CullerSpec {directions:Record<CullerDir,CullerDirectionSpec>;attackTools:Record<string,CullerAttackKind>}
export function cullerSpecFrameKeys(spec:CullerSpec){return [...new Set(Object.values(spec.directions).flatMap(d=>Object.values(d.art).map(p=>p.frame)))]}
