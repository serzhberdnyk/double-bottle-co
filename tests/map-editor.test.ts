import test from 'node:test';
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {testDatabase} from './d1-adapter';
import {defaultMapLayout,mapLayoutSchema,legacyMapLayout} from '../lib/public/map-layout';
import {mapEditorState,publishedMapLayout,saveMapDraft,publishMapDraft} from '../lib/server/map-editor';
import {saveEditorImage,editorImageResponse} from '../lib/server/catalog-editor-media';
import {exportBackup,validatedBackupTables} from '../lib/server/backup';

test('Map draft stays private until explicit publication; stale saves and duplicate publication fail closed',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const before=await mapEditorState(db),layout=structuredClone(defaultMapLayout);layout[0].x=34;
 assert.equal(before.revision,0);assert.equal(before.draft,null);
 const saved=await saveMapDraft(db,layout,0,'synthetic-owner');assert.equal(saved.revision,1);assert.deepEqual(legacyMapLayout({version:2,placements:await publishedMapLayout(db),routes:[]}),defaultMapLayout);
 await assert.rejects(saveMapDraft(db,layout,0,'other-owner'),/MAP_CONFLICT/);
 const published=await publishMapDraft(db,1,'synthetic-owner');assert.equal(published.publishedRevision,1);assert.equal(published.draft,null);assert.deepEqual(legacyMapLayout({version:2,placements:await publishedMapLayout(db),routes:[]}),layout);
 await assert.rejects(publishMapDraft(db,1,'synthetic-owner'),/MAP_CONFLICT/);assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM internal_events WHERE type='map_published'").get()!.n,1);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM catalog_state').get()!.n,0);
});
test('Map layout rejects duplicate and unknown objects, out-of-map points and unapproved image paths',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const invalid=structuredClone(defaultMapLayout);invalid[0].x=101;assert(!mapLayoutSchema.safeParse(invalid).success);
 const duplicate=structuredClone(defaultMapLayout);duplicate[1]=duplicate[0];assert(!mapLayoutSchema.safeParse(duplicate).success);
 const foreign=structuredClone(defaultMapLayout);foreign[0].image='https://example.invalid/image.svg';assert(!mapLayoutSchema.safeParse(foreign).success);
 const missing=structuredClone(defaultMapLayout);missing[0].image='/api/catalog-media/'+'a'.repeat(64);await assert.rejects(saveMapDraft(db,missing,0,'synthetic-owner'),/MAP_IMAGE_MISSING/);
 assert.equal((await mapEditorState(db)).revision,0);
});
test('Existing upload remains private in a map draft, becomes public on publication and is preserved in backups',async t=>{
 const db=testDatabase();t.after(()=>db.sqlite.close());const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 const image=await saveEditorImage(db,png,'image/png','synthetic-owner'),layout=structuredClone(defaultMapLayout);layout[0].image=image.path;
 assert.equal((await editorImageResponse(db,image.id,false)).status,404);await saveMapDraft(db,layout,0,'synthetic-owner');assert.equal((await editorImageResponse(db,image.id,false)).status,404);
 await publishMapDraft(db,1,'synthetic-owner');assert.equal((await editorImageResponse(db,image.id,false)).status,200);
 await saveMapDraft(db,defaultMapLayout,2,'synthetic-owner');await publishMapDraft(db,3,'synthetic-owner');assert.equal((await editorImageResponse(db,image.id,false)).status,200);
 const backup=await exportBackup(db);assert(backup.tables.some(t=>t.name==='map_editor_state'&&t.rows.length===1));
 const legacy={...backup,tables:backup.tables.filter(t=>t.name!=='map_editor_state')};assert(validatedBackupTables(legacy).some((t:{name:string;rows:unknown[]})=>t.name==='map_editor_state'&&t.rows.length===0));
});
