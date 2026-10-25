import {defaultMapDocument,legacyMapLayout,mergeMapDocument,mergeLegacyMapLayout,parseMapDocument,type MapDocument,type MapLayout} from '../public/map-layout';
import {uuid} from './management';

type Row={revision:number;published_revision:number;draft_json:string|null;published_json:string|null};
async function row(db:D1Database){return db.prepare('SELECT revision,published_revision,draft_json,published_json FROM map_editor_state WHERE id=1').first<Row>();}
function storedDocument(json:string|null|undefined):MapDocument{return json?parseMapDocument(JSON.parse(json)):structuredClone(defaultMapDocument);}
export async function publishedMapDocument(db:D1Database):Promise<MapDocument>{return storedDocument((await row(db))?.published_json);}
/** Existing public consumers may continue reading placements only. */
export async function publishedMapLayout(db:D1Database):Promise<MapLayout>{return (await publishedMapDocument(db)).placements;}
export async function mapEditorState(db:D1Database){
 const current=await row(db),publishedDocument=storedDocument(current?.published_json),draftDocument=current?.draft_json?storedDocument(current.draft_json):null;
 return {schemaVersion:2 as const,revision:current?.revision||0,publishedRevision:current?.published_revision||0,published:legacyMapLayout(publishedDocument),draft:draftDocument?legacyMapLayout(draftDocument):null,publishedDocument,draftDocument};
}
async function validateUploadedMedia(db:D1Database,document:MapDocument){
 const paths=new Set(document.placements.flatMap(item=>[item.image,...item.photos||[]]).filter(path=>path.startsWith('/api/catalog-media/')));
 for(const path of paths){if(!await db.prepare('SELECT id FROM catalog_media_uploads WHERE id=?').bind(path.split('/').at(-1)).first())throw Error('MAP_IMAGE_MISSING');}
}
export async function saveMapDraft(db:D1Database,input:unknown,revision:number,actor:string){
 const current=await mapEditorState(db);if(current.revision!==revision)throw Error('MAP_CONFLICT');
 const document=Array.isArray(input)?mergeLegacyMapLayout(input,current.draftDocument||current.publishedDocument):mergeMapDocument(input,current.draftDocument||current.publishedDocument);
 await validateUploadedMedia(db,document);
 const stamp=new Date().toISOString(),serialized=JSON.stringify(document);
 const results=await db.batch([
  db.prepare('INSERT INTO map_editor_state (id,revision,published_revision,draft_json,published_json,updated_at,updated_by) VALUES (1,1,0,?,NULL,?,?) ON CONFLICT(id) DO UPDATE SET revision=map_editor_state.revision+1,draft_json=excluded.draft_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE map_editor_state.revision=?').bind(serialized,stamp,actor,revision),
  db.prepare("INSERT INTO internal_events (id,type,actor,created_at,data_json) SELECT ?,'map_draft_saved',?,?,? WHERE changes()>0").bind(uuid(),actor,stamp,JSON.stringify({version:2,placements:document.placements.length,routes:document.routes.length})),
 ]);
 if(!results[0].meta.changes)throw Error('MAP_CONFLICT');return mapEditorState(db);
}
export async function publishMapDraft(db:D1Database,revision:number,actor:string){
 const current=await mapEditorState(db);if(current.revision!==revision||!current.draftDocument)throw Error('MAP_CONFLICT');
 await validateUploadedMedia(db,current.draftDocument);
 const stamp=new Date().toISOString();
 const results=await db.batch([
  db.prepare('UPDATE map_editor_state SET published_json=draft_json,draft_json=NULL,published_revision=published_revision+1,revision=revision+1,updated_at=?,updated_by=? WHERE id=1 AND revision=? AND draft_json IS NOT NULL').bind(stamp,actor,revision),
  db.prepare("INSERT INTO internal_events (id,type,actor,created_at,data_json) SELECT ?,'map_published',?,?,? WHERE changes()>0").bind(uuid(),actor,stamp,JSON.stringify({version:2,items:current.draftDocument.placements,routes:current.draftDocument.routes})),
 ]);if(!results[0].meta.changes)throw Error('MAP_CONFLICT');return mapEditorState(db);
}
