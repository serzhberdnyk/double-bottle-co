import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {phuketAirportPOI} from '../app/reference-preview/supplementary-pois';
import {supplementaryArtAnchors} from '../app/reference-preview/reference-art-anchors';

test('The newly selected THAI-jet beach original is byte-identical, not either edited variant',()=>{
  const data=readFileSync('public/media/reference/phuket-airport-beach-original.png');
  assert.equal(createHash('sha256').update(data).digest('hex'),'f3032a13ac7c6228ad90d05c2046d7d5d046ead09b54c5ed7bd192c61536caa9');
  assert.equal(data.readUInt32BE(16),1254);assert.equal(data.readUInt32BE(20),1254);
  assert.equal(phuketAirportPOI.image,'/media/reference/airport-plane-cutout.png');
  assert.equal(phuketAirportPOI.imageSize,48);assert.deepEqual(supplementaryArtAnchors['phuket-airport'],{x:257,y:226});
  assert.equal(phuketAirportPOI.descriptions[0],'Информация об аэропорте появится здесь.');
});

test('The original uses the generic image branch while target and existing motion stay intact',()=>{
  const art=readFileSync('app/reference-preview/POIArtwork.tsx','utf8');
  assert(art.includes("item.kind==='airport'&&item.image==='/media/reference/airport-plane.svg'"));
  assert(art.includes('src={item.image}'));
  const css=readFileSync('app/reference-preview/MapPOI.module.css','utf8');
  assert(css.includes('width:56px'));assert(css.includes('height:64px'));
  assert(css.includes('translate(-50%,-3px) scale(1.12)'));assert(css.includes('scale(.96)'));
  assert(css.includes('prefers-reduced-motion:reduce'));assert(!css.includes('.artTrigger::after'));
  const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
  assert(!home.includes('MapFilters'));assert(!home.includes('styles.compass'));assert(!home.includes('styles.mapHint'));
});
