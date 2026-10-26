import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Buffer} from 'node:buffer';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,type ImportPacket} from '../lib/server/management';
import {catalog,product,activeState} from '../lib/server/catalog';
import {editorPayload,canEditCatalogIdentity} from '../lib/public/catalog-editor';
import {todayInThailand} from '../lib/public/pricing';
import {canManageIdentity} from '../lib/server/access-policy';
import {saveEditorDraft,previewEditorDraft,publishEditorDraft,restoreEditorRelease,editorState} from '../lib/server/catalog-editor';
import {saveEditorImage,editorImageResponse,MAX_EDITOR_IMAGE_BYTES,limitedImageBody} from '../lib/server/catalog-editor-media';
import {tourCover} from '../lib/public/tour-cover';
import {exportBackup,validatedBackupTables} from '../lib/server/backup';
const actor='local-test-editor';
async function fixture(){const db=testDatabase();const packet=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;const staged=await stageImport(db,packet,'test-import');await publishRelease(db,staged.id,0,'test-import');const state=await activeState(db),tour=(await product(db,'racha-coral'))!.tour;return {db,state,tour};}
function saveInput(f:Awaited<ReturnType<typeof fixture>>){return {revision:0,productId:f.tour.id,baseReleaseId:f.state.release_id,baseGeneration:f.state.generation,payload:editorPayload(f.tour)};}

test('Content editor can publish content but is not an administrator and receives no access by default',()=>{
 assert(canEditCatalogIdentity('Editor@Example.com','verified-id','','editor@example.com'));
 assert(canEditCatalogIdentity('owner@example.com','verified-id','owner@example.com',''));
 assert(!canManageIdentity('editor@example.com','verified-id','owner@example.com'));
 assert(!canEditCatalogIdentity('editor@example.com',null,'','editor@example.com'));
 assert(!canEditCatalogIdentity('editor@example.com','verified-id','',''));
});

test('Draft, preview, self-publication and restore preserve old releases, other tours, terms and inquiry snapshots',async t=>{
 const f=await fixture();t.after(()=>f.db.sqlite.close());const {db,tour,state}=f,body=saveInput(f),before=JSON.stringify(tour);
 body.payload.title='Редактор: новое название';body.payload.description='Новое общее описание.';body.payload.variants[0].description='Новый основной текст варианта.';
 const rate=body.payload.variants[0].rates[0];assert.notEqual(rate.amountMinor,null);rate.amountMinor=rate.amountMinor!+12345;
 db.sqlite.prepare("INSERT INTO operations_inquiries (id,owner_hash,idempotency_key,request_hash,status,created_at,snapshot_json,contact_json) VALUES ('test','owner','key','hash','received','2026-01-01','{\"oldPrice\":200000}','{}')").run();
 const untouched=await product(db,'bangkok'),draft=await saveEditorDraft(db,body,actor);
 assert.equal(JSON.stringify((await product(db,tour.slug))!.tour),before);
 const preview=await previewEditorDraft(db,draft.id);assert.equal(preview.tour.title,body.payload.title);assert.equal(preview.tour.variants[0].rates[0].amountMinor,rate.amountMinor);
 const published=await publishEditorDraft(db,draft.id,draft.revision,actor),current=(await product(db,tour.slug))!.tour;
 assert.equal(current.title,body.payload.title);assert.equal(current.variants[0].description,body.payload.variants[0].description);assert.equal(current.variants[0].rates[0].amountMinor,rate.amountMinor);
 assert.deepEqual(current.variants[0].stops,tour.variants[0].stops);assert.deepEqual(current.variants[0].priceOptions,tour.variants[0].priceOptions);assert.deepEqual(current.variants[0].includes,tour.variants[0].includes);
 assert.equal(JSON.stringify((await product(db,tour.slug,state.release_id))!.tour),before);
 assert.equal((await catalog(db,{limit:48})).total,43);assert.deepEqual((await product(db,'bangkok'))!.tour.variants.map(v=>v.rates),untouched!.tour.variants.map(v=>v.rates));
 assert.equal((db.sqlite.prepare("SELECT snapshot_json FROM operations_inquiries WHERE id='test'").get() as any).snapshot_json,'{"oldPrice":200000}');
 assert.deepEqual(await publishEditorDraft(db,draft.id,draft.revision,actor),published);
 await restoreEditorRelease(db,state.release_id,published.generation,actor);assert.equal(JSON.stringify((await product(db,tour.slug))!.tour),before);
 const editor=await editorState(db);assert(!('inquiries' in editor));assert(!('orders' in editor));assert(!('suppliers' in editor));
});

test('Stale revisions, concurrent catalog changes, unknown rate identities and invalid prices fail closed',async t=>{
 const f=await fixture();t.after(()=>f.db.sqlite.close());const body=saveInput(f);body.payload.title+=' draft';const draft=await saveEditorDraft(f.db,body,actor);
 await assert.rejects(saveEditorDraft(f.db,{...body,id:draft.id,revision:0},actor),/DRAFT_CONFLICT/);
 const spoof=structuredClone(body);spoof.payload.variants[0].rates[0].id='someone-else';await assert.rejects(saveEditorDraft(f.db,spoof,actor),/INVALID_CONTENT_IDENTITY/);
 const invalid=structuredClone(body);invalid.payload.variants[0].rates[0].amountMinor=0;await assert.rejects(saveEditorDraft(f.db,invalid,actor));
 const missing=structuredClone(body);missing.payload.variants[0].rates=[];await assert.rejects(saveEditorDraft(f.db,missing,actor),/INVALID_CONTENT_IDENTITY/);
 await f.db.prepare('UPDATE catalog_state SET generation=generation+1 WHERE id=1').run();await assert.rejects(publishEditorDraft(f.db,draft.id,1,actor),/CONFLICT_REFRESH_REQUIRED/);await assert.rejects(saveEditorDraft(f.db,body,actor),/CONFLICT_REFRESH_REQUIRED/);
});

test('Raster upload is private before publication, becomes the actual cover, and remains in backups',async t=>{
 const f=await fixture();t.after(()=>f.db.sqlite.close());const bytes=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
 await assert.rejects(saveEditorImage(f.db,new TextEncoder().encode('<svg onload="alert(1)"/>'),'image/svg+xml',actor),/INVALID_IMAGE/);
 await assert.rejects(saveEditorImage(f.db,new Uint8Array(MAX_EDITOR_IMAGE_BYTES+1),'image/png',actor),/IMAGE_TOO_LARGE/);
 await assert.rejects(saveEditorImage(f.db,bytes,'image/jpeg',actor),/INVALID_IMAGE/);
 const image=await saveEditorImage(f.db,bytes,'image/png',actor);assert.equal((await editorImageResponse(f.db,image.id,false)).status,404);assert.equal((await editorImageResponse(f.db,image.id,true)).status,200);
 const body=saveInput(f);body.payload.image=image.path;body.payload.imageAlt='Проверочное фото';const draft=await saveEditorDraft(f.db,body,actor);
 await publishEditorDraft(f.db,draft.id,draft.revision,actor);const publicImage=await editorImageResponse(f.db,image.id,false);assert.equal(publicImage.status,200);assert.equal(publicImage.headers.get('X-Content-Type-Options'),'nosniff');assert.deepEqual(new Uint8Array(await publicImage.arrayBuffer()),bytes);
 const current=(await product(f.db,f.tour.slug))!.tour;assert.equal(tourCover(current).src,image.path);assert.equal(tourCover(current).kind,'photo');
 const backup=await exportBackup(f.db);assert.equal(backup.tables.find(x=>x.name==='catalog_media_uploads')!.rows.length,1);assert.doesNotThrow(()=>validatedBackupTables(backup));
 const legacy={...backup,tables:backup.tables.filter(t=>!['catalog_editor_drafts','catalog_media_uploads'].includes(t.name))};const restored=validatedBackupTables(legacy);assert(restored.some((x:any)=>x.name==='catalog_editor_drafts'&&!x.rows.length));
 const request=new Request('http://localhost/image',{method:'POST',body:new Uint8Array(MAX_EDITOR_IMAGE_BYTES+1)});await assert.rejects(limitedImageBody(request),/IMAGE_TOO_LARGE/);
});

test('Copying a catalog release does not re-expose the previously disputed overnight child tariff',async t=>{
 const f=await fixture();t.after(()=>f.db.sqlite.close());const id='rel_a4052de1479ca1bfe3febe64_v_bf7e501e6e205ac58a4c945e_1';
 f.db.sqlite.prepare("INSERT INTO catalog_public_rates (id,release_id,variant_id,option_key,amount_minor,currency,unit,audience,valid_from,valid_until,conditions,supplements_json) VALUES (?,?,'v_bf7e501e6e205ac58a4c945e',NULL,360000,'THB','за ребёнка','child','2026-01-01',NULL,'','[]')").run(id,f.state.release_id);
 const before=(await product(f.db,'phi-phi-overnight'))!.tour;assert(!before.variants.some(v=>v.rates.some(r=>r.audience==='child'&&r.amountMinor===360000)));
 const body=saveInput(f);body.payload.title+=' change';const draft=await saveEditorDraft(f.db,body,actor);await publishEditorDraft(f.db,draft.id,draft.revision,actor);
 const after=(await product(f.db,'phi-phi-overnight'))!.tour;assert(!after.variants.some(v=>v.rates.some(r=>r.audience==='child'&&r.amountMinor===360000)));
});


test('Selling prices can be added, edited and cleared in release-local drafts without rewriting history',async t=>{
 const f=await fixture();t.after(()=>f.db.sqlite.close());const body=saveInput(f),v=f.tour.variants[0],beforeRows=f.db.sqlite.prepare('SELECT * FROM catalog_public_rates WHERE release_id=? ORDER BY id').all(f.state.release_id);
 for(const r of body.payload.variants[0].rates)r.amountMinor=null;
 const cleared=await saveEditorDraft(f.db,body,actor);assert.equal((await previewEditorDraft(f.db,cleared.id)).tour.variants[0].rates.length,0);
 await publishEditorDraft(f.db,cleared.id,cleared.revision,actor);assert.equal((await product(f.db,f.tour.slug))!.tour.variants[0].rates.length,0);
 assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM catalog_public_rates WHERE release_id=? ORDER BY id').all(f.state.release_id),beforeRows);
 const current=(await product(f.db,f.tour.slug))!.tour,st=await activeState(f.db),payload=editorPayload(current);
 payload.variants[0].newRates=[{audience:'adult',amountMinor:123456,currency:'THB',unit:'per adult',conditions:'Test price only',...(v.priceOptions?.length?{optionKey:v.priceOptions[0].key}:{})}];
 const added=await saveEditorDraft(f.db,{revision:0,productId:current.id,baseReleaseId:st.release_id,baseGeneration:st.generation,payload},actor);
 const savedRate=added.payload.variants[0].newRates![0];assert.equal(savedRate.validFrom,todayInThailand(new Date(added.updatedAt)));assert.equal(savedRate.validUntil,null);
 assert.equal((await previewEditorDraft(f.db,added.id)).tour.variants[0].rates[0].amountMinor,123456);
 await publishEditorDraft(f.db,added.id,added.revision,actor);
 const now=(await product(f.db,f.tour.slug))!.tour;assert.equal(now.variants[0].rates[0].amountMinor,123456);assert.equal(now.variants[0].revisionId,v.revisionId);assert.equal(now.variants[0].visible,v.visible);
 assert.equal(now.variants[0].rates[0].validFrom,savedRate.validFrom);assert.equal(now.variants[0].rates[0].validUntil,null);
 const childPayload=editorPayload(now),childState=await activeState(f.db);childPayload.variants[0].newRates=[{...payload.variants[0].newRates![0],audience:'child',unit:'child, age confirmed',amountMinor:11111}];const childDraft=await saveEditorDraft(f.db,{revision:0,productId:now.id,baseReleaseId:childState.release_id,baseGeneration:childState.generation,payload:childPayload},actor);await publishEditorDraft(f.db,childDraft.id,childDraft.revision,actor);assert.equal((await product(f.db,f.tour.slug))!.tour.variants[0].rates.length,2);
 assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM catalog_public_rates WHERE release_id=? ORDER BY id').all(f.state.release_id),beforeRows);
});

test('New selling rates reject duplicate audiences, unknown options and zero; existing identities stay guarded',async t=>{
 const f=await fixture();t.after(()=>f.db.sqlite.close());const body=saveInput(f),v=f.tour.variants[0],r=v.rates[0];
 const newRate={audience:r.audience as 'adult'|'child',amountMinor:11100,currency:'THB' as const,unit:'person',validFrom:'2026-01-01',validUntil:null,conditions:'',...(r.optionKey?{optionKey:r.optionKey}:{})};
 body.payload.variants[0].newRates=[newRate];await assert.rejects(saveEditorDraft(f.db,body,actor),/DUPLICATE_PRICE/);
 body.payload.variants[0].newRates=[{...newRate,optionKey:'unapproved-option'}];await assert.rejects(saveEditorDraft(f.db,body,actor),/INVALID_PRICE_OPTION/);
 body.payload.variants[0].newRates=[{...newRate,amountMinor:0}];await assert.rejects(saveEditorDraft(f.db,body,actor));
});
