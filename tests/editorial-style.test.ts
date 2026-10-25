import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {project} from '../lib/public/geo';

test('Illustrated revision preserves the canonical coastline bytes',()=>{
  assert.equal(createHash('sha256').update(readFileSync('public/map/andaman.geojson')).digest('hex'),'2ceb76e168ba4a3a24d92138b6625f2446de04061d94b190c5df1cf322be04ab');
});

test('Land texture covers the complete geographic source, including visible overflow',()=>{
  const geo=JSON.parse(readFileSync('public/map/andaman.geojson','utf8'));
  for(const feature of geo.features) {
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    for(const polygon of polygons)for(const ring of polygon)for(const [lng,lat] of ring){
      const [x,y]=project(lng,lat);assert(x>=-300&&x<=1150);assert(y>=-400&&y<=900);
    }
  }
  const art=readFileSync('app/components/GeoArtwork.tsx','utf8');
  assert(art.includes('clipPath={url(\'land-clip\')}'));assert(art.includes('clipRule="evenodd"'));
  assert(art.includes('illustrated-land.png" x="-300" y="-400" width="1450" height="1300"'));
  assert(art.includes('data-texture="decorative-not-elevation"'));
});

test('Painted surface assets are valid PNGs and do not replace geographic data',()=>{
  for(const [file,width,height] of [['illustrated-land.png',1448,1086],['illustrated-sea.png',1774,887]] as const){
    const png=readFileSync('public/media/reference/'+file);assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
  }
  assert(!readFileSync('lib/public/geo.ts','utf8').includes('illustrated'));
});

test('Airport artwork is substantially smaller while its native target remains accessible',()=>{
  const css=readFileSync('app/reference-preview/reference.module.css','utf8');
  assert(css.includes('.airportMarker img {width:24px;height:24px'));
  assert(css.includes('.airportMarker img {width:20px;height:20px}'));
  assert(css.includes('width:44px;height:44px;min-width:44px;min-height:44px'));
  assert(css.includes('padding:10px;border:0;border-radius:50%;background:transparent'));
});

test('Exact-art hero is a fixed uniform image crop without synthetic route or hit layers',()=>{
  const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
  assert(home.includes('styles.sourceMapImage'));assert(!home.includes('<IslandMap'));
  assert(!home.includes('<MapFilters'));assert(home.includes('<SupplementalArtPOIs/>'));
  const css=readFileSync('app/reference-preview/reference.module.css','utf8');
  assert(css.includes('.sourceMapImage {position:absolute;left:25.207%;top:-1.9%;width:81.4917%;height:auto'));
  assert(css.includes('.sourceMapScene {position:absolute;inset:0;z-index:1;pointer-events:none;'));
  assert(css.includes('left:-23.077%;top:13px;width:194.872%;height:auto'));
});
