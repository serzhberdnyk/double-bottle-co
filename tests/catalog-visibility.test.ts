import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './d1-adapter';
import {catalog,product,activeState,sitemapPaths,destination,canonicalSlug} from '../lib/server/catalog';
import {editorPayload,type EditorDraft} from '../lib/public/catalog-editor';
import {editorState,editorDraft,saveEditorDraft,previewEditorDraft,publishEditorDraft} from '../lib/server/catalog-editor';
import {saveEditorImage,editorImageResponse} from '../lib/server/catalog-editor-media';

// Independent synthetic catalog: no legacy import fixture or production data.
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
  sql.prepare('INSERT INTO catalog_release_variants (release_id,variant_id,revision_id,sale_status) VALUES (?,?,?,?)').run('synthetic-release',variant,revision,'on_request');
  sql.prepare('INSERT INTO catalog_itinerary_stops VALUES (?,?,?,?,?,?)').run(revision,first?'private-island':'shared-island',1,'landing',1,'Original stop');
  sql.prepare('INSERT INTO catalog_public_rates (id,release_id,variant_id,amount_minor,currency,unit,audience,valid_from,valid_until,conditions,supplements_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('rate-'+i,'synthetic-release',variant,100000+i,'THB','person','adult','2020-01-01',null,'Original conditions','[]');
 }
 sql.prepare("INSERT INTO catalog_redirects VALUES ('old-synthetic','synthetic-0')").run();
 return db;
}
async function input(db:D1Database,id='synthetic-0'){
 const state=await activeState(db),tour=(await editorState(db)).tours.find(t=>t.id===id)!;
 return {revision:0,productId:id,baseReleaseId:state.release_id,baseGeneration:state.generation,payload:editorPayload(tour)};
}
async function toggle(db:D1Database,visible:boolean){const body=await input(db);body.payload.visible=visible;const draft=await saveEditorDraft(db,body,'synthetic-editor');await publishEditorDraft(db,draft.id,draft.revision,'synthetic-editor');return draft;}

test('43 cards stay visible by default; hidden drafts persist and preview without changing the public catalog',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());
 const initial=await catalog(db,{limit:48});assert.equal(initial.total,43);assert(initial.items.every(t=>!t.hidden));
 const body=await input(db);body.payload.visible=false;const draft=await saveEditorDraft(db,body,'synthetic-editor');
 assert.equal((await editorDraft(db,draft.id)).payload.visible,false); // fresh reload
 assert.equal((await previewEditorDraft(db,draft.id)).tour.hidden,true);
 assert.equal((await catalog(db)).total,43);assert(await product(db,'synthetic-0'));
 await publishEditorDraft(db,draft.id,draft.revision,'synthetic-editor');
 const summary=JSON.parse(db.sqlite.prepare('SELECT summary_json FROM catalog_releases WHERE id=?').get((await activeState(db)).release_id)!.summary_json as string);assert.equal(summary.products,43);assert.equal(summary.published,42);assert.equal(summary.counts.hidden,1);
 const current=await catalog(db,{limit:48});assert.equal(current.total,42);assert.equal(current.count,42);
 for(const q of [{q:'Unique visibility target'},{category:'nature'},{days:'2'},{transport:'sailboat'},{format:'private'},{destination:'private-island'},{ids:['synthetic-0']},{release:'synthetic-release',ids:['synthetic-0']}])assert.equal((await catalog(db,q)).total,0);
 assert(!current.facets.categories.some(c=>c.id==='nature'));assert(!current.facets.durations.includes(2));assert(!current.facets.transports.includes('sailboat'));assert(!current.facets.formats.includes('private'));assert(!current.destinations.some(d=>d.id==='private-island'));
 assert.equal(await product(db,'synthetic-0'),null);assert.equal(await product(db,'synthetic-0','synthetic-release'),null);
 assert.equal(await destination(db,'private-island'),null);assert.equal(await canonicalSlug(db,'old-synthetic'),null);
 assert(!(await sitemapPaths(db)).includes('/tour/synthetic-0'));
 const editor=await editorState(db);assert.equal(editor.tours.length,43);assert.equal(editor.tours.find(t=>t.id==='synthetic-0')!.hidden,true);
 assert.equal((await editorDraft(db,draft.id)).status,'published');
});

test('Restore after reload preserves stable IDs, all source data, photographs, rates and saved inquiry snapshots; nothing is deleted',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'),image=await saveEditorImage(db,bytes,'image/png','synthetic-editor');
 db.sqlite.prepare("UPDATE catalog_release_products SET image=? WHERE product_id='synthetic-0'").run(image.path);
 const original=(await product(db,'synthetic-0'))!.tour;
 const originalRows=db.sqlite.prepare('SELECT * FROM catalog_release_products WHERE release_id=? ORDER BY product_id').all('synthetic-release');
 const counts=()=>['catalog_products','catalog_variants','catalog_variant_revisions','catalog_itinerary_stops','catalog_media_uploads'].map(table=>db.sqlite.prepare('SELECT COUNT(*) AS n FROM '+table).get()!.n);
 const beforeCounts=counts();
 db.sqlite.prepare("INSERT INTO operations_inquiries (id,owner_hash,idempotency_key,request_hash,status,created_at,snapshot_json,contact_json) VALUES ('saved','owner','key','hash','received','2026-01-01','{\"original\":true}','{}')").run();
 await toggle(db,false);
 const hidden=(await editorState(db)).tours.find(t=>t.id===original.id)!;assert.equal(hidden.image,original.image);assert.equal(hidden.id,original.id);
 const body=await input(db);body.payload.visible=true;const draft=await saveEditorDraft(db,body,'synthetic-editor');
 assert.equal((await editorDraft(db,draft.id)).payload.visible,true);assert.equal(await product(db,original.slug),null);
 assert.equal((await previewEditorDraft(db,draft.id)).tour.hidden,false);
 await publishEditorDraft(db,draft.id,draft.revision,'synthetic-editor');
 assert.equal((await catalog(db)).total,43);assert.equal((await editorState(db)).tours.length,43);
 const restored=(await product(db,original.slug))!.tour;assert.equal(restored.id,original.id);assert.equal(restored.image,original.image);assert.equal(restored.variants[0].revisionId,original.variants[0].revisionId);
 assert.deepEqual({...restored,variants:[]},{...original,variants:[]});
 assert.deepEqual(restored.variants.map(v=>({...v,rates:v.rates.map(({id,...rate})=>rate)})),original.variants.map(v=>({...v,rates:v.rates.map(({id,...rate})=>rate)})));
 assert.deepEqual(counts(),beforeCounts);
 assert.deepEqual(Buffer.from(await (await editorImageResponse(db,image.id,true)).arrayBuffer()),bytes);
 const state=await activeState(db);const afterRows=db.sqlite.prepare('SELECT * FROM catalog_release_products WHERE release_id=? ORDER BY product_id').all(state.release_id);
 assert.deepEqual(afterRows.map(({release_id,...row})=>row),originalRows.map(({release_id,...row})=>row));
 assert.equal(db.sqlite.prepare("SELECT snapshot_json FROM operations_inquiries WHERE id='saved'").get()!.snapshot_json,'{"original":true}');
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_release_products WHERE release_id=?').get('synthetic-release')!.n,43);
});

test('Legacy drafts keep current visibility; stale revisions, forged IDs and invalid visibility fail closed',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());await toggle(db,false);
 const body=await input(db);delete body.payload.visible;body.payload.title='Edited while hidden';
 const draft=await saveEditorDraft(db,body,'synthetic-editor');await publishEditorDraft(db,draft.id,draft.revision,'synthetic-editor');
 assert.equal(await product(db,'synthetic-0'),null);assert.equal((await editorState(db)).tours.find(t=>t.id==='synthetic-0')!.hidden,true);
 const restore=await input(db);restore.payload.visible=true;const saved=await saveEditorDraft(db,restore,'synthetic-editor');
 await assert.rejects(saveEditorDraft(db,{...restore,id:saved.id,revision:0},'synthetic-editor'),/DRAFT_CONFLICT/);
 await assert.rejects(saveEditorDraft(db,{...restore,productId:'new-card'},'synthetic-editor'),/PRODUCT_NOT_FOUND/);
 await assert.rejects(saveEditorDraft(db,{...restore,payload:{...restore.payload,visible:'yes'}},'synthetic-editor'));
 await db.prepare('UPDATE catalog_state SET generation=generation+1 WHERE id=1').run();await assert.rejects(publishEditorDraft(db,saved.id,saved.revision,'synthetic-editor'),/CONFLICT_REFRESH_REQUIRED/);
});

test('Actual API rejects anonymous, unlisted and cross-origin writes; existing editor can hide/restore, public query cannot opt into hidden cards',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());
 (globalThis as any).__visibilityEnv={DB:db,CATALOG_EDITOR_EMAILS:'editor@example.invalid',ADMIN_EMAILS:'owner@example.invalid'};
 const route=await import('../app/api/admin/catalog/route');
 const publicRoute=await import('../app/api/catalog/route');
 const headers={'content-type':'application/json',origin:'https://example.invalid','oai-authenticated-user-id':'verified-editor','oai-authenticated-user-email':'editor@example.invalid'};
 const operations=await import('../app/api/admin/route'),backup=await import('../app/api/admin/backup/route');
 assert.equal((await operations.GET(new Request('https://example.invalid/api/admin',{headers}))).status,403);
 assert.equal((await backup.GET(new Request('https://example.invalid/api/admin/backup',{headers}))).status,403);
 const post=(body:unknown,override:Record<string,string>={})=>route.POST(new Request('https://example.invalid/api/admin/catalog',{method:'POST',headers:{...headers,...override},body:JSON.stringify(body)}));
 const body=await input(db);body.payload.visible=false;
 assert.equal((await route.GET(new Request('https://example.invalid/api/admin/catalog'))).status,403);
 assert.equal((await post({action:'save',draft:body},{'oai-authenticated-user-id':''})).status,403);
 assert.equal((await post({action:'save',draft:body},{'oai-authenticated-user-email':'stranger@example.invalid'})).status,403);
 assert.equal((await post({action:'save',draft:body},{origin:'https://other.invalid'})).status,403);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_editor_drafts').get()!.n,0);
 const response=await post({action:'save',draft:body});assert.equal(response.status,200);const draft=await response.json() as EditorDraft;
 assert.equal((await post({action:'publish',id:draft.id,revision:draft.revision})).status,200);
 const publicResponse=await publicRoute.GET(new Request('https://example.invalid/api/catalog?includeHidden=true&ids=synthetic-0'));assert.equal(publicResponse.status,200);assert.equal((await publicResponse.json() as {total:number}).total,0);
 const editorResponse=await route.GET(new Request('https://example.invalid/api/admin/catalog',{headers}));const editor=await editorResponse.json() as Awaited<ReturnType<typeof editorState>>;assert.equal(editor.tours.length,43);assert.equal(editor.tours.find(t=>t.id==='synthetic-0')!.hidden,true);assert(!('inquiries' in editor));assert(!('suppliers' in editor));
 const restore=await input(db);restore.payload.visible=true;const saved=await (await post({action:'save',draft:restore})).json() as EditorDraft;assert.equal((await post({action:'publish',id:saved.id,revision:saved.revision})).status,200);assert.equal((await catalog(db)).total,43);
});
