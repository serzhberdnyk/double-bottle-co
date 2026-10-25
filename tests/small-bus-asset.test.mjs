import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {busMapObject,smallBusImage,mapPlacementDisplayImage} from '../lib/public/map-layout.ts';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('approved small bus is exactly the transferred transparent PNG and original sprite is retained',()=>{
 const bytes=readFileSync('public'+smallBusImage);assert.equal(bytes.length,64908);assert.equal(sha(bytes),'23ae7e6faf8dbdbcb190ba20c228eacabe12b4aa232c1b16f39b14fd32441f28');
 assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),256);assert.equal(bytes.readUInt32BE(20),128);assert.equal(bytes[25],6);
 assert.equal(sha(readFileSync('public'+busMapObject.image)),'9b2c0a6431b867f4da9b6d185d3e2230e1a87456d510e58c310181570c8473a9');
});
test('compact rendering retains original stored identity, uploaded replacements and all other icons',()=>{
 const original={...busMapObject};assert.equal(mapPlacementDisplayImage(original),smallBusImage);assert.equal(original.image,busMapObject.image);
 const upload='/api/catalog-media/'+'a'.repeat(64);assert.equal(mapPlacementDisplayImage({...original,image:upload}),upload);
 assert.equal(mapPlacementDisplayImage({...original,id:'another-icon'}),busMapObject.image);
});
