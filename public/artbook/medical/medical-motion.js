export const medicalCycles = { examine: 1600, wrap: 1400, wash: 1400, splint: 1800, needle: 1500, cut: 1700, extract: 1600, reduce: 1800, dose: 1200 };
export function medicalPropSpec(kind, primary, item) {
    const needle = primary && kind === 'needle', blade = primary && ['cut', 'extract'].includes(kind);
    return { ...item, grip: needle ? [.7, .3] : blade ? [.52, .79] : [.5, .65], axis: needle ? Math.PI * .75 : -Math.PI / 2, length: needle ? 5 : !primary ? 5 : blade ? 12 : kind === 'splint' ? 14 : kind === 'dose' ? 3 : kind === 'wash' ? 6 : 5 };
}
/** Rotation only: grip stays at the registered palm throughout the cycle. */
export function medicalPropAngle(kind, direction, phase) {
    const facing = direction === 'left' ? -1 : 1, base = direction === 'up' ? -Math.PI / 2 : direction === 'down' ? Math.PI / 2 : direction === 'left' ? Math.PI : 0, t = phase - Math.floor(phase);
    const movement = kind === 'needle' ? .16 : kind === 'cut' ? .24 : kind === 'wash' ? .13 : kind === 'wrap' ? .2 : .06;
    return base + Math.sin(t * Math.PI * 2) * movement * facing;
}
export function medicalGripPosition(point, frame, crouched = false) {
    return { x: (point[0] - frame.anchor[0] * frame.width) * frame.scale * (frame.flipX ? -1 : 1), y: (point[1] - frame.anchor[1] * frame.height) * frame.scale * (crouched ? .78 : 1) };
}
