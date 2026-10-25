/** Only fixed internal aliases are accepted by callers; never pass request input.
 * Old published URLs respect both current variant visibility and the current
 * effective owner's archived status, even after release-local ownership moves.
 * Admin callers explicitly bypass these checks, retaining all editable records.
 */
export function variantPublication(alias:string,includeHidden=false):string {
 return includeHidden?'1=1':`${alias}.visible=1 AND NOT EXISTS (
 SELECT 1 FROM catalog_release_variants current_variant
 JOIN catalog_state current_state ON current_state.release_id=current_variant.release_id AND current_state.id=1
 LEFT JOIN catalog_variants current_identity ON current_identity.id=current_variant.variant_id
 LEFT JOIN catalog_release_products current_owner ON current_owner.release_id=current_variant.release_id AND current_owner.product_id=COALESCE(current_variant.product_id,current_identity.product_id)
 WHERE current_variant.variant_id=${alias}.variant_id AND (current_variant.visible=0 OR current_owner.publication_status='archived'))`;
}
