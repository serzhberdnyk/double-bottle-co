import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {testDatabase} from './d1-adapter';import {stageImport,publishRelease,validatePacket,type ImportPacket} from '../lib/server/management';
import {prepareApprovedEight,mergeApprovedEight,currentImportPacket} from '../lib/server/approved-eight-import';
import {catalog,product} from '../lib/server/catalog';import {translateCatalog} from '../lib/i18n/catalog';import {publishedTranslations} from '../lib/server/localization';
async function fixture(){const db=testDatabase(),packet=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;const staged=await stageImport(db,packet,'test');await publishRelease(db,staged.id,0,'test');return {db,packet};}
test('complete fresh packet adds four provider-specific products and five variants; no duplicates or lost services',async t=>{
 const {db}=await fixture();t.after(()=>db.sqlite.close());const before=await currentImportPacket(db),p=await prepareApprovedEight(db);
 assert.equal(p.packet.products.length,before.packet.products.length+4);assert.equal(p.mapping.length,9);assert.equal(new Set((p.mapping as any[]).map(m=>m.program)).size,8);validatePacket(p.packet);
 for(const original of before.packet.products){const after=p.packet.products.find(p=>p.id===original.id)!;assert(after);for(const v of original.variants)assert(after.variants.some(x=>x.id===v.id));if(!(p.mapping as any[]).some(m=>m.product===original.id))assert.deepEqual(after,original);}
 const staged=await stageImport(db,p.packet,'test-owner'),published=await publishRelease(db,staged.id,p.state.generation,'test-owner');assert.equal(published.generation,2);
 assert.equal((await catalog(db,{limit:48})).total,before.packet.products.length+4);
 const city=(await product(db,'a-time-phuket-city'))!.tour;assert.equal(city.variants.length,2);assert.deepEqual(city.variants.map(v=>v.rates.map(r=>r.amountMinor)),[[250000,200000],[280000,230000]]);assert(city.variants.some(v=>v.conditions.includes('Воскресенье. Минимум 6 человек.')));
 const again=await prepareApprovedEight(db);assert.equal(again.packet.products.length,p.packet.products.length);assert.equal(new Set(again.packet.products.map(p=>p.id)).size,p.packet.products.length);
 for(const slug of ['a-time-khao-sok-cheow-lan-day','a-time-phuket-city','a-time-khao-lak-safari','a-time-treasures-andaman'])assert(await product(db,slug));
});
test('existing approved tariffs and Four Pearls corrected route are kept; source brochure conflict remains separate',async t=>{
 const {db}=await fixture();t.after(()=>db.sqlite.close());const {packet}=await currentImportPacket(db);const sim=packet.products.find(p=>p.slug==='similan-early')!.variants.find(v=>v.name==='Стандартный выезд')!;
 sim.rates=[{id:'existing-adult',amountMinor:550000,currency:'THB',unit:'за взрослого',audience:'adult',validFrom:'2026-10-01',validUntil:null,conditions:'approved existing tariff',supplements:[]},{id:'existing-child',amountMinor:450000,currency:'THB',unit:'за ребёнка 4–10 лет',audience:'child',validFrom:'2026-10-01',validUntil:null,conditions:'existing age rule',supplements:[]}];
 const pearls=packet.products.find(p=>p.slug==='andaman-pearls-two-days')!.variants[0];pearls.itinerary=['USER_CORRECTED_DAY2_RAILAY_PANYEE_NAKA'];const originalRates=JSON.stringify(sim.rates),merged=mergeApprovedEight(packet);
 assert.equal(JSON.stringify(merged.packet.products.find(p=>p.slug==='similan-early')!.variants.find(v=>v.id===sim.id)!.rates),originalRates);assert.deepEqual(merged.packet.products.find(p=>p.slug==='andaman-pearls-two-days')!.variants[0].itinerary,pearls.itinerary);assert(merged.conflicts.length>0);
 assert(JSON.stringify(merged.packet.products.find(p=>p.slug==='similan-early')!.supplier.raw).includes('4500'));assert.equal(packet.products.length+4,merged.packet.products.length);
});
test('all new and matched brochure fields translate into EN/TH and images are intact; no internal NET data in public assets',async t=>{
 const {db}=await fixture();t.after(()=>db.sqlite.close());const p=await prepareApprovedEight(db),ids=new Set((p.mapping as any[]).map(m=>m.product));
 for(const locale of ['en','th'] as const){const dict=await publishedTranslations(db,locale);for(const tour of p.packet.products.filter(t=>ids.has(t.id))){const {supplier,provenance,publicationStatus,...dto}=tour;const translated=translateCatalog(dto,locale,dict);assert.deepEqual(translated.missing,[],tour.slug+' '+locale+' missing '+JSON.stringify(translated.missing));}}
 const programs=JSON.parse(readFileSync('content/approved-eight/programs.json','utf8'));assert.equal(programs.length,8);assert(!JSON.stringify(programs).includes('netPrice'));
 for(const m of p.packet.media.filter(m=>m.path.startsWith('/media/atime-')))assert(readFileSync('public'+m.path).length>1000);
});
test('import endpoint retains existing owner authorization, same-origin writes and optimistic generation guard',async t=>{
 const {db}=await fixture();t.after(()=>db.sqlite.close());(globalThis as any).__visibilityEnv={DB:db,ADMIN_EMAILS:'owner@example.invalid'};
 const route=await import('../app/api/admin/approved-programs/route');const url='https://doublebottle.co/api/admin/approved-programs';assert.equal((await route.GET(new Request(url))).status,403);
 const headers={'oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'owner@example.invalid'};const preview=await route.GET(new Request(url,{headers}));assert.equal(preview.status,200);const p=await preview.json() as any;
 assert.equal((await route.POST(new Request(url,{method:'POST',headers:{...headers,Origin:'https://other.invalid'},body:'{}'}))).status,403);
 assert.equal((await route.POST(new Request(url,{method:'POST',headers:{...headers,Origin:'https://doublebottle.co'},body:JSON.stringify({generation:p.state.generation+1,releaseId:p.state.release_id,digest:p.digest})}))).status,409);
 assert.equal((await route.POST(new Request(url,{method:'POST',headers:{...headers,Origin:'https://doublebottle.co'},body:JSON.stringify({generation:p.state.generation,releaseId:p.state.release_id,digest:p.digest})}))).status,200);
});
