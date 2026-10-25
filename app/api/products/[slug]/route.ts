import {database} from '@/lib/server/db';
import {product} from '@/lib/server/catalog';
import {json,errorResponse} from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{slug:string}>}){try{const p=await product(database(),(await params).slug,new URL(req.url).searchParams.get('release')||undefined);return p?json(p):json({error:'Программа не найдена'},404);}catch(e){return errorResponse(e);}}
