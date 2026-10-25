import {database} from '@/lib/server/db';
import {hash} from '@/lib/server/management';
import {saveInquiry} from '@/lib/server/inquiries';
import {json,errorResponse,sameOrigin,visitor} from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function POST(req:Request){if(!sameOrigin(req))return json({error:'Недопустимый источник запроса'},403);if(Number(req.headers.get('content-length'))>12000)return json({error:'Слишком большой запрос'},413);try{const owner=await visitor(req);if(!owner)return json({error:'Обновите форму и повторите отправку.'},401);const bodyText=await req.text();if(bodyText.length>12000)return json({error:'Слишком большой запрос'},413);let input:unknown;try{input=JSON.parse(bodyText);}catch{return json({error:'Некорректный JSON'},400);}const ip=req.headers.get('cf-connecting-ip')||owner;const result=await saveInquiry(database(),input,owner,req.headers.get('idempotency-key')||'',await hash(ip));return json(result,result.replayed?200:201);}catch(e){return errorResponse(e);}}
