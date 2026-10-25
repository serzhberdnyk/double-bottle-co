import {database} from '@/lib/server/db';
import {administrator,json} from '@/lib/server/http';
import {exportBackup} from '@/lib/server/backup';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!await administrator(req))return json({error:'Доступ закрыт'},403);try{return json(await exportBackup(database()),200,{'Content-Disposition':'attachment; filename="elysiam-private-backup.json"'});}catch{return json({error:'Не удалось получить полный снимок. Используйте экспорт базы у провайдера.'},503);}}
