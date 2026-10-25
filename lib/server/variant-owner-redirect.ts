/** Resolve only a moved variant's original product URL, not arbitrary cross-product IDs. */
export async function movedVariantSlug(db:D1Database,slug:string,variant:unknown){
 if(typeof variant!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(variant))return null;
 return db.prepare(`SELECT COALESCE(NULLIF(rp.slug,''),target.slug) AS slug
 FROM catalog_variants v JOIN catalog_products origin ON origin.id=v.product_id
 JOIN catalog_state st ON st.id=1
 JOIN catalog_release_variants rv ON rv.release_id=st.release_id AND rv.variant_id=v.id
 JOIN catalog_products target ON target.id=COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id))
 JOIN catalog_release_products rp ON rp.release_id=rv.release_id AND rp.product_id=COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id))
 WHERE v.id=? AND origin.slug=? AND COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id))<>v.product_id
 AND rv.visible=1 AND rp.publication_status='published'`).bind(variant,slug).first<{slug:string}>();
}
export function variantRedirectPath(slug:string,query:Record<string,string|string[]|undefined>){
 const params=new URLSearchParams();
 for(const key of ['variant','priceOption'])if(typeof query[key]==='string')params.set(key,query[key]);
 return '/tour/'+encodeURIComponent(slug)+(params.size?'?'+params:'');
}
