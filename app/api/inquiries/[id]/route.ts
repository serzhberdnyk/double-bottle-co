import {database} from '@/lib/server/db';
import {inquiryStatus} from '@/lib/server/inquiries';
import {json,visitor} from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){const owner=await visitor(req);if(!owner)return json({error:'Не найдено'},404);const result=await inquiryStatus(database(),(await params).id,owner);return result?json(result):json({error:'Не найдено'},404);}
