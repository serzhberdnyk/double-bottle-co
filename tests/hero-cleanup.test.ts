import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync('app/reference-preview/ReferenceHome.tsx','utf8');

test('Requested cleanup removes only the hero directions panel, caption and compass',()=>{
  for(const removed of ['MapFilters','DestinationDirectory','styles.compass','styles.mapHint','Отметки мест схематичны. Экскурсии — в списке направлений.'])assert(!home.includes(removed),removed);
  assert(home.includes('<SupplementalArtPOIs/>'));
  assert(home.includes('andaman-user-map.png'));assert(home.includes('styles.sourceArtPlane'));
  assert(home.includes('styles.primaryAction} href="/#selected"'));assert(home.includes('styles.heroBrand} href="/#selected"'));
  assert(!home.includes('<header'));assert(!home.includes('copy.eyebrow'));
});

test('Inline excursion access and honest POI placement notice survive hero cleanup',()=>{
  assert(home.includes('useReferenceCatalog(initial,initialQuery,onlyFavorites)'));assert(home.includes('onClick={handleLoadMore}'));
  assert(home.includes('Показать ещё'));assert(home.includes('ReferenceCard key={tour.id}'));
  assert(home.includes('aria-live="polite"'));assert(home.includes('firstAdded?.focus({preventScroll:true})'));
  assert(readFileSync('app/reference-preview/reference-art-anchors.ts','utf8').includes('Расположение на иллюстрации схематичное.'));
  assert(readFileSync('app/reference-preview/SupplementalArtPOIs.tsx','utf8').includes('placementNotice={schematicPlacementNotice}'));
  assert(readFileSync('app/reference-preview/supplementary-pois.ts','utf8').includes("image:'/media/reference/airport-plane-cutout.png'"));
});
