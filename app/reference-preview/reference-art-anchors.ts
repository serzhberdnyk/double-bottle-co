/** Schematic positions on the unchanged 1280 × 1083 painting, NOT GPS coordinates.
 * Local Phuket coast calibration: seven fit controls, five withheld checks.
 * Held-out RMSE 8.51 source px, maximum 14.34 px. Interior sites are not depicted.
 * Conservative ±25 px visual allowance is judgmental, not a confidence interval.
 * Parent reviewed the diagnostic proof on 2026-10-08 at 14:43 UTC.
 * Canonical GPS positions stay in airport-landmark.ts / reference-landmarks.ts.
 */
export const supplementaryArtAnchors = {
  'phuket-airport':{x:257,y:226},
  'big-buddha':{x:263,y:430},
} as const;
export const schematicPlacementNotice='Расположение на иллюстрации схематичное.';
export const artCalibration={sourceWidth:1280,sourceHeight:1083,visualAllowancePx:25,method:'local-phuket-coast-controls',heldOutRmsePx:8.51,heldOutMaxPx:14.34} as const;

export function supplementalArtAnchorFor(id:string) {
  return id==='phuket-airport'||id==='big-buddha' ? supplementaryArtAnchors[id] : null;
}
