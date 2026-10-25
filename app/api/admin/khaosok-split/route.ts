import {administrator,json,sameOrigin} from '@/lib/server/http';
import {database} from '@/lib/server/db';
import {khaosokSplitPreview,stageKhaosokSplit} from '@/lib/server/khaosok-split-action';
import {splitDraftReadback} from '@/lib/server/khaosok-split-readback';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!await administrator(req))return json({error:'Доступ закрыт'},403);try{const id=new URL(req.url).searchParams.get('draft');return json(id?await splitDraftReadback(database(),id):await khaosokSplitPreview(database()));}catch{return json({error:'Не удалось проверить данные разделения'},409);}}
export async function POST(req:Request){const actor=await administrator(req);if(!actor||!sameOrigin(req))return json({error:'Доступ закрыт'},403);try{const text=await req.text();if(text.length>50000)return json({error:'Слишком большой запрос'},413);return json(await stageKhaosokSplit(database(),JSON.parse(text),actor));}catch{return json({error:'Разделение не подготовлено. Обновите исходные данные и проверьте материалы VIP.'},409);}}
