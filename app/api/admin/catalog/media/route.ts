import {database} from '@/lib/server/db';
import {json,sameOrigin} from '@/lib/server/http';
import {catalogEditorActor} from '@/lib/server/catalog-editor-auth';
import {limitedImageBody,saveEditorImage} from '@/lib/server/catalog-editor-media';
export const dynamic='force-dynamic';
export async function POST(req:Request){const actor=await catalogEditorActor(req);if(!actor)return json({error:'Доступ закрыт'},403);if(!sameOrigin(req))return json({error:'Недопустимый источник'},403);
 try{return json(await saveEditorImage(database(),await limitedImageBody(req),req.headers.get('content-type')||'',actor));}catch{return json({error:'Нужен JPEG, PNG или WebP до 512 КБ. SVG и другие форматы не поддерживаются.'},400);}}
