import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {phuketAirportPOI} from '../app/reference-preview/supplementary-pois';
import {supplementaryArtAnchors} from '../app/reference-preview/reference-art-anchors';

test('Airport uses the approved wide transparent plane, without the circle/background crop',()=>{
  const png=readFileSync('public/media/reference/airport-plane-cutout.png');
  assert.equal(png.readUInt32BE(16),1774);assert.equal(png.readUInt32BE(20),887);assert.equal(png[25],6);
  assert.equal(phuketAirportPOI.image,'/media/reference/airport-plane-cutout.png');assert.equal(phuketAirportPOI.imageSize,48);
  assert.deepEqual(supplementaryArtAnchors['phuket-airport'],{x:257,y:226});
  const css=readFileSync('app/reference-preview/MapPOI.module.css','utf8');
  assert(css.includes('object-position:center bottom'));assert(!css.includes('border-radius:50%'));
  assert(css.includes('width:56px'));assert(css.includes('height:64px'));assert(css.includes('scale(1.12)'));
});
