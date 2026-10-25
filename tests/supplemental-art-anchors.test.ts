import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {supplementaryArtAnchors,supplementalArtAnchorFor,artCalibration,schematicPlacementNotice} from '../app/reference-preview/reference-art-anchors';
import {artAnchorPosition,supplementaryPOIs} from '../app/reference-preview/supplementary-pois';
import {phuketAirport} from '../app/reference-preview/airport-landmark';
import {bigBuddha} from '../app/reference-preview/reference-landmarks';

test('Only the two reviewed supplementary POIs receive schematic anchors',()=>{
  assert.deepEqual(Object.keys(supplementaryArtAnchors).sort(),['big-buddha','phuket-airport']);
  assert.deepEqual(supplementaryArtAnchors['phuket-airport'],{x:257,y:226});
  assert.deepEqual(supplementaryArtAnchors['big-buddha'],{x:263,y:430});
  assert.equal(supplementalArtAnchorFor('phi-phi-don'),null);assert.equal(supplementalArtAnchorFor('coral'),null);
  assert.equal(supplementaryPOIs.length,2);assert.equal(artCalibration.visualAllowancePx,25);
  assert.match(schematicPlacementNotice,/схематичное/);
});

test('GPS remains independent of locally inferred image anchors',()=>{
  assert.equal(phuketAirport.lat,8.1125);assert.equal(phuketAirport.lng,98.3091666667);
  assert.equal(bigBuddha.lat,7.827778);assert.equal(bigBuddha.lng,98.312778);
  const layer=readFileSync('app/reference-preview/SupplementalArtPOIs.tsx','utf8');
  assert(!layer.includes('project('));assert(layer.includes('supplementalArtAnchorFor(item.id)'));
  assert(layer.includes('placementNotice={schematicPlacementNotice}'));
});

test('Image and markers use one uniformly sized source plane at every crop',()=>{
  for(const width of [1180,1100,760,624]){
    const height=width*1083/1280;
    for(const anchor of Object.values(supplementaryArtAnchors)){
      const css=artAnchorPosition(anchor);
      assert(Math.abs(parseFloat(css.left)/100*width-anchor.x*width/1280)<1e-8);
      assert(Math.abs(parseFloat(css.top)/100*height-anchor.y*width/1280)<1e-8);
    }
  }
  const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
  const plane=home.slice(home.indexOf('<div className={styles.sourceArtPlane}>'),home.indexOf('<div className={styles.readabilityMask}'));
  assert(plane.includes('styles.sourceMapImage'));assert(plane.includes('<SupplementalArtPOIs/>'));
  assert(!home.includes('className={styles.sourceMapScene} aria-hidden'));
  const css=readFileSync('app/reference-preview/reference.module.css','utf8');
  assert(css.includes('aspect-ratio:1280/1083'));assert(css.includes('.sourceMapScene {z-index:auto;mask-image:none}'));
});
