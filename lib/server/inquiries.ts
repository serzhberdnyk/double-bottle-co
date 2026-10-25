import {z} from 'zod';
import {hash,uuid} from './management';
import {product,activeState} from './catalog';
import {rateSelection,publicQuote,todayInThailand} from '../public/pricing';

const identifier = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const inputSchema = z.object({
 productId:identifier,variantId:identifier,revisionId:identifier,releaseId:identifier,priceOptionKey:identifier.optional(),
 date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 adults:z.number().int().min(1).max(50),children:z.number().int().min(0).max(30),
 childrenAges:z.string().max(120),name:z.string().trim().min(1).max(100),
 contact:z.string().trim().min(5).max(160),note:z.string().max(1200),
 consent:z.literal(true),website:z.literal('').optional(),
 expectedRates:z.array(z.object({id:identifier,amountMinor:z.number().int().positive(),
 currency:z.string().regex(/^[A-Z]{3}$/)}).strict()).max(30),
}).strict();

export async function saveInquiry(db:D1Database,body:unknown,owner:string,key:string,ipHash:string){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(key)||!owner)throw new Error('INVALID_KEY');
 const parsed=inputSchema.safeParse(body);if(!parsed.success)throw new Error('INVALID_INPUT');
 const input=parsed.data;
 const parsedDate=Date.parse(input.date),today=todayInThailand();
 if(!Number.isFinite(parsedDate)||new Date(parsedDate).toISOString().slice(0,10)!==input.date
   ||input.date<today||input.date>todayInThailand(new Date(Date.now()+730*864e5)))throw new Error('INVALID_DATE');
 input.expectedRates.sort((a,b)=>a.id.localeCompare(b.id));
 const digest=await hash(input);
 const replay=async()=>{const row=await db.prepare('SELECT id,request_hash FROM operations_inquiries WHERE owner_hash=? AND idempotency_key=?').bind(owner,key).first<{id:string;request_hash:string}>();
  if(!row)return null;if(row.request_hash!==digest)throw new Error('IDEMPOTENCY_CONFLICT');return{id:row.id,replayed:true};};
 const existing=await replay();if(existing)return existing;
 const state=await activeState(db);
 const p=await db.prepare("SELECT COALESCE(NULLIF(rp.slug,''),p.slug) AS slug FROM catalog_products p JOIN catalog_release_products rp ON rp.product_id=p.id WHERE p.id=? AND rp.release_id=? AND rp.publication_status='published'").bind(input.productId,state.release_id).first<{slug:string}>();
 if(!p)throw new Error('VARIANT_UNAVAILABLE');
 const data=await product(db,p.slug,state.release_id),originalVariant=data?.tour.variants.find(v=>v.id===input.variantId);
 const options=originalVariant?.priceOptions||[],option=options.find(o=>o.key===input.priceOptionKey)||(options.length===1&&!input.priceOptionKey?options[0]:null);
 if((options.length&&!option)||(input.priceOptionKey&&!option))throw new Error('INVALID_PRICE_OPTION');
 const v=originalVariant?(option?{...originalVariant,rates:originalVariant.rates.filter(r=>r.optionKey===option.key)}:originalVariant):null;
 if(!data||!v||data.tour.status==='temporarily_unavailable'||v.status==='temporarily_unavailable'||v.visible===false)throw new Error('VARIANT_UNAVAILABLE');
 if(v.revisionId!==input.revisionId||state.release_id!==input.releaseId)throw new Error('CATALOG_CHANGED');
 if((v.earliestDate&&input.date<v.earliestDate)||(option?.serviceDateFrom&&input.date<option.serviceDateFrom))throw new Error('DATE_NOT_YET_OPEN');
 if(option?.serviceDateUntil&&input.date>option.serviceDateUntil)throw new Error('INVALID_DATE');
 if(JSON.stringify(rateSelection(v.rates,input.date))!==JSON.stringify(input.expectedRates))throw new Error('PRICE_CHANGED');
 const hour=Math.floor(Date.now()/36e5),throttleKey=ipHash+':'+hour;
 await db.prepare('INSERT INTO operations_throttle (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(throttleKey,(hour+2)*36e5).run();
 const id='inq_'+uuid(),now=new Date().toISOString(),pricing=publicQuote(v.rates,input.date,input.adults,input.children,input.childrenAges,option);
 const snapshot={productId:data.tour.id,productTitle:data.tour.title,variantId:v.id,revisionId:v.revisionId,
  variantName:v.name,releaseId:state.release_id,generation:state.generation,createdAt:now,date:input.date,
  adults:input.adults,children:input.children,childrenAges:input.childrenAges,selectedOptions:option?[{...option}]:[],
  pricing,publicRates:pricing.rates,currency:pricing.currency,publicTotalMinor:pricing.totalMinor,
  itinerary:v.itinerary,stops:v.stops,includes:v.includes,extras:v.extras,conditions:v.conditions,
  status:'inquiry',confirmation:'Дата и цена требуют подтверждения менеджером'};
 // Publication generation, current visibility and insertion are checked by ONE SQL statement.
 // A publication/rollback racing the reads cannot create an inquiry for stale terms.
 const result=await db.prepare(`INSERT INTO operations_inquiries
  (id,owner_hash,idempotency_key,request_hash,status,created_at,snapshot_json,contact_json)
  SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (
   SELECT 1 FROM catalog_state st
   JOIN catalog_release_products rp ON rp.release_id=st.release_id
   JOIN catalog_release_variants rv ON rv.release_id=st.release_id AND COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id))=rp.product_id
   WHERE st.id=1 AND st.release_id=? AND st.generation=? AND rp.product_id=?
    AND rp.publication_status='published' AND rp.sale_status<>'temporarily_unavailable'
    AND rv.visible=1 AND rv.variant_id=? AND rv.revision_id=? AND rv.sale_status<>'temporarily_unavailable')
  AND EXISTS (SELECT 1 FROM operations_throttle WHERE key=? AND count<=8)
  ON CONFLICT(owner_hash,idempotency_key) DO NOTHING`)
  .bind(id,owner,key,digest,'new',now,JSON.stringify(snapshot),
   JSON.stringify({name:input.name,contact:input.contact,note:input.note,consentedAt:now}),
   state.release_id,state.generation,input.productId,v.id,v.revisionId,throttleKey).run();
 if(result.meta.changes!==1){
  const same=await replay();if(same)return same;
  const count=await db.prepare('SELECT count FROM operations_throttle WHERE key=?').bind(throttleKey).first<{count:number}>();
  if((count?.count||0)>8)throw new Error('RATE_LIMITED');
  throw new Error('CATALOG_CHANGED');
 }
 return{id,replayed:false};
}
export async function inquiryStatus(db:D1Database,id:string,owner:string){return db.prepare('SELECT id,status,created_at FROM operations_inquiries WHERE id=? AND owner_hash=?').bind(id,owner).first();}
export async function recordOffer(db:D1Database,inquiryId:string,terms:Record<string,unknown>,execution:Record<string,unknown>,actor:string,kind:'offer'|'confirmed_order'){
 const inquiry=await db.prepare('SELECT id,snapshot_json FROM operations_inquiries WHERE id=?').bind(inquiryId).first<any>();if(!inquiry)throw new Error('NOT_FOUND');
 if(typeof terms.currency!=='string'||!/^[A-Z]{3}$/.test(terms.currency)||!Number.isSafeInteger(terms.totalMinor)||Number(terms.totalMinor)<=0||!terms.confirmation||!terms.cancellation||!execution.bindingId||(kind==='confirmed_order'&&!terms.consentReference))throw new Error('INCOMPLETE_CONFIRMED_TERMS');
 const original=JSON.parse(inquiry.snapshot_json);const binding=await db.prepare("SELECT id,revision_id,offer_id FROM internal_supply_bindings WHERE id=? AND status='approved' AND valid_from<=? AND (valid_until IS NULL OR valid_until>=?)").bind(execution.bindingId,original.date,original.date).first<any>();if(!binding||binding.revision_id!==original.revisionId)throw new Error('EXECUTION_NOT_APPROVED');
 const id='ord_'+uuid();await db.prepare('INSERT INTO operations_orders (id,inquiry_id,kind,snapshot_json,execution_json,created_at,created_by) VALUES (?,?,?,?,?,?,?)').bind(id,inquiryId,kind,JSON.stringify({...original,agreedTerms:terms}),JSON.stringify({binding,execution}),new Date().toISOString(),actor).run();return {id};
}

export async function amendOrder(db:D1Database,orderId:string,terms:Record<string,unknown>,execution:Record<string,unknown>,actor:string){
 const order=await db.prepare("SELECT id,snapshot_json FROM operations_orders WHERE id=? AND kind='confirmed_order'").bind(orderId).first<any>();if(!order)throw new Error('ORDER_NOT_FOUND');
 if(typeof terms.currency!=='string'||!/^[A-Z]{3}$/.test(terms.currency)||!Number.isSafeInteger(terms.totalMinor)||Number(terms.totalMinor)<=0||!terms.confirmation||!terms.cancellation||!terms.consentReference)throw new Error('NEW_CONSENT_REQUIRED');
 const original=JSON.parse(order.snapshot_json);const binding=await db.prepare("SELECT id,revision_id,offer_id FROM internal_supply_bindings WHERE id=? AND status='approved' AND valid_from<=? AND (valid_until IS NULL OR valid_until>=?)").bind(execution.bindingId,original.date,original.date).first<any>();if(!binding||binding.revision_id!==original.revisionId)throw new Error('EXECUTION_NOT_APPROVED');
 const snapshot={...original,agreedTerms:terms,execution:{binding},amendsOrder:orderId};const id='amend_'+(await hash({orderId,terms,execution})).slice(0,32),stamp=new Date().toISOString();
 await db.prepare('INSERT INTO operations_order_events (id,order_id,type,snapshot_json,consent_ref,created_at,actor) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,orderId,'agreed_amendment',JSON.stringify(snapshot),String(terms.consentReference),stamp,actor).run();return{id};
}
