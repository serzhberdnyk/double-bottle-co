import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {approvedReviewQueue,isApprovedReviewTour} from '../lib/public/approved-review-queue';
import {usesCompactTourLayout,compactTourModel} from '../lib/public/compact-tour';
import {approvedTourCover} from '../lib/public/tour-cover';
import type {Tour,Variant} from '../lib/public/types';

test('All 39 approved review pages are exact ID and slug scoped, with 31 new covers and eight reused covers',()=>{
 assert.equal(approvedReviewQueue.length,39);assert.equal(approvedReviewQueue.filter(x=>'src' in x).length,31);
 for(const row of approvedReviewQueue){assert(usesCompactTourLayout(row));assert(approvedTourCover(row));assert(!isApprovedReviewTour({...row,id:'wrong'}));assert(!isApprovedReviewTour({...row,slug:'wrong'}));}
});
test('Every queued program preserves all itinerary and literal numeric conditions without mutating source data',()=>{
 for(const row of approvedReviewQueue){
 const tour={...row,title:'Tour',description:'Description'} as Tour;
 const v={name:'Основная',duration:'1 день',transport:'Лодка',format:'По запросу',description:'Описание',status:'on_request',itinerary:['Первый пункт','Второй пункт'],includes:['Трансфер 300 ฿'],extras:['Доплата 500 ฿'],conditions:['Детский тариф 1000 ฿','Рабочие дни: понедельник','Программа меняется из-за погоды.']} as Variant;
 const before=JSON.stringify(v),m=compactTourModel(tour,v);
 assert.deepEqual(m.itinerary,v.itinerary);assert.deepEqual(m.includes,v.includes);assert.deepEqual(m.extras,v.extras);assert(v.conditions.every(x=>[...m.conditions,...m.schedule,...m.routeNotes].includes(x)));assert.equal(JSON.stringify(v),before);
 }
});
test('All 43 cover masters match manifest hashes, and requests stay on the existing live workflow',()=>{
 const m=JSON.parse(readFileSync('docs/identity/cover-manifest.json','utf8'));assert.equal(m.covers.length,43);
 for(const r of m.covers)assert.equal(createHash('sha256').update(readFileSync(r.sourcePng)).digest('hex'),r.sha256);
 const view=readFileSync('app/components/CompactTourDetail.tsx','utf8');assert(view.indexOf('styles.photo')<view.indexOf('styles.program'));assert(view.indexOf('styles.program')<view.indexOf('styles.summaryCard'));
 assert(view.includes('!isApprovedReviewTour(tour)'));assert(view.includes('onRequest(event.currentTarget)'));
 const css=readFileSync('app/components/CompactTourDetail.module.css','utf8');assert(css.includes('select[data-pointer-focus]:focus'));assert(css.includes('object-fit: contain'));
});
