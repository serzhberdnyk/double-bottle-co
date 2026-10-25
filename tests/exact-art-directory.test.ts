import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {referenceDestinationHref} from '../app/reference-preview/reference-catalog';

test('Each canonical destination retains a direct, encoded catalogue route',()=>{
  const data=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8'));
  assert.equal(data.destinations.length,13);
  for(const destination of data.destinations){
    const url=new URL(referenceDestinationHref(destination.id),'https://example.invalid');
    assert.equal(url.pathname,'/');assert.equal(url.searchParams.get('destination'),destination.id);
    assert.equal([...url.searchParams.keys()].length,1);
  }
  assert.equal(new URL(referenceDestinationHref('x&category=sea'),'https://example.invalid').searchParams.get('destination'),'x&category=sea');
});

test('Directory includes accessible modal semantics, honest counts and nonspatial landmark cards',()=>{
  const source=readFileSync('app/reference-preview/DestinationDirectory.tsx','utf8');
  for(const text of ['Dialog.Trigger asChild','Dialog.Title','Dialog.Description','Dialog.Close','Dialog.Overlay','Dialog.Content','referenceDestinationHref(destination.id)','data-destination-id={destination.id}','Пока нет программ','<MapPOI key={item.id} item={item} placement="list" portalContainer={portalContainer}/>','supplementaryPOIs.map(item=>'])assert(source.includes(text),text);
  assert(!source.includes('project('));assert(!source.includes('onPointerMove'));
  assert(source.includes('href="/#selected"'));
  assert(source.includes('Информационные карточки дополнительных мест.'));
  const css=readFileSync('app/reference-preview/reference.module.css','utf8');
  assert(css.includes('.landmarkCard,.airportPopover {z-index:80}'));
  assert(css.includes('min-height:57px'));assert(css.includes('max-height:calc(100dvh - 32px)'));
});

test('Separate canonical catalogue still supports both list and real interactive geographic map',()=>{
  const catalogue=readFileSync('app/components/CatalogUI.tsx','utf8');
  assert(catalogue.includes('<IslandMap data={data}'));assert(catalogue.includes("setMode('map')"));assert(catalogue.includes("setMode('list')"));
  const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');
  assert(home.includes('useReferenceCatalog(initial,initialQuery,onlyFavorites)'));
  const hook=readFileSync('app/reference-preview/useReferenceCatalog.ts','utf8');
  const feed=readFileSync('app/reference-preview/reference-feed.ts','utf8');
  assert(hook.includes("fetch('/api/catalog?' + referenceCatalogQuery"));
  assert(feed.includes('if (!isCurrent(operation)) return false'));assert(feed.includes('appliedFilters: operation.filters'));
  assert(home.includes("key==='" )===false); // no competing query implementation in the page.
});
