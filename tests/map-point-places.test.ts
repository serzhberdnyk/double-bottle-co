import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {testDatabase} from './d1-adapter';
import {defaultMapDocument,mapObjects,mapDocumentSchema,mergeMapDocument,parseMapDocument,resolveMapRoute,setMapRoutePointPlace,removeMapPlacement,mapRouteLinePoints,type MapDocument} from '../lib/public/map-layout';
import {mapEditorState,publishedMapDocument,publishedMapLayout,saveAndPublishMap} from '../lib/server/map-editor';
import {routesForProgram} from '../lib/public/map-route-display';

function document():MapDocument{return {...structuredClone(defaultMapDocument),routes:[{id:'route',title:'Route',color:'sea',style:'dashed',closed:true,points:[{x:5,y:10,label:'Own name',color:'coral'},{x:70,y:40,color:'violet'},{x:60,y:90,color:'gold'}]}]};}
const buddha=mapObjects.find(place=>place.id==='big-buddha')!;
function seedProgram(db:ReturnType<typeof testDatabase>){
 db.sqlite.exec(`INSERT INTO catalog_releases(id,hash,status,created_at,created_by,summary_json) VALUES('r','places-test','published','2026-01-01','test','{}');
 INSERT INTO catalog_state(id,release_id,generation) VALUES(1,'r',1);
 INSERT INTO catalog_products(id,slug) VALUES('tour','tour');
 INSERT INTO catalog_release_products(release_id,product_id,title,description,category,image_alt,sale_status,publication_status) VALUES('r','tour','Tour','','sea','','on_request','published');
 INSERT INTO catalog_variants(id,product_id) VALUES('standard','tour');
 INSERT INTO catalog_variant_revisions(id,variant_id,hash,name,duration,days,transport,format,terms_json) VALUES('rev','standard','hash','Standard','1 day',1,'Boat','Group','{}');
 INSERT INTO catalog_release_variants(release_id,variant_id,revision_id,sale_status,visible) VALUES('r','standard','rev','on_request',1);`);
}

test('Big Buddha is an existing image object; linked stop follows its ID while retaining name, colour, order and closure',()=>{
 const doc=document(),before=JSON.stringify(doc);assert(existsSync('public'+buddha.image));
 const linked=setMapRoutePointPlace(doc.routes[0].points[0],buddha.id,doc.placements);
 assert.equal(JSON.stringify(doc),before);assert.equal(linked.placeId,buddha.id);assert.equal(linked.icon,null);assert(!Object.hasOwn(linked,'image'));
 doc.routes[0].points[0]=linked;
 const place=doc.placements.find(place=>place.id===buddha.id)!;Object.assign(place,{x:32,y:44,title:'Renamed place'});
 const preview=resolveMapRoute(doc.routes[0],doc.placements);
 assert.deepEqual(preview.points[0],{...linked,x:32,y:44,image:buddha.image});
 assert.equal(preview.points[0].label,'Own name');assert.equal(preview.points[0].color,'coral');
 assert.deepEqual(preview.points.slice(1),doc.routes[0].points.slice(1));assert.equal(preview.closed,true);
 assert.equal(mapRouteLinePoints(preview).split(' ').length,4);assert(mapRouteLinePoints(preview).endsWith('409.6,476.52'));
});

test('place and standalone image survive save/reopen/edit; public program gets resolved icons, general layout gains nothing',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());seedProgram(db);const doc=document();
 Object.assign(doc.routes[0],{tourId:'tour',variantId:'standard'});
 doc.routes[0].points[0]=setMapRoutePointPlace({...doc.routes[0].points[0],label:''},buddha.id,doc.placements);
 doc.routes[0].points[1].icon=mapObjects[0].image;
 const catalogue=db.sqlite.prepare('SELECT * FROM catalog_release_variants').all();
 await saveAndPublishMap(db,doc,0,1,'test');
 const reopened=(await mapEditorState(db)).publishedDocument;assert.deepEqual(reopened,doc);
 const pub=await publishedMapDocument(db),route=routesForProgram(pub.routes,'tour','standard')[0];
 assert.equal(route.points[0].image,buddha.image);assert.equal(route.points[0].label,'Биг Будда');assert.equal(route.points[1].image,mapObjects[0].image);
 assert.equal(routesForProgram(pub.routes,'tour','vip').length,0);assert.deepEqual(await publishedMapLayout(db),doc.placements);
 const moved=reopened.placements.find(place=>place.id===buddha.id)!;moved.x=35;moved.y=45;
 reopened.routes[0].points[1].icon=mapObjects[1].image;await saveAndPublishMap(db,reopened,1,1,'test');
 const second=(await publishedMapDocument(db)).routes[0];assert.equal(second.points[0].x,35);assert.equal(second.points[0].y,45);assert.equal(second.points[1].image,mapObjects[1].image);
 assert.deepEqual((await mapEditorState(db)).publishedDocument,reopened);assert.deepEqual(db.sqlite.prepare('SELECT * FROM catalog_release_variants').all(),catalogue);
});

test('detaching keeps current position/name/colour and all places; standalone icon clearing does not remove a stop',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const doc=document();
 doc.routes[0].points[0]=setMapRoutePointPlace({...doc.routes[0].points[0],label:''},buddha.id,doc.placements);
 doc.placements.find(place=>place.id===buddha.id)!.x=33;
 const before=structuredClone(doc.placements),point=setMapRoutePointPlace(doc.routes[0].points[0],null,doc.placements);
 assert.equal(point.x,33);assert.equal(point.label,'Биг Будда');assert.equal(point.color,'coral');assert.equal(point.placeId,null);assert(!Object.hasOwn(point,'image'));
 doc.routes[0].points[0]={...point,icon:buddha.image};await saveAndPublishMap(db,doc,0,null,'test');
 doc.routes[0].points[0].icon=null;await saveAndPublishMap(db,doc,1,null,'test');
 assert.deepEqual((await mapEditorState(db)).publishedDocument,doc);assert.deepEqual(doc.placements,before);assert.equal(doc.routes[0].points.length,3);assert.equal(doc.routes[0].closed,true);
});

test('missing places, conflicting or unsafe images, missing uploads and forged preview fields fail without saving',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());
 for(const patch of [{placeId:'missing'},{icon:'https://example.invalid/image.png'},{icon:'javascript:alert(1)'},{placeId:buddha.id,icon:buddha.image},{image:buddha.image}]){
  const doc=document();Object.assign(doc.routes[0].points[0],patch);assert.equal(mapDocumentSchema.safeParse(doc).success,false);await assert.rejects(saveAndPublishMap(db,doc,0,null,'test'));
 }
 const missing=document();missing.routes[0].points[0].icon='/api/catalog-media/'+'a'.repeat(64);await assert.rejects(saveAndPublishMap(db,missing,0,null,'test'),/MAP_IMAGE_MISSING/);
 const collapsed=document();collapsed.routes[0].points[0].placeId=buddha.id;collapsed.routes[0].points[1].placeId=buddha.id;assert.equal(mapDocumentSchema.safeParse(collapsed).success,false);
 assert.equal((await mapEditorState(db)).publishedRevision,0);
});

test('legacy geometry and open editors remain compatible; omitted bindings survive exact matches, explicit null clears',()=>{
 const legacy=document();assert.deepEqual(parseMapDocument(legacy),legacy);
 const doc=document();doc.routes[0].points[0]=setMapRoutePointPlace(doc.routes[0].points[0],buddha.id,doc.placements);doc.routes[0].points[1].icon=buddha.image;
 const older=structuredClone(doc);older.routes[0].points=older.routes[0].points.map(({placeId,icon,...point})=>point).reverse();
 for(const preserveRouteMetadata of [true,false]){
  const merged=mergeMapDocument(older,doc,{preserveRouteMetadata});assert.equal(merged.routes[0].points[2].placeId,buddha.id);assert.equal(merged.routes[0].points[1].icon,buddha.image);
  const cleared=structuredClone(doc);cleared.routes[0].points[0].placeId=null;cleared.routes[0].points[1].icon=null;assert.deepEqual(mergeMapDocument(cleared,doc,{preserveRouteMetadata}),cleared);
 }
 older.routes[0].points[2]={x:99,y:99};assert.equal(mergeMapDocument(older,doc,{preserveRouteMetadata:false}).routes[0].points[2].placeId,undefined);
});

test('removing a custom place detaches dependent stops at their last location without deleting routes',()=>{
 const doc=document();doc.placements.push({id:'custom',x:44,y:55,image:buddha.image,title:'Custom place'});
 doc.routes[0].points[0]=setMapRoutePointPlace(doc.routes[0].points[0],'custom',doc.placements);
 const updated=removeMapPlacement(doc,'custom');assert.equal(doc.placements.length,updated.placements.length+1);
 assert.equal(updated.routes.length,1);assert.equal(updated.routes[0].points.length,3);assert.equal(updated.routes[0].closed,true);
 assert.deepEqual(updated.routes[0].points[0],{...doc.routes[0].points[0],placeId:null});assert(mapDocumentSchema.safeParse(updated).success);
});
