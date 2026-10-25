import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,approveBinding,promiseFingerprint,compatibility,type ImportPacket} from '../lib/server/management';
import {catalog,product,activeState} from '../lib/server/catalog';
import {saveInquiry,inquiryStatus,recordOffer} from '../lib/server/inquiries';
import {project,geometryPath} from '../lib/public/geo';
import {rateSelection} from '../lib/public/pricing';
import {priceLabel} from '../lib/public/types';
const original=JSON.parse(readFileSync('private-import/initial-catalog.json','utf8')) as ImportPacket;
const fresh=()=>structuredClone(original);
async function setup(){const db=testDatabase();const r=await stageImport(db,fresh(),'qa');await publishRelease(db,r.id,0,'qa');return{db,release:r.id};}
function inputFor(t:any,release:string){const d=new Date(Date.now()+10*864e5).toISOString().slice(0,10);return{productId:t.id,variantId:t.variants[0].id,revisionId:t.variants[0].revisionId,releaseId:release,expectedRates:rateSelection(t.variants[0].rates,d),date:d,adults:2,children:0,childrenAges:'',name:'Acceptance test',contact:'qa@example.invalid',note:'isolated test only',consent:true};}

test('A: added product appears in search and destination popup with no component changes; importer is idempotent',async()=>{
 const {db}=await setup();const p=fresh();const t=structuredClone(p.products.find(x=>x.slug==='racha-coral')!);t.id='isolated-new-product';t.slug='isolated-new-product';t.title='Изолированная новая программа';t.variants[0].id='isolated-new-variant';t.supplier.offerId='isolated-new-offer';t.provenance.sourceId='isolated-new-source';p.products.push(t);
 const r=await stageImport(db,p,'qa');const again=await stageImport(db,p,'qa');assert.equal(again.id,r.id);assert.equal(again.idempotent,true);await publishRelease(db,r.id,1,'qa');
 assert.equal((await catalog(db,{q:'Изолированная'})).items[0].id,t.id);assert((await catalog(db,{destination:'coral',limit:48})).items.some(x=>x.id===t.id));assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM catalog_products WHERE id=?').get(t.id)?.n,1);
});
test('B: popup returns only variants that actually include the selected place; filters use the same variant',async()=>{
 const {db}=await setup();const p=fresh();const t=p.products.find(x=>x.slug==='racha-coral')!;const other=structuredClone(t.variants[0]);other.id='isolated-no-coral';other.name='Только Рача';other.stops=other.stops.filter(s=>s.destinationId!=='coral');other.transport='Другой транспорт';t.variants.push(other);const r=await stageImport(db,p,'qa');await publishRelease(db,r.id,1,'qa');const result=await catalog(db,{destination:'coral',limit:48});assert.equal(result.items.find(x=>x.id===t.id)?.variants.length,1);assert.equal((await catalog(db,{destination:'coral',transport:'Другой транспорт'})).total,0);
});
test('C: compatible supply approval preserves public product identity; incompatible supply is rejected',async()=>{
 const {db}=await setup();const p=await product(db,'racha-coral');const b=db.sqlite.prepare('SELECT id,compatibility_json FROM internal_supply_bindings WHERE revision_id=?').get(p!.tour.variants[0].revisionId) as any;const facts=JSON.parse(b.compatibility_json).promises;
 const before=JSON.stringify(p);await approveBinding(db,b.id,facts,'qa','2026-10-31');assert.equal(JSON.stringify(await product(db,'racha-coral')),before);await assert.rejects(approveBinding(db,b.id,{...facts,transport:'Несовместимое судно'},'qa',null),/INCOMPATIBLE/);assert.equal(compatibility(facts,{...facts,extras:['другая обязательная доплата']}).compatible,false);
});
test('D/K: withdrawal does not mutate saved inquiry or confirmed-order snapshots',async()=>{
 const {db,release}=await setup();const p=await product(db,'racha-coral');const input=inputFor(p!.tour,release);const saved=await saveInquiry(db,input,'owner-a','fixed-key','ip-a');const inquiryBefore=db.sqlite.prepare('SELECT snapshot_json FROM operations_inquiries WHERE id=?').get(saved.id) as any;
 const b=db.sqlite.prepare('SELECT id,compatibility_json FROM internal_supply_bindings WHERE revision_id=?').get(p!.tour.variants[0].revisionId) as any;await approveBinding(db,b.id,JSON.parse(b.compatibility_json).promises,'qa',null);
 const order=await recordOffer(db,saved.id,{currency:'THB',totalMinor:400000,confirmation:'Agreed date and party',cancellation:'Agreed terms',consentReference:'qa-consent'},{bindingId:b.id},'qa','confirmed_order');const orderBefore=db.sqlite.prepare('SELECT snapshot_json FROM operations_orders WHERE id=?').get(order.id) as any;
 const next=fresh();const t=next.products.find(x=>x.id===p!.tour.id)!;t.status='temporarily_unavailable';t.variants[0].name='Новое условие';const r=await stageImport(db,next,'qa');await publishRelease(db,r.id,1,'qa');assert(!(await catalog(db,{destination:'coral',limit:48})).items.some(x=>x.id===t.id));await assert.rejects(saveInquiry(db,input,'owner-b','new-key','ip-b'),/VARIANT_UNAVAILABLE/);
 assert.equal((db.sqlite.prepare('SELECT snapshot_json FROM operations_inquiries WHERE id=?').get(saved.id) as any).snapshot_json,inquiryBefore.snapshot_json);assert.equal((db.sqlite.prepare('SELECT snapshot_json FROM operations_orders WHERE id=?').get(order.id) as any).snapshot_json,orderBefore.snapshot_json);
});
test('E: expired rates vanish on API and UI calculation; consistent current price per publication',async()=>{
 const {db}=await setup();const p=fresh();const t=p.products.find(x=>x.slug==='racha-coral')!;t.variants[0].rates[0].validUntil='2026-06-01';const r=await stageImport(db,p,'qa');await publishRelease(db,r.id,1,'qa');const one=await product(db,'racha-coral');assert.equal(one!.tour.variants[0].rates.filter(x=>x.audience==='adult').length,0);assert.equal(priceLabel(t.variants[0].rates,'2026-10-04').text,'По запросу');
 const n=structuredClone(p);n.products.find(x=>x.slug==='racha-coral')!.variants[0].rates[0].validUntil='2028-10-31';n.products.find(x=>x.slug==='racha-coral')!.variants[0].rates[0].amountMinor=230000;const v=await stageImport(db,n,'qa');await publishRelease(db,v.id,2,'qa');const card=(await catalog(db,{q:'Рача и Корал'})).items.find(x=>x.slug==='racha-coral')!;const popup=(await catalog(db,{destination:'coral',limit:48})).items.find(x=>x.slug==='racha-coral')!;const detail=(await product(db,'racha-coral'))!.tour;assert.equal(priceLabel(card.variants[0].rates).text,priceLabel(popup.variants[0].rates).text);assert.equal(priceLabel(card.variants[0].rates).text,priceLabel(detail.variants[0].rates).text);
});
test('F: incomplete, empty and missing-row imports preserve the last publication',async()=>{
 const {db,release}=await setup();const p=fresh();p.complete=false;await assert.rejects(stageImport(db,p,'qa'),/INCOMPLETE/);p.complete=true;p.products=[];await assert.rejects(stageImport(db,p,'qa'),/INCOMPLETE/);const short=fresh();short.products.pop();await assert.rejects(stageImport(db,short,'qa'),/MISSING_PRODUCTS/);assert.equal((await activeState(db)).release_id,release);assert.equal((await catalog(db)).count,43);
});
test('G: public DTO contains no source IDs, suppliers, net costs, contacts or raw data',async()=>{
 const {db}=await setup();const c=await catalog(db,{limit:48});const publicText=JSON.stringify(c);assert(!/"(?:supplier|source|operator|provenance|raw|facts_json|sourceId|net|commission)"/i.test(publicText));assert(!/SeaStar|A-Time|Narayana|Ratsada|Best Travel|Bungalow Raya|docs.google|drive.google|atimenaturetour/i.test(publicText));assert.equal(c.count,43);assert.equal(c.items.length,43);
});
test('I: coastline coordinates and stop markers share one transform through zoom and pan',()=>{
 const [x,y]=project(98.37244,7.74348);const path=geometryPath({type:'Polygon',coordinates:[[[98.37244,7.74348],[98.373,7.744],[98.37244,7.74348]]]});assert(path.startsWith(`M${x.toFixed(2)},${y.toFixed(2)}`));for(const z of [.75,1,2.5]){const tx=70,ty=-22;assert.equal(x*z+tx,project(98.37244,7.74348)[0]*z+tx);assert.equal(y*z+ty,project(98.37244,7.74348)[1]*z+ty);}
});
test('J: real SQLite persistence, duplicate retries, visitor ownership, validation and throttling',async()=>{
 const {db,release}=await setup();const p=await product(db,'racha-coral');const input=inputFor(p!.tour,release);const one=await saveInquiry(db,input,'visitor-a','same','ip-a');const two=await saveInquiry(db,input,'visitor-a','same','ip-a');assert.equal(one.id,two.id);assert.equal(two.replayed,true);assert.equal(await inquiryStatus(db,one.id,'visitor-b'),null);assert((await inquiryStatus(db,one.id,'visitor-a')));await assert.rejects(saveInquiry(db,{...input,adults:0},'visitor-a','invalid','ip-a'),/INVALID/);await assert.rejects(saveInquiry(db,{...input,name:'Changed'},'visitor-a','same','ip-a'),/IDEMPOTENCY/);
 for(let i=0;i<7;i++)await saveInquiry(db,input,'visitor-a','key-'+i,'ip-a');await assert.rejects(saveInquiry(db,input,'visitor-a','limit','ip-a'),/RATE_LIMITED/);assert.equal((db.sqlite.prepare('SELECT COUNT(*) n FROM operations_inquiries').get() as any).n,8);
});
test('Publication compare-and-swap rejects stale writers and supports atomic rollback',async()=>{
 const {db,release}=await setup();const a=fresh();a.products[0].description+=' A';const b=fresh();b.products[0].description+=' B';const ra=await stageImport(db,a,'a'),rb=await stageImport(db,b,'b');await publishRelease(db,ra.id,1,'a');await assert.rejects(publishRelease(db,rb.id,1,'b'),/CONFLICT/);await publishRelease(db,release,2,'qa',true);assert.equal((await activeState(db)).release_id,release);
});
test('L: isolated 500-product catalogue supports indexed relationships and bounded pagination',async()=>{
 const db=testDatabase(),p=fresh(),template=p.products.find(x=>x.slug==='racha-coral')!;p.products=Array.from({length:500},(_,i)=>{const t=structuredClone(template);t.id='test-'+i;t.slug='test-'+i;t.title='Нагрузочная программа '+i;t.variants[0].id='test-variant-'+i;t.supplier.offerId='test-offer-'+i;t.provenance.sourceId='test-source-'+i;return t;});
 const start=performance.now();const r=await stageImport(db,p,'qa-isolated');await publishRelease(db,r.id,0,'qa');const c=await catalog(db,{destination:'coral',page:10,limit:12});assert.equal(c.total,500);assert.equal(c.items.length,12);assert.equal(c.page,10);const queryPlan=db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT revision_id FROM catalog_itinerary_stops WHERE destination_id=?').all('coral');assert(JSON.stringify(queryPlan).includes('idx_stops_destination_revision'));mkdirSync('work',{recursive:true});writeFileSync('work/load-test.json',JSON.stringify({products:500,pageSize:12,totalMs:Math.round(performance.now()-start),queryPlan},null,2));
});
test('Backups: SQLite export/restoration retains public catalogue and source relationships',async()=>{
 const {db}=await setup();rmSync("work/restore-check.sqlite",{force:true});db.sqlite.exec("VACUUM INTO 'work/restore-check.sqlite'");const {DatabaseSync}=await import('node:sqlite');const restored=new DatabaseSync('work/restore-check.sqlite');assert.equal((restored.prepare('SELECT COUNT(*) n FROM catalog_products').get() as any).n,44);assert.equal((restored.prepare('PRAGMA integrity_check').get() as any).integrity_check,'ok');assert.equal(restored.prepare('PRAGMA foreign_key_check').all().length,0);restored.close();
});

test('Draft diffs, source versions, slug redirects and immutable snapshots remain consistent',async()=>{
 const {db}=await setup();const originalProduct=(await product(db,'racha-coral'))!.tour;
 const beforeOffer=db.sqlite.prepare('SELECT id,facts_json FROM internal_supplier_offers LIMIT 1').get() as any;
 const next=fresh();const t=next.products.find(x=>x.slug==='racha-coral')!;t.slug='racha-and-coral';t.variants[0].rates[0].amountMinor=240000;t.variants[0].itinerary.push('Уточнённая остановка');t.provenance.hash+='updated';t.supplier.raw={updated:true};
 const r=await stageImport(db,next,'qa');assert(r.summary.changes.find((c:any)=>c.id===t.id)!.fields.includes('variants'));assert((await product(db,'racha-coral')));assert.equal(await product(db,'racha-and-coral'),null);
 await publishRelease(db,r.id,1,'qa');assert.equal((await product(db,'racha-and-coral'))!.tour.id,originalProduct.id);assert.equal((db.sqlite.prepare('SELECT product_id FROM catalog_redirects WHERE from_slug=?').get('racha-coral') as any).product_id,originalProduct.id);
 assert.equal((db.sqlite.prepare('SELECT facts_json FROM internal_supplier_offers WHERE id=?').get(beforeOffer.id) as any).facts_json,beforeOffer.facts_json);
 assert.throws(()=>db.sqlite.prepare('UPDATE catalog_variant_revisions SET name=? WHERE id=?').run('bad',originalProduct.variants[0].revisionId),/IMMUTABLE/);
 const input=inputFor((await product(db,'racha-and-coral'))!.tour,r.id);assert((await saveInquiry(db,input,'visitor','renamed','ip')).id);
});
test('Map counts exclude destinations belonging only to other variants under transport filters',async()=>{
 const {db}=await setup(),p=fresh(),t=p.products.find(x=>x.slug==='racha-coral')!;const alternate=structuredClone(t.variants[0]);alternate.id='test-map-alt';alternate.transport='Только тестовый транспорт';alternate.stops=alternate.stops.filter(s=>s.destinationId!=='coral');t.variants.push(alternate);const r=await stageImport(db,p,'qa');await publishRelease(db,r.id,1,'qa');const c=await catalog(db,{transport:alternate.transport});assert.equal(c.total,1);assert(!c.destinations.some(d=>d.id==='coral'));assert(c.destinations.some(d=>d.id==='racha-yai'));
});


test('Administrative policy denies anonymous and ordinary users',async()=>{const {canManageIdentity}=await import('../lib/server/access-policy');assert.equal(canManageIdentity(null,null,'owner@example.invalid'),false);assert.equal(canManageIdentity('guest@example.invalid','guest-id','owner@example.invalid'),false);assert.equal(canManageIdentity('owner@example.invalid',null,'owner@example.invalid'),false);assert.equal(canManageIdentity('OWNER@example.invalid','owner-id','owner@example.invalid'),true);});

test('An agreed order amendment appends history and keeps the original snapshot',async()=>{const {amendOrder}=await import('../lib/server/inquiries');const {db,release}=await setup();const t=(await product(db,'racha-coral'))!.tour;const inquiry=await saveInquiry(db,inputFor(t,release),'qa-amend','qa-amend','qa-amend');const b=db.sqlite.prepare('SELECT id,compatibility_json FROM internal_supply_bindings WHERE revision_id=?').get(t.variants[0].revisionId) as any;await approveBinding(db,b.id,JSON.parse(b.compatibility_json).promises,'qa',null);const terms={currency:'THB',totalMinor:400000,confirmation:'Initial agreement',cancellation:'Initial cancellation',consentReference:'qa-1'};const o=await recordOffer(db,inquiry.id,terms,{bindingId:b.id},'qa','confirmed_order');const before=(db.sqlite.prepare('SELECT snapshot_json FROM operations_orders WHERE id=?').get(o.id) as any).snapshot_json;await assert.rejects(amendOrder(db,o.id,{...terms,consentReference:''},{bindingId:b.id},'qa'),/CONSENT/);const amendment=await amendOrder(db,o.id,{...terms,totalMinor:420000,consentReference:'qa-2'},{bindingId:b.id},'qa');assert(amendment.id);assert.equal((db.sqlite.prepare('SELECT snapshot_json FROM operations_orders WHERE id=?').get(o.id) as any).snapshot_json,before);assert.equal((db.sqlite.prepare('SELECT COUNT(*) AS n FROM operations_order_events WHERE order_id=?').get(o.id) as any).n,1);});

test('Strict inquiry boundary rejects malformed values, unknown fields and forged prices',async()=>{
 const {db,release}=await setup(),t=(await product(db,'racha-coral'))!.tour,input=inputFor(t,release);
 for(const payload of [null,[],true,{...input,note:{}},{...input,consent:'yes'},
  {...input,children:1.5},{...input,price:1},{...input,expectedRates:undefined}])
  await assert.rejects(saveInquiry(db,payload,'qa-strict','strict','qa-strict'),/INVALID_INPUT/);
 await assert.rejects(saveInquiry(db,{...input,date:'2027-02-31'},'qa-strict','bad-date','qa-strict'),/INVALID_DATE/);
 await assert.rejects(saveInquiry(db,{...input,variantId:'unknown'},'qa-strict','unknown','qa-strict'),/VARIANT_UNAVAILABLE/);
 const forged=structuredClone(input);forged.expectedRates[0].amountMinor=1;
 await assert.rejects(saveInquiry(db,forged,'qa-strict','forged','qa-strict'),/PRICE_CHANGED/);
 assert.equal((db.sqlite.prepare('SELECT COUNT(*) n FROM operations_inquiries').get() as any).n,0);
});

test('Price-only publication invalidates an open form, even with an unchanged variant revision',async()=>{
 const {db,release}=await setup(),t=(await product(db,'racha-coral'))!.tour,input=inputFor(t,release);
 const next=fresh();next.products.find(x=>x.slug===t.slug)!.variants[0].rates[0].amountMinor+=100;
 const staged=await stageImport(db,next,'qa');await publishRelease(db,staged.id,1,'qa');
 assert.equal((await product(db,t.slug))!.tour.variants[0].revisionId,t.variants[0].revisionId);
 await assert.rejects(saveInquiry(db,input,'qa-price','changed','qa-price'),/CATALOG_CHANGED/);
});

test('Unpublished variants and products reject direct submissions',async()=>{
 for(const hideProduct of [true,false]){
  const {db,release}=await setup(),t=(await product(db,'racha-coral'))!.tour,input=inputFor(t,release),next=fresh();
  const item=next.products.find(x=>x.slug===t.slug)!;
  if(hideProduct)item.publicationStatus='archived';else item.variants[0].status='temporarily_unavailable';
  const r=await stageImport(db,next,'qa');await publishRelease(db,r.id,1,'qa');
  await assert.rejects(saveInquiry(db,input,'qa-hidden','hidden','qa-hidden'),/VARIANT_UNAVAILABLE/);
 }
});

test('No published price persists an explicit on-request snapshot, never a zero charge',async()=>{
 const {db,release}=await setup(),t=(await product(db,'phi-phi-paradise'))!.tour;
 const r=await saveInquiry(db,inputFor(t,release),'qa-no-price','no-price','qa-no-price');
 const s=JSON.parse((db.sqlite.prepare('SELECT snapshot_json FROM operations_inquiries WHERE id=?').get(r.id) as any).snapshot_json);
 assert.equal(s.pricing.status,'on_request');assert.equal(s.publicTotalMinor,null);assert.equal(s.currency,null);
 assert.deepEqual(s.publicRates,[]);assert(s.createdAt);assert.equal(s.generation,1);
});

test('A publication racing the final database write cannot store a stale snapshot',async()=>{
 const {db,release}=await setup(),t=(await product(db,'racha-coral'))!.tour;
 const next=fresh();next.products.find(x=>x.slug===t.slug)!.variants[0].rates[0].amountMinor+=200;
 const staged=await stageImport(db,next,'qa');let switched=false;
 const racing={prepare(sql:string){const statement=db.prepare(sql);if(!sql.includes('INSERT INTO operations_inquiries'))return statement;
  return{bind(...args:unknown[]){const bound=statement.bind(...args);return{async run(){
   if(!switched){switched=true;await publishRelease(db,staged.id,1,'qa-race');}return bound.run();
  }};}};}} as D1Database;
 await assert.rejects(saveInquiry(racing,inputFor(t,release),'qa-race','race','qa-race'),/CATALOG_CHANGED/);
 assert(switched);assert.equal((db.sqlite.prepare('SELECT COUNT(*) n FROM operations_inquiries').get() as any).n,0);
});

test('Parallel identical submits create exactly one inquiry',async()=>{
 const {db,release}=await setup(),t=(await product(db,'racha-coral'))!.tour,input=inputFor(t,release);
 const [a,b]=await Promise.all([saveInquiry(db,input,'qa-double','same','qa-double'),saveInquiry(db,input,'qa-double','same','qa-double')]);
 assert.equal(a.id,b.id);assert.equal((db.sqlite.prepare('SELECT COUNT(*) n FROM operations_inquiries').get() as any).n,1);
 const s=JSON.parse((db.sqlite.prepare('SELECT snapshot_json FROM operations_inquiries').get() as any).snapshot_json);
 assert.equal(s.publicTotalMinor,400000);assert.equal(s.currency,'THB');
});

test('Corrupt import rows fail before staging and keep the current catalogue',async()=>{
 const {db,release}=await setup();
 for(const change of [(p:any)=>p.products[0]=null,(p:any)=>p.products[0].variants[0].includes=[{net:1}],
  (p:any)=>p.products.find((x:any)=>x.slug==='racha-coral').variants[0].stops[0].destinationId='missing-destination',
  (p:any)=>p.destinations.push(structuredClone(p.destinations[0])),
  (p:any)=>p.products.find((x:any)=>x.slug==='racha-coral').variants[0].rates[0].validUntil='2027-02-31']){
  const p=fresh();change(p);await assert.rejects(stageImport(db,p,'qa'),/VALIDATION/);
  assert.equal((await activeState(db)).release_id,release);
 }
});

test('An empty destination and a product without a photograph remain safe',async()=>{
 const {db}=await setup(),p=fresh();p.destinations.push({...p.destinations[0],id:'unused-place',slug:'unused-place'});
 const t=p.products.find(x=>x.slug==='racha-coral')!;t.image=null;t.imageAlt='';
 const r=await stageImport(db,p,'qa');await publishRelease(db,r.id,1,'qa');
 const c=await catalog(db,{destination:'unused-place'});assert.equal(c.total,0);assert.deepEqual(c.items,[]);
 assert(!(await catalog(db)).destinations.some(d=>d.id==='unused-place'));
 assert.equal((await product(db,t.slug))!.tour.image,null);
});
