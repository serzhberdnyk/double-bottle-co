import {releaseOwnershipValidSql} from './release-variant-ownership';
import {validateSplitLocales,type SplitLocaleDrafts} from './khaosok-split-locales';
import {cloneReleaseRows} from './catalog-release-copy';
import {prepareKhaosokSplit,KHAOSOK_STANDARD_PRODUCT,KHAOSOK_STANDARD_VARIANT,KHAOSOK_VIP_VARIANTS,type SplitEvidence} from './khaosok-split-plan';
type Row=Record<string,unknown>;
type Snapshot={rows:Row[];sql:string;args:unknown[];json:string};
async function digest(value:unknown){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),n=>n.toString(16).padStart(2,'0')).join('');}
const tables=['catalog_release_products','catalog_release_variants','catalog_variant_revisions','catalog_public_rates','internal_supply_bindings','catalog_variants'] as const;
async function snapshot(db:D1Database,table:typeof tables[number],where:string,args:unknown[],order:string):Promise<Snapshot>{
 const cols=(await db.prepare(`PRAGMA table_info("${table}")`).all<{name:string}>()).results.map(r=>r.name);
 if(!cols.length||cols.length>16||cols.some(c=>!/^[a-z_]+$/.test(c)))throw Error('SPLIT_SCHEMA_UNAVAILABLE');
 const sql=`SELECT json_group_array(json_object(${cols.map(c=>`'${c}',"${c}"`).join(',')})) FROM (SELECT * FROM "${table}" WHERE ${where} ORDER BY ${order})`;
 const r=await db.prepare(sql).bind(...args).first<Record<string,string>>();
 const json=r?Object.values(r)[0]:'[]';if(typeof json!=='string'||json.length>500000)throw Error('SPLIT_EVIDENCE_TOO_LARGE');
 return {sql,args,json,rows:JSON.parse(json)};
}
async function readEvidence(db:D1Database){
 const state=await db.prepare('SELECT release_id,generation FROM catalog_state WHERE id=1').first<{release_id:string;generation:number}>();if(!state?.release_id)throw Error('CATALOG_NOT_PUBLISHED');
 const ownedWhere='release_id=? AND COALESCE(product_id,(SELECT origin.product_id FROM catalog_variants origin WHERE origin.id=catalog_release_variants.variant_id))=?';
 const whereVariant='SELECT variant_id FROM catalog_release_variants WHERE '+ownedWhere;
 const whereRevision='SELECT revision_id FROM catalog_release_variants WHERE '+ownedWhere;
 const args=[state.release_id,KHAOSOK_STANDARD_PRODUCT];
 const snapshots=await Promise.all([
  snapshot(db,'catalog_release_products','release_id=? AND product_id=?',args,'product_id'),
  snapshot(db,'catalog_release_variants',ownedWhere,args,'variant_id'),
  snapshot(db,'catalog_variant_revisions',`id IN (${whereRevision})`,args,'id'),
  snapshot(db,'catalog_public_rates',`release_id=? AND variant_id IN (${whereVariant})`,[state.release_id,...args],'id'),
  snapshot(db,'internal_supply_bindings',`revision_id IN (${whereRevision})`,args,'id'),
  snapshot(db,'catalog_variants',`id IN (${whereVariant})`,args,'id')
 ]);
 if(snapshots[0].rows.length!==1)throw Error('SPLIT_PRODUCT_UNAVAILABLE');
 const effectiveVariantRows=snapshots[1].rows.map(row=>({...row,product_id:row.product_id??snapshots[5].rows.find(origin=>origin.id===row.variant_id)?.product_id}));
 return {state,snapshots,effectiveVariantRows,evidenceDigest:await digest({state,rows:snapshots.map(s=>s.rows)})};
}
export async function khaosokSplitPreview(db:D1Database){const e=await readEvidence(db);return {status:'read_only_evidence',state:e.state,evidenceDigest:e.evidenceDigest,product:e.snapshots[0].rows[0],variantRows:e.snapshots[1].rows,revisionRows:e.snapshots[2].rows,rateRows:e.snapshots[3].rows,bindingRows:e.snapshots[4].rows,variantIdentityRows:e.snapshots[5].rows,effectiveVariantRows:e.effectiveVariantRows};}
export type SplitRequest={expectedEvidenceDigest:string;sourceReferences:string[];vip:SplitEvidence['vip'];localeDrafts:SplitLocaleDrafts};
function validateInput(input:unknown):SplitRequest{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_SPLIT_INPUT');
 const p=input as SplitRequest;
 if(Object.keys(p).sort().join(',')!=='expectedEvidenceDigest,localeDrafts,sourceReferences,vip'||typeof p.expectedEvidenceDigest!=='string'||!/^[a-f0-9]{64}$/.test(p.expectedEvidenceDigest)||!Array.isArray(p.sourceReferences)||p.sourceReferences.length>20||p.sourceReferences.some(s=>typeof s!=='string'||s.length>2000)||!p.vip||Object.keys(p.vip).sort().join(',')!=='description,id,image,imageAlt,slug,sourceReference,title'||Object.values(p.vip).some(v=>typeof v!=='string'||v.length>10000))throw Error('INVALID_SPLIT_INPUT');
 return p;
}
/** Stage only: caller must separately review and publish this draft with existing generation guard. */
export async function stageKhaosokSplit(db:D1Database,input:unknown,actor:string){
 if(!actor||actor.length>200)throw Error('INVALID_SPLIT_ACTOR');
 const body=validateInput(input);await validateSplitLocales(body.vip,body.localeDrafts);const requestHash=await digest(body),releaseId='rel_split_'+requestHash.slice(0,24);
 const existing=await db.prepare('SELECT id,hash,status,base_id FROM catalog_releases WHERE id=?').bind(releaseId).first<Row>();
 if(existing){if(existing.hash!==requestHash||!['draft','published'].includes(String(existing.status)))throw Error('SPLIT_IDEMPOTENCY_CONFLICT');return {status:existing.status,releaseId,baseReleaseId:existing.base_id,idempotent:true};}
 const e=await readEvidence(db);if(e.evidenceDigest!==body.expectedEvidenceDigest)throw Error('CONFLICT_REFRESH_REQUIRED');
 const plan=prepareKhaosokSplit({releaseId:e.state.release_id,generation:e.state.generation,productId:KHAOSOK_STANDARD_PRODUCT,variantRows:e.effectiveVariantRows,revisionRows:e.snapshots[2].rows,rateRows:e.snapshots[3].rows,bindingRows:e.snapshots[4].rows,sourceReferences:body.sourceReferences,vip:body.vip});
 const vip=body.vip,base=e.snapshots[0].rows[0];
 if(await db.prepare('SELECT id FROM catalog_products WHERE id=? OR slug=?').bind(vip.id,vip.slug).first()||await db.prepare('SELECT product_id FROM catalog_redirects WHERE from_slug=?').bind(vip.slug).first())throw Error('SPLIT_PRODUCT_IDENTITY_CONFLICT');
 if(!await db.prepare('SELECT id FROM catalog_media WHERE path=?').bind(vip.image).first())throw Error('IMAGE_NOT_APPROVED');
 const now=new Date().toISOString(),summary={kind:'standard_vip_split',productsChanged:2,priceChanges:0,baseReleaseId:e.state.release_id,evidenceDigest:e.evidenceDigest,standardVariantIds:plan.standard.variantIds,vipVariantIds:plan.vip.variantIds,sourceReferences:body.sourceReferences,vipProductId:vip.id,sourceCopy:{title:vip.title,description:vip.description},localeDrafts:body.localeDrafts};
 // Recheck all captured preimages inside the SAME atomic D1 batch as staging.
 // NOT NULL(data_json) turns any stale preimage into a transaction rollback.
 const guards=["EXISTS(SELECT 1 FROM catalog_state WHERE id=1 AND release_id=? AND generation=?)",...e.snapshots.map(s=>`(${s.sql})=?`),"EXISTS(SELECT 1 FROM catalog_media WHERE path=?)","NOT EXISTS(SELECT 1 FROM catalog_redirects WHERE from_slug=?)"];
 const guardArgs:unknown[]=[e.state.release_id,e.state.generation];for(const s of e.snapshots)guardArgs.push(...s.args,s.json);guardArgs.push(vip.image,vip.slug);
 const statements=[db.prepare(`INSERT INTO internal_events(id,type,actor,created_at,data_json) VALUES (?,'split_stage',?,?,CASE WHEN ${guards.join(' AND ')} THEN ? ELSE NULL END)`).bind('event_'+releaseId,actor,now,...guardArgs,JSON.stringify(summary)),
 db.prepare("INSERT INTO catalog_releases(id,hash,status,base_id,created_at,created_by,summary_json) VALUES (?,?,'draft',?,?,?,?)").bind(releaseId,requestHash,e.state.release_id,now,actor,JSON.stringify(summary)),
 db.prepare('INSERT INTO catalog_products(id,slug) VALUES (?,?)').bind(vip.id,vip.slug)];
 for(const table of ['catalog_release_products','catalog_release_variants','catalog_release_destinations','catalog_public_rates'] as const)statements.push(await cloneReleaseRows(db,table,e.state.release_id,releaseId));
 statements.push(db.prepare('INSERT INTO catalog_release_products (release_id,product_id,slug,title,description,description_edited,category,image,image_alt,sale_status,publication_status,featured_rank) VALUES (?,?,?,?,?,1,?,?,?,?,?,?)').bind(releaseId,vip.id,vip.slug,vip.title,vip.description,base.category,vip.image,vip.imageAlt,base.sale_status,base.publication_status,Number(base.featured_rank)+1));
 statements.push(db.prepare('UPDATE catalog_release_variants SET product_id=? WHERE release_id=? AND COALESCE(product_id,(SELECT origin.product_id FROM catalog_variants origin WHERE origin.id=catalog_release_variants.variant_id))=? AND variant_id IN (?,?)').bind(vip.id,releaseId,KHAOSOK_STANDARD_PRODUCT,...KHAOSOK_VIP_VARIANTS));
 statements.push(db.prepare(`INSERT INTO internal_events(id,type,actor,created_at,data_json) VALUES (?,'split_owner_validation',?,?,CASE WHEN ${releaseOwnershipValidSql()} THEN '{}' ELSE NULL END)`).bind('owner_'+releaseId,actor,now,releaseId));
 await db.batch(statements);
 const owners=(await db.prepare('SELECT variant_id,COALESCE(product_id,(SELECT origin.product_id FROM catalog_variants origin WHERE origin.id=catalog_release_variants.variant_id)) AS product_id FROM catalog_release_variants WHERE release_id=? AND variant_id IN (?,?,?) ORDER BY variant_id').bind(releaseId,KHAOSOK_STANDARD_VARIANT,...KHAOSOK_VIP_VARIANTS).all<{variant_id:string;product_id:string}>()).results;
 if(owners.length!==3||owners.some(r=>r.product_id!==(r.variant_id===KHAOSOK_STANDARD_VARIANT?KHAOSOK_STANDARD_PRODUCT:vip.id)))throw Error('SPLIT_READBACK_FAILED');
 return {status:'draft',releaseId,baseReleaseId:e.state.release_id,expectedGeneration:e.state.generation,owners,idempotent:false,publicCatalogChanged:false};
}
