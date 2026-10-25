import {database} from '@/lib/server/db';
import {catalogEditorActor} from '@/lib/server/catalog-editor-auth';
import {editorImageResponse} from '@/lib/server/catalog-editor-media';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return editorImageResponse(database(),id,!!await catalogEditorActor(req));}
