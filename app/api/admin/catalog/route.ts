import {creationState,saveCreationDraft,publishCreationDraft,cancelCreationDraft} from '@/lib/server/catalog-creation';
import {creationErrorMessage} from '@/lib/public/catalog-creation';
import {z} from 'zod';
import {database} from '@/lib/server/db';
import {json,sameOrigin} from '@/lib/server/http';
import {catalogEditorActor} from '@/lib/server/catalog-editor-auth';
import {editorState,saveEditorDraft,publishEditorDraft,restoreEditorRelease} from '@/lib/server/catalog-editor';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!await catalogEditorActor(req))return json({error:'Доступ закрыт'},403);try{const url=new URL(req.url);if(url.searchParams.has('draft'))return json({error:'Not found'},404);const db=database();return json(url.searchParams.has('creation')?await creationState(db):await editorState(db));}catch{return json({error:'Не удалось прочитать каталог'},503);}}
export async function POST(req:Request){const actor=await catalogEditorActor(req);if(!actor)return json({error:'Доступ закрыт'},403);if(!sameOrigin(req))return json({error:'Недопустимый источник'},403);
 try{const text=await req.text();if(text.length>200000)return json({error:'Изменения слишком большие'},413);const body=JSON.parse(text),db=database();
  if(body.action==='create-save')return json(await saveCreationDraft(db,body.draft,actor));
  if(body.action==='create-publish'||body.action==='create-cancel'){const b=z.object({action:z.enum(['create-publish','create-cancel']),id:z.string().max(100),revision:z.number().int().positive()}).strict().parse(body);return json(await (b.action==='create-publish'?publishCreationDraft:cancelCreationDraft)(db,b.id,b.revision,actor));}
  if(body.action==='save')return json(await saveEditorDraft(db,body.draft,actor));
  if(body.action==='publish'){const b=z.object({action:z.literal('publish'),id:z.string().max(100),revision:z.number().int().positive()}).strict().parse(body);return json(await publishEditorDraft(db,b.id,b.revision,actor));}
  if(body.action==='restore'){const b=z.object({action:z.literal('restore'),id:z.string().max(100),generation:z.number().int().nonnegative()}).strict().parse(body);return json(await restoreEditorRelease(db,b.id,b.generation,actor));}
  return json({error:'Неизвестное действие'},400);
 }catch(error){if(error instanceof z.ZodError)return json({error:creationErrorMessage(error)},400);const code=String(error);if(/SLUG_IN_USE|PRODUCT_ID_IN_USE|DESTINATION_NOT_APPROVED|DRAFT_NOT_EDITABLE|CREATION_DRAFT_NOT_FOUND/.test(code))return json({error:/SLUG/.test(code)?'Этот адрес карточки уже занят. Укажите другой.':/DESTINATION/.test(code)?'Выберите место из актуального каталога.':'Черновик изменён или недоступен. Обновите данные.'},409);return json({error:/CONFLICT|IDENTITY/.test(code)?'Каталог или черновик изменился. Обновите данные перед сохранением.':/NO_CONTENT_CHANGES/.test(code)?'Нет изменений для публикации.':/IMAGE/.test(code)?'Сначала загрузите изображение через редактор.':'Не удалось сохранить изменения. Проверьте заполненные поля.'},409);}
}
