import {khaosokSplitPreview} from './khaosok-split-action';
import {KHAOSOK_STANDARD_PRODUCT,KHAOSOK_STANDARD_VARIANT,KHAOSOK_VIP_VARIANTS} from './khaosok-split-plan';
type Row=Record<string,any>;
export async function splitDraftReadback(db:D1Database,id:string){
 if(!/^rel_split_[a-f0-9]+$/.test(id))throw Error('INVALID_SPLIT_RELEASE');
 const release=await db.prepare('SELECT id,status,base_id,summary_json FROM catalog_releases WHERE id=?').bind(id).first<Row>();
 if(!release||release.status!=='draft')throw Error('SPLIT_DRAFT_REQUIRED');
 const summary=JSON.parse(release.summary_json),before=await khaosokSplitPreview(db);
 if(summary.kind!=='standard_vip_split'||release.base_id!==before.state.release_id||summary.evidenceDigest!==before.evidenceDigest)throw Error('CONFLICT_REFRESH_REQUIRED');
 const ids=[KHAOSOK_STANDARD_VARIANT,...KHAOSOK_VIP_VARIANTS];
 const variants=(await db.prepare('SELECT * FROM catalog_release_variants WHERE release_id=? AND variant_id IN (?,?,?) ORDER BY variant_id').bind(id,...ids).all<Row>()).results;
 const rates=(await db.prepare('SELECT * FROM catalog_public_rates WHERE release_id=? AND variant_id IN (?,?,?) ORDER BY id').bind(id,...ids).all<Row>()).results;
 const canonical=(rows:Row[],omit:string[])=>JSON.stringify(rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!omit.includes(key)).sort(([a],[b])=>a.localeCompare(b)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 const owner=(v:Row)=>v.product_id??before.variantIdentityRows.find(x=>x.id===v.variant_id)?.product_id;
 const owners=variants.length===3&&variants.every(v=>owner(v)===(v.variant_id===KHAOSOK_STANDARD_VARIANT?KHAOSOK_STANDARD_PRODUCT:summary.vipProductId));
 const preserved=canonical(variants,['release_id','product_id'])===canonical(before.variantRows,['release_id','product_id'])&&canonical(rates,['release_id','id'])===canonical(before.rateRows,['release_id','id']);
 if(!owners||!preserved)throw Error('SPLIT_READBACK_FAILED');
 return {releaseId:id,expectedGeneration:before.state.generation,checks:{owners:true,prices:true,visibility:true,revisions:true},variants:variants.map(v=>({id:v.variant_id,owner:owner(v),visible:v.visible,revision:v.revision_id})),rates,publicCatalogChanged:false};
}
