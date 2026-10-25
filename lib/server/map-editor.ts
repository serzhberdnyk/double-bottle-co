import {defaultMapDocument,legacyMapLayout,mergeMapDocument,mergeLegacyMapLayout,parseMapDocument,type MapDocument,type MapLayout,type MapTourChoice} from '../public/map-layout';
import {uuid} from './management';
import {variantPublication} from './variant-visibility';
import {currentLocale} from '../i18n/server';
import {catalog} from './catalog';

type Row={revision:number;published_revision:number;draft_json:string|null;published_json:string|null};
async function row(db:D1Database){return db.prepare('SELECT revision,published_revision,draft_json,published_json FROM map_editor_state WHERE id=1').first<Row>();}
function storedDocument(json:string|null|undefined):MapDocument{return json?parseMapDocument(JSON.parse(json)):structuredClone(defaultMapDocument);}
export async function mapTourChoices(db:D1Database){
 const state=await db.prepare('SELECT release_id,generation FROM catalog_state WHERE id=1').first<{release_id:string;generation:number}>();
 if(!state?.release_id)return {catalogGeneration:null,tours:[] as MapTourChoice[]};
 const result=await db.prepare(`SELECT p.product_id AS id,COALESCE(NULLIF(p.slug,''),identity.slug) AS slug,p.title FROM catalog_release_products p JOIN catalog_products identity ON identity.id=p.product_id WHERE p.release_id=? AND p.publication_status='published' AND EXISTS (SELECT 1 FROM catalog_release_variants rv JOIN catalog_variants v ON v.id=rv.variant_id WHERE rv.release_id=p.release_id AND COALESCE(rv.product_id,v.product_id)=p.product_id AND ${variantPublication('rv')}) ORDER BY p.title,p.product_id`).bind(state.release_id).all<MapTourChoice>();
 return {catalogGeneration:state.generation,tours:result.results};
}
export async function publishedMapDocument(db:D1Database):Promise<MapDocument>{
 const document=storedDocument((await row(db))?.published_json);
 if(!document.routes.some(route=>route.tourId))return document;
 const choices=await mapTourChoices(db);let tours=choices.tours;
 if(tours.length&&await currentLocale()!=='ru'){
  // Reuse the catalog's complete locale-readiness rules, not just a translated
  // title. Never offer an EN/TH link whose excursion page is unavailable.
  const ids=[...new Set(document.routes.map(route=>route.tourId).filter((id):id is string=>!!id))];
  const first=await catalog(db,{ids,limit:48});const ready=[...first.items];
  for(let page=2;page<=first.pages;page++)ready.push(...(await catalog(db,{ids,limit:48,page})).items);
  tours=ready.map(({id,slug,title})=>({id,slug,title}));
 }
 const byId=new Map(tours.map(tour=>[tour.id,tour]));
 // Do not leak a hidden/deleted excursion through a previously published map.
 return {...document,routes:document.routes.filter(route=>!route.tourId||byId.has(route.tourId)).map(route=>route.tourId?{...route,tour:byId.get(route.tourId)}:route)};
}
/** Existing public consumers may continue reading placements only. */
export async function publishedMapLayout(db:D1Database):Promise<MapLayout>{return (await publishedMapDocument(db)).placements;}
export async function mapEditorState(db:D1Database){
 const current=await row(db),publishedDocument=storedDocument(current?.published_json),draftDocument=current?.draft_json?storedDocument(current.draft_json):null;
 return {...await mapTourChoices(db),schemaVersion:2 as const,revision:current?.revision||0,publishedRevision:current?.published_revision||0,published:legacyMapLayout(publishedDocument),draft:draftDocument?legacyMapLayout(draftDocument):null,publishedDocument,draftDocument};
}
async function validateUploadedMedia(db:D1Database,document:MapDocument){
 const paths=new Set(document.placements.flatMap(item=>[item.image,...item.photos||[]]).filter(path=>path.startsWith('/api/catalog-media/')));
 for(const path of paths){if(!await db.prepare('SELECT id FROM catalog_media_uploads WHERE id=?').bind(path.split('/').at(-1)).first())throw Error('MAP_IMAGE_MISSING');}
}
function validateRouteTours(document:MapDocument,tours:MapTourChoice[]){
 const ids=new Set(tours.map(tour=>tour.id));
 if(document.routes.some(route=>route.tourId&&!ids.has(route.tourId)))throw Error('MAP_TOUR_UNAVAILABLE');
}
export async function saveMapDraft(db:D1Database,input:unknown,revision:number,actor:string){
 const current=await mapEditorState(db);if(current.revision!==revision)throw Error('MAP_CONFLICT');
 const document=Array.isArray(input)?mergeLegacyMapLayout(input,current.draftDocument||current.publishedDocument):mergeMapDocument(input,current.draftDocument||current.publishedDocument);
 await validateUploadedMedia(db,document);validateRouteTours(document,current.tours);
 const stamp=new Date().toISOString(),serialized=JSON.stringify(document);
 const results=await db.batch([
  db.prepare('INSERT INTO map_editor_state (id,revision,published_revision,draft_json,published_json,updated_at,updated_by) VALUES (1,1,0,?,NULL,?,?) ON CONFLICT(id) DO UPDATE SET revision=map_editor_state.revision+1,draft_json=excluded.draft_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE map_editor_state.revision=?').bind(serialized,stamp,actor,revision),
  db.prepare("INSERT INTO internal_events (id,type,actor,created_at,data_json) SELECT ?,'map_draft_saved',?,?,? WHERE changes()>0").bind(uuid(),actor,stamp,JSON.stringify({version:2,placements:document.placements.length,routes:document.routes.length})),
 ]);
 if(!results[0].meta.changes)throw Error('MAP_CONFLICT');return mapEditorState(db);
}
export async function publishMapDraft(db:D1Database,revision:number,actor:string){
 const current=await mapEditorState(db);if(current.revision!==revision||!current.draftDocument)throw Error('MAP_CONFLICT');
 await validateUploadedMedia(db,current.draftDocument);validateRouteTours(current.draftDocument,current.tours);
 const stamp=new Date().toISOString();
 const results=await db.batch([
  db.prepare('UPDATE map_editor_state SET published_json=draft_json,draft_json=NULL,published_revision=published_revision+1,revision=revision+1,updated_at=?,updated_by=? WHERE id=1 AND revision=? AND draft_json IS NOT NULL').bind(stamp,actor,revision),
  db.prepare("INSERT INTO internal_events (id,type,actor,created_at,data_json) SELECT ?,'map_published',?,?,? WHERE changes()>0").bind(uuid(),actor,stamp,JSON.stringify({version:2,items:current.draftDocument.placements,routes:current.draftDocument.routes})),
 ]);if(!results[0].meta.changes)throw Error('MAP_CONFLICT');return mapEditorState(db);
}

/** Validate and publish the exact editor payload in one guarded transaction.
 * Existing draft/history APIs remain available for older clients; the new UI
 * does not require a separate draft action and never publishes stale contents. */
export async function saveAndPublishMap(db:D1Database,input:unknown,revision:number,catalogGeneration:number|null,actor:string){
 const current=await mapEditorState(db);
 if(current.revision!==revision)throw Error('MAP_CONFLICT');
 if(current.catalogGeneration!==catalogGeneration)throw Error('MAP_CATALOG_CONFLICT');
 const document=mergeMapDocument(input,current.draftDocument||current.publishedDocument,{preserveRouteMetadata:false});
 await validateUploadedMedia(db,document);validateRouteTours(document,current.tours);
 const stamp=new Date().toISOString(),serialized=JSON.stringify(document);
 // The catalog check lives inside the same write as the map revision check.
 // Concurrent hiding/removal or publication cannot slip between validation and
 // committing the association. D1 batch rolls state + both audit events back.
 const catalogGuard='COALESCE((SELECT generation FROM catalog_state WHERE id=1 AND release_id IS NOT NULL),-1)=?';
 const generation=catalogGeneration??-1;
 const results=await db.batch([
  db.prepare(`INSERT INTO map_editor_state (id,revision,published_revision,draft_json,published_json,updated_at,updated_by) SELECT 1,1,1,NULL,?,?,? WHERE ${catalogGuard} AND (?=0 OR EXISTS (SELECT 1 FROM map_editor_state WHERE id=1)) ON CONFLICT(id) DO UPDATE SET revision=map_editor_state.revision+1,published_revision=map_editor_state.published_revision+1,draft_json=NULL,published_json=excluded.published_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE map_editor_state.revision=? AND ${catalogGuard}`).bind(serialized,stamp,actor,generation,revision,revision,generation),
  db.prepare("INSERT INTO internal_events (id,type,actor,created_at,data_json) SELECT ?,'map_draft_saved',?,?,? WHERE changes()>0").bind(uuid(),actor,stamp,JSON.stringify({version:2,placements:document.placements.length,routes:document.routes.length,combined:true})),
  db.prepare("INSERT INTO internal_events (id,type,actor,created_at,data_json) SELECT ?,'map_published',?,?,? WHERE changes()>0").bind(uuid(),actor,stamp,JSON.stringify({version:2,items:document.placements,routes:document.routes,combined:true})),
 ]);
 if(!results[0].meta.changes)throw Error('MAP_CONFLICT');
 return mapEditorState(db);
}
