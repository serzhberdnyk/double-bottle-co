import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bigBuddha} from '../app/reference-preview/reference-landmarks';
import {geometryContains} from '../lib/public/map-engine';
import {project} from '../lib/public/geo';
import {referenceCatalogQuery} from '../app/reference-preview/reference-catalog';

test('Reference map keeps the supplied artwork byte-for-byte', () => {
  const image=readFileSync('public/media/reference/andaman-user-map.png');
  assert.equal(createHash('sha256').update(image).digest('hex'),'7ca6d8929c8f9eac90fb45a878b7ebc41fabc4e545f2ecbe310177f3991475df');
  assert.equal(image.readUInt32BE(16),1280);
  assert.equal(image.readUInt32BE(20),1083);
});

test('Hero filters keep canonical destination IDs in the existing catalogue query',()=>{
  const query=new URLSearchParams(referenceCatalogQuery({destination:'phi-phi-don',category:'sea',limit:4,release:'edition-1',featured:true}));
  assert.equal(query.get('destination'),'phi-phi-don');assert.equal(query.get('category'),'sea');
  assert.equal(query.get('limit'),'4');assert.equal(query.get('release'),'edition-1');assert(!query.has('featured'));
  assert.equal(referenceCatalogQuery({category:undefined,destination:undefined}),'');
});

test('Exact-art hero never overlays the unaligned geographic engine or manual anchors',()=>{
  const component=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
  assert(!component.includes('<IslandMap '));assert(!component.includes('referenceMapPins'));
  assert(component.includes('andaman-user-map.png'));assert(component.includes('data-map-mode="illustration"'));
  assert(!component.includes('<DestinationDirectory'));assert(component.includes('styles.heroBrand} href="/#selected"'));
  assert(!component.includes('styles.mapHint'));assert(component.includes('<SupplementalArtPOIs/>'));
});

test('Big Buddha stays on its verified Phuket coordinate without invented catalogue bindings',()=>{
  assert.equal(bigBuddha.lat,7.827778);assert.equal(bigBuddha.lng,98.312778);
  assert.deepEqual(bigBuddha.confirmedTourIds,[]);
  const geo=JSON.parse(readFileSync('public/map/andaman.geojson','utf8'));
  const containing=geo.features.filter((feature:{geometry:Parameters<typeof geometryContains>[0]})=>geometryContains(feature.geometry,[bigBuddha.lng,bigBuddha.lat]));
  assert.equal(containing.length,1);assert.equal(containing[0].properties.id,1);
  const [x,y]=project(bigBuddha.lng,bigBuddha.lat);assert(x>0&&x<1000&&y>0&&y<750);
  const component=readFileSync('app/reference-preview/BigBuddhaMarker.tsx','utf8');
  assert(component.includes('project(bigBuddha.lng,bigBuddha.lat)'));
  assert(component.includes('Подтвержд')||component.includes('подтверждённой остановкой'));
  assert(component.includes('режим работы нужно уточнять отдельно'));
});

test('Requested visual labels are suppressed only in editorial map, while headline and access remain',()=>{
  const map=readFileSync('app/components/IslandMap.tsx','utf8');
  const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
  assert(map.includes(`variant!=='editorial'&&<text data-region="phuket"`));
  assert(!map.includes('>ЯО<'));assert(home.includes('copy.headline.map'));
  assert(home.includes('appliedFilters'));assert(home.includes('useReferenceCatalog(initial,initialQuery,onlyFavorites)'));
  assert(home.includes('Сохранили предыдущую подборку.'));
});
