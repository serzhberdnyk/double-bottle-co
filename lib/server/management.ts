import {assertReleaseOwnership,releaseOwnershipValidSql} from './release-variant-ownership';
import {splitLocalePublication} from './khaosok-split-locales';
import {product} from './catalog';
import {translationSeed} from './localization';
import {validateImportShape} from './import-schema';
import type {Tour,Destination,Variant,Rate} from '../public/types';
export type ImportTour=Tour&{publicationStatus:'draft'|'published'|'archived';provenance:{sourceId:string;source:string;checkedAt:string;hash:string};supplier:{id:string;name:string;offerId:string;raw:unknown;rates?:{id:string;amountMinor:number|null;currency:string;kind:string;unit:string;validFrom:string|null;validUntil:string|null;sourceText:string}[]}};
export interface ImportPacket{schemaVersion:1;complete:boolean;source:string;checkedAt:string;products:ImportTour[];destinations:Destination[];media:{id:string;path:string;license:string;attribution:string;sourceUrl:string}[]}
export const uuid=()=>crypto.randomUUID();
export async function hash(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
const iso=/^\d{4}-\d{2}-\d{2}$/;
export function validatePacket(p:ImportPacket){
 const errors:string[]=[];
 if(!p||p.schemaVersion!==1||!p.complete||!Array.isArray(p.products)||!p.products.length)throw new Error('INCOMPLETE_IMPORT');
 if(p.products.length>5000)throw new Error('IMPORT_TOO_LARGE');
 validateImportShape(p);
 const ids=new Set<string>(),slugs=new Set<string>(),vs=new Set<string>(),ds=new Set((p.destinations||[]).map(d=>d.id));
 const approved=new Set((p.media||[]).filter(m=>m.license&&m.sourceUrl&&m.attribution).map(m=>m.path));
 const destinationIds=new Set<string>(),destinationSlugs=new Set<string>();
 for(const d of p.destinations||[]){if(destinationIds.has(d.id)||destinationSlugs.has(d.slug))errors.push('Повтор места: '+d.id);destinationIds.add(d.id);destinationSlugs.add(d.slug);if(!d.id||!d.slug||!d.name)errors.push('Место без ID или названия');if(!Number.isFinite(d.lat)||Math.abs(d.lat)>90||!Number.isFinite(d.lng)||Math.abs(d.lng)>180)errors.push('Координаты: '+d.id);if(d.image&&!approved.has(d.image))errors.push('Права на фото места: '+d.id);}
 for(const t of p.products){
  if(!t.supplier?.id||!t.supplier?.offerId||!t.supplier?.name)errors.push('Нет внутреннего источника: '+t.id);if(!t.id||ids.has(t.id)||slugs.has(t.slug))errors.push('Повтор ID / адреса: '+t.slug);ids.add(t.id);slugs.add(t.slug);
  if(!/^[a-z0-9-]+$/.test(t.slug)||!t.title||!t.category||!t.variants?.length)errors.push('Неполный продукт: '+t.id);
  if(!t.provenance?.sourceId||!t.provenance.checkedAt||!t.provenance.hash)errors.push('Нет происхождения: '+t.id);
  if(t.image&&!approved.has(t.image))errors.push('Права на фото: '+t.id);
  if(!['on_request','temporarily_unavailable'].includes(t.status))errors.push('Статус продажи: '+t.id);if(!['published','draft','archived'].includes(t.publicationStatus))errors.push('Статус публикации: '+t.id);
  for(const v of t.variants||[]){
   if(vs.has(v.id)||!v.id)errors.push('Повтор варианта: '+v.id);vs.add(v.id);
   if(!['on_request','temporarily_unavailable'].includes(v.status)||!v.name||!v.transport||!Number.isInteger(v.days)||v.days<1)errors.push('Вариант: '+v.id);
   const seq=new Set<number>();for(const s of v.stops||[]){if(!ds.has(s.destinationId)||!Number.isInteger(s.sequence)||s.sequence<1||seq.has(s.sequence)||!['landing','snorkeling','boat_view','water_stop','passage','optional','conditional'].includes(s.visitType))errors.push('Остановка: '+v.id);seq.add(s.sequence);}
   const optionKeys=new Set<string>();for(const o of v.priceOptions||[]){if(optionKeys.has(o.key)||!o.key||!o.label||(o.serviceDateFrom&&o.serviceDateUntil&&o.serviceDateFrom>o.serviceDateUntil))errors.push('Тарифная опция: '+v.id);optionKeys.add(o.key);}
   for(const r of v.rates){if((optionKeys.size&&!r.optionKey)||(r.optionKey&&!optionKeys.has(r.optionKey)))errors.push('Тариф без опции: '+v.id);}
   for(let i=0;i<v.rates.length;i++){const a=v.rates[i];for(const b of v.rates.slice(i+1)){if(a.audience===b.audience&&a.optionKey===b.optionKey&&a.validFrom<=(b.validUntil||'9999-12-31')&&b.validFrom<=(a.validUntil||'9999-12-31'))errors.push('Пересекающиеся тарифы: '+v.id);}}
   for(const r of v.rates||[]){if(!Number.isSafeInteger(r.amountMinor)||r.amountMinor<=0||!r.unit||!/^[A-Z]{3}$/.test(r.currency)||!iso.test(r.validFrom)||(r.validUntil&&(!iso.test(r.validUntil)||r.validUntil<r.validFrom)))errors.push('Тариф: '+v.id);}
  }
 }
 if(errors.length)throw new Error('VALIDATION: '+errors.slice(0,30).join('; '));
 return {products:p.products.length,variants:vs.size,published:p.products.filter(t=>t.publicationStatus==='published').length,drafts:p.products.filter(t=>t.publicationStatus==='draft').length};
}
export function publicTerms(v:Variant){return {description:v.description,itinerary:v.itinerary,includes:v.includes,extras:v.extras,conditions:v.conditions,earliestDate:v.earliestDate,...(v.priceOptions?.length?{priceOptions:v.priceOptions}:{})};}
export function promiseFingerprint(v:Variant){return {stops:v.stops.map(s=>({destinationId:s.destinationId,visitType:s.visitType,required:s.required,note:s.note})),itinerary:v.itinerary,description:v.description,earliestDate:v.earliestDate,duration:v.duration,days:v.days,transport:v.transport,format:v.format,includes:[...v.includes].sort(),extras:[...v.extras].sort(),conditions:[...v.conditions].sort(),...(v.priceOptions?.length?{priceOptions:v.priceOptions}: {})};}
export function compatibility(promised:Record<string,unknown>,offered:Record<string,unknown>){const keys=['stops','itinerary','description','earliestDate','duration','days','transport','format','includes','extras','conditions','priceOptions'];const mismatches=keys.filter(k=>JSON.stringify(promised[k])!==JSON.stringify(offered[k]));return {compatible:mismatches.length===0,mismatches};}
async function chunks(db:D1Database,statements:D1PreparedStatement[]){for(let i=0;i<statements.length;i+=60)await db.batch(statements.slice(i,i+60));}
export async function stageImport(db:D1Database,p:ImportPacket,actor:string){
 const digest=await hash(p),now=new Date().toISOString();
 const prior=await db.prepare("SELECT id,status,summary_json FROM catalog_releases WHERE hash=?").bind(digest).first<any>();if(prior&&prior.status!=='failed'&&prior.status!=='staging')return {id:prior.id,status:prior.status,summary:JSON.parse(prior.summary_json),idempotent:true};
 let summary;try{summary=validatePacket(p);}catch(e){await db.prepare('INSERT INTO internal_imports (id,hash,status,source_json,created_at,actor,error) VALUES (?,?,?,?,?,?,?)').bind(uuid(),digest,'failed',JSON.stringify({source:p?.source,checkedAt:p?.checkedAt}),now,actor,String(e).slice(0,1500)).run();throw e;}
 const st=await db.prepare('SELECT release_id,generation FROM catalog_state WHERE id=1').first<any>();const base=st?.release_id||null;
 const old=base?(await db.prepare('SELECT product_id,slug,title,description,category,sale_status,publication_status,image,featured_rank FROM catalog_release_products WHERE release_id=?').bind(base).all<any>()).results:[];
 const missing=old.filter(x=>!p.products.some(y=>y.id===x.product_id));if(missing.length)throw new Error('MISSING_PRODUCTS: Отсутствующие строки не удаляются. Передайте полный импорт или явный статус archived.');
 const existingVariants=(await db.prepare('SELECT v.id,COALESCE(rv.product_id,v.product_id) AS product_id FROM catalog_variants v LEFT JOIN catalog_state st ON st.id=1 LEFT JOIN catalog_release_variants rv ON rv.variant_id=v.id AND rv.release_id=st.release_id').all<any>()).results;
 for(const t of p.products){for(const v of t.variants){const existing=existingVariants.find(x=>x.id===v.id);if(existing&&existing.product_id!==t.id)throw new Error('VARIANT_IDENTITY_CONFLICT');}const alias=await db.prepare('SELECT product_id FROM catalog_redirects WHERE from_slug=?').bind(t.slug).first<any>();if(alias&&alias.product_id!==t.id)throw new Error('SLUG_RESERVED');const oldOwner=old.find(x=>x.slug===t.slug);if(oldOwner&&oldOwner.product_id!==t.id)throw new Error('SLUG_IDENTITY_CONFLICT');}
 const oldVariants=base?(await db.prepare('SELECT COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) AS product_id,v.id,rv.revision_id,rv.sale_status,rev.name,rev.duration,rev.days,rev.transport,rev.format,rev.terms_json FROM catalog_release_variants rv JOIN catalog_variants v ON v.id=rv.variant_id JOIN catalog_variant_revisions rev ON rev.id=rv.revision_id WHERE rv.release_id=?').bind(base).all<any>()).results:[];
 const oldStops=base?(await db.prepare('SELECT s.revision_id,s.destination_id,s.sequence,s.visit_type,s.required,s.note FROM catalog_itinerary_stops s JOIN catalog_release_variants rv ON rv.revision_id=s.revision_id WHERE rv.release_id=?').bind(base).all<any>()).results:[];
 const oldRates=base?(await db.prepare('SELECT variant_id,option_key,amount_minor,currency,unit,audience,valid_from,valid_until,conditions,supplements_json FROM catalog_public_rates WHERE release_id=?').bind(base).all<any>()).results:[];
 const rateView=(r:Rate)=>({... (r.optionKey?{optionKey:r.optionKey}:{}),amountMinor:r.amountMinor,currency:r.currency,unit:r.unit,audience:r.audience,validFrom:r.validFrom,validUntil:r.validUntil,conditions:r.conditions,supplements:r.supplements});
 const variantView=(v:Variant)=>({id:v.id,name:v.name,status:v.status,duration:v.duration,days:v.days,transport:v.transport,format:v.format,...publicTerms(v),stops:v.stops.map(s=>({destinationId:s.destinationId,sequence:s.sequence,visitType:s.visitType,required:s.required,note:s.note})),rates:v.rates.map(rateView)});
 const changes=p.products.map(t=>{const previous=old.find(x=>x.product_id===t.id);const after={slug:t.slug,title:t.title,description:t.description,category:t.category,status:t.status,publication:t.publicationStatus,image:t.image,featuredRank:t.featuredRank,variants:t.variants.map(variantView).sort((a,b)=>a.id.localeCompare(b.id))};
 const before=previous?{slug:previous.slug,title:previous.title,description:previous.description,category:previous.category,status:previous.sale_status,publication:previous.publication_status,image:previous.image,featuredRank:previous.featured_rank,variants:oldVariants.filter(v=>v.product_id===t.id).map(v=>variantView({id:v.id,name:v.name,status:v.sale_status,duration:v.duration,days:v.days,transport:v.transport,format:v.format,...JSON.parse(v.terms_json),stops:oldStops.filter(s=>s.revision_id===v.revision_id).map(s=>({destinationId:s.destination_id,sequence:s.sequence,visitType:s.visit_type,required:!!s.required,note:s.note})).sort((a,b)=>a.sequence-b.sequence),rates:oldRates.filter(r=>r.variant_id===v.id).map(r=>({optionKey:r.option_key||undefined,amountMinor:r.amount_minor,currency:r.currency,unit:r.unit,audience:r.audience,validFrom:r.valid_from,validUntil:r.valid_until,conditions:r.conditions,supplements:JSON.parse(r.supplements_json)}))})).sort((a,b)=>a.id.localeCompare(b.id))}:null;
 const fields=Object.keys(after).filter(k=>JSON.stringify(before?.[k as keyof typeof before])!==JSON.stringify(after[k as keyof typeof after]));const impacts=after.variants.map(v=>{const oldVariant=before?.variants.find(x=>x.id===v.id);const fields=Object.keys(v).filter(k=>JSON.stringify(oldVariant?.[k as keyof typeof oldVariant])!==JSON.stringify(v[k as keyof typeof v]));return{id:v.id,name:v.name,fields};}).filter(v=>v.fields.length);
 const removedVariants=(before?.variants||[]).filter(v=>!after.variants.some(a=>a.id===v.id)).map(v=>({id:v.id,name:v.name,fields:['removed']}));
 return {id:t.id,title:t.title,kind:!previous?'added':fields.length?'changed':'unchanged',publication:t.publicationStatus,fields,impacts:[...impacts,...removedVariants],before:fields.length?before:null,after:fields.length?after:null};});
 const details={...summary,changes,counts:{added:changes.filter(c=>c.kind==='added').length,changed:changes.filter(c=>c.kind==='changed').length,hidden:changes.filter(c=>c.before?.publication==='published'&&c.after?.publication!=='published').length,price:changes.filter(c=>c.impacts.some(v=>v.fields.includes('rates'))).length,itinerary:changes.filter(c=>c.impacts.some(v=>v.fields.includes('itinerary')||v.fields.includes('stops'))).length,includes:changes.filter(c=>c.impacts.some(v=>v.fields.includes('includes'))).length},baseGeneration:st?.generation||0,checkedAt:p.checkedAt};const id='rel_'+digest.slice(0,24);
 if(prior?.status==='staging')throw new Error('IMPORT_IN_PROGRESS');
 if(prior)await db.prepare("UPDATE catalog_releases SET status='staging',base_id=?,summary_json=? WHERE id=? AND status='failed'").bind(base,JSON.stringify(details),id).run();else await db.prepare('INSERT INTO catalog_releases (id,hash,status,base_id,created_at,created_by,summary_json) VALUES (?,?,?,?,?,?,?)').bind(id,digest,'staging',base,now,actor,JSON.stringify(details)).run();
 try{
 const statements:D1PreparedStatement[]=[];
 for(const m of p.media)statements.push(db.prepare('INSERT INTO catalog_media (id,path,license,attribution,source_url,approved_by,approved_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(m.id,m.path,m.license,m.attribution,m.sourceUrl,actor,now));
 for(const d of p.destinations){statements.push(db.prepare('INSERT INTO catalog_destinations (id,slug,name,lat_micro,lng_micro,region,description,image) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(d.id,d.slug,d.name,Math.round(d.lat*1e6),Math.round(d.lng*1e6),d.region,d.description,d.image));statements.push(db.prepare('INSERT INTO catalog_release_destinations (release_id,destination_id,slug,name,lat_micro,lng_micro,region,description,image) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(release_id,destination_id) DO NOTHING').bind(id,d.id,d.slug,d.name,Math.round(d.lat*1e6),Math.round(d.lng*1e6),d.region,d.description,d.image));}
 for(const t of p.products){
  statements.push(db.prepare('INSERT INTO catalog_products (id,slug) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind(t.id,t.slug));
  statements.push(db.prepare('INSERT INTO catalog_release_products (release_id,product_id,slug,title,description,category,image,image_alt,sale_status,publication_status,featured_rank,description_edited) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(release_id,product_id) DO NOTHING').bind(id,t.id,t.slug,t.title,t.description,t.category,t.image,t.imageAlt,t.status,t.publicationStatus,t.featuredRank,Number(t.descriptionEdited||false)));
  statements.push(db.prepare('INSERT INTO internal_suppliers (id,name,details_json) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').bind(t.supplier.id,t.supplier.name,'{}'));
  const existingOffer=await db.prepare('SELECT id FROM internal_supplier_offers WHERE supplier_id=? AND source_id=? AND source_hash=?').bind(t.supplier.id,t.provenance.sourceId,t.provenance.hash).first<{id:string}>();const offerVersion=existingOffer?.id||t.supplier.offerId+'_'+t.provenance.hash.slice(0,16);
  statements.push(db.prepare('INSERT INTO internal_supplier_offers (id,supplier_id,source_id,facts_json,source_hash,checked_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(offerVersion,t.supplier.id,t.provenance.sourceId,JSON.stringify(t.supplier.raw),t.provenance.hash,t.provenance.checkedAt));
  for(const rate of t.supplier.rates||[]){if(rate.amountMinor!==null&&(!Number.isSafeInteger(rate.amountMinor)||rate.amountMinor<0))throw new Error('INVALID_SUPPLIER_RATE');statements.push(db.prepare('INSERT INTO internal_supplier_rates (id,offer_id,amount_minor,currency,kind,unit,valid_from,valid_until,source_text) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(offerVersion+'_'+rate.id,offerVersion,rate.amountMinor,rate.currency,rate.kind,rate.unit,rate.validFrom,rate.validUntil,rate.sourceText));}
  for(const v of t.variants){
   const fingerprint=await hash({variant:v.id,name:v.name,days:v.days,duration:v.duration,transport:v.transport,format:v.format,terms:publicTerms(v),stops:v.stops});const revisionId='rev_'+fingerprint.slice(0,28);
   statements.push(db.prepare('INSERT INTO catalog_variants (id,product_id) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind(v.id,t.id));
   statements.push(db.prepare('INSERT INTO catalog_variant_revisions (id,variant_id,hash,name,duration,days,transport,format,terms_json) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(revisionId,v.id,fingerprint,v.name,v.duration,v.days,v.transport,v.format,JSON.stringify(publicTerms(v))));
   statements.push(db.prepare('INSERT INTO catalog_release_variants (release_id,variant_id,revision_id,sale_status,product_id,visible) VALUES (?,?,?,?,?,COALESCE((SELECT rv.visible FROM catalog_release_variants rv JOIN catalog_state st ON st.release_id=rv.release_id AND st.id=1 WHERE rv.variant_id=?),1)) ON CONFLICT(release_id,variant_id) DO NOTHING').bind(id,v.id,revisionId,v.status,t.id,v.id));
   for(const s of v.stops)statements.push(db.prepare('INSERT INTO catalog_itinerary_stops (revision_id,destination_id,sequence,visit_type,required,note) VALUES (?,?,?,?,?,?) ON CONFLICT(revision_id,sequence) DO NOTHING').bind(revisionId,s.destinationId,s.sequence,s.visitType,Number(s.required),s.note));
   for(const [i,r] of v.rates.entries())statements.push(db.prepare('INSERT INTO catalog_public_rates (id,release_id,variant_id,option_key,amount_minor,currency,unit,audience,valid_from,valid_until,conditions,supplements_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id+'_'+v.id+'_'+i,id,v.id,r.optionKey||null,r.amountMinor,r.currency,r.unit,r.audience,r.validFrom,r.validUntil,r.conditions,JSON.stringify(r.supplements)));
   statements.push(db.prepare('INSERT INTO internal_supply_bindings (id,revision_id,offer_id,status,priority,valid_from,valid_until,compatibility_json) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind('binding_'+revisionId+'_'+offerVersion,revisionId,offerVersion,'pending_review',1,p.checkedAt.slice(0,10),null,JSON.stringify({promises:promiseFingerprint(v),reviewRequired:true})));
  }
 }
 await chunks(db,statements);
 await db.batch([db.prepare("UPDATE catalog_releases SET status='draft' WHERE id=?").bind(id),db.prepare('INSERT INTO internal_imports (id,hash,status,source_json,release_id,created_at,actor) VALUES (?,?,?,?,?,?,?)').bind(uuid(),digest,'validated',JSON.stringify({source:p?.source,checkedAt:p?.checkedAt}),id,now,actor)]);
 return {id,status:'draft',summary:details,idempotent:false};
 }catch(e){await db.prepare("UPDATE catalog_releases SET status='failed' WHERE id=?").bind(id).run();throw e;}
}
export async function publishRelease(db:D1Database,id:string,expectedGeneration:number,actor:string,rollback=false){
 const r=await db.prepare('SELECT id,status,base_id,summary_json FROM catalog_releases WHERE id=?').bind(id).first<any>();if(!r||!(rollback?r.status==='published':r.status==='draft'))throw new Error('RELEASE_NOT_READY');
 await db.prepare('INSERT INTO catalog_state (id,release_id,generation) VALUES (1,NULL,0) ON CONFLICT(id) DO NOTHING').run();
 const st=await db.prepare('SELECT release_id,generation FROM catalog_state WHERE id=1').first<any>();if(st.generation!==expectedGeneration||(!rollback&&r.base_id!==st.release_id))throw new Error('CONFLICT_REFRESH_REQUIRED');
 await assertReleaseOwnership(db,id);
 const stamp=new Date().toISOString();
 const summary=JSON.parse(r.summary_json||'{}');let localeStatements:D1PreparedStatement[]=[];
 if(!rollback&&summary.kind==='standard_vip_split'){
  const next=await db.prepare('SELECT * FROM catalog_release_products WHERE release_id=? AND product_id=?').bind(id,summary.vipProductId).first<any>();
  if(!next||next.title!==summary.sourceCopy?.title||next.description!==summary.sourceCopy?.description)throw Error('SPLIT_LOCALE_SOURCE_CONFLICT');
  const original=await db.prepare('SELECT slug FROM catalog_release_products WHERE release_id=? AND product_id=?').bind(r.base_id,'p_f60658ace81d54048d0d6a8a').first<{slug:string}>();
  const source=original&&await product(db,original.slug,r.base_id,true);if(!source)throw Error('SPLIT_SOURCE_UNAVAILABLE');
  const candidate={...source.tour,id:next.product_id,slug:next.slug,title:next.title,description:next.description,image:next.image,imageAlt:next.image_alt,variants:source.tour.variants.filter(v=>summary.vipVariantIds.includes(v.id)&&v.visible!==false)};
  localeStatements=await splitLocalePublication(db,summary,candidate,{en:translationSeed('en'),th:translationSeed('th')},id,expectedGeneration,actor);
 }
 const result=await db.batch([
 db.prepare('UPDATE catalog_state SET release_id=?,generation=generation+1 WHERE id=1 AND generation=?').bind(id,expectedGeneration),
 ...localeStatements,
 db.prepare("INSERT INTO catalog_redirects (from_slug,product_id) SELECT old.slug,old.product_id FROM catalog_release_products old JOIN catalog_release_products next ON next.product_id=old.product_id WHERE old.release_id=? AND next.release_id=? AND old.slug<>next.slug AND old.slug<>'' AND EXISTS (SELECT 1 FROM catalog_state WHERE release_id=? AND generation=?) ON CONFLICT(from_slug) DO NOTHING").bind(st.release_id||'',id,id,expectedGeneration+1),
 db.prepare("UPDATE catalog_releases SET status='published' WHERE id=? AND EXISTS (SELECT 1 FROM catalog_state WHERE release_id=? AND generation=?)").bind(id,id,expectedGeneration+1),
 db.prepare(`INSERT INTO internal_events (id,type,actor,created_at,data_json) SELECT ?,?,?,?,CASE WHEN ${releaseOwnershipValidSql()} THEN ? ELSE NULL END WHERE EXISTS (SELECT 1 FROM catalog_state WHERE release_id=? AND generation=?)`).bind(uuid(),rollback?'rollback':'publish',actor,stamp,id,JSON.stringify({releaseId:id,from:st.release_id}),id,expectedGeneration+1)
 ]);if(result[0].meta.changes!==1)throw new Error('CONFLICT_REFRESH_REQUIRED');return {releaseId:id,generation:expectedGeneration+1};
}
export async function approveBinding(db:D1Database,id:string,offered:Record<string,unknown>,actor:string,validUntil:string|null){
 const b=await db.prepare('SELECT revision_id,valid_from,compatibility_json FROM internal_supply_bindings WHERE id=?').bind(id).first<any>();if(!b)throw new Error('NOT_FOUND');const promised=JSON.parse(b.compatibility_json).promises;const result=compatibility(promised,offered);if(!result.compatible)throw new Error('INCOMPATIBLE: '+result.mismatches.join(', '));if(validUntil&&(!iso.test(validUntil)||validUntil<b.valid_from))throw new Error('INVALID_DATE');
 await db.prepare("UPDATE internal_supply_bindings SET status='approved',compatibility_json=?,approved_by=?,approved_at=?,valid_until=? WHERE id=?").bind(JSON.stringify({promises:promised,offered,...result}),actor,new Date().toISOString(),validUntil,id).run();await db.prepare('INSERT INTO internal_events (id,type,actor,created_at,data_json) VALUES (?,?,?,?,?)').bind(uuid(),'approve_binding',actor,new Date().toISOString(),JSON.stringify({bindingId:id,validUntil})).run();return result;
}
