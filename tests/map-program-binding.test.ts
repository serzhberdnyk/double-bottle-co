import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './d1-adapter';
import {defaultMapDocument,mapDocumentSchema,mergeMapDocument,type MapDocument} from '../lib/public/map-layout';
import {mapEditorState,mapTourChoices,publishedMapDocument,saveAndPublishMap} from '../lib/server/map-editor';

function seededDatabase(){
 const db=testDatabase();
 db.sqlite.exec(`INSERT INTO catalog_releases(id,hash,status,created_at,created_by,summary_json) VALUES('r','program-test','published','2026-01-01','test','{}');
 INSERT INTO catalog_state(id,release_id,generation) VALUES(1,'r',4);`);
 for(let index=0;index<16;index++){
  const id='tour-'+index;
  db.sqlite.prepare('INSERT INTO catalog_products(id,slug) VALUES(?,?)').run(id,id);
  db.sqlite.prepare("INSERT INTO catalog_release_products(release_id,product_id,title,description,category,image_alt,sale_status,publication_status) VALUES('r',? ,?,'','sea','','on_request',?)").run(id,'Tour '+index,index===2?'archived':'published');
  for(const name of index===0?['standard','vip']:['standard']){
   const variant=id+'-'+name;
   db.sqlite.prepare('INSERT INTO catalog_variants(id,product_id) VALUES(?,?)').run(variant,id);
   db.sqlite.prepare("INSERT INTO catalog_variant_revisions(id,variant_id,hash,name,duration,days,transport,format,terms_json) VALUES(?,?,?,?,'1 day',1,'Boat','Group','{}')").run('rev-'+variant,variant,'hash-'+variant,name);
   db.sqlite.prepare("INSERT INTO catalog_release_variants(release_id,variant_id,revision_id,sale_status,visible) VALUES('r',?,?,'on_request',?)").run(variant,'rev-'+variant,index===1?0:1);
  }
 }
 // An identity that is absent from the active release is not a selectable program.
 db.sqlite.exec("INSERT INTO catalog_products(id,slug) VALUES('draft-only','draft-only'); INSERT INTO catalog_variants(id,product_id) VALUES('draft-program','draft-only');");
 return db;
}
function document(tourId:string|null='tour-0',variantId:string|null|undefined='tour-0-standard'):MapDocument{
 return {...structuredClone(defaultMapDocument),routes:[{id:'program-route',title:'Route',tourId,...(variantId===undefined?{}:{variantId}),color:'sea',style:'dashed',closed:true,points:[{x:10,y:20,label:'Boarding',color:'gold'},{x:30,y:40,label:'Bay',color:'violet'},{x:50,y:60,label:'Return',color:'coral'}]}]};
}

test('admin choices include the full active catalog with hidden/archive labels and stable program IDs',async t=>{
 const db=seededDatabase();t.after(()=>db.sqlite.close());
 const admin=await mapEditorState(db),publicChoices=await mapTourChoices(db);
 assert.equal(admin.tours.length,16);assert.equal(publicChoices.tours.length,14);
 assert.equal(admin.tours.find(tour=>tour.id==='tour-2')!.hidden,true);
 assert.equal(admin.tours.find(tour=>tour.id==='tour-1')!.variants![0].visible,false);
 assert.deepEqual(admin.tours.find(tour=>tour.id==='tour-0')!.variants!.map(program=>program.id),['tour-0-standard','tour-0-vip']);
 assert(!admin.tours.some(tour=>tour.id==='draft-only'));
});

test('program bindings persist exact route metadata; hidden and archived routes remain admin-only',async t=>{
 const db=seededDatabase();t.after(()=>db.sqlite.close());
 const doc=document();doc.routes.push({...document('tour-1','tour-1-standard').routes[0],id:'hidden-route'},{...document('tour-2','tour-2-standard').routes[0],id:'archived-route'});
 const catalogBefore=db.sqlite.prepare('SELECT * FROM catalog_release_variants').all();
 await saveAndPublishMap(db,doc,0,4,'owner');assert.deepEqual((await mapEditorState(db)).publishedDocument,doc);
 let publicDoc=await publishedMapDocument(db);assert.deepEqual(publicDoc.routes.map(route=>route.id),['program-route']);
 const {tour,...publicRoute}=publicDoc.routes[0];assert.deepEqual(publicRoute,doc.routes[0]);assert.deepEqual(tour,{id:'tour-0',slug:'tour-0',title:'Tour 0'});
 assert.deepEqual(db.sqlite.prepare('SELECT * FROM catalog_release_variants').all(),catalogBefore);
 db.sqlite.exec("UPDATE catalog_release_variants SET visible=0 WHERE variant_id='tour-0-standard'");
 publicDoc=await publishedMapDocument(db);assert.equal(publicDoc.routes.length,0);assert.deepEqual((await mapEditorState(db)).publishedDocument,doc);
});

test('deleted, unrelated and out-of-release program IDs are rejected without modifying saved map or catalog',async t=>{
 const db=seededDatabase();t.after(()=>db.sqlite.close());await saveAndPublishMap(db,document(),0,4,'owner');
 const before=await mapEditorState(db),events=db.sqlite.prepare('SELECT * FROM internal_events').all();
 for(const variantId of ['deleted-program','tour-3-standard','draft-program'])await assert.rejects(saveAndPublishMap(db,document('tour-0',variantId),1,4,'owner'),/MAP_PROGRAM_UNAVAILABLE/);
 await assert.rejects(saveAndPublishMap(db,document('draft-only','draft-program'),1,4,'owner'),/MAP_TOUR_UNAVAILABLE/);
 assert.deepEqual(await mapEditorState(db),before);assert.deepEqual(db.sqlite.prepare('SELECT * FROM internal_events').all(),events);
 db.sqlite.exec("DELETE FROM catalog_release_variants WHERE variant_id='tour-0-standard'");
 assert.equal((await publishedMapDocument(db)).routes.length,0);
 await assert.rejects(saveAndPublishMap(db,document(),1,4,'owner'),/MAP_PROGRAM_UNAVAILABLE/);
 assert.deepEqual((await mapEditorState(db)).publishedDocument,document());
});

test('a release-local moved program accepts only its effective tour owner',async t=>{
 const db=seededDatabase();t.after(()=>db.sqlite.close());
 db.sqlite.exec("UPDATE catalog_release_variants SET product_id='tour-3' WHERE variant_id='tour-0-vip'");
 const choices=await mapTourChoices(db,true);
 assert(!choices.tours.find(tour=>tour.id==='tour-0')!.variants!.some(program=>program.id==='tour-0-vip'));
 assert(choices.tours.find(tour=>tour.id==='tour-3')!.variants!.some(program=>program.id==='tour-0-vip'));
 await assert.rejects(saveAndPublishMap(db,document('tour-0','tour-0-vip'),0,4,'owner'),/MAP_PROGRAM_UNAVAILABLE/);
 await saveAndPublishMap(db,document('tour-3','tour-0-vip'),0,4,'owner');
 assert.equal((await publishedMapDocument(db)).routes[0].tourId,'tour-3');
});

test('legacy tour-only routes retain all data and require explicit program selection, even for one variant',async t=>{
 const db=seededDatabase();t.after(()=>db.sqlite.close());
 const doc=document();delete doc.routes[0].variantId;
 const single=document('tour-3');delete single.routes[0].variantId;doc.routes.push({...single.routes[0],id:'single-program-legacy'});
 await saveAndPublishMap(db,doc,0,4,'owner');assert.deepEqual((await mapEditorState(db)).publishedDocument,doc);assert.equal((await publishedMapDocument(db)).routes.length,0);
 doc.routes[0].variantId='tour-0-vip';await saveAndPublishMap(db,doc,1,4,'owner');
 assert.deepEqual((await publishedMapDocument(db)).routes.map(route=>route.variantId),['tour-0-vip']);
 assert.deepEqual((await mapEditorState(db)).publishedDocument.routes[1],doc.routes[1]);
});

test('older v0.8.2 editor omitting program preserves its binding; explicit clears and tour changes detach',async t=>{
 const db=seededDatabase();t.after(()=>db.sqlite.close());const doc=document();await saveAndPublishMap(db,doc,0,4,'owner');
 const older=structuredClone(doc);delete older.routes[0].variantId;older.routes[0].title='Edited by older client';
 await saveAndPublishMap(db,older,1,4,'owner');assert.equal((await mapEditorState(db)).publishedDocument.routes[0].variantId,'tour-0-standard');
 for(const preserveRouteMetadata of [true,false]){
  const changed=structuredClone(older);changed.routes[0].tourId='tour-3';assert.equal(mergeMapDocument(changed,doc,{preserveRouteMetadata}).routes[0].variantId,undefined);
  changed.routes[0].tourId=null;assert.equal(mergeMapDocument(changed,doc,{preserveRouteMetadata}).routes[0].variantId,undefined);
 }
 const cleared=structuredClone(doc);cleared.routes[0].variantId=null;await saveAndPublishMap(db,cleared,2,4,'owner');assert.deepEqual((await mapEditorState(db)).publishedDocument,cleared);assert.equal((await publishedMapDocument(db)).routes.length,0);
 const orphan=document(null);assert.equal(mapDocumentSchema.safeParse(orphan).success,false);
});
