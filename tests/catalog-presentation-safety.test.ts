import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safePublicTour} from '../lib/public/catalog-presentation-safety';
import {publicQuote,selectPriceOption} from '../lib/public/pricing';
import type {Tour} from '../lib/public/types';
const read=(slug:string)=>JSON.parse(readFileSync(`tests/fixtures/public-review-safety/${slug}.json`,'utf8')).tour as Tour;
test('Overnight conflicting child amount is on request for display and quote, adult and route unchanged',()=>{
 const t=read('phi-phi-overnight'),before=JSON.stringify(t),safe=safePublicTour(t),v=safe.variants[0];
 assert.equal(JSON.stringify(t),before);assert.deepEqual(v.itinerary,t.variants[0].itinerary);
 assert.deepEqual(v.rates,t.variants[0].rates.filter(r=>r.audience!=='child'));
 assert(v.conditions.some(x=>x.includes('Детская цена — по запросу')));assert(!JSON.stringify(safe).includes('4 500'));
 assert.equal(publicQuote(v.rates,'2026-10-20',2,1,'7',v.priceOptions![0]).totalMinor,null);
 assert.equal(publicQuote(v.rates,'2026-10-20',2,0,'',v.priceOptions![0]).totalMinor,780000);
 assert.equal(safePublicTour({...t,id:'wrong'}).variants[0].rates.length,t.variants[0].rates.length);
});
test('Jet ski published group rates and occupancy remain unchanged, obsolete unknown-price description is clarified',()=>{
 const t=read('jet-ski-south'),safe=safePublicTour(t);
 assert.deepEqual(safe.variants.map(v=>v.rates),t.variants.map(v=>v.rates));
 const v=safe.variants.find(v=>v.name==='Yamaha 1800')!;assert(v.description.includes('за один гидроцикл'));assert(!v.description.includes('стоимость уточняется'));
 assert.deepEqual(v.rates.map(r=>r.amountMinor),[600000,630000]);assert(v.rates.every(r=>r.unit==='за гидроцикл'));
 const selected=selectPriceOption(v);assert.equal(publicQuote(selected.variant.rates,'2026-10-20',2,0,'',selected.option).totalMinor,null);
});
test('Khao Sok keeps known 7000/6500 rates and empty alternatives; disputed child age cannot be used for automatic quote',()=>{
 const t=read('khao-sok'),safe=safePublicTour(t);assert.deepEqual(safe.variants.map(v=>v.rates.map(r=>[r.id,r.amountMinor,r.unit,r.validFrom,r.validUntil])),t.variants.map(v=>v.rates.map(r=>[r.id,r.amountMinor,r.unit,r.validFrom,r.validUntil])));
 assert.equal(safe.variants.filter(v=>!v.rates.length).length,2);assert(!JSON.stringify(safe).includes('4–9 / 4–10'));
 const v=safe.variants.find(v=>v.rates.length)!;assert.equal(publicQuote(v.rates,'2026-10-20',2,1,'7',v.priceOptions![0]).totalMinor,null);assert.equal(publicQuote(v.rates,'2026-10-20',2,0,'',v.priceOptions![0]).totalMinor,1400000);
});
test('Server product used by inquiry rate validation applies the same public safeguards',()=>{
 const catalog=readFileSync('lib/server/catalog.ts','utf8'),inquiry=readFileSync('lib/server/inquiries.ts','utf8');assert(catalog.includes('.map(tour=>safePublicTour(tour as Tour))'));assert(inquiry.includes('data=await product(db,p.slug,state.release_id)'));assert(inquiry.includes('rateSelection(v.rates,input.date)'));assert(inquiry.includes('publicQuote(v.rates,input.date'));
});
