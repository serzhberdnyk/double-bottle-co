import {database,configuration} from '@/lib/server/db';
import {localizedSitemapPaths} from '@/lib/server/catalog';
import {indexingPolicy,sitemapXml} from '@/lib/public/seo-policy';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const policy=indexingPolicy(configuration(),new URL(request.url).host);
  if(!policy.enabled||!policy.origin)return new Response('Sitemap not enabled',{status:404,headers:{'X-Robots-Tag':'noindex','Cache-Control':'no-store'}});
  try{const localized=await localizedSitemapPaths(database());return new Response(sitemapXml(policy.origin,localized),{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'no-store'}});}
  catch{return new Response('Sitemap unavailable',{status:503,headers:{'Cache-Control':'no-store'}});}
}
