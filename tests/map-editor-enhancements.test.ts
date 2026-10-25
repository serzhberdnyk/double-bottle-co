import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDatabase} from './d1-adapter';
import {defaultMapDocument,mapDocumentSchema,mergeMapDocument,mapRouteLinePoints,type MapDocument} from '../lib/public/map-layout';
import {mapEditorState,publishedMapDocument,mapTourChoices,saveMapDraft,saveAndPublishMap} from '../lib/server/map-editor';

function document():MapDocument{return {...structuredClone(defaultMapDocument),routes:[{id:'synthetic-route',title:'Synthetic route',color:'sea',style:'dashed',points:[{x:5,y:10,label:'Start',color:'gold'},{x:80,y:90,label:'Finish',color:'violet'}]}]};}
function seedTours(db:ReturnType<typeof testDatabase>){
 db.sqlite.exec(`INSERT INTO catalog_releases(id,hash,status,created_at,created_by,summary_json) VALUES('r','synthetic-r','published','2026-01-01','test','{}');
 INSERT INTO catalog_state(id,release_id,generation) VALUES(1,'r',4);`);
 for(const [id,publication,visible] of [['one','published',1],['hidden','archived',1],['no-visible','published',0]] as const){
  db.sqlite.prepare('INSERT INTO catalog_products(id,slug) VALUES(?,?)').run(id,id);
  db.sqlite.prepare('INSERT INTO catalog_variants(id,product_id) VALUES(?,?)').run('v-'+id,id);
  db.sqlite.prepare("INSERT INTO catalog_variant_revisions(id,variant_id,hash,name,duration,days,transport,format,terms_json) VALUES(?,?,?,'Synthetic','1 day',1,'Boat','Group','{}')").run('rev-'+id,'v-'+id,'hash-'+id);
  db.sqlite.prepare("INSERT INTO catalog_release_products(release_id,product_id,title,description,category,image_alt,sale_status,publication_status) VALUES('r',?,'Synthetic excursion','','sea','','on_request',?)").run(id,publication);
  db.sqlite.prepare("INSERT INTO catalog_release_variants(release_id,variant_id,revision_id,sale_status,visible) VALUES('r',?,?,'on_request',?)").run('v-'+id,'rev-'+id,visible);
 }
}

test('point labels/colors and program link survive save, publish, readback, reload; no catalog changes',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());seedTours(db);const doc=document();doc.routes[0].tourId='one';doc.routes[0].variantId='v-one';
 const before=db.sqlite.prepare('SELECT * FROM catalog_release_products').all();
 const saved=await saveMapDraft(db,doc,0,'owner');assert.deepEqual(saved.draftDocument,doc);
 const published=await saveAndPublishMap(db,doc,1,4,'owner');assert.equal(published.draftDocument,null);assert.deepEqual(published.publishedDocument,doc);
 assert.deepEqual((await mapEditorState(db)).publishedDocument,doc);
 const publicDoc=await publishedMapDocument(db);assert.deepEqual({...publicDoc.routes[0].tour},{id:'one',slug:'one',title:'Synthetic excursion'});
 assert.deepEqual(db.sqlite.prepare('SELECT * FROM catalog_release_products').all(),before);
});
test('one-step publication accepts a fresh editor with no saved draft and uses current payload instead of old draft',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const doc=document();
 await saveAndPublishMap(db,doc,0,null,'owner');assert.equal((await mapEditorState(db)).publishedRevision,1);
 const old=structuredClone(doc);old.routes[0].title='Old saved content';await saveMapDraft(db,old,1,'owner');
 doc.routes[0].title='Latest local content';doc.routes[0].points[0].x=11;
 await saveAndPublishMap(db,doc,2,null,'owner');assert.deepEqual((await mapEditorState(db)).publishedDocument,doc);
 assert.equal(db.sqlite.prepare("SELECT count(*) n FROM internal_events WHERE type='map_published'").get()!.n,2);
});
test('invalid current payload, stale revision and repeated publication never publish an old draft',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const doc=document();await saveMapDraft(db,doc,0,'owner');const before=await mapEditorState(db);
 const invalid=structuredClone(doc);invalid.routes[0].points=[invalid.routes[0].points[0]];
 await assert.rejects(saveAndPublishMap(db,invalid,1,null,'owner'));
 await assert.rejects(saveAndPublishMap(db,doc,0,null,'owner'),/MAP_CONFLICT/);assert.deepEqual(await mapEditorState(db),before);
 await saveAndPublishMap(db,doc,1,null,'owner');await assert.rejects(saveAndPublishMap(db,doc,1,null,'owner'),/MAP_CONFLICT/);
 assert.equal(db.sqlite.prepare("SELECT count(*) n FROM internal_events WHERE type='map_published'").get()!.n,1);
});
test('older v2 geometry-only clients preserve point metadata and link; explicit reset detaches safely',()=>{
 const doc=document();doc.routes[0].tourId='one';
 const old=structuredClone(doc);delete old.routes[0].tourId;old.routes[0].points=old.routes[0].points.map(({x,y})=>({x,y})).reverse();
 const merged=mergeMapDocument(old,doc);assert.equal(merged.routes[0].tourId,'one');assert.equal(merged.routes[0].points[0].label,'Finish');
 const reset=structuredClone(doc);reset.routes[0].tourId=null;reset.routes[0].points[0].label='';reset.routes[0].points[0].color='cream';
 assert.deepEqual(mergeMapDocument(reset,doc),reset);
});
test('strict shape rejects oversized labels, unsupported colors, duplicate routes and forged public metadata',()=>{
 for(const patch of [{label:'x'.repeat(121)},{color:'url(javascript:x)'}]){const doc=document();Object.assign(doc.routes[0].points[0],patch);assert.equal(mapDocumentSchema.safeParse(doc).success,false);}
 const duplicate=document();duplicate.routes.push(duplicate.routes[0]);assert.equal(mapDocumentSchema.safeParse(duplicate).success,false);
 const forged=document();forged.routes[0].tour={id:'one',slug:'fake',title:'Fake'};assert.equal(mapDocumentSchema.safeParse(forged).success,false);
});
test('missing excursions cannot be linked; archived and detached routes are not public',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());seedTours(db);
 assert.deepEqual((await mapTourChoices(db)).tours.map(tour=>tour.id),['one']);
 const missing=document();missing.routes[0].tourId='missing';await assert.rejects(saveAndPublishMap(db,missing,0,4,'owner'),/MAP_TOUR_UNAVAILABLE/);
 const doc=document();doc.routes[0].tourId='one';doc.routes[0].variantId='v-one';await saveAndPublishMap(db,doc,0,4,'owner');
 db.sqlite.exec("UPDATE catalog_release_products SET publication_status='archived' WHERE product_id='one'");assert.equal((await publishedMapDocument(db)).routes.length,0);
 assert.equal((await mapEditorState(db)).publishedDocument.routes[0].tourId,'one');
 doc.routes[0].tourId=null;doc.routes[0].variantId=null;await saveAndPublishMap(db,doc,1,4,'owner');assert.equal((await publishedMapDocument(db)).routes.length,0);
});
test('stale catalog generation and catalog change between validation/write fail closed',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());seedTours(db);const doc=document();doc.routes[0].tourId='one';
 await assert.rejects(saveAndPublishMap(db,doc,0,3,'owner'),/MAP_CATALOG_CONFLICT/);
 const batch=db.batch.bind(db);db.batch=(async statements=>{db.sqlite.exec('UPDATE catalog_state SET generation=5');return batch(statements);}) as typeof db.batch;
 await assert.rejects(saveAndPublishMap(db,doc,0,4,'owner'),/MAP_CONFLICT/);
 assert.equal((await mapEditorState(db)).revision,0);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM internal_events').get()!.n,0);
});
test('failed audit write rolls back the whole publication and preserves old published/draft state',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const doc=document();await saveMapDraft(db,doc,0,'owner');const before=await mapEditorState(db);
 db.sqlite.exec("CREATE TRIGGER synthetic_reject_publication BEFORE INSERT ON internal_events WHEN NEW.type='map_published' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");
 await assert.rejects(saveAndPublishMap(db,doc,1,null,'owner'),/synthetic audit failure/);assert.deepEqual(await mapEditorState(db),before);
 assert.equal(db.sqlite.prepare("SELECT count(*) n FROM internal_events WHERE type='map_draft_saved'").get()!.n,1);
});
test('map API keeps authentication, same-origin, payload cap, generation/revision and current-document guards',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());Object.assign(globalThis,{__visibilityEnv:{DB:db,ADMIN_EMAILS:'owner@example.invalid'}});
 const route=await import('../app/api/admin/map/route');const url='https://example.invalid/api/admin/map';
 const headers={'oai-authenticated-user-id':'synthetic-owner','oai-authenticated-user-email':'owner@example.invalid','content-type':'application/json',Origin:'https://example.invalid'};
 const body={action:'saveAndPublish',revision:0,catalogGeneration:null,document:document()};
 const post=(payload:unknown,h:Record<string,string>=headers)=>route.POST(new Request(url,{method:'POST',headers:h,body:JSON.stringify(payload)}));
 assert.equal((await route.GET(new Request(url))).status,403);assert.equal((await post(body,{})).status,403);assert.equal((await post(body,{...headers,Origin:'https://other.invalid'})).status,403);
 assert.equal((await post({...body,document:undefined})).status,409);assert.equal((await post({...body,catalogGeneration:undefined})).status,409);
 assert.equal((await post({...body,extra:'x'.repeat(256001)})).status,413);assert.equal((await post(body)).status,200);assert.equal((await post(body)).status,409);
});
test('editor removes all numeric coordinates but retains direct drag, keyboard movement and unsaved warnings',()=>{
 const source=readFileSync('app/admin/map-panel.tsx','utf8');assert(!source.includes('type="number"'));assert(!source.includes('Слева'));assert(!source.includes('Сверху'));assert(!source.includes('Сохранить черновик карты'));
 for(const text of ['Сохранить и опубликовать','Название точки','Цвет точки','Экскурсия','beforeunload','onPointerMove={pointMove}','onKeyDown={event=>pointKey(event,index)}','actionLock.current','catalogGeneration:data.catalogGeneration'])assert(source.includes(text),text);
});

test('modern delete then add does not copy removed/index-matched point metadata onto the new point',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const doc=document();await saveAndPublishMap(db,doc,0,null,'owner');
 const edited=structuredClone(doc);edited.routes[0].points=[edited.routes[0].points[1],{x:20,y:30}];
 await saveAndPublishMap(db,edited,1,null,'owner');assert.deepEqual((await mapEditorState(db)).publishedDocument,edited);
});

test('EN/TH public map omits links and routes whose excursion is not locale-ready',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());seedTours(db);db.sqlite.exec("UPDATE catalog_release_products SET title='Уникальная непереведённая экскурсия 987654' WHERE product_id='one'");const doc=document();doc.routes[0].tourId='one';doc.routes[0].variantId='v-one';await saveAndPublishMap(db,doc,0,4,'owner');
 try{for(const locale of ['en','th']){Object.assign(globalThis,{__testLocale:locale});assert.equal((await publishedMapDocument(db)).routes.length,0);}}
 finally{Object.assign(globalThis,{__testLocale:'ru'});}
 assert.equal((await publishedMapDocument(db)).routes[0].tourId,'one');assert.equal((await mapEditorState(db)).publishedDocument.routes.length,1);
});

test('closed route persists without a duplicate stop and old geometry clients retain closure or auto-open below three',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const doc=document();doc.routes[0].points.push({x:40,y:70,label:'Middle',color:'coral'});doc.routes[0].closed=true;
 await saveAndPublishMap(db,doc,0,null,'owner');assert.deepEqual((await mapEditorState(db)).publishedDocument,doc);assert.equal(doc.routes[0].points.length,3);assert.equal(mapRouteLinePoints(doc.routes[0]).split(' ').length,4);
 const old=structuredClone(doc);delete old.routes[0].closed;assert.equal(mergeMapDocument(old,doc).routes[0].closed,true);old.routes[0].points.pop();assert.equal(mergeMapDocument(old,doc).routes[0].closed,false);
 const reopened=structuredClone(doc);reopened.routes[0].closed=false;await saveAndPublishMap(db,reopened,1,null,'owner');assert.deepEqual((await mapEditorState(db)).publishedDocument.routes[0].points,doc.routes[0].points);assert.equal(mapRouteLinePoints(reopened.routes[0]).split(' ').length,3);
});
test('closed route rejects fewer than three distinct points and non-boolean flags without publishing',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const doc=document();doc.routes[0].closed=true;assert.equal(mapDocumentSchema.safeParse(doc).success,false);await assert.rejects(saveAndPublishMap(db,doc,0,null,'owner'));
 doc.routes[0].points.push({...doc.routes[0].points[0]});assert.equal(mapDocumentSchema.safeParse(doc).success,false);Object.assign(doc.routes[0],{closed:'true'});assert.equal(mapDocumentSchema.safeParse(doc).success,false);assert.equal((await mapEditorState(db)).publishedRevision,0);
});
