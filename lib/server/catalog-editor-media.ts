import {Buffer} from 'node:buffer';
import {hash} from './management';
import {MAX_EDITOR_IMAGE_BYTES} from '../public/editor-image-limits';
export {MAX_EDITOR_IMAGE_BYTES} from '../public/editor-image-limits';
export function editorImageType(bytes:Uint8Array){
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))return 'image/png';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217)return 'image/jpeg';
 throw Error('INVALID_IMAGE');
}
export async function limitedImageBody(req:Request){
 if(Number(req.headers.get('content-length')||0)>MAX_EDITOR_IMAGE_BYTES)throw Error('IMAGE_TOO_LARGE');
 const reader=req.body?.getReader();if(!reader)throw Error('INVALID_IMAGE');const chunks:Uint8Array[]=[];let length=0;
 for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>MAX_EDITOR_IMAGE_BYTES){await reader.cancel();throw Error('IMAGE_TOO_LARGE');}chunks.push(next.value);}
 const all=new Uint8Array(length);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}return all;
}
export async function saveEditorImage(db:D1Database,bytes:Uint8Array,claimedType:string,actor:string){
 if(bytes.length>MAX_EDITOR_IMAGE_BYTES)throw Error('IMAGE_TOO_LARGE');const contentType=editorImageType(bytes);if(contentType!==claimedType)throw Error('INVALID_IMAGE');
 const base64=Buffer.from(bytes).toString('base64'),id=await hash(base64),path='/api/catalog-media/'+id,stamp=new Date().toISOString();
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO catalog_media_uploads (id,content_type,body_base64,byte_length,created_at,created_by) VALUES (?,?,?,?,?,?)').bind(id,contentType,base64,bytes.length,stamp,actor),
  db.prepare('INSERT OR IGNORE INTO catalog_media (id,path,license,attribution,source_url,approved_by,approved_at) VALUES (?,?,?,?,?,?,?)').bind('upload_'+id,path,'owner-provided','Uploaded by authorized catalog editor','upload://catalog-editor/'+id,actor,stamp),
 ]);return {id,path,contentType,size:bytes.length};
}
export async function editorImageResponse(db:D1Database,id:string,editor:boolean){
 if(!/^[a-f0-9]{64}$/.test(id))return new Response(null,{status:404});
 const path='/api/catalog-media/'+id;
 const catalogPublished=await db.prepare("SELECT 1 AS yes FROM catalog_release_products p JOIN catalog_releases r ON r.id=p.release_id WHERE p.image=? AND p.publication_status='published' AND r.status='published' LIMIT 1").bind(path).first();
 const variantPublished=catalogPublished?null:await db.prepare("SELECT 1 AS yes FROM catalog_release_variants rv JOIN catalog_variants v ON v.id=rv.variant_id JOIN catalog_release_products p ON p.product_id=COALESCE(rv.product_id,(SELECT owner_identity.product_id FROM catalog_variants owner_identity WHERE owner_identity.id=rv.variant_id)) AND p.release_id=rv.release_id JOIN catalog_releases r ON r.id=rv.release_id WHERE rv.image_override=? AND rv.visible=1 AND p.publication_status='published' AND r.status='published' LIMIT 1").bind(path).first();
 const mapPublished=catalogPublished||variantPublished?null:await db.prepare("SELECT 1 AS yes FROM internal_events e, json_each(e.data_json,'$.items') item WHERE e.type='map_published' AND (json_extract(item.value,'$.image')=? OR EXISTS (SELECT 1 FROM json_each(item.value,'$.photos') photo WHERE photo.value=?)) LIMIT 1").bind(path,path).first();
 const published=catalogPublished||variantPublished||mapPublished;
 if(!published&&!editor)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const row=await db.prepare('SELECT content_type,body_base64 FROM catalog_media_uploads WHERE id=?').bind(id).first<{content_type:string;body_base64:string}>();if(!row)return new Response(null,{status:404});
 return new Response(new Uint8Array(Buffer.from(row.body_base64,'base64')),{headers:{'Content-Type':row.content_type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':published?'public, max-age=31536000, immutable':'private, no-store'}});
}
