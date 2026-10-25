import {releaseOwnershipValidSql} from './release-variant-ownership';
import {z} from 'zod';
import {activeState} from './catalog';
import {hash,uuid} from './management';
import {cloneReleaseRows} from './catalog-release-copy';
import {creationPayloadSchema,type CreationPayload,type CreationDraft} from '../public/catalog-creation';
import type {Tour} from '../public/types';
type Row={id:string;product_id:string;slug:string;base_release_id:string;base_generation:number;revision:number;status:CreationDraft['status'];payload_json:string;updated_at:string;updated_by:string;published_release_id:string|null;published_generation:number|null};
const dto=(r:Row):CreationDraft=>({id:r.id,requestId:r.id.slice(4),productId:r.product_id,slug:r.slug,baseReleaseId:r.base_release_id,baseGeneration:r.base_generation,revision:r.revision,status:r.status,payload:JSON.parse(r.payload_json),updatedAt:r.updated_at,publishedReleaseId:r.published_release_id,publishedGeneration:r.published_generation});
const draftId=z.string().regex(/^new_[a-f0-9-]{36}$/);
async function row(db:D1Database,id:string){draftId.parse(id);const r=await db.prepare('SELECT * FROM catalog_creation_drafts WHERE id=?').bind(id).first<Row>();if(!r)throw Error('CREATION_DRAFT_NOT_FOUND');return r;}
export async function creationState(db:D1Database){const state=await activeState(db);const drafts=await db.prepare('SELECT * FROM catalog_creation_drafts ORDER BY updated_at DESC LIMIT 100').all<Row>();const destinations=await db.prepare('SELECT destination_id AS id,name FROM catalog_release_destinations WHERE release_id=? ORDER BY name').bind(state.release_id).all<{id:string;name:string}>();return {state,drafts:drafts.results.map(dto),destinations:destinations.results};}
const saveSchema=z.object({requestId:z.string().uuid().transform(s=>s.toLowerCase()),id:draftId.optional(),revision:z.number().int().nonnegative(),baseReleaseId:z.string().min(1).max(100),baseGeneration:z.number().int().nonnegative(),payload:creationPayloadSchema}).strict();
async function validateReferences(db:D1Database,p:CreationPayload,release:string){
 if(p.image&&!await db.prepare('SELECT id FROM catalog_media WHERE path=?').bind(p.image).first())throw Error('IMAGE_NOT_APPROVED');
 for(const stop of p.variant.stops)if(!await db.prepare('SELECT destination_id FROM catalog_release_destinations WHERE release_id=? AND destination_id=?').bind(release,stop.destinationId).first())throw Error('DESTINATION_NOT_APPROVED');
}
async function validateSlug(db:D1Database,slug:string,id:string){
 if(await db.prepare('SELECT id FROM catalog_products WHERE slug=? UNION ALL SELECT product_id AS id FROM catalog_release_products WHERE slug=? UNION ALL SELECT product_id AS id FROM catalog_redirects WHERE from_slug=? LIMIT 1').bind(slug,slug,slug).first()||await db.prepare('SELECT id FROM catalog_creation_drafts WHERE slug=? AND id<>?').bind(slug,id).first())throw Error('SLUG_IN_USE');
}
export async function saveCreationDraft(db:D1Database,input:unknown,actor:string){
 const b=saveSchema.parse(input),state=await activeState(db),id='new_'+b.requestId;
 if(b.id&&b.id!==id)throw Error('DRAFT_CONFLICT');if(state.release_id!==b.baseReleaseId||state.generation!==b.baseGeneration)throw Error('CONFLICT_REFRESH_REQUIRED');
 const existing=await db.prepare('SELECT * FROM catalog_creation_drafts WHERE id=?').bind(id).first<Row>();
 if(!b.id&&existing){if(b.revision===0&&existing.revision===1&&existing.status==='editing'&&existing.updated_by===actor&&existing.base_release_id===b.baseReleaseId&&existing.base_generation===b.baseGeneration&&existing.payload_json===JSON.stringify(b.payload))return dto(existing);throw Error('DRAFT_CONFLICT');}
 if(b.id&&(!existing||existing.revision!==b.revision||existing.status==='published'))throw Error('DRAFT_CONFLICT');if(!b.id&&b.revision!==0)throw Error('DRAFT_CONFLICT');
 await validateReferences(db,b.payload,state.release_id);
 const productId=existing?.product_id||'p_new_'+(await hash(b.requestId)).slice(0,24);
 if(await db.prepare('SELECT id FROM catalog_products WHERE id=?').bind(productId).first())throw Error('PRODUCT_ID_IN_USE');
 const slug=b.payload.slug||existing?.slug||'tour-'+b.requestId.replaceAll('-','').slice(0,20);await validateSlug(db,slug,id);
 const stamp=new Date().toISOString();
 if(existing){const result=await db.prepare("UPDATE catalog_creation_drafts SET slug=?,base_release_id=?,base_generation=?,payload_json=?,revision=revision+1,status='editing',updated_at=?,updated_by=? WHERE id=? AND revision=? AND status IN ('editing','cancelled')").bind(slug,b.baseReleaseId,b.baseGeneration,JSON.stringify(b.payload),stamp,actor,id,b.revision).run();if(result.meta.changes!==1)throw Error('DRAFT_CONFLICT');}
 else await db.prepare("INSERT INTO catalog_creation_drafts (id,product_id,slug,base_release_id,base_generation,revision,status,payload_json,updated_at,updated_by) VALUES (?,?,?,?,?,1,'editing',?,?,?)").bind(id,productId,slug,b.baseReleaseId,b.baseGeneration,JSON.stringify(b.payload),stamp,actor).run();
 return dto(await row(db,id));
}
async function draftTour(db:D1Database,d:CreationDraft):Promise<Tour>{
 const p=creationPayloadSchema.parse(d.payload),v=p.variant,revisionId='rev_new_'+(await hash({productId:d.productId,variant:v})).slice(0,24),variantId=d.productId+'_v1';
 const stops=[];for(const [i,s] of v.stops.entries()){const place=await db.prepare('SELECT name,lat_micro,lng_micro FROM catalog_release_destinations WHERE release_id=? AND destination_id=?').bind(d.baseReleaseId,s.destinationId).first<{name:string;lat_micro:number;lng_micro:number}>();if(!place)throw Error('DESTINATION_NOT_APPROVED');stops.push({...s,sequence:i+1,name:place.name,lat:place.lat_micro/1e6,lng:place.lng_micro/1e6});}
 return {id:d.productId,slug:d.slug,title:p.title,description:p.description,category:p.category,image:p.image,imageAlt:p.imageAlt,status:'on_request',featuredRank:999,variants:[{id:variantId,revisionId,name:v.name,description:v.description,duration:v.duration,days:v.days,transport:v.transport,format:v.format,status:'on_request',stops,itinerary:v.itinerary,includes:v.includes,extras:v.extras,conditions:v.conditions,earliestDate:null,rates:v.price.mode==='on_request'?[]:[{id:d.productId+'_rate1',amountMinor:v.price.amountMinor,currency:v.price.currency,unit:v.price.unit,audience:v.price.audience,validFrom:v.price.validFrom,validUntil:v.price.validUntil,conditions:'',supplements:[]}]}]};
}
export async function previewCreationDraft(db:D1Database,id:string){const draft=dto(await row(db,id));return {draft,tour:await draftTour(db,draft)};}
export async function cancelCreationDraft(db:D1Database,id:string,revision:number,actor:string){const current=await row(db,id);if(current.status==='cancelled'&&current.revision===revision+1)return dto(current);const r=await db.prepare("UPDATE catalog_creation_drafts SET status='cancelled',revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND status='editing'").bind(new Date().toISOString(),actor,id,revision).run();if(r.meta.changes!==1)throw Error('DRAFT_CONFLICT');return dto(await row(db,id));}
export async function publishCreationDraft(db:D1Database,id:string,revision:number,actor:string){
 const d=dto(await row(db,id));if(d.revision!==revision)throw Error('DRAFT_CONFLICT');
 const result=()=>({releaseId:d.publishedReleaseId!,generation:d.publishedGeneration!,productId:d.productId});if(d.status==='published')return result();if(d.status!=='editing')throw Error('DRAFT_NOT_EDITABLE');
 const state=await activeState(db);if(state.release_id!==d.baseReleaseId||state.generation!==d.baseGeneration)throw Error('CONFLICT_REFRESH_REQUIRED');
 const p=creationPayloadSchema.parse(d.payload);await validateReferences(db,p,d.baseReleaseId);await validateSlug(db,d.slug,id);
 if(await db.prepare('SELECT id FROM catalog_products WHERE id=?').bind(d.productId).first())throw Error('PRODUCT_ID_IN_USE');
 const tour=await draftTour(db,d),v=tour.variants[0],release='rel_create_'+(await hash(id+':'+revision)).slice(0,24),stamp=new Date().toISOString(),generation=state.generation+1;
 const counts=await db.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN publication_status='published' THEN 1 ELSE 0 END) AS published,SUM(CASE WHEN publication_status='draft' THEN 1 ELSE 0 END) AS drafts FROM catalog_release_products WHERE release_id=?").bind(state.release_id).first<{total:number;published:number;drafts:number}>();
 const summary={products:(counts?.total||0)+1,published:(counts?.published||0)+1,drafts:counts?.drafts||0,counts:{added:1,changed:0,hidden:0,price:Number(v.rates.length>0),itinerary:0,includes:0},changes:[{id:tour.id,title:tour.title,kind:'added',publication:'published',fields:Object.keys(p)}]};
 // D1 batch is transactional. The NOT NULL hash is a SQL assertion at the first
 // write: stale generation/revision aborts the WHOLE batch, including new IDs.
 const statements=[db.prepare("INSERT INTO catalog_releases (id,hash,status,base_id,created_at,created_by,summary_json) SELECT ?,CASE WHEN EXISTS (SELECT 1 FROM catalog_state WHERE id=1 AND release_id=? AND generation=?) AND EXISTS (SELECT 1 FROM catalog_creation_drafts WHERE id=? AND revision=? AND status='editing') THEN ? ELSE NULL END,'published',?,?,?,?").bind(release,state.release_id,state.generation,id,revision,await hash({id,revision,payload:p}),state.release_id,stamp,actor,JSON.stringify(summary))];
 for(const table of ['catalog_release_products','catalog_release_variants','catalog_release_destinations','catalog_public_rates'] as const)statements.push(await cloneReleaseRows(db,table,state.release_id,release));
 statements.push(db.prepare('INSERT INTO catalog_products (id,slug) VALUES (?,?)').bind(tour.id,tour.slug));
 statements.push(db.prepare('INSERT INTO catalog_release_products (release_id,product_id,slug,title,description,category,image,image_alt,sale_status,publication_status,featured_rank) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(release,tour.id,tour.slug,tour.title,tour.description,tour.category,tour.image,tour.imageAlt,tour.status,'published',tour.featuredRank));
 statements.push(db.prepare('INSERT INTO catalog_variants (id,product_id) VALUES (?,?)').bind(v.id,tour.id));
 const terms={description:v.description,itinerary:v.itinerary,includes:v.includes,extras:v.extras,conditions:v.conditions,earliestDate:null};
 statements.push(db.prepare('INSERT INTO catalog_variant_revisions (id,variant_id,hash,name,duration,days,transport,format,terms_json) VALUES (?,?,?,?,?,?,?,?,?)').bind(v.revisionId,v.id,await hash({variantId:v.id,terms,stops:v.stops}),v.name,v.duration,v.days,v.transport,v.format,JSON.stringify(terms)));
 statements.push(db.prepare('INSERT INTO catalog_release_variants (release_id,variant_id,revision_id,sale_status,product_id) VALUES (?,?,?,?,?)').bind(release,v.id,v.revisionId,v.status,tour.id));
 for(const s of v.stops)statements.push(db.prepare('INSERT INTO catalog_itinerary_stops (revision_id,destination_id,sequence,visit_type,required,note) VALUES (?,?,?,?,?,?)').bind(v.revisionId,s.destinationId,s.sequence,s.visitType,Number(s.required),s.note));
 for(const rate of v.rates)statements.push(db.prepare('INSERT INTO catalog_public_rates (id,release_id,variant_id,amount_minor,currency,unit,audience,valid_from,valid_until,conditions,supplements_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(release+'__'+rate.id,release,v.id,rate.amountMinor,rate.currency,rate.unit,rate.audience,rate.validFrom,rate.validUntil,rate.conditions,JSON.stringify(rate.supplements)));
 statements.push(db.prepare('UPDATE catalog_state SET release_id=?,generation=generation+1 WHERE id=1 AND release_id=? AND generation=?').bind(release,state.release_id,state.generation));
 statements.push(db.prepare("UPDATE catalog_creation_drafts SET status='published',published_release_id=?,published_generation=?,updated_at=?,updated_by=? WHERE id=? AND revision=? AND status='editing'").bind(release,generation,stamp,actor,id,revision));
 statements.push(db.prepare(`INSERT INTO internal_events (id,type,actor,created_at,data_json) VALUES (?,?,?,?,CASE WHEN ${releaseOwnershipValidSql()} THEN ? ELSE NULL END)`).bind(uuid(),'publish',actor,stamp,release,JSON.stringify({releaseId:release,from:state.release_id,creationDraft:id})));
 try{await db.batch(statements);}catch(error){const latest=dto(await row(db,id));if(latest.status==='published'&&latest.revision===revision)return {releaseId:latest.publishedReleaseId!,generation:latest.publishedGeneration!,productId:latest.productId};const now=await activeState(db);if(now.generation!==state.generation||latest.revision!==revision||latest.status!=='editing')throw Error('CONFLICT_REFRESH_REQUIRED');throw error;}
 return {releaseId:release,generation,productId:tour.id};
}
