import {companyNames,type ServiceCompanies} from '../public/admin-service-sort';
// Existing variant bindings supply labels only. Include earlier revisions of the
// same variant so a content-only revision does not lose its company association.
export async function adminServiceCompanies(db:D1Database,releaseId:string):Promise<ServiceCompanies>{
 const rows=await db.prepare(`SELECT DISTINCT COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) AS product_id,s.name
  FROM catalog_release_variants rv
  JOIN catalog_variants v ON v.id=rv.variant_id
  JOIN catalog_variant_revisions revision ON revision.variant_id=v.id
  JOIN internal_supply_bindings binding ON binding.revision_id=revision.id
  JOIN internal_supplier_offers offer ON offer.id=binding.offer_id
  JOIN internal_suppliers s ON s.id=offer.supplier_id
  WHERE rv.release_id=?`).bind(releaseId).all<{product_id:string;name:string}>();
 const result:ServiceCompanies={};
 for(const row of rows.results)(result[row.product_id]??=[]).push(row.name);
 for(const id of Object.keys(result))result[id]=companyNames(result[id]);
 return result;
}
