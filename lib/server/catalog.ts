import {variantPublication} from './variant-visibility';
import {currentLocale} from '../i18n/server';
import {translateCatalog,originalCatalogText} from '../i18n/catalog';
import {publishedTranslations} from './localization';
import {safePublicTour} from '../public/catalog-presentation-safety';
import type {CatalogResponse,CatalogQuery,Tour,Variant,Rate,Destination} from '../public/types';
import {categoryNames} from '../public/types';
type Row=Record<string,any>;
// Only authenticated editor callers opt into archived cards. Public queries also
// respect current visibility when a visitor holds an older release URL.
function publication(alias:string,includeHidden=false){return includeHidden
 ? alias+".publication_status IN ('published','archived')"
 : alias+".publication_status='published' AND "+alias+".product_id NOT IN (SELECT product_id FROM catalog_release_products WHERE release_id=(SELECT release_id FROM catalog_state WHERE id=1) AND publication_status='archived') AND EXISTS (SELECT 1 FROM catalog_release_variants visible_variant JOIN catalog_variants visible_identity ON visible_identity.id=visible_variant.variant_id WHERE visible_variant.release_id="+alias+".release_id AND COALESCE(visible_variant.product_id,visible_identity.product_id)="+alias+".product_id AND "+variantPublication('visible_variant')+")";}
export async function activeState(db:D1Database){const s=await db.prepare('SELECT release_id, generation FROM catalog_state WHERE id = 1').first<{release_id:string;generation:number}>();if(!s?.release_id)throw new Error('CATALOG_NOT_PUBLISHED');return s;}
async function rawCatalog(db:D1Database,q:CatalogQuery={},includeHidden=false,full=false):Promise<CatalogResponse>{
 const state=await activeState(db);const release=q.release||state.release_id;
 if(release!==state.release_id){const exists=await db.prepare("SELECT id FROM catalog_releases WHERE id = ? AND status = 'published'").bind(release).first();if(!exists)throw new Error('UNKNOWN_RELEASE');}
 const args:any[]=[release];let where='rp.release_id = ? AND '+publication('rp',includeHidden);
 if(q.q?.trim()){
  // SQLite LIKE does not fold Cyrillic case. Search the real published copy
  // and named itinerary destinations in Unicode before applying SQL paging.
  const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const terms=normalize(q.q.slice(0,100)).split(/\s+/).filter(Boolean);
  const searchable=await db.prepare(`SELECT rp.product_id AS id,rp.title,rp.description,
    GROUP_CONCAT(DISTINCT d.name) AS destinations
    FROM catalog_release_products rp
    LEFT JOIN catalog_release_variants rv ON COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id))=rp.product_id AND rv.release_id=rp.release_id AND ${variantPublication('rv',includeHidden)}
    LEFT JOIN catalog_itinerary_stops s ON s.revision_id=rv.revision_id
    LEFT JOIN catalog_release_destinations d ON d.destination_id=s.destination_id AND d.release_id=rp.release_id
    WHERE rp.release_id=? AND ${publication('rp',includeHidden)} GROUP BY rp.product_id`).bind(release).all<Row>();
  const ids=searchable.results.filter(row=>{const text=normalize([row.title,row.description,row.destinations].filter(Boolean).join(' '));return terms.every(term=>text.includes(term));}).map(row=>row.id);
  where+=' AND p.id IN (SELECT value FROM json_each(?))';args.push(JSON.stringify(ids));
 }
 if(q.category){where+=' AND rp.category = ?';args.push(q.category);}
 if(q.ids){where+=' AND p.id IN ('+q.ids.map(()=>'?').join(',')+')';args.push(...q.ids);}
 const activeOnly=!!(q.destination||q.featured);if(activeOnly)where+=" AND rp.sale_status <> 'temporarily_unavailable'";
 let vw="rv.release_id = rp.release_id AND COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) = p.id AND "+variantPublication('rv',includeHidden);
 const va:any[]=[];
 if(q.destination){vw+=" AND rv.sale_status <> 'temporarily_unavailable' AND EXISTS (SELECT 1 FROM catalog_itinerary_stops its WHERE its.revision_id = rev.id AND its.destination_id = ?)";va.push(q.destination);}
 if(q.days){vw+=' AND rev.days = ?';va.push(Number(q.days));}
 if(q.transport){vw+=' AND rev.transport = ?';va.push(q.transport);}
 if(q.format){vw+=' AND rev.format = ?';va.push(q.format);}
 if(va.length){where+=` AND EXISTS (SELECT 1 FROM catalog_release_variants rv JOIN catalog_variants v ON v.id=rv.variant_id JOIN catalog_variant_revisions rev ON rev.id=rv.revision_id WHERE ${vw})`;args.push(...va);}
 const from='FROM catalog_release_products rp JOIN catalog_products p ON p.id=rp.product_id';
 const total=(await db.prepare(`SELECT COUNT(*) AS n ${from} WHERE ${where}`).bind(...args).first<{n:number}>())?.n||0;
 const limit=Math.trunc(Math.min(Math.max(q.limit||12,1),48));const page=Math.trunc(Math.min(Math.max(q.page||1,1),Math.max(1,Math.ceil(total/limit))));
 const order=q.sort==='title'?'rp.title':q.sort==='duration'?"(SELECT MIN(rev.days) FROM catalog_release_variants rv JOIN catalog_variants v ON v.id=rv.variant_id JOIN catalog_variant_revisions rev ON rev.id=rv.revision_id WHERE rv.release_id=rp.release_id AND COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id))=p.id AND "+variantPublication('rv',includeHidden)+"), rp.title":'rp.featured_rank, rp.title';
 const rows=await db.prepare(`SELECT p.id,COALESCE(NULLIF(rp.slug,''),p.slug) AS slug,rp.title,rp.description,rp.description_edited,rp.category,rp.image,rp.image_alt,rp.sale_status,rp.featured_rank,rp.publication_status ${from} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...args,limit,(page-1)*limit).all<Row>();
 const items=await hydrate(db,rows.results,release,q,full,includeHidden);
 const count=(await db.prepare(`SELECT COUNT(*) AS n FROM catalog_release_products rp WHERE release_id = ? AND ${publication('rp',includeHidden)}`).bind(release).first<{n:number}>())?.n||0;
 const facetsRows=await db.prepare(`SELECT category, COUNT(*) AS n FROM catalog_release_products rp WHERE release_id = ? AND ${publication('rp',includeHidden)} GROUP BY category`).bind(release).all<Row>();
 const vf=await db.prepare(`SELECT DISTINCT rev.days,rev.transport,rev.format FROM catalog_variant_revisions rev JOIN catalog_release_variants rv ON rv.revision_id=rev.id JOIN catalog_variants v ON v.id=rv.variant_id JOIN catalog_release_products rp ON rp.product_id=COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) AND rp.release_id=rv.release_id WHERE rv.release_id=? AND ${publication('rp',includeHidden)} AND ${variantPublication('rv',includeHidden)}`).bind(release).all<Row>();
 const mapVariantArgs:any[]=[];let mapVariantWhere='';for(const [field,value] of [['days',q.days],['transport',q.transport],['format',q.format]]){if(value){mapVariantWhere+=` AND rev.${field}=?`;mapVariantArgs.push(field==='days'?Number(value):value);}}if(q.destination){mapVariantWhere+=' AND EXISTS (SELECT 1 FROM catalog_itinerary_stops ms WHERE ms.revision_id=rev.id AND ms.destination_id=?)';mapVariantArgs.push(q.destination);}
 const dest=await db.prepare(`SELECT d.destination_id AS id,d.slug,d.name,d.lat_micro,d.lng_micro,d.region,d.description,d.image,COUNT(DISTINCT p.id) AS n FROM catalog_release_destinations d JOIN catalog_itinerary_stops s ON s.destination_id=d.destination_id JOIN catalog_release_variants rv ON rv.revision_id=s.revision_id AND rv.release_id=d.release_id JOIN catalog_variant_revisions rev ON rev.id=rv.revision_id JOIN catalog_variants v ON v.id=rv.variant_id JOIN catalog_products p ON p.id=COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) JOIN catalog_release_products rp ON rp.product_id=p.id AND rp.release_id=rv.release_id WHERE ${where} AND ${variantPublication('rv',includeHidden)} AND rv.sale_status <> 'temporarily_unavailable' AND rp.sale_status <> 'temporarily_unavailable' ${mapVariantWhere} GROUP BY d.destination_id LIMIT 100`).bind(...args,...mapVariantArgs).all<Row>();
 return {releaseId:release,generation:state.generation,items,total,page,pages:Math.ceil(total/limit),count,destinations:dest.results.map(destinationDto),facets:{categories:facetsRows.results.map(x=>({id:x.category,name:categoryNames[x.category]||x.category,count:x.n})),durations:[...new Set(vf.results.map(x=>x.days))].sort((a,b)=>a-b),transports:[...new Set(vf.results.map(x=>x.transport))],formats:[...new Set(vf.results.map(x=>x.format).filter(x=>x&&x!=='По запросу'))]}};
}
function destinationDto(x:Row):Destination{return {id:x.id,slug:x.slug,name:x.name,lat:x.lat_micro/1e6,lng:x.lng_micro/1e6,region:x.region,description:x.description,image:x.image,count:x.n};}
async function hydrate(db:D1Database,rows:Row[],release:string,q:CatalogQuery,detail=true,includeHidden=false):Promise<Tour[]>{
 if(!rows.length)return[];const ids=rows.map(x=>x.id),marks=ids.map(()=>'?').join(',');
 const vr=await db.prepare(`SELECT COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) AS product_id,v.id,rv.revision_id,rv.sale_status,rv.visible,rv.image_override,rv.image_alt_override,COALESCE(rv.name_override,rev.name) AS name,rev.duration,rev.days,rev.transport,rev.format,rev.terms_json FROM catalog_variants v JOIN catalog_release_variants rv ON rv.variant_id=v.id JOIN catalog_variant_revisions rev ON rev.id=rv.revision_id WHERE rv.release_id=? AND ${variantPublication('rv',includeHidden)} AND COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) IN (${marks}) ORDER BY v.id`).bind(release,...ids).all<Row>();
 const revisions=vr.results.map(x=>x.revision_id);if(!revisions.length)return[];
 const sr=await db.prepare(`SELECT s.revision_id,s.destination_id,s.sequence,s.visit_type,s.required,s.note,d.name,d.lat_micro,d.lng_micro FROM catalog_itinerary_stops s JOIN catalog_release_destinations d ON d.destination_id=s.destination_id AND d.release_id=? WHERE s.revision_id IN (${revisions.map(()=>'?').join(',')}) ORDER BY s.sequence`).bind(release,...revisions).all<Row>();
 const rr=await db.prepare(`SELECT r.id,r.variant_id,r.option_key,r.amount_minor,r.currency,r.unit,r.audience,r.valid_from,r.valid_until,r.conditions,r.supplements_json FROM catalog_public_rates r JOIN catalog_release_variants rv ON rv.variant_id=r.variant_id AND rv.release_id=r.release_id WHERE r.release_id=? AND COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) IN (${marks}) AND (r.valid_until IS NULL OR r.valid_until >= date('now'))`).bind(release,...ids).all<Row>();
 return rows.map(p=>({id:p.id,...(p.publication_status==='archived'?{hidden:true}:{}),slug:p.slug,title:p.title,description:p.description,...(p.description_edited?{descriptionEdited:true}:{}),category:p.category,image:p.image,imageAlt:p.image_alt,status:p.sale_status,featuredRank:p.featured_rank,variants:vr.results.filter(v=>v.product_id===p.id).map(v=>{const t=JSON.parse(v.terms_json);const stops=sr.results.filter(s=>s.revision_id===v.revision_id).map(s=>({destinationId:s.destination_id,sequence:s.sequence,visitType:s.visit_type,required:!!s.required,note:s.note,name:s.name,lat:s.lat_micro/1e6,lng:s.lng_micro/1e6}));return {id:v.id,image:v.image_override,imageAlt:v.image_alt_override||'',visible:v.visible!==0,revisionId:v.revision_id,name:v.name,description:t.description||'',duration:v.duration,days:v.days,transport:v.transport,format:v.format,status:v.sale_status,stops,itinerary:detail?t.itinerary||[]:[],includes:detail?t.includes||[]:[],extras:detail?t.extras||[]:[],conditions:detail?t.conditions||[]:[],earliestDate:t.earliestDate||null,...(t.priceOptions?.length?{priceOptions:t.priceOptions}:{}),rates:rr.results.filter(r=>r.variant_id===v.id).map(r=>({id:r.id,...(r.option_key?{optionKey:r.option_key}:{}),amountMinor:r.amount_minor,currency:r.currency,unit:r.unit,audience:r.audience,validFrom:r.valid_from,validUntil:r.valid_until,conditions:r.conditions,supplements:JSON.parse(r.supplements_json)}))} as Variant;}).filter(v=>(!q.destination||v.stops.some(s=>s.destinationId===q.destination))&&(!q.days||v.days===Number(q.days))&&(!q.transport||v.transport===q.transport)&&(!q.format||v.format===q.format)&&(!q.destination||v.status!=='temporarily_unavailable'))})).map(tour=>safePublicTour(tour as Tour));
}
async function rawProduct(db:D1Database,slug:string,release?:string,includeHidden=false){const state=await activeState(db);const r=release||state.release_id;if(r!==state.release_id&&!await db.prepare("SELECT id FROM catalog_releases WHERE id=? AND status='published'").bind(r).first())return null;const p=await db.prepare(`SELECT p.id,COALESCE(NULLIF(rp.slug,''),p.slug) AS slug,rp.title,rp.description,rp.description_edited,rp.category,rp.image,rp.image_alt,rp.sale_status,rp.featured_rank,rp.publication_status FROM catalog_products p JOIN catalog_release_products rp ON rp.product_id=p.id WHERE COALESCE(NULLIF(rp.slug,''),p.slug)=? AND rp.release_id=? AND ${publication('rp',includeHidden)}`).bind(slug,r).first<Row>();if(!p)return null;return {releaseId:r,tour:(await hydrate(db,[p],r,{},true,includeHidden))[0]};}
async function rawDestination(db:D1Database,slug:string){const state=await activeState(db);const row=await db.prepare(`SELECT d.destination_id AS id,d.slug,d.name,d.lat_micro,d.lng_micro,d.region,d.description,d.image FROM catalog_release_destinations d WHERE d.slug=? AND d.release_id=? AND EXISTS (SELECT 1 FROM catalog_itinerary_stops s JOIN catalog_release_variants rv ON rv.revision_id=s.revision_id JOIN catalog_variants v ON v.id=rv.variant_id JOIN catalog_release_products rp ON rp.product_id=COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) AND rp.release_id=rv.release_id WHERE s.destination_id=d.destination_id AND rv.release_id=d.release_id AND ${publication('rp')} AND ${variantPublication('rv')})`).bind(slug,state.release_id).first<Row>();return row?destinationDto(row):null;}
export async function canonicalSlug(db:D1Database,slug:string){return db.prepare(`SELECT COALESCE(NULLIF(rp.slug,''),p.slug) AS slug FROM catalog_redirects r JOIN catalog_products p ON p.id=r.product_id JOIN catalog_state st ON st.id=1 JOIN catalog_release_products rp ON rp.product_id=p.id AND rp.release_id=st.release_id WHERE r.from_slug=? AND ${publication('rp')}`).bind(slug).first<{slug:string}>();}

export async function sitemapPaths(db:D1Database):Promise<string[]> {
 const state=await activeState(db);
 const tours=await db.prepare(`SELECT COALESCE(NULLIF(rp.slug,''),p.slug) AS slug FROM catalog_release_products rp JOIN catalog_products p ON p.id=rp.product_id WHERE rp.release_id=? AND ${publication('rp')} ORDER BY slug LIMIT 5000`).bind(state.release_id).all<{slug:string}>();
 const destinations=await db.prepare(`SELECT DISTINCT d.slug FROM catalog_release_destinations d WHERE d.release_id=? AND EXISTS (SELECT 1 FROM catalog_itinerary_stops s JOIN catalog_release_variants rv ON rv.revision_id=s.revision_id JOIN catalog_variants v ON v.id=rv.variant_id JOIN catalog_release_products rp ON rp.product_id=COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) AND rp.release_id=rv.release_id WHERE s.destination_id=d.destination_id AND rv.release_id=d.release_id AND ${publication('rp')} AND ${variantPublication('rv')} AND rp.sale_status <> 'temporarily_unavailable' AND rv.sale_status <> 'temporarily_unavailable') ORDER BY d.slug LIMIT 5000`).bind(state.release_id).all<{slug:string}>();
 return ['/', '/destinations', '/guide', '/about', '/cheow-lan',
   ...tours.results.filter(row=>row.slug).map(row=>'/tour/'+encodeURIComponent(row.slug)),
   ...destinations.results.filter(row=>row.slug).map(row=>'/destination/'+encodeURIComponent(row.slug))];
}

/** Locale overlays never mutate shared commercial facts or release/draft state. */
export async function catalog(db:D1Database,q:CatalogQuery={},includeHidden=false,full=false):Promise<CatalogResponse>{
 const locale=await currentLocale();if(locale==='ru'||includeHidden)return rawCatalog(db,q,includeHidden,full);
 const dictionary=await publishedTranslations(db,locale);
 const baseQuery={...q,q:undefined,page:1,limit:48,transport:originalCatalogText(q.transport,dictionary),format:originalCatalogText(q.format,dictionary)};
 const raw=await rawCatalog(db,baseQuery,includeHidden,true);
 const allItems=[...raw.items];for(let sourcePage=2;sourcePage<=raw.pages;sourcePage++)allItems.push(...(await rawCatalog(db,{...baseQuery,page:sourcePage},includeHidden,true)).items);
 let items=allItems.map(item=>translateCatalog(item,locale,dictionary)).filter(item=>!item.missing.length).map(item=>item.value);
 if(q.q?.trim()){const terms=q.q.toLocaleLowerCase(locale).trim().split(/\s+/);items=items.filter(item=>{const text=JSON.stringify(item).toLocaleLowerCase(locale);return terms.every(term=>text.includes(term));});}
 if(q.sort==='title')items.sort((a,b)=>a.title.localeCompare(b.title,locale));
 const total=items.length,limit=Math.trunc(Math.min(Math.max(q.limit||12,1),48)),page=Math.min(Math.max(q.page||1,1),Math.max(1,Math.ceil(total/limit)));
 const destinations=raw.destinations.map(item=>translateCatalog(item,locale,dictionary)).filter(item=>!item.missing.length).map(item=>item.value);
 const facets=translateCatalog(raw.facets,locale,dictionary).value;
 // Query values remain source keys; UI translates their labels separately.
 facets.transports=raw.facets.transports;facets.formats=raw.facets.formats;
 return {...raw,items:items.slice((page-1)*limit,page*limit),destinations,facets,total,page,pages:Math.ceil(total/limit)};
}
export async function product(db:D1Database,slug:string,release?:string,includeHidden=false){const raw=await rawProduct(db,slug,release,includeHidden);if(!raw)return null;const locale=await currentLocale();if(locale==='ru'||includeHidden)return raw;const translated=translateCatalog(raw,locale,await publishedTranslations(db,locale));return translated.missing.length?null:translated.value;}
export async function destination(db:D1Database,slug:string){const raw=await rawDestination(db,slug);if(!raw)return null;const locale=await currentLocale();const translated=translateCatalog(raw,locale,await publishedTranslations(db,locale));return translated.missing.length?null:translated.value;}

export async function equivalentLocales(db:D1Database,path:string):Promise<import('../i18n/core').Locale[]>{
 const parsed=new URL(path,'https://catalog.invalid'),parts=parsed.pathname.split('/').filter(Boolean);let value:unknown=null;
 if(parts[0]==='tour'&&parts[1])value=await rawProduct(db,decodeURIComponent(parts[1]));
 else if(parts[0]==='destination'&&parts[1])value=await rawDestination(db,decodeURIComponent(parts[1]));
 else return ['ru','en','th'];
 if(!value)return [];const result:import('../i18n/core').Locale[]=['ru'];
 const related=parts[0]==='destination'?await rawCatalog(db,{destination:(value as Destination).id,limit:48},false,true):null;
 const relatedTours=related?[...related.items]:[];if(related)for(let page=2;page<=related.pages;page++)relatedTours.push(...(await rawCatalog(db,{destination:(value as Destination).id,limit:48,page},false,true)).items);
 for(const locale of ['en','th'] as const){const dictionary=await publishedTranslations(db,locale);if(translateCatalog(value,locale,dictionary).missing.length)continue;if(related&&!relatedTours.some(tour=>!translateCatalog(tour,locale,dictionary).missing.length))continue;result.push(locale);}return result;
}
export async function localizedSitemapPaths(db:D1Database){const source=await publishedLocalizationSources(db),paths:string[]=[];const {localePath}=await import('../i18n/core');for(const locale of ['ru','en','th'] as const){const dictionary=await publishedTranslations(db,locale);for(const path of ['/', '/destinations','/guide','/about','/privacy','/credits','/cheow-lan'])paths.push(localePath(path,locale));const tours=source.tours.filter(tour=>!translateCatalog(tour,locale,dictionary).missing.length);for(const tour of tours)paths.push(localePath('/tour/'+encodeURIComponent(tour.slug),locale));for(const destination of source.destinations){if(translateCatalog(destination,locale,dictionary).missing.length)continue;if(!tours.some(tour=>tour.status!=='temporarily_unavailable'&&tour.variants.some(v=>v.status!=='temporarily_unavailable'&&v.stops.some(s=>s.destinationId===destination.id))))continue;paths.push(localePath('/destination/'+encodeURIComponent(destination.slug),locale));}}return paths;}
export async function publishedLocalizationSources(db:D1Database){const all=await rawCatalog(db,{limit:48},false,true),tours=[...all.items];for(let page=2;page<=all.pages;page++){tours.push(...(await rawCatalog(db,{limit:48,page},false,true)).items);}return {tours,destinations:all.destinations,facets:all.facets};}
