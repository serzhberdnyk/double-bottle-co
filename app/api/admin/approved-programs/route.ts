import {administrator,json,sameOrigin} from '@/lib/server/http';
import {database} from '@/lib/server/db';
import {prepareApprovedEight} from '@/lib/server/approved-eight-import';
import {stageImport,publishRelease} from '@/lib/server/management';
import {translateCatalog} from '@/lib/i18n/catalog';
import {publishedTranslations} from '@/lib/server/localization';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!await administrator(req))return json({error:'Доступ закрыт'},403);try{
 const db=database(),p=await prepareApprovedEight(db);const ids=new Set(p.mapping.map((m:any)=>m.product));const missing:Record<string,string[]>={};
 for(const locale of ['en','th'] as const){const dictionary=await publishedTranslations(db,locale);missing[locale]=[...new Set(p.packet.products.filter(t=>ids.has(t.id)).flatMap(t=>translateCatalog({id:t.id,slug:t.slug,title:t.title,description:t.description,imageAlt:t.imageAlt,variants:t.variants},locale,dictionary).missing))];}
 return json({state:p.state,digest:p.digest,alreadyImported:p.alreadyImported,programs:8,products:p.packet.products.length,mapping:p.mapping,conflicts:p.conflicts,missingTranslations:missing});
 }catch(e){return json({error:String(e)},409);}}
export async function POST(req:Request){const actor=await administrator(req);if(!actor)return json({error:'Доступ закрыт'},403);if(!sameOrigin(req))return json({error:'Недопустимый источник'},403);try{
 const b=await req.json() as {generation:number;releaseId:string;digest:string};const db=database(),p=await prepareApprovedEight(db);
 if(b.generation!==p.state.generation||b.releaseId!==p.state.release_id||b.digest!==p.digest)return json({error:'Каталог изменился. Обновите проверку перед импортом.'},409);
 if(p.alreadyImported)return json({releaseId:p.state.release_id,generation:p.state.generation,alreadyImported:true,programs:8,mapping:p.mapping,conflicts:p.conflicts}); const staged=await stageImport(db,p.packet,actor);const result=staged.status==='published'?{releaseId:staged.id,generation:p.state.generation}:await publishRelease(db,staged.id,p.state.generation,actor);
 return json({...result,programs:8,mapping:p.mapping,conflicts:p.conflicts});
 }catch(e){return json({error:String(e)},409);}}
