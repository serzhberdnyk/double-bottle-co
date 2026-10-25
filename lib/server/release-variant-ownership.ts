/** Release-local ownership is additive: NULL means the immutable origin owner.
 * Never backfill or rewrite catalog_variants.product_id; old writers and old
 * releases may legitimately retain NULL. New explicit owners override origin.
 */
export function releaseOwnershipValidSql(){
 return `NOT EXISTS (SELECT 1 FROM catalog_release_variants owned
 LEFT JOIN catalog_variants identity ON identity.id=owned.variant_id
 LEFT JOIN catalog_release_products owner ON owner.release_id=owned.release_id AND owner.product_id=COALESCE(owned.product_id,identity.product_id)
 LEFT JOIN catalog_variant_revisions revision ON revision.id=owned.revision_id AND revision.variant_id=owned.variant_id
 WHERE owned.release_id=? AND (identity.id IS NULL OR owner.product_id IS NULL OR revision.id IS NULL))`;
}
export async function assertReleaseOwnership(db:D1Database,release:string){
 const row=await db.prepare(`SELECT ${releaseOwnershipValidSql()} AS valid`).bind(release).first<{valid:number}>();
 if(row?.valid!==1)throw Error('INVALID_RELEASE_VARIANT_OWNER');
}
