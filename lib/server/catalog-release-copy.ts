/** Copy raw release-local owners, including legacy NULLs; never rewrite history. */
export async function cloneReleaseRows(db:D1Database,table:'catalog_release_products'|'catalog_release_variants'|'catalog_release_destinations'|'catalog_public_rates',base:string,next:string){
 const cols=(await db.prepare(`PRAGMA table_info("${table}")`).all<{name:string}>()).results.map(x=>x.name);
 const args:unknown[]=[];const select=cols.map(c=>{if(c==='release_id'){args.push(next);return '?';}if(c==='id'&&table==='catalog_public_rates'){args.push(next);return "? || '__' || CASE WHEN instr(id,'__')>0 THEN substr(id,instr(id,'__')+2) ELSE id END";}return '"'+c+'"';});
 return db.prepare(`INSERT INTO "${table}" (${cols.map(c=>'"'+c+'"').join(',')}) SELECT ${select.join(',')} FROM "${table}" WHERE release_id=?`).bind(...args,base);
}
