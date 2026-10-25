/** Non-mutating preparation only. This module never executes SQL or publishes. */
export const KHAOSOK_STANDARD_PRODUCT='p_f60658ace81d54048d0d6a8a';
export const KHAOSOK_STANDARD_VARIANT='v_42a96f1ff0b65f9d9f21c556';
export const KHAOSOK_VIP_VARIANTS=['v_51a937035c3d5d20919f9c49','v_ea14b26d9c485ba0897f3362'] as const;
type Row=Record<string,unknown>;
export type SplitEvidence={releaseId:string;generation:number;productId:string;variantRows:Row[];revisionRows:Row[];rateRows:Row[];bindingRows:Row[];sourceReferences:string[];vip:{id:string;slug:string;title:string;description:string;image:string;imageAlt:string;sourceReference:string}};
const id=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
export function prepareKhaosokSplit(e:SplitEvidence){
 if(!e||!id(e.releaseId)||!Number.isSafeInteger(e.generation)||e.generation<0||e.productId!==KHAOSOK_STANDARD_PRODUCT)throw Error('INVALID_SPLIT_EVIDENCE');
 const expected=[KHAOSOK_STANDARD_VARIANT,...KHAOSOK_VIP_VARIANTS];
 if(!Array.isArray(e.variantRows)||e.variantRows.length!==3||new Set(e.variantRows.map(r=>r.variant_id)).size!==3||e.variantRows.some(r=>!expected.includes(String(r.variant_id))||r.release_id!==e.releaseId||r.product_id!==e.productId||!id(r.revision_id)))throw Error('SPLIT_MEMBERSHIP_CONFLICT');
 const revisions=e.variantRows.map(r=>r.revision_id);
 if(!Array.isArray(e.revisionRows)||e.revisionRows.length!==3||new Set(e.revisionRows.map(r=>r.id)).size!==3||e.revisionRows.some(r=>!revisions.includes(r.id)||!e.variantRows.some(v=>v.variant_id===r.variant_id&&v.revision_id===r.id)))throw Error('SPLIT_REVISION_CONFLICT');
 if(!Array.isArray(e.rateRows)||e.rateRows.some(r=>r.release_id!==e.releaseId||!expected.includes(String(r.variant_id))))throw Error('SPLIT_RATES_INCOMPLETE');
 if(!Array.isArray(e.bindingRows)||e.bindingRows.some(r=>!revisions.includes(r.revision_id))||!Array.isArray(e.sourceReferences)||!e.sourceReferences.length||e.sourceReferences.some(x=>typeof x!=='string'||!x.trim()))throw Error('SPLIT_SOURCE_EVIDENCE_MISSING');
 const p=e.vip;
 if(!p||!id(p.id)||p.id===e.productId||!p.slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)||p.slug==='khao-sok'||![p.title,p.description,p.image,p.imageAlt,p.sourceReference].every(x=>typeof x==='string'&&x.trim()))throw Error('VIP_PUBLIC_CONTENT_UNRESOLVED');
 const original=structuredClone(e);
 return {status:'dry_run_only' as const,expectedReleaseId:e.releaseId,expectedGeneration:e.generation,standard:{productId:e.productId,variantIds:[KHAOSOK_STANDARD_VARIANT]},vip:{...structuredClone(p),variantIds:[...KHAOSOK_VIP_VARIANTS]},preserve:{variantIds:expected,revisionRows:original.revisionRows,rateRows:original.rateRows,bindingRows:original.bindingRows},before:original,requiredBeforeApply:['Re-read evidence and compare exact preimages','Verify new product identity/slug are unused and image is approved','Clone release and update release-local ownership in one guarded transaction','Keep all old releases and inquiry/order snapshots unchanged','Publish only with expected generation; read back both cards and preserved values']};
}
