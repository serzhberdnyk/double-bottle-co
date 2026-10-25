import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './d1-adapter';
import {product,activeState} from '../lib/server/catalog';
import {editorPayload} from '../lib/public/catalog-editor';
import {programmeItemsSchema,moveProgrammeItem} from '../lib/public/programme-items';
import {editorState,saveEditorDraft,previewEditorDraft,publishEditorDraft} from '../lib/server/catalog-editor';

function fixture(){
 const db=testDatabase(),sql=db.sqlite;
 sql.exec("INSERT INTO catalog_releases (id,hash,status,created_at,created_by,summary_json) VALUES ('base','base','published','2026-01-01','test','{}'); INSERT INTO catalog_state VALUES (1,'base',1); INSERT INTO catalog_products VALUES ('tour','tour'); INSERT INTO catalog_release_products (release_id,product_id,slug,title,description,category,image_alt,sale_status,publication_status) VALUES ('base','tour','tour','Tour','Description','nature','','on_request','published'); INSERT INTO catalog_destinations VALUES ('lake','lake','Lake',7000000,98000000,'test','Lake',NULL); INSERT INTO catalog_release_destinations VALUES ('base','lake','lake','Lake',7000000,98000000,'test','Lake',NULL);");
 for(let i=0;i<2;i++){
  sql.prepare('INSERT INTO catalog_variants VALUES (?,?)').run('v'+i,'tour');
  sql.prepare('INSERT INTO catalog_variant_revisions VALUES (?,?,?,?,?,?,?,?,?)').run('rev'+i,'v'+i,'hash'+i,'Option '+i,'Two days',2,'boat','group',JSON.stringify({description:'Original',itinerary:['Boat '+i,'Bungalow '+i,'Safari '+i],includes:['Meal'],extras:['Extra'],conditions:['Term'],earliestDate:'2026-01-01',customPreserved:'private term'}));
  sql.prepare('INSERT INTO catalog_release_variants VALUES (?,?,?,?)').run('base','v'+i,'rev'+i,'on_request');
  sql.prepare('INSERT INTO catalog_itinerary_stops VALUES (?,?,?,?,?,?)').run('rev'+i,'lake',1,'landing',1,'Unchanged stop');
  sql.prepare('INSERT INTO catalog_public_rates (id,release_id,variant_id,amount_minor,currency,unit,audience,valid_from,conditions,supplements_json) VALUES (?,?,?,?,?,?,?,?,?,?)').run('rate'+i,'base','v'+i,100000+i,'THB','person','adult','2020-01-01','Rate terms','[]');
 }
 return db;
}

test('Programme validation rejects empty/blank/oversize items and bounded ordering is immutable',()=>{
 for(const value of [[],[' '],['x'.repeat(501)],Array(201).fill('x')])assert.equal(programmeItemsSchema.safeParse(value).success,false);
 assert.deepEqual(programmeItemsSchema.parse(['  Boat  ']),['Boat']);
 const items=['Boat','Bungalow','Safari'];assert.deepEqual(moveProgrammeItem(items,2,-1),['Boat','Safari','Bungalow']);assert.deepEqual(items,['Boat','Bungalow','Safari']);assert.equal(moveProgrammeItem(items,0,-1),items);
});

test('Programme edits round-trip per variant through draft, preview and publish without changing rates, terms or stops',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());const original=(await product(db,'tour'))!.tour,state=await activeState(db);
 assert.deepEqual((await editorState(db)).tours[0].variants[0].itinerary,original.variants[0].itinerary);
 const payload=editorPayload(original);payload.variants[0].itinerary=['Edited safari','New temple','Boat 0'];
 const input={revision:0,productId:original.id,baseReleaseId:state.release_id,baseGeneration:state.generation,payload};
 const draft=await saveEditorDraft(db,input,'test');assert.deepEqual((await product(db,'tour'))!.tour,original);
 const restored=await editorState(db);assert.deepEqual(restored.drafts.find(d=>d.id===draft.id)!.payload.variants[0].itinerary,payload.variants[0].itinerary);assert.deepEqual(restored.tours[0].variants[0].itinerary,original.variants[0].itinerary);
 const preview=await previewEditorDraft(db,draft.id);assert.deepEqual(preview.tour.variants[0].itinerary,payload.variants[0].itinerary);assert.deepEqual(preview.tour.variants[1],original.variants[1]);
 await assert.rejects(saveEditorDraft(db,{...input,id:draft.id,revision:0},'test'),/DRAFT_CONFLICT/);
 const result=await publishEditorDraft(db,draft.id,1,'test'),current=(await product(db,'tour'))!.tour;
 assert.deepEqual(current.variants[0].itinerary,payload.variants[0].itinerary);assert.deepEqual(current.variants[1].itinerary,original.variants[1].itinerary);assert.equal(current.variants[1].revisionId,original.variants[1].revisionId);
 for(let i=0;i<2;i++){
  for(const key of ['id','description','includes','extras','conditions','earliestDate','stops'] as const)assert.deepEqual(current.variants[i][key],original.variants[i][key]);
  assert.deepEqual(current.variants[i].rates.map(rate=>({...rate,id:undefined})),original.variants[i].rates.map(rate=>({...rate,id:undefined})));
 }
 const terms=JSON.parse(String(db.sqlite.prepare('SELECT terms_json FROM catalog_variant_revisions WHERE id=?').get(current.variants[0].revisionId)!.terms_json));assert.equal(terms.customPreserved,'private term');
 const summary=JSON.parse(String(db.sqlite.prepare('SELECT summary_json FROM catalog_releases WHERE id=?').get(result.releaseId)!.summary_json));assert.equal(summary.counts.itinerary,1);assert.equal(summary.counts.price,0);
 assert.deepEqual((await product(db,'tour','base'))!.tour,original);assert.deepEqual(await publishEditorDraft(db,draft.id,1,'test'),result);
 await assert.rejects(saveEditorDraft(db,input,'test'),/CONFLICT_REFRESH_REQUIRED/);
});

test('Legacy draft without itinerary preserves programme; invalid explicit programmes never save',async t=>{
 const db=fixture();t.after(()=>db.sqlite.close());const original=(await product(db,'tour'))!.tour,payload=editorPayload(original);
 payload.variants.forEach(v=>delete v.itinerary);payload.title='Legacy title';
 const input={revision:0,productId:'tour',baseReleaseId:'base',baseGeneration:1,payload};
 for(const itinerary of [[],[' '],Array(201).fill('x')])await assert.rejects(saveEditorDraft(db,{...input,payload:{...payload,variants:payload.variants.map((v,i)=>i? v:{...v,itinerary})}},'test'));
 const draft=await saveEditorDraft(db,input,'test');await publishEditorDraft(db,draft.id,1,'test');assert.deepEqual((await product(db,'tour'))!.tour.variants.map(v=>v.itinerary),original.variants.map(v=>v.itinerary));
});


test('Changed RU programme gates stale EN until an explicit translation publication',async t=>{
 const db=fixture();t.after(()=>{Object.assign(globalThis,{__testLocale:'ru'});db.sqlite.close();});
 Object.assign(globalThis,{__testLocale:'ru'});const original=(await product(db,'tour'))!.tour,payload=editorPayload(original);
 payload.variants[0].itinerary=['Новый маршрут после правки'];
 const draft=await saveEditorDraft(db,{revision:0,productId:'tour',baseReleaseId:'base',baseGeneration:1,payload},'test');
 Object.assign(globalThis,{__testLocale:'en'});assert.ok(await product(db,'tour'));
 await publishEditorDraft(db,draft.id,1,'test');assert.equal(await product(db,'tour'),null);
 db.sqlite.prepare('INSERT INTO catalog_localizations VALUES(?,?,?,?,?,?,?)').run('en','Новый маршрут после правки','New revised route',null,1,'2026-10-21','test');
 assert.equal(await product(db,'tour'),null);
 db.sqlite.prepare('UPDATE catalog_localizations SET published_text=translated_text WHERE locale=?').run('en');
 assert.deepEqual((await product(db,'tour'))!.tour.variants[0].itinerary,['New revised route']);
 Object.assign(globalThis,{__testLocale:'ru'});assert.deepEqual((await product(db,'tour'))!.tour.variants[0].itinerary,['Новый маршрут после правки']);
});
