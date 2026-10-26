import {companyNames,adminCompanyChoices,type ServiceCompanies,type ServiceCompanyRefs} from '../public/admin-service-sort';
// Existing variant bindings supply stable IDs and labels. Include earlier revisions of the
// same variant so a content-only revision does not lose its company association.
export async function adminServiceCompanyRefs(db:D1Database,releaseId:string):Promise<ServiceCompanyRefs>{
 const rows=await db.prepare(`SELECT DISTINCT COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) AS product_id,s.id AS supplier_id,s.name
  FROM catalog_release_variants rv
  JOIN catalog_variants v ON v.id=rv.variant_id
  JOIN catalog_variant_revisions revision ON revision.variant_id=v.id
  JOIN internal_supply_bindings binding ON binding.revision_id=revision.id
  JOIN internal_supplier_offers offer ON offer.id=binding.offer_id
  JOIN internal_suppliers s ON s.id=offer.supplier_id
  WHERE rv.release_id=?`).bind(releaseId).all<{product_id:string;supplier_id:string;name:string}>();
 const result:ServiceCompanyRefs={};
 for(const row of rows.results)(result[row.product_id]??=[]).push({id:row.supplier_id,name:row.name.trim()||'Компания без названия'});
 for(const id of Object.keys(result))result[id]=adminCompanyChoices([{id}],result);
 return result;
}
export async function adminServiceCompanies(db:D1Database,releaseId:string):Promise<ServiceCompanies>{
 return Object.fromEntries(Object.entries(await adminServiceCompanyRefs(db,releaseId)).map(([id,companies])=>[id,companyNames(companies.map(c=>c.name))]));
}
