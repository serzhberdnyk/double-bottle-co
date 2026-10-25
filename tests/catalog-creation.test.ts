import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './d1-adapter';
import {catalog,product,activeState} from '../lib/server/catalog';
import {creationState,saveCreationDraft,previewCreationDraft,publishCreationDraft,cancelCreationDraft} from '../lib/server/catalog-creation';

// Independent synthetic catalog; no private import fixture or production data.
function fixture(){
 const db=testDatabase(),sql=db.sqlite;
 sql.prepare("INSERT INTO catalog_releases (id,hash,status,created_at,created_by,summary_json) VALUES ('synthetic-release','synthetic-hash','published','2026-01-01','synthetic','{}')").run();
 sql.prepare("INSERT INTO catalog_state VALUES (1,'synthetic-release',1)").run();
 for(const id of ['private-island','shared-island']){
  sql.prepare('INSERT INTO catalog_destinations VALUES (?,?,?,?,?,?,?,?)').run(id,id,id,7000000,98000000,'synthetic','Synthetic island',null);
  sql.prepare('INSERT INTO catalog_release_destinations VALUES (?,?,?,?,?,?,?,?,?)').run('synthetic-release',id,id,id,7000000,98000000,'synthetic','Synthetic island',null);
 }
 for(let i=0;i<43;i++){
  const id='synthetic-'+i,variant='variant-'+i,revision='revision-'+i,first=i===0;
  sql.prepare('INSERT INTO catalog_products VALUES (?,?)').run(id,id);
  sql.prepare('INSERT INTO catalog_release_products (release_id,product_id,slug,title,description,category,image,image_alt,sale_status,publication_status,featured_rank) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('synthetic-release',id,id,first?'Unique visibility target':'Synthetic tour '+i,'Unchanged description '+i,first?'nature':'sea','/media/synthetic.webp','Unchanged photograph','on_request','published',i);
  sql.prepare('INSERT INTO catalog_variants VALUES (?,?)').run(variant,id);
  sql.prepare('INSERT INTO catalog_variant_revisions VALUES (?,?,?,?,?,?,?,?,?)').run(revision,variant,'hash-'+i,'Variant '+i,'One day',first?2:1,first?'sailboat':'speedboat',first?'private':'shared',JSON.stringify({description:'Original variant',itinerary:['Original program'],includes:['Original inclusion'],extras:[],conditions:[],earliestDate:null}));
  sql.prepare('INSERT INTO catalog_release_variants VALUES (?,?,?,?)').run('synthetic-release',variant,revision,'on_request');
  sql.prepare('INSERT INTO catalog_itinerary_stops VALUES (?,?,?,?,?,?)').run(revision,first?'private-island':'shared-island',1,'landing',1,'Original stop');
  sql.prepare('INSERT INTO catalog_public_rates (id,release_id,variant_id,amount_minor,currency,unit,audience,valid_from,valid_until,conditions,supplements_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('rate-'+i,'synthetic-release',variant,100000+i,'THB','person','adult','2020-01-01',null,'Original conditions','[]');
 }
 sql.prepare("INSERT INTO catalog_redirects VALUES ('old-synthetic','synthetic-0')").run();
 return db;
}

const actor='synthetic-editor';
function payload(){return {title:'User entered tour',description:'A user entered description',slug:'',category:'sea' as const,image:null,imageAlt:'',variant:{name:'User entered option',description:'User entered option description',duration:'One day',days:1,transport:'speedboat',format:'shared',itinerary:['User entered program'],includes:['User entered inclusion'],extras:[],conditions:[],stops:[{destinationId:'shared-island',visitType:'landing' as const,required:true,note:'User entered stop'}],price:{mode:'on_request' as const}}};}
async function input(db:D1Database,requestId=crypto.randomUUID()){
 const state=await activeState(db);return {requestId,revision:0,baseReleaseId:state.release_id,baseGeneration:state.generation,payload:payload()};
}
function count(db:ReturnType<typeof fixture>,table:string){return Number(db.sqlite.prepare('SELECT COUNT(*) AS n FROM '+table).get()!.n);}

test('Creation drafts survive reload with stable IDs, preview privately, and retry the same request idempotently',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());const body=await input(db);
 const saved=await saveCreationDraft(db,body,actor);assert.equal(saved.id,'new_'+body.requestId);assert(saved.productId);assert(saved.slug);
 const retry=await saveCreationDraft(db,body,actor);assert.deepEqual(retry,saved);
 const reloaded=(await creationState(db)).drafts.find(d=>d.id===saved.id)!;assert(reloaded);assert.equal(reloaded.productId,saved.productId);
 const preview=await previewCreationDraft(db,saved.id);assert.equal(preview.tour.id,saved.productId);assert.equal(preview.tour.title,body.payload.title);
 assert.equal((await catalog(db)).total,43);assert.equal(await product(db,saved.slug),null);assert.equal(count(db,'catalog_products'),43);
 const edited={...body,id:saved.id,revision:saved.revision,payload:{...body.payload,title:'Changed by user'}};
 const updated=await saveCreationDraft(db,edited,actor);assert.equal(updated.productId,saved.productId);assert.equal(updated.slug,saved.slug);assert(updated.revision>saved.revision);
 assert.equal((await previewCreationDraft(db,saved.id)).tour.title,'Changed by user');
 await assert.rejects(saveCreationDraft(db,{...body,payload:{...body.payload,title:'Conflicting request'}},actor));
 await assert.rejects(saveCreationDraft(db,{...body,requestId:crypto.randomUUID(),productId:'synthetic-0'},actor));
 assert.equal((await product(db,'synthetic-0'))!.tour.title,'Unique visibility target');
});

test('Validation rejects incomplete fields, invalid rates/dates and unknown destinations; custom slugs are reserved',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());
 const invalid=[
  {title:''},{description:''},{category:'invented'},
  {variant:{...payload().variant,name:''}},
  {variant:{...payload().variant,itinerary:[]}},
  {variant:{...payload().variant,stops:[{destinationId:'unknown-island',visitType:'landing',required:true,note:'Stop'}]}},
  {variant:{...payload().variant,price:{mode:'fixed',amountMinor:-1,currency:'THB',unit:'person',audience:'adult',validFrom:'2026-01-01',validUntil:null}}},
  {variant:{...payload().variant,price:{mode:'fixed',amountMinor:120000,currency:'THB',unit:'person',audience:'adult',validFrom:'2026-02-30',validUntil:null}}},
  {variant:{...payload().variant,price:{mode:'fixed',amountMinor:120000,currency:'THB',unit:'person',audience:'adult',validFrom:'2026-02-01',validUntil:'2026-01-01'}}}
 ];
 for(const change of invalid){const body=await input(db);await assert.rejects(saveCreationDraft(db,{...body,payload:{...body.payload,...change}},actor));}
 assert.equal(count(db,'catalog_products'),43);assert.equal(count(db,'catalog_creation_drafts'),0);
 const first=await input(db);first.payload.slug='user-custom-tour';await saveCreationDraft(db,first,actor);
 const duplicate=await input(db);duplicate.payload.slug='user-custom-tour';await assert.rejects(saveCreationDraft(db,duplicate,actor));
 duplicate.payload.slug='synthetic-0';await assert.rejects(saveCreationDraft(db,duplicate,actor));
});

test('Cancel keeps a resumable draft and never inserts or deletes a catalog product',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());const body=await input(db),draft=await saveCreationDraft(db,body,actor);
 const cancelled=await cancelCreationDraft(db,draft.id,draft.revision,actor);assert.equal(cancelled.status,'cancelled');
 assert.equal((await creationState(db)).drafts.find(d=>d.id===draft.id)!.status,'cancelled');assert.equal(count(db,'catalog_creation_drafts'),1);assert.equal(count(db,'catalog_products'),43);assert.equal((await catalog(db)).total,43);
 await assert.rejects(publishCreationDraft(db,cancelled.id,cancelled.revision,actor));
 const resumed=await saveCreationDraft(db,{...body,id:cancelled.id,revision:cancelled.revision},actor);assert.notEqual(resumed.status,'cancelled');assert.equal(resumed.productId,draft.productId);
 assert.equal((await previewCreationDraft(db,draft.id)).tour.id,draft.productId);
});

test('Explicit publication adds exactly one card, preserves original43 and inquiry snapshots, and repeated publish is idempotent',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());
 const originalRows=db.sqlite.prepare('SELECT * FROM catalog_release_products WHERE release_id=? ORDER BY product_id').all('synthetic-release');
 const originalTours=await Promise.all((await catalog(db,{limit:48})).items.map(async item=>(await product(db,item.slug))!.tour));
 db.sqlite.prepare("INSERT INTO operations_inquiries (id,owner_hash,idempotency_key,request_hash,status,created_at,snapshot_json,contact_json) VALUES ('saved','owner','key','hash','received','2026-01-01','{\"original\":true}','{}')").run();
 const suppliers=count(db,'internal_suppliers'),bindings=count(db,'internal_supply_bindings');
 const draft=await saveCreationDraft(db,await input(db),actor),published=await publishCreationDraft(db,draft.id,draft.revision,actor);
 assert.equal(published.productId,draft.productId);assert.equal(published.generation,2);assert.equal((await catalog(db,{limit:48})).total,44);assert.equal(count(db,'catalog_products'),44);
 const created=(await product(db,draft.slug))!.tour;assert.equal(created.id,draft.productId);assert.equal(created.title,draft.payload.title);assert.equal(created.variants.length,1);assert.equal(created.variants[0].rates.length,0);
 for(const original of originalTours){const current=(await product(db,original.slug))!.tour;assert.deepEqual({...current,variants:[]},{...original,variants:[]});assert.deepEqual(current.variants.map(v=>({...v,rates:v.rates.map(({id,...rate})=>rate)})),original.variants.map(v=>({...v,rates:v.rates.map(({id,...rate})=>rate)})));}
 const rows=db.sqlite.prepare('SELECT * FROM catalog_release_products WHERE release_id=? AND product_id<>? ORDER BY product_id').all(published.releaseId,draft.productId);
 assert.deepEqual(rows.map(({release_id,...row})=>row),originalRows.map(({release_id,...row})=>row));
 assert.deepEqual(db.sqlite.prepare('SELECT * FROM catalog_release_products WHERE release_id=? ORDER BY product_id').all('synthetic-release'),originalRows);
 assert.equal(db.sqlite.prepare("SELECT snapshot_json FROM operations_inquiries WHERE id='saved'").get()!.snapshot_json,'{"original":true}');
 assert.equal(count(db,'internal_suppliers'),suppliers);assert.equal(count(db,'internal_supply_bindings'),bindings);
 assert.deepEqual(await publishCreationDraft(db,draft.id,draft.revision,actor),published);assert.equal(count(db,'catalog_products'),44);assert.equal((await activeState(db)).generation,2);
 assert.equal((await creationState(db)).drafts.find(d=>d.id===draft.id)!.status,'published');
});

test('Concurrent catalog generation and stale draft revisions fail without partial product rows',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());const body=await input(db),draft=await saveCreationDraft(db,body,actor);
 const edited=await saveCreationDraft(db,{...body,id:draft.id,revision:draft.revision,payload:{...body.payload,title:'Revised title'}},actor);
 await assert.rejects(cancelCreationDraft(db,draft.id,draft.revision,actor));await assert.rejects(publishCreationDraft(db,draft.id,draft.revision,actor));
 db.sqlite.prepare('UPDATE catalog_state SET generation=generation+1').run();
 await assert.rejects(publishCreationDraft(db,edited.id,edited.revision,actor),/CONFLICT/);assert.equal(count(db,'catalog_products'),43);assert.equal(count(db,'catalog_releases'),1);
});


test('Creation API enforces existing editor authorization and same-origin rules without granting operations or backup access',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());
 (globalThis as any).__visibilityEnv={DB:db,CATALOG_EDITOR_EMAILS:'editor@example.invalid',ADMIN_EMAILS:'owner@example.invalid'};
 const route=await import('../app/api/admin/catalog/route'),operations=await import('../app/api/admin/route'),backup=await import('../app/api/admin/backup/route');
 const headers={'content-type':'application/json',origin:'https://example.invalid','oai-authenticated-user-id':'verified-editor','oai-authenticated-user-email':'editor@example.invalid'};
 const post=(body:unknown,override:Record<string,string>={})=>route.POST(new Request('https://example.invalid/api/admin/catalog',{method:'POST',headers:{...headers,...override},body:JSON.stringify(body)}));
 const body=await input(db);
 assert.equal((await route.GET(new Request('https://example.invalid/api/admin/catalog?creation=1'))).status,403);
 for(const override of ([{'oai-authenticated-user-id':''},{'oai-authenticated-user-email':'stranger@example.invalid'},{origin:'https://other.invalid'}] as Record<string,string>[]))assert.equal((await post({action:'create-save',draft:body},override)).status,403);
 assert.equal(count(db,'catalog_creation_drafts'),0);
 assert.equal((await operations.GET(new Request('https://example.invalid/api/admin',{headers}))).status,403);assert.equal((await backup.GET(new Request('https://example.invalid/api/admin/backup',{headers}))).status,403);
 assert.equal((await post({action:'create-save',draft:{...body,productId:'synthetic-0'}})).status,400);
 const response=await post({action:'create-save',draft:body});assert.equal(response.status,200);const draft=await response.json() as Awaited<ReturnType<typeof saveCreationDraft>>;
 const stateResponse=await route.GET(new Request('https://example.invalid/api/admin/catalog?creation=1',{headers}));assert.equal(stateResponse.status,200);const state=await stateResponse.json() as Awaited<ReturnType<typeof creationState>>;assert(state.drafts.some(d=>d.id===draft.id));assert(!('suppliers' in state));assert(!('inquiries' in state));
 const removedPreview=await route.GET(new Request('https://example.invalid/api/admin/catalog?draft='+draft.id,{headers}));assert.equal(removedPreview.status,404);assert.equal((await catalog(db)).total,43);
 assert.equal((await post({action:'create-publish',id:draft.id,revision:draft.revision},{origin:'https://other.invalid'})).status,403);
 const cancelledResponse=await post({action:'create-cancel',id:draft.id,revision:draft.revision});assert.equal(cancelledResponse.status,200);const cancelled=await cancelledResponse.json() as Awaited<ReturnType<typeof cancelCreationDraft>>;
 const resumedResponse=await post({action:'create-save',draft:{...body,id:draft.id,revision:cancelled.revision}});assert.equal(resumedResponse.status,200);const resumed=await resumedResponse.json() as Awaited<ReturnType<typeof saveCreationDraft>>;
 assert.equal((await post({action:'create-publish',id:resumed.id,revision:resumed.revision})).status,200);assert.equal((await catalog(db)).total,44);
});


test('A user supplied fixed price retains its currency, amount and validity without fabricated prices',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());const body=await input(db);
 const fixed={...body,payload:{...body.payload,variant:{...body.payload.variant,price:{mode:'fixed',amountMinor:135000,currency:'THB',unit:'person',audience:'adult',validFrom:'2026-01-01',validUntil:'2027-12-31'}}}};
 const draft=await saveCreationDraft(db,fixed,actor);await publishCreationDraft(db,draft.id,draft.revision,actor);
 const rates=(await product(db,draft.slug))!.tour.variants[0].rates;assert.equal(rates.length,1);assert.equal(rates[0].amountMinor,135000);assert.equal(rates[0].currency,'THB');assert.equal(rates[0].validFrom,'2026-01-01');assert.equal(rates[0].validUntil,'2027-12-31');
});
