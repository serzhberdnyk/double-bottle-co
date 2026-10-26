import {validateNewSellingRates,resolveNewSellingRate} from '../public/selling-price-editor';
import {todayInThailand} from '../public/pricing';
import {adminServiceCompanyRefs} from './admin-service-companies';
import {companyNames} from '../public/admin-service-sort';
import {cloneReleaseRows} from './catalog-release-copy';
import {z} from 'zod';
import {activeState,catalog,product} from './catalog';
import {hash,publishRelease,uuid} from './management';
import {editorPayload,editorPayloadSchema,editorPreview,type EditorDraft,type EditorPayload} from '../public/catalog-editor';
import type {Tour} from '../public/types';

type DraftRow={id:string;product_id:string;base_release_id:string;base_generation:number;revision:number;status:string;payload_json:string;updated_at:string;published_release_id:string|null};
function draftDto(r:DraftRow):EditorDraft{return {id:r.id,productId:r.product_id,baseReleaseId:r.base_release_id,baseGeneration:r.base_generation,revision:r.revision,status:r.status,payload:JSON.parse(r.payload_json),updatedAt:r.updated_at,publishedReleaseId:r.published_release_id};}
export async function editorDraft(db:D1Database,id:string){const r=await db.prepare('SELECT * FROM catalog_editor_drafts WHERE id=?').bind(id).first<DraftRow>();if(!r)throw Error('DRAFT_NOT_FOUND');return draftDto(r);}
async function editorTour(db:D1Database,productId:string,release:string):Promise<Tour>{
 const p=await db.prepare('SELECT slug FROM catalog_release_products WHERE release_id=? AND product_id=?').bind(release,productId).first<{slug:string}>();
 const data=p&&await product(db,p.slug,release,true);if(!data)throw Error('PRODUCT_NOT_FOUND');return data.tour;
}
export async function editorState(db:D1Database){
 const state=await activeState(db),first=await catalog(db,{limit:48,release:state.release_id},true,true);const tours=[...first.items];
 for(let page=2;page<=first.pages;page++)tours.push(...(await catalog(db,{page,limit:48,release:state.release_id},true,true)).items);
 // Admin-only company IDs and labels; no supplier details, rates, contacts or settings.
 const serviceCompanyRefs=await adminServiceCompanyRefs(db,state.release_id);
 const serviceCompanies=Object.fromEntries(Object.entries(serviceCompanyRefs).map(([id,companies])=>[id,companyNames(companies.map(c=>c.name))]));
 const drafts=await db.prepare('SELECT * FROM catalog_editor_drafts ORDER BY updated_at DESC LIMIT 100').all<DraftRow>();
 const releases=await db.prepare("SELECT id,created_at,summary_json FROM catalog_releases WHERE status='published' ORDER BY created_at DESC LIMIT 30").all<{id:string;created_at:string;summary_json:string}>();
 return {state,tours,serviceCompanies,serviceCompanyRefs,drafts:drafts.results.map(draftDto),releases:releases.results.map(r=>({id:r.id,createdAt:r.created_at,summary:JSON.parse(r.summary_json)}))};
}
const saveSchema=z.object({id:z.string().max(100).optional(),revision:z.number().int().nonnegative(),productId:z.string().min(1).max(100),baseReleaseId:z.string().min(1).max(100),baseGeneration:z.number().int().nonnegative(),payload:editorPayloadSchema}).strict();
function sameIds(a:{id:string}[],b:{id:string}[]){return a.length===b.length&&new Set(b.map(x=>x.id)).size===b.length&&a.every(x=>b.some(y=>y.id===x.id));}
export async function saveEditorDraft(db:D1Database,input:unknown,actor:string){
 const body=saveSchema.parse(input),state=await activeState(db);
 if(state.release_id!==body.baseReleaseId||state.generation!==body.baseGeneration)throw Error('CONFLICT_REFRESH_REQUIRED');
 const tour=await editorTour(db,body.productId,body.baseReleaseId),before=editorPayload(tour);
 if(!sameIds(before.variants,body.payload.variants)||before.variants.some(v=>!sameIds(v.rates,body.payload.variants.find(x=>x.id===v.id)!.rates)))throw Error('INVALID_CONTENT_IDENTITY');
 for(const v of body.payload.variants)validateNewSellingRates(tour.variants.find(x=>x.id===v.id)!,v.newRates);
 if(body.payload.image!==before.image&&body.payload.image!==null){const media=await db.prepare('SELECT id FROM catalog_media WHERE path=?').bind(body.payload.image).first();if(!media)throw Error('IMAGE_NOT_APPROVED');}
 await approvedVariantImages(db,body.payload);
 const id=body.id||'draft_'+uuid(),now=new Date().toISOString();
 // Persist the technical start once at save so preview and later publication agree.
 for(const v of body.payload.variants)if(v.newRates)v.newRates=v.newRates.map(r=>resolveNewSellingRate(r,todayInThailand(new Date(now))));
 if(body.id){const draft=await editorDraft(db,body.id);if(draft.productId!==body.productId||draft.baseReleaseId!==body.baseReleaseId||draft.baseGeneration!==body.baseGeneration)throw Error('INVALID_CONTENT_IDENTITY');
  const r=await db.prepare("UPDATE catalog_editor_drafts SET payload_json=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND status='editing'").bind(JSON.stringify(body.payload),now,actor,id,body.revision).run();if(r.meta.changes!==1)throw Error('DRAFT_CONFLICT');
 }else{if(body.revision!==0)throw Error('DRAFT_CONFLICT');await db.prepare("INSERT INTO catalog_editor_drafts (id,product_id,base_release_id,base_generation,revision,status,payload_json,updated_at,updated_by) VALUES (?,?,?,?,1,'editing',?,?,?)").bind(id,body.productId,body.baseReleaseId,body.baseGeneration,JSON.stringify(body.payload),now,actor).run();}
 return editorDraft(db,id);
}
export async function previewEditorDraft(db:D1Database,id:string){const draft=await editorDraft(db,id);const tour=await editorTour(db,draft.productId,draft.baseReleaseId);return {draft,tour:editorPreview(tour,draft.payload)};}
async function approvedVariantImages(db:D1Database,payload:EditorPayload){
 for(const path of new Set(payload.variants.map(v=>v.image).filter((path):path is string=>!!path)))if(!await db.prepare('SELECT id FROM catalog_media WHERE path=?').bind(path).first())throw Error('IMAGE_NOT_APPROVED');
}
const originRateId=(id:string)=>id.split('__').at(-1)!;
export async function publishEditorDraft(db:D1Database,id:string,revision:number,actor:string){
 const draft=await editorDraft(db,id),releaseId='rel_edit_'+(await hash(id+':'+revision)).slice(0,24),state=await activeState(db);
 if(draft.revision!==revision)throw Error('DRAFT_CONFLICT');
 if(state.release_id===releaseId){await db.prepare("UPDATE catalog_editor_drafts SET status='published' WHERE id=? AND revision=?").bind(id,revision).run();return {releaseId,generation:state.generation};}
 if(draft.status!=='editing'||state.release_id!==draft.baseReleaseId||state.generation!==draft.baseGeneration)throw Error('CONFLICT_REFRESH_REQUIRED');
 editorPayloadSchema.parse(draft.payload);
 const tour=await editorTour(db,draft.productId,draft.baseReleaseId),before=editorPayload(tour),after={...draft.payload,visible:draft.payload.visible??before.visible,variants:draft.payload.variants.map(v=>({...before.variants.find(x=>x.id===v.id)!,...v,image:v.image===undefined?before.variants.find(x=>x.id===v.id)!.image:v.image,imageAlt:v.image===null?'':v.imageAlt??before.variants.find(x=>x.id===v.id)!.imageAlt,name:v.name??before.variants.find(x=>x.id===v.id)!.name,visible:v.visible??before.variants.find(x=>x.id===v.id)!.visible,...(v.itinerary===undefined&&before.variants.find(x=>x.id===v.id)?.itinerary?{itinerary:before.variants.find(x=>x.id===v.id)!.itinerary}:{} )}))};
 if(Object.keys(before).every(k=>JSON.stringify(before[k as keyof EditorPayload])===JSON.stringify(after[k as keyof EditorPayload])))throw Error('NO_CONTENT_CHANGES');
 if(!sameIds(before.variants,after.variants)||before.variants.some(v=>!sameIds(v.rates,after.variants.find(x=>x.id===v.id)!.rates)))throw Error('INVALID_CONTENT_IDENTITY');
 for(const v of after.variants)validateNewSellingRates(tour.variants.find(x=>x.id===v.id)!,v.newRates);
 await approvedVariantImages(db,after);
 const claim=await db.prepare("UPDATE catalog_editor_drafts SET status='publishing',published_release_id=? WHERE id=? AND revision=? AND status='editing'").bind(releaseId,id,revision).run();if(claim.meta.changes!==1)throw Error('DRAFT_CONFLICT');
 try{
  const prior=await db.prepare('SELECT id FROM catalog_releases WHERE id=?').bind(releaseId).first();
  if(!prior){
   const count=await db.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN publication_status='published' THEN 1 ELSE 0 END) AS n FROM catalog_release_products WHERE release_id=?").bind(state.release_id).first<{total:number;n:number}>();
   const publishedCount=(count?.n||0)+Number(after.visible)-Number(before.visible);
   const summary={products:count?.total||0,published:publishedCount,drafts:0,checkedAt:draft.updatedAt,counts:{added:0,changed:1,hidden:Number(before.visible&&!after.visible),price:Number(after.variants.some(v=>v.newRates?.length||JSON.stringify(v.rates)!==JSON.stringify(before.variants.find(x=>x.id===v.id)!.rates))),itinerary:Number(after.variants.some(v=>v.itinerary!==undefined&&JSON.stringify(v.itinerary)!==JSON.stringify(tour.variants.find(x=>x.id===v.id)!.itinerary))),includes:0},changes:[{id:tour.id,title:after.title,kind:'changed',publication:after.visible?'published':'archived',fields:Object.keys(after).filter(k=>JSON.stringify(before[k as keyof EditorPayload])!==JSON.stringify(after[k as keyof EditorPayload])),before,after}]};
   const statements=[db.prepare("INSERT INTO catalog_releases (id,hash,status,base_id,created_at,created_by,summary_json) VALUES (?,?,'draft',?,?,?,?)").bind(releaseId,await hash({id,revision,payload:after}),state.release_id,draft.updatedAt,actor,JSON.stringify(summary))];
   for(const table of ['catalog_release_products','catalog_release_variants','catalog_release_destinations','catalog_public_rates'] as const)statements.push(await cloneReleaseRows(db,table,state.release_id,releaseId));
   // A visibility-only release changes no copy, images, identity or variants.
   const fields:string[]=[],values:unknown[]=[];
   for(const [key,column] of [['title','title'],['description','description'],['image','image'],['imageAlt','image_alt']] as const){if(after[key]!==before[key]){fields.push(column+'=?');values.push(after[key]);}}
   if(after.description!==before.description)fields.push('description_edited=1');
   if(after.visible!==before.visible){fields.push('publication_status=?');values.push(after.visible?'published':'archived');}
   if(fields.length)statements.push(db.prepare('UPDATE catalog_release_products SET '+fields.join(',')+' WHERE release_id=? AND product_id=?').bind(...values,releaseId,tour.id));
   for(const edit of after.variants){const original=tour.variants.find(v=>v.id===edit.id)!;
    // Display-only names and images stay release-local: revisions and approved bindings are unchanged.
    if(edit.image!==(original.image??null)||edit.imageAlt!==(original.imageAlt||''))statements.push(db.prepare('UPDATE catalog_release_variants SET image_override=?,image_alt_override=? WHERE release_id=? AND variant_id=?').bind(edit.image,edit.image?edit.imageAlt:null,releaseId,edit.id));
    if(edit.name!==original.name)statements.push(db.prepare('UPDATE catalog_release_variants SET name_override=? WHERE release_id=? AND variant_id=?').bind(edit.name,releaseId,edit.id));
    if(edit.visible!==(original.visible!==false))statements.push(db.prepare('UPDATE catalog_release_variants SET visible=? WHERE release_id=? AND variant_id=?').bind(Number(edit.visible),releaseId,edit.id));
    if(edit.description!==original.description||(edit.itinerary!==undefined&&JSON.stringify(edit.itinerary)!==JSON.stringify(original.itinerary))){const old=await db.prepare('SELECT * FROM catalog_variant_revisions WHERE id=?').bind(original.revisionId).first<Record<string,any>>();if(!old)throw Error('REVISION_NOT_FOUND');
     const terms={...JSON.parse(old.terms_json),description:edit.description,...(edit.itinerary!==undefined?{itinerary:edit.itinerary}:{})},fingerprint=await hash({from:old.id,terms}),nextRevision='rev_'+fingerprint.slice(0,28);
     statements.push(db.prepare('INSERT OR IGNORE INTO catalog_variant_revisions (id,variant_id,hash,name,duration,days,transport,format,terms_json) VALUES (?,?,?,?,?,?,?,?,?)').bind(nextRevision,old.variant_id,fingerprint,old.name,old.duration,old.days,old.transport,old.format,JSON.stringify(terms)));
     statements.push(db.prepare('INSERT OR IGNORE INTO catalog_itinerary_stops (revision_id,destination_id,sequence,visit_type,required,note) SELECT ?,destination_id,sequence,visit_type,required,note FROM catalog_itinerary_stops WHERE revision_id=?').bind(nextRevision,old.id));
     statements.push(db.prepare('UPDATE catalog_release_variants SET revision_id=? WHERE release_id=? AND variant_id=?').bind(nextRevision,releaseId,edit.id));
    }
    for(const rate of edit.rates){const rateId=releaseId+'__'+originRateId(rate.id);
     if(rate.amountMinor===null)statements.push(db.prepare('DELETE FROM catalog_public_rates WHERE release_id=? AND variant_id=? AND id=?').bind(releaseId,edit.id,rateId));
     else if(rate.amountMinor!==original.rates.find(r=>r.id===rate.id)!.amountMinor)statements.push(db.prepare('UPDATE catalog_public_rates SET amount_minor=? WHERE release_id=? AND variant_id=? AND id=?').bind(rate.amountMinor,releaseId,edit.id,rateId));
    }
    for(const [i,input] of (edit.newRates||[]).entries()){const rate=resolveNewSellingRate(input,todayInThailand(new Date(draft.updatedAt)));statements.push(db.prepare('INSERT INTO catalog_public_rates (id,release_id,variant_id,option_key,amount_minor,currency,unit,audience,valid_from,valid_until,conditions,supplements_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(releaseId+'__price_'+(await hash(id+':'+revision+':'+edit.id+':'+i)).slice(0,24),releaseId,edit.id,rate.optionKey||null,rate.amountMinor,rate.currency,rate.unit,rate.audience,rate.validFrom,rate.validUntil,rate.conditions,'[]'));}
   }
   await db.batch(statements);
  }
  const result=await publishRelease(db,releaseId,draft.baseGeneration,actor);
  await db.prepare("UPDATE catalog_editor_drafts SET status='published' WHERE id=? AND revision=?").bind(id,revision).run();return result;
 }catch(error){const current=await activeState(db);if(current.release_id!==releaseId)await db.prepare("UPDATE catalog_editor_drafts SET status='editing' WHERE id=? AND revision=? AND status='publishing'").bind(id,revision).run();throw error;}
}
export async function restoreEditorRelease(db:D1Database,id:string,generation:number,actor:string){return publishRelease(db,id,generation,actor,true);}
