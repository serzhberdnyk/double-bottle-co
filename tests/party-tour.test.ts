import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usesCompactTourLayout,compactTourModel} from '../lib/public/compact-tour';
import {approvedTourCover} from '../lib/public/tour-cover';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,type ImportPacket} from '../lib/server/management';
import {product} from '../lib/server/catalog';
const target={id:'p_26d3b3eb87f65341b3af9fcc',slug:'phi-phi-racha-party'};
test('Party approved artwork and comic layout opt in only exact approved product',()=>{
 assert(usesCompactTourLayout(target));assert(approvedTourCover(target)?.src.includes('phi-phi-racha-party-approved'));
 for(const t of [{...target,id:'wrong'},{...target,slug:'phi-phi-sunrise'}]){assert(!usesCompactTourLayout(t));assert.equal(approvedTourCover(t),null);}
 const css=readFileSync('app/components/CompactTourDetail.module.css','utf8');assert(css.includes('aspect-ratio: 3 / 2; object-fit: contain'));
});
test('Party presentation retains literal itinerary, extras, conditions and destination links',async()=>{
 const db=testDatabase();const packet=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;
 const r=await stageImport(db,packet,'racha-party-test');await publishRelease(db,r.id,0,'racha-party-test');
 const p=await product(db,'phi-phi-racha-party');assert(p);const v=p.tour.variants[0],before=JSON.stringify(p),m=compactTourModel(p.tour,v);
 assert.deepEqual(m.itinerary,v.itinerary);assert.deepEqual(m.extras,v.extras);assert.equal(m.itinerary.length,5);assert.equal(JSON.stringify(p),before);
 assert(v.conditions.every(s=>[...m.conditions,...m.routeNotes].includes(s)));
 const view=readFileSync('app/components/CompactTourDetail.tsx','utf8');assert(view.includes("encodeURIComponent(stop.destinationId)"));assert(view.includes('visitNames[stop.visitType]'));
 const host=readFileSync('app/components/CatalogUI.tsx','utf8');for(const token of ['priceOptionKey={option?.key||optionKey}','variantSelector={selectors}','<InquiryForm tour={tour} variant={v} releaseId={releaseId}'])assert(host.includes(token));
});

test('Illustrated covers omit generic caption; photo fallback retains its caveat',()=>{ const view=readFileSync('app/components/CompactTourDetail.tsx','utf8');assert(view.includes("{!cover && !isApprovedReviewTour(tour)"));assert(!view.includes('Иллюстрация направления.'));assert(view.includes('Пейзаж направления. Конкретное судно и оснащение уточняются.')); });
