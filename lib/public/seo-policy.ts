import type {Locale} from '../i18n/core';
import type {Metadata} from 'next';

export type IndexingPolicy={enabled:boolean;origin:string|null};
export type PageSeo={title:string;description:string;path:string;indexable?:boolean;locale?:Locale;alternates?:{locale:Locale;path:string}[]};

/** Indexing is an explicit launch step and never applies to the temporary host. */
export function indexingPolicy(env:Record<string,string|undefined>,requestHost:string|null):IndexingPolicy {
  const disabled={enabled:false,origin:null};
  if(env.PUBLIC_INDEXING!=='true'||!env.SITE_ORIGIN||!requestHost)return disabled;
  try {
    const url=new URL(env.SITE_ORIGIN);
    const host=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.port)return disabled;
    if(!host.includes('.')||host.endsWith('.')||host.endsWith('.chatgpt.site')||host==='chatgpt.site'||host==='localhost'||host.endsWith('.localhost')||/^[\d.]+$/.test(host)||host.includes(':'))return disabled;
    if(/(^|\.)(example\.(com|net|org)|example|invalid|test|local)$/.test(host))return disabled;
    if(host.length>253||host.split('.').some(label=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))return disabled;
    if(['yourdomain.com','your-domain.com','your-domain.tld','domain.tld'].includes(host))return disabled;
    if(requestHost.toLowerCase()!==url.host.toLowerCase())return disabled;
    return {enabled:true,origin:url.origin};
  } catch {return disabled;}
}

export function seoMetadata(policy:IndexingPolicy,page:PageSeo):Metadata {
  const indexable=policy.enabled&&page.indexable!==false;
  const canonical=indexable&&policy.origin?new URL(page.path,policy.origin).href:undefined;
  return {
    title:/\bDouble Bottle Co(?!\w)/i.test(page.title)?{absolute:page.title}:page.title,
    description:page.description,
    robots:{index:indexable,follow:true},
    alternates:{canonical:canonical||null,...(canonical&&page.alternates?.length?{languages:Object.fromEntries([...page.alternates.map(item=>[item.locale,new URL(item.path,policy.origin!).href]),['x-default',new URL(page.alternates.find(item=>item.locale==='ru')?.path||page.path,policy.origin!).href]])}:{})},
    openGraph:{title:page.title,description:page.description,siteName:'Double Bottle Co’',locale:page.locale==='en'?'en_US':page.locale==='th'?'th_TH':'ru_RU',type:'website',...(canonical?{url:canonical}:{})},
  };
}

export function robotsText(policy:IndexingPolicy) {
  return 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n'+(policy.enabled&&policy.origin?`Sitemap: ${policy.origin}/sitemap.xml\n`:'');
}

/** Keep temporary-host HTML excluded even while dynamic metadata is streaming. */
export function applyIndexingHeader(response:Response,policy:IndexingPolicy,pathname:string):Response {
  if(!response.headers.get('Content-Type')?.includes('text/html'))return response;
  if(policy.enabled&&!/^\/(admin|reference-preview)(\/|$)/.test(pathname))return response;
  const next=new Response(response.body,response);
  const existing=next.headers.get('X-Robots-Tag');
  if(!existing?.toLowerCase().includes('noindex'))next.headers.set('X-Robots-Tag',existing?existing+', noindex':'noindex');
  return next;
}

const escapeXml=(value:string)=>value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character]!));
export function sitemapXml(origin:string,paths:string[]) {
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
    [...new Set(paths)].map(path=>'<url><loc>'+escapeXml(new URL(path,origin).href)+'</loc></url>').join('')+'</urlset>';
}
