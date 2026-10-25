import {z} from 'zod';
import {database} from '@/lib/server/db';
import {json,sameOrigin} from '@/lib/server/http';
import {catalogEditorActor} from '@/lib/server/catalog-editor-auth';
import {mapEditorState,saveMapDraft,publishMapDraft} from '@/lib/server/map-editor';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!await catalogEditorActor(req))return json({error:'Доступ закрыт'},403);try{return json(await mapEditorState(database()));}catch{return json({error:'Не удалось загрузить карту.'},503);}}
export async function POST(req:Request){const actor=await catalogEditorActor(req);if(!actor)return json({error:'Доступ закрыт'},403);if(!sameOrigin(req))return json({error:'Недопустимый источник'},403);
 try{const text=await req.text();if(new TextEncoder().encode(text).byteLength>256000)return json({error:'Слишком большой запрос'},413);const b=z.object({action:z.enum(['save','publish']),revision:z.number().int().nonnegative(),layout:z.unknown().optional(),document:z.unknown().optional()}).strict().superRefine((body,ctx)=>{if(body.action==='save'&&(Number(body.layout!==undefined)+Number(body.document!==undefined)!==1))ctx.addIssue({code:'custom',message:'MAP_INPUT_REQUIRED'});if(body.action==='publish'&&(body.layout!==undefined||body.document!==undefined))ctx.addIssue({code:'custom',message:'MAP_PUBLISH_USES_SAVED_DRAFT'});}).parse(JSON.parse(text));return json(b.action==='save'?await saveMapDraft(database(),b.document??b.layout,b.revision,actor):await publishMapDraft(database(),b.revision,actor));}catch(e){return json({error:String(e).includes('MAP_CONFLICT')?'Карта уже изменилась. Обновите данные перед сохранением.':'Не удалось сохранить карту. Проверьте положение, подписи, фотографии и точки маршрута.'},409);}
}
