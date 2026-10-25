import test from 'node:test';import assert from 'node:assert/strict';
import {busMapObject,defaultMapDocument,legacyMapLayout,parseMapDocument,mapDocumentSchema,mapPlacementImageSize} from '../lib/public/map-layout.ts';
import {testDatabase} from './d1-adapter.ts';
import {saveMapDraft,publishMapDraft,mapEditorState} from '../lib/server/map-editor.ts';

test('old four-object records gain an editable bus without rewriting storage',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());
 const old=legacyMapLayout(defaultMapDocument);assert.equal(old.length,4);
 const parsed=parseMapDocument(old);assert.equal(parsed.placements.length,5);
 assert.deepEqual(parsed.placements.find(p=>p.id===busMapObject.id),{id:busMapObject.id,x:25.7,y:10.34,image:busMapObject.image});
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM map_editor_state').get().n,0);
 assert.equal(mapPlacementImageSize(parsed.placements.at(-1)),83.2);
 const oldV2={version:2,placements:old,routes:[]};
 db.sqlite.prepare('INSERT INTO map_editor_state(id,revision,published_revision,published_json,updated_at,updated_by) VALUES(1,0,0,?,?,?)').run(JSON.stringify(oldV2),'test','test');
 assert.equal((await mapEditorState(db)).publishedDocument.placements.length,5);
 assert.equal(db.sqlite.prepare('SELECT published_json FROM map_editor_state').get().published_json,JSON.stringify(oldV2));
});

test('bus and every icon size/position survive save, publish, reload and older client saves',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const doc=structuredClone(defaultMapDocument);
 doc.placements=doc.placements.map((p,i)=>({...p,sizePx:90+i,x:7+i,y:83-i}));
 doc.placements.push({id:'custom-landmark',title:'Custom',image:'/media/reference/map-landmark-placeholder.svg',x:99,y:1,sizePx:111});
 doc.routes=[{id:'route-preserved',title:'Route',points:[{x:1,y:99},{x:98,y:2}],color:'sea',style:'dashed'}];
 await saveMapDraft(db,doc,0,'test-owner');await publishMapDraft(db,1,'test-owner');
 let state=await mapEditorState(db);assert.deepEqual(state.publishedDocument,doc);
 // v1 knows just four anchors. It must retain all added objects, sizes and routes.
 await saveMapDraft(db,legacyMapLayout(doc),2,'old-owner');state=await mapEditorState(db);assert.deepEqual(state.draftDocument,doc);
 // Older v2 does know custom content but has neither the new bus nor size field.
 const older={...doc,placements:doc.placements.filter(p=>p.id!==busMapObject.id).map(({sizePx,...p})=>p)};
 await saveMapDraft(db,older,3,'old-v2-owner');state=await mapEditorState(db);assert.deepEqual(state.draftDocument,doc);
 const reset=structuredClone(doc);reset.placements[0].sizePx=null;
 await saveMapDraft(db,reset,4,'test-owner');await publishMapDraft(db,5,'test-owner');
 state=await mapEditorState(db);assert.equal(state.publishedDocument.placements[0].sizePx,null);
 assert.equal(mapPlacementImageSize(state.publishedDocument.placements[0]),66);
 assert.deepEqual(state.publishedDocument.placements.slice(1),doc.placements.slice(1));
 assert.deepEqual(state.publishedDocument.routes,doc.routes);
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM catalog_state').get().n,0);
});

test('invalid size, unknown fields and malformed old records fail instead of erasing content',()=>{
 for(const sizePx of [0,15.9,240.1,Infinity,'90']){const doc=structuredClone(defaultMapDocument);doc.placements[0].sizePx=sizePx;assert(!mapDocumentSchema.safeParse(doc).success);}
 const doc=structuredClone(defaultMapDocument);doc.placements[0].unknown=true;assert(!mapDocumentSchema.safeParse(doc).success);
 assert.throws(()=>parseMapDocument(legacyMapLayout(defaultMapDocument).slice(1)));
});
