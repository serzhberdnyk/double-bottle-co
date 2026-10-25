import programs from '../../content/approved-eight/programs.json' with {type:'json'};
import {hash,type ImportPacket,type ImportTour} from './management';
import {activeState} from './catalog';
import type {Rate,Variant} from '../public/types';
type Row=Record<string,any>;
export const supplierId='supplier_ea45eb0bd2095e91abc386cf';
const matches:Record<string,[string,string]>={
 'AT-PNG-SKY':['p_e340acb314a559f4b49a6e22','v_71922332029552a0bbe613cf'],
 'AT-PNG-VIP':['p_e340acb314a559f4b49a6e22','v_00d8c531ec5b54d09dcbad0e'],
 'AT-4P-DLX-2D1N':['p_1cdc3b7fc1625ada979ad010','v_2e6aed6250e85a4f9ec6d3c6'],
 'AT-SIM-1D':['p_dd70e1051d36596481a18438','v_8b58f2a25672504db4722f01'],
};
const slugs:Record<string,string>={'AT-KS-1D':'a-time-khao-sok-cheow-lan-day','AT-CITY-AB':'a-time-phuket-city','AT-KL-SAFARI-1D':'a-time-khao-lak-safari','AT-TTOA-1D':'a-time-treasures-andaman'};
export const brochureCaption='Цена из буклета. Срок действия не указан.';
export function brochureImages(programId:string){const p=programs.find(p=>p.id===programId);if(!p)return [];const stem=p.card.image.split('/').at(-1)!.replace(/\.[^.]+$/,'').toLowerCase();return ['/media/atime-'+stem+'.jpg','/media/atime-'+stem+'1.jpg'];}
export async function currentImportPacket(db:D1Database):Promise<{packet:ImportPacket;state:{release_id:string;generation:number}}>{
 const state=await activeState(db),release=state.release_id;
 const [products,variants,rates,stops,destinations,media,supply]=await Promise.all([
  db.prepare('SELECT * FROM catalog_release_products WHERE release_id=?').bind(release).all<Row>(),
  db.prepare('SELECT rev.*,COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) AS product_id,rv.sale_status,COALESCE(rv.name_override,rev.name) AS name FROM catalog_release_variants rv JOIN catalog_variants v ON v.id=rv.variant_id JOIN catalog_variant_revisions rev ON rev.id=rv.revision_id WHERE rv.release_id=?').bind(release).all<Row>(),
  db.prepare('SELECT * FROM catalog_public_rates WHERE release_id=?').bind(release).all<Row>(),
  db.prepare('SELECT DISTINCT s.* FROM catalog_itinerary_stops s JOIN catalog_release_variants rv ON rv.revision_id=s.revision_id WHERE rv.release_id=?').bind(release).all<Row>(),
  db.prepare('SELECT * FROM catalog_release_destinations WHERE release_id=?').bind(release).all<Row>(),
  db.prepare('SELECT * FROM catalog_media').all<Row>(),
  db.prepare('SELECT COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) AS product_id,s.id AS supplier_id,s.name,o.* FROM catalog_release_variants rv JOIN catalog_variant_revisions r ON r.variant_id=rv.variant_id JOIN internal_supply_bindings b ON b.revision_id=r.id JOIN internal_supplier_offers o ON o.id=b.offer_id JOIN internal_suppliers s ON s.id=o.supplier_id WHERE rv.release_id=? ORDER BY o.checked_at DESC,o.id').bind(release).all<Row>(),
 ]);
 const packet:ImportPacket={schemaVersion:1,complete:true,source:'Current catalog + approved A-Time brochures 2026-10-22',checkedAt:'2026-10-22',
  destinations:destinations.results.map(d=>({id:d.destination_id,slug:d.slug,name:d.name,lat:d.lat_micro/1e6,lng:d.lng_micro/1e6,region:d.region,description:d.description,image:d.image})),
  media:media.results.map(m=>({id:m.id,path:m.path,license:m.license,attribution:m.attribution,sourceUrl:m.source_url})),products:[]};
 for(const p of products.results){const s=supply.results.find(s=>s.product_id===p.product_id);if(!s)throw Error('SUPPLIER_ASSOCIATION_MISSING: '+p.product_id);
  const vv=variants.results.filter(v=>v.product_id===p.product_id).map(v=>{const terms=JSON.parse(v.terms_json);return {id:v.variant_id,revisionId:v.id,name:v.name,description:terms.description||'',duration:v.duration,days:v.days,transport:v.transport,format:v.format,status:v.sale_status,
   itinerary:terms.itinerary||[],includes:terms.includes||[],extras:terms.extras||[],conditions:terms.conditions||[],earliestDate:terms.earliestDate||null,...(terms.priceOptions?.length?{priceOptions:terms.priceOptions}:{}),
   stops:stops.results.filter(s=>s.revision_id===v.id).map(s=>({destinationId:s.destination_id,sequence:s.sequence,visitType:s.visit_type,required:!!s.required,note:s.note})),
   rates:rates.results.filter(r=>r.variant_id===v.variant_id).map(r=>({id:r.id,...(r.option_key?{optionKey:r.option_key}:{}),amountMinor:r.amount_minor,currency:r.currency,unit:r.unit,audience:r.audience,validFrom:r.valid_from,validUntil:r.valid_until,conditions:r.conditions,supplements:JSON.parse(r.supplements_json)}))} as Variant;});
  packet.products.push({id:p.product_id,slug:p.slug,title:p.title,description:p.description,descriptionEdited:!!p.description_edited,category:p.category,image:p.image,imageAlt:p.image_alt,status:p.sale_status,featuredRank:p.featured_rank,publicationStatus:p.publication_status,variants:vv,
   provenance:{sourceId:s.source_id,source:'Preserved current source',checkedAt:s.checked_at,hash:s.source_hash},supplier:{id:s.supplier_id,name:s.name,offerId:s.id,raw:JSON.parse(s.facts_json)}});
 }
 return {packet,state};
}
export function mergeApprovedEight(input:ImportPacket){
 const packet=structuredClone(input),conflicts:unknown[]=[],mapping:unknown[]=[];
 for(const p of programs){
  const match=matches[p.id];let product=match?packet.products.find(t=>t.id===match[0]):packet.products.find(t=>t.id==='p_'+p.id.toLowerCase().replaceAll('-','_'));
  if(match&&(!product||product.supplier.id!==supplierId||!product.variants.some(v=>v.id===match[1])))throw Error('EXACT_PROVIDER_VARIANT_MISMATCH: '+p.id);
  if(!product){const slug=slugs[p.id];if(packet.products.some(t=>t.slug===slug))throw Error('SLUG_IN_USE: '+slug);
   product={id:'p_'+p.id.toLowerCase().replaceAll('-','_'),slug,title:p.title,description:p.title,descriptionEdited:true,category:['AT-KS-1D','AT-KL-SAFARI-1D'].includes(p.id)?'nature':p.id==='AT-CITY-AB'?'culture':'sea',image:brochureImages(p.id)[0],imageAlt:'DEMO: синтетический образец: '+p.title,status:'on_request',featuredRank:20,publicationStatus:'published',variants:[],provenance:{sourceId:p.id,source:'A-Time brochure',checkedAt:'2026-10-22',hash:''},supplier:{id:supplierId,name:'A-Time',offerId:'offer_'+p.id.replaceAll('-','_'),raw:{}}};packet.products.push(product);
  }
  product.publicationStatus='published';product.status='on_request';
  const brochureFacts=(product.supplier.raw&&typeof product.supplier.raw==='object'?product.supplier.raw:{}) as Row;
  product.supplier.raw={...brochureFacts,approvedBrochures:{...(brochureFacts.approvedBrochures||{}),[p.id]:p}};
  const sourceVariants=p.variants.length?p.variants:[{id:'main',label:match?product.variants.find(v=>v.id===match[1])!.name:p.title,adult:p.brochurePrice.adult,child:p.brochurePrice.child,childAge:p.brochurePrice.childAge}];
  for(const sv of sourceVariants){const id=match?match[1]:'v_'+p.id.toLowerCase().replaceAll('-','_')+'_'+sv.id.toLowerCase(),old=product.variants.find(v=>v.id===id);
   const priceKey=old?.priceOptions?.[0]?.key;
   const childAge=sv.childAge.replace(/\s*лет$/,'');
   const newRates:Rate[]=[{id:id+'_adult',audience:'adult',amountMinor:sv.adult*100,unit:'за взрослого'},{id:id+'_child',audience:'child',amountMinor:sv.child*100,unit:'за ребёнка '+childAge+' лет'}].map(r=>({...r,currency:'THB',validFrom:'2026-10-22',validUntil:null,conditions:brochureCaption,supplements:[],...(priceKey?{optionKey:priceKey}:{})}));
   const preserved=!!old?.rates.length;
   if(preserved&&old!.rates.some(r=>newRates.find(n=>n.audience===r.audience)?.amountMinor!==r.amountMinor))conflicts.push({program:p.id,variant:id,kept:old!.rates.map(r=>({amountMinor:r.amountMinor,currency:r.currency,unit:r.unit,option:r.optionKey})),brochure:newRates.map(r=>({amountMinor:r.amountMinor,currency:r.currency,unit:r.unit}))});
   const publicExtras=p.extras.map(s=>s.includes('конфликт')?'Условия депозита Skywalk уточняются.':s);
   const publicIncludes=p.included.map(s=>s.includes('сохранить разницу')?'Язык гида уточняется.':s);
   const itinerary=p.itinerary.filter(([time])=>p.id!=='AT-CITY-AB'||time.startsWith(sv.id)).map(([time,text])=>(p.id==='AT-CITY-AB'?time.slice(1):time)+' · '+text);
   const next:Variant={id,revisionId:'',name:sv.label,description:p.title,duration:p.id==='AT-CITY-AB'?(sv.id==='A'?'6 часов':'8 часов'):p.duration,days:p.id==='AT-4P-DLX-2D1N'?2:1,transport:['AT-SIM-1D','AT-TTOA-1D','AT-4P-DLX-2D1N'].includes(p.id)?'Скоростная лодка':'Минивэн',format:'Групповая',status:'on_request',stops:old?.stops||[],itinerary:p.id==='AT-4P-DLX-2D1N'&&old?.itinerary.length?old.itinerary:itinerary,includes:publicIncludes,extras:publicExtras,conditions:[...p.restrictions,...(p.id==='AT-CITY-AB'&&sv.id==='B'?['Воскресенье. Минимум 6 человек.']:[]),...(!preserved?[brochureCaption]:[])],rates:preserved?old!.rates:newRates,earliestDate:old?.earliestDate||null,...(old?.priceOptions?{priceOptions:old.priceOptions}:{})};
   const i=product.variants.findIndex(v=>v.id===id);if(i<0)product.variants.push(next);else product.variants[i]=next;
   mapping.push({program:p.id,product:product.id,slug:product.slug,variant:id,existing:!!old,ratesPreserved:preserved});
  }
  for(const image of brochureImages(p.id))if(!packet.media.some(m=>m.path===image))packet.media.push({id:'media_'+image.split('/').at(-1)!.replaceAll('.','_').replaceAll('-','_'),path:image,license:'Synthetic DEMO placeholder for this public source export; not an operator brochure',attribution:'Original code-generated DEMO placeholder; contains no operator artwork',sourceUrl:'synthetic-demo-placeholder / '+p.id});
 }
 return {packet,conflicts,mapping};
}
export async function prepareApprovedEight(db:D1Database){const {packet:base,state}=await currentImportPacket(db),merged=mergeApprovedEight(base);for(const t of merged.packet.products)if((t.supplier.raw as Row)?.approvedBrochures){t.provenance.hash=await hash(t.supplier.raw);t.provenance.checkedAt='2026-10-22';t.provenance.source='A-Time brochures received 2026-10-22';}const alreadyImported=programs.every(p=>base.products.some(t=>(t.supplier.raw as Row)?.approvedBrochures?.[p.id]));return {...merged,state,alreadyImported,digest:await hash(merged.packet)};}
