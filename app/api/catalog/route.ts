import {database} from '@/lib/server/db';
import {catalog} from '@/lib/server/catalog';
import {json,errorResponse} from '@/lib/server/http';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const s=new URL(req.url).searchParams;return json(await catalog(database(),{sort:s.get('sort')||undefined,q:s.get('q')||undefined,category:s.get('category')||undefined,destination:s.get('destination')||undefined,transport:s.get('transport')||undefined,format:s.get('format')||undefined,days:s.get('days')||undefined,release:s.get('release')||undefined,page:Number(s.get('page'))||1,limit:Number(s.get('limit'))||12,ids:s.get('ids')?.split(',').filter(Boolean).slice(0,48)}));}catch(e){return errorResponse(e);}}
