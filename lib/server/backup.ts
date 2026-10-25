import {getTableName,getTableColumns} from 'drizzle-orm';
import * as schema from '../../db/schema';
import {variantImagePathSchema} from '../public/variant-image';
export const backupTables=Object.values(schema).map(t=>({name:getTableName(t),columns:Object.values(getTableColumns(t)).map(c=>c.name)}));
export async function exportBackup(db:D1Database){const result=await db.batch(backupTables.map(t=>db.prepare(`SELECT ${t.columns.map(c=>'"'+c+'"').join(',')} FROM "${t.name}" LIMIT 10001`)));if(result.some(r=>r.results.length>10000))throw new Error('BACKUP_TOO_LARGE_USE_DATABASE_EXPORT');return{schemaVersion:1,exportedAt:new Date().toISOString(),tables:backupTables.map((t,i)=>({...t,rows:result[i].results}))};}

/** Explicit additive legacy shapes only; unrelated missing/extra columns remain invalid. */
export function validatedBackupTables(source:any){
 if(source?.schemaVersion!==1||!Array.isArray(source.tables)||source.tables.length>backupTables.length)throw Error('INVALID_BACKUP');
 const names=new Set<string>();
 const tables=source.tables.map((table:any)=>{
  const expected=backupTables.find(x=>x.name===table.name);
  if(!expected||names.has(table.name)||!Array.isArray(table.rows))throw Error('INVALID_BACKUP_TABLE');
  names.add(table.name);
  const exact=JSON.stringify(table.columns)===JSON.stringify(expected.columns);
  const legacy=table.name==='catalog_public_rates'&&JSON.stringify(table.columns)===JSON.stringify(expected.columns.filter(c=>c!=='option_key'));
  const legacyDescription=table.name==='catalog_release_products'&&JSON.stringify(table.columns)===JSON.stringify(expected.columns.filter(c=>c!=='description_edited'));
  const variantLegacyMissing=[[],['name_override'],['visible'],['visible','name_override'],['image_override','image_alt_override'],['name_override','image_override','image_alt_override'],['visible','image_override','image_alt_override'],['visible','name_override','image_override','image_alt_override']].flatMap(missing=>[missing,[...missing,'product_id']]);
  const legacyVariants=table.name==='catalog_release_variants'&&variantLegacyMissing.some(missing=>JSON.stringify(table.columns)===JSON.stringify(expected.columns.filter(c=>!missing.includes(c))));
  if(!exact&&!legacy&&!legacyDescription&&!legacyVariants)throw Error('INVALID_BACKUP_TABLE');
  for(const row of table.rows)if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!table.columns.includes(k))||table.columns.some((k:string)=>!(k in row)))throw Error('INVALID_BACKUP_ROW');
  if(table.name==='catalog_release_variants'){
   if(table.columns.includes('product_id')&&table.rows.some((row:Record<string,unknown>)=>row.product_id!==null&&(typeof row.product_id!=='string'||!row.product_id.trim())))throw Error('INVALID_BACKUP_ROW');
   if(table.columns.includes('visible')&&table.rows.some((row:any)=>row.visible!==0&&row.visible!==1))throw Error('INVALID_BACKUP_ROW');
   if(table.columns.includes('name_override')&&table.rows.some((row:any)=>row.name_override!==null&&(typeof row.name_override!=='string'||!row.name_override.trim()||row.name_override.length>500)))throw Error('INVALID_BACKUP_ROW');
   if(table.columns.includes('image_override')&&table.rows.some((row:Record<string,unknown>)=>row.image_override!==null&&!variantImagePathSchema.safeParse(row.image_override).success))throw Error('INVALID_BACKUP_ROW');
   if(table.columns.includes('image_alt_override')&&table.rows.some((row:Record<string,unknown>)=>row.image_alt_override!==null&&(typeof row.image_alt_override!=='string'||row.image_alt_override.length>1000)))throw Error('INVALID_BACKUP_ROW');
  }
  return {...table,columns:expected.columns,rows:legacyVariants?table.rows.map((row:any)=>({...row,...(!table.columns.includes('product_id')?{product_id:null}:{}),...(!table.columns.includes('visible')?{visible:1}:{}),...(!table.columns.includes('name_override')?{name_override:null}:{}),...(!table.columns.includes('image_override')?{image_override:null,image_alt_override:null}:{})})):legacy?table.rows.map((row:any)=>({...row,option_key:null})):legacyDescription?table.rows.map((row:any)=>({...row,description_edited:0})):table.rows};
 });
 for(const expected of backupTables)if(!names.has(expected.name)){
  if(!['catalog_editor_drafts','catalog_media_uploads','map_editor_state','catalog_creation_drafts'].includes(expected.name))throw Error('INVALID_BACKUP_TABLE');
  tables.push({...expected,rows:[]});
 }
 const variants=new Map(tables.find((t:any)=>t.name==='catalog_variants').rows.map((row:any)=>[row.id,row]));
 const revisions=new Map(tables.find((t:any)=>t.name==='catalog_variant_revisions').rows.map((row:any)=>[row.id,row]));
 const owners=new Set(tables.find((t:any)=>t.name==='catalog_release_products').rows.map((row:any)=>JSON.stringify([row.release_id,row.product_id])));
 for(const row of tables.find((t:any)=>t.name==='catalog_release_variants').rows){
  const origin=variants.get(row.variant_id) as any,revision=revisions.get(row.revision_id) as any;
  if(!origin||!revision||revision.variant_id!==row.variant_id||!owners.has(JSON.stringify([row.release_id,row.product_id??origin.product_id])))throw Error('INVALID_BACKUP_ROW');
 }
 return tables;
}

