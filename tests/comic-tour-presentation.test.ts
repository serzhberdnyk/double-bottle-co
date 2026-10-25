import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usesCompactTourLayout} from '../lib/public/compact-tour';
test('Comic paper presentation stays restricted to canonical Phi Phi with responsive panels',()=>{
 assert(usesCompactTourLayout({id:'p_7cbe8b01189d5eaca6d50242',slug:'phi-phi-paradise'}));
 for(const slug of ['khao-sok-cheow-lan','racha-coral','similan-early','james-bond-catamaran'])assert(!usesCompactTourLayout({id:'other',slug}));
 const css=readFileSync('app/components/CompactTourDetail.module.css','utf8');
 for(const token of ['--paper:#fff2d3','repeat(3,minmax(0,1fr))','repeat(2,minmax(0,1fr))','@media(max-width:370px)',':global(body):has(.page) :global(.compact-inquiry-modal)'])assert(css.includes(token));
});
test('Comic presentation preserves production data, requests and accessibility',()=>{
 const view=readFileSync('app/components/CompactTourDetail.tsx','utf8'),host=readFileSync('app/components/CatalogUI.tsx','utf8');
 for(const token of ['const model = compactTourModel(tour, variant)','model.itinerary.map((line, index)','variantSelector &&','{inquiryDialog}','onClick={event=>onRequest(event.currentTarget)}','disabled={model.unavailable}','aria-pressed={saved}','src={tour.image}'])assert(view.includes(token));
 for(const token of ["request<{id:string}>('/api/inquiries'",'priceOptionKey={option?.key||optionKey}','compactRequestTrigger.current.focus({preventScroll:true})'])assert(host.includes(token));
 for(const token of ['демо','preview','2600','2200'])assert(!view.includes(token));
});
