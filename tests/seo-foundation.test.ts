import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import type {Metadata} from 'next';
import {indexingPolicy,seoMetadata,robotsText,sitemapXml,applyIndexingHeader} from '../lib/public/seo-policy';
import * as seoPolicy from '../lib/public/seo-policy';
import {catalogQueryFromSearch,catalogHref,indexableCatalogSearch,type CatalogSearch} from '../lib/public/catalog-navigation';
import * as catalogNavigation from '../lib/public/catalog-navigation';
import {categoryNames,type CatalogQuery,type CatalogResponse} from '../lib/public/types';
import {sitemapPaths} from '../lib/server/catalog';
import * as publicCatalog from '../lib/server/catalog';
import {stageImport,publishRelease,type ImportPacket} from '../lib/server/management';
import {testDatabase} from './d1-adapter';

const origin='https://travel.elysiam.com';
const host='travel.elysiam.com';
const approved={PUBLIC_INDEXING:'true',SITE_ORIGIN:origin};
const page={title:'Экскурсии на Пхукете',description:'Острова, море и природа Таиланда.',path:'/catalog'};

test('Indexing is opt-in and requires a permanent HTTPS origin on the current request host',()=>{
  for(const env of [{},{SITE_ORIGIN:origin},{...approved,PUBLIC_INDEXING:'false'},{...approved,PUBLIC_INDEXING:'TRUE'},{PUBLIC_INDEXING:'true'}]){
    assert.deepEqual(indexingPolicy(env,host),{enabled:false,origin:null});
  }
  assert.deepEqual(indexingPolicy(approved,host),{enabled:true,origin});
  assert.deepEqual(indexingPolicy({...approved,SITE_ORIGIN:origin+'/'},host),{enabled:true,origin});
  for(const requestHost of [null,'preview.chatgpt.site','www.'+host,host+':8443',host+'.attacker.com']){
    assert.deepEqual(indexingPolicy(approved,requestHost),{enabled:false,origin:null},String(requestHost));
  }
});

test('Malformed, temporary, local, IP and placeholder origins cannot publish canonical or sitemap URLs',()=>{
  const rejected=[
    '', 'not a url', '//'+host, 'http://'+host,
    origin+'/catalog', origin+'?mode=preview', origin+'#preview', origin+':8443',
    'https://user:password@'+host, 'https://chatgpt.site', 'https://preview.chatgpt.site',
    'https://preview.chatgpt.site.', 'https://localhost', 'https://app.localhost',
    'https://127.0.0.1', 'https://127.1', 'https://[::1]',
    'https://example.com', 'https://www.example.org', 'https://example.net', 'https://example.com.',
    'https://travel.test', 'https://travel.invalid', 'https://travel.local',
    'https://travel..elysiam.com', 'https://-travel.elysiam.com', 'https://_preview.elysiam.com',
  ];
  for(const SITE_ORIGIN of rejected){
    let requestHost=host;
    try{requestHost=new URL(SITE_ORIGIN).host;}catch{}
    const policy=indexingPolicy({...approved,SITE_ORIGIN},requestHost);
    assert.deepEqual(policy,{enabled:false,origin:null},SITE_ORIGIN);
    const metadata=seoMetadata(policy,page);
    assert.equal(metadata.alternates?.canonical??null,null,SITE_ORIGIN);
    assert.equal(metadata.openGraph?.url,undefined,SITE_ORIGIN);
    assert.doesNotMatch(robotsText(policy),/^Sitemap:/m,SITE_ORIGIN);
  }
});

test('Disabled metadata is noindex, follow, with matching page and Open Graph copy',()=>{
  const metadata=seoMetadata(indexingPolicy({},host),page);
  assert.deepEqual(metadata.robots,{index:false,follow:true});
  assert.equal(metadata.title,page.title);
  assert.equal(metadata.description,page.description);
  assert.equal(metadata.openGraph?.title,page.title);
  assert.equal(metadata.openGraph?.description,page.description);
  assert.equal(metadata.alternates?.canonical??null,null);
  assert.equal(metadata.openGraph?.url,undefined);
});

test('An already branded page title does not receive a second Double Bottle Co’ suffix',()=>{
  const title='О Double Bottle Co’';
  const metadata=seoMetadata(indexingPolicy({},host),{...page,title,path:'/about'});
  assert.deepEqual(metadata.title,{absolute:title});
  assert.equal(metadata.openGraph?.title,title);
});

test('Approved pages use their own canonical, while explicit private and preview pages remain noindex',()=>{
  const policy=indexingPolicy(approved,host);
  const metadata=seoMetadata(policy,{...page,path:'/?category=sea&page=2'});
  assert.deepEqual(metadata.robots,{index:true,follow:true});
  assert.equal(metadata.alternates?.canonical,origin+'/?category=sea&page=2');
  assert.equal(metadata.openGraph?.url,metadata.alternates?.canonical);
  for(const path of ['/admin','/reference-preview']){
    const hidden=seoMetadata(policy,{...page,path,indexable:false});
    assert.deepEqual(hidden.robots,{index:false,follow:true});
    assert.equal(hidden.alternates?.canonical??null,null);
    assert.equal(hidden.openGraph?.url,undefined);
  }
});

test('Robots only advertises an approved sitemap and keeps administrative routes excluded',()=>{
  for(const policy of [indexingPolicy({},host),indexingPolicy(approved,host)]){
    const robots=robotsText(policy);
    assert.match(robots,/^User-agent: \*$/m);
    assert.match(robots,/^Disallow: \/admin$/m);
    assert.match(robots,/^Disallow: \/api\/$/m);
    assert.equal(robots.includes('Sitemap:'),policy.enabled);
    if(policy.enabled)assert(robots.includes('Sitemap: '+origin+'/sitemap.xml'));
    assert.doesNotMatch(robots,/undefined|null|chatgpt\.site/);
  }
});

test('Disabled HTML receives noindex while its body, status and other headers are preserved',async()=>{
  const body='<!doctype html><html lang="ru"><body>Временно недоступно</body></html>';
  const response=new Response(body,{
    status:503,statusText:'Temporarily unavailable',
    headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Retry-After':'60','X-Request-ID':'seo-test'},
  });
  const result=applyIndexingHeader(response,indexingPolicy({},host),'/catalog');
  assert.equal(result.status,503);
  assert.equal(result.statusText,'Temporarily unavailable');
  assert.equal(result.headers.get('X-Robots-Tag'),'noindex');
  assert.equal(result.headers.get('Content-Type'),'text/html; charset=utf-8');
  assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal(result.headers.get('Retry-After'),'60');
  assert.equal(result.headers.get('X-Request-ID'),'seo-test');
  assert.equal(response.headers.get('X-Robots-Tag'),null);
  assert.equal(await result.text(),body);
});

test('HTML indexing headers keep stricter directives and protect private paths after launch',async()=>{
  const policy=indexingPolicy(approved,host);
  for(const pathname of ['/admin','/admin/operations','/reference-preview','/reference-preview/map']){
    const response=new Response('Private HTML',{headers:{'Content-Type':'text/html','X-Robots-Tag':'nofollow, noarchive'}});
    const result=applyIndexingHeader(response,policy,pathname);
    assert.equal(result.headers.get('X-Robots-Tag'),'nofollow, noarchive, noindex',pathname);
    assert.equal(await result.text(),'Private HTML');
  }
  for(const existing of ['noindex, nofollow, noarchive','NOINDEX, nofollow']){
    const response=new Response('Private HTML',{headers:{'Content-Type':'text/html','X-Robots-Tag':existing}});
    const once=applyIndexingHeader(response,policy,'/admin');
    const twice=applyIndexingHeader(once,policy,'/admin');
    assert.equal(twice.headers.get('X-Robots-Tag'),existing);
    assert.equal(await twice.text(),'Private HTML');
  }
});

test('Indexing headers leave non-HTML responses and approved public HTML unchanged',async()=>{
  for(const contentType of ['application/json','application/xml','text/css','image/svg+xml',null]){
    const response=new Response(new TextEncoder().encode('Response body'),{
      status:201,headers:contentType?{'Content-Type':contentType,'X-Test':'preserved'}:{'X-Test':'preserved'},
    });
    const result=applyIndexingHeader(response,indexingPolicy({},host),'/admin');
    assert.equal(result,response,contentType||'no content type');
    assert.equal(result.headers.get('X-Robots-Tag'),null);
    assert.equal(await result.text(),'Response body');
  }
  for(const pathname of ['/','/catalog','/tour/coral','/administrator','/reference-preview-notes']){
    const response=new Response('Public HTML',{headers:{'Content-Type':'text/html','X-Robots-Tag':'follow'}});
    const result=applyIndexingHeader(response,indexingPolicy(approved,host),pathname);
    assert.equal(result,response,pathname);
    assert.equal(result.headers.get('X-Robots-Tag'),'follow');
    assert.equal(await result.text(),'Public HTML');
  }
});

test('Sitemap XML deduplicates routes and escapes query characters without breaking URLs',()=>{
  const path="/destination/coral?name=sea&note='reef'&label=<island>";
  const xml=sitemapXml(origin,['/',path,path,"/destination/reef'break"]);
  assert.match(xml,/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml,/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.equal((xml.match(/<loc>/g)||[]).length,3);
  assert(xml.includes('<loc>'+origin+'/</loc>'));
  assert(xml.includes('name=sea&amp;note=%27reef%27&amp;label=%3Cisland%3E'));
  assert(xml.includes('/destination/reef&apos;break</loc>'));
  assert.doesNotMatch(xml,/<island>|&(?!amp;|apos;|quot;|lt;|gt;)/);
});

test('Catalogue query parsing preserves category, filters and page, and fixes destination identity',()=>{
  const search={category:'sea',page:'2',q:'Рача & Корал',destination:'other-place',days:'1',transport:'Катер',format:'Группа',sort:'title'};
  const query=catalogQueryFromSearch(search,'coral');
  assert.equal(query.destination,'coral');
  assert.equal(query.category,'sea');
  assert.equal(query.page,2);
  assert.equal(query.q,search.q);
  assert.equal(query.days,'1');
  assert.equal(query.transport,search.transport);
  assert.equal(query.format,search.format);
  assert.equal(query.sort,'title');
  const duplicate=catalogQueryFromSearch({category:['sea','nature'],page:['2','3'],destination:['other-place','third-place']},'coral');
  assert.equal(duplicate.destination,'coral');
  assert.equal(duplicate.category,undefined);
  assert.equal(duplicate.page,1);
  for(const value of ['invalid','0','-2'])assert.equal(catalogQueryFromSearch({page:value}).page,1);
});

test('Catalogue links retain filters and page; destination reset returns to the catalogue',()=>{
  const search={category:'sea',page:'2',q:'Рача & Корал',days:'1',transport:'Катер',format:'Группа',sort:'title'};
  const query=catalogQueryFromSearch(search,'coral');
  const context={basePath:'/destination/coral',destinationId:'coral'};
  const destinationUrl=new URL(catalogHref(query,context),origin);
  assert.equal(destinationUrl.pathname,'/destination/coral');
  assert.equal(destinationUrl.searchParams.has('destination'),false);
  for(const [key,value] of Object.entries(search))assert.equal(destinationUrl.searchParams.get(key),value,key);
  assert.equal(catalogHref({},context),'/#selected');
  assert.equal(catalogHref({}),'/#selected');
  const changed=new URL(catalogHref({category:'sea',destination:'racha-yai',page:2},context),origin);
  assert.equal(changed.pathname,'/');
  assert.equal(changed.searchParams.get('destination'),'racha-yai');
  assert.equal(changed.searchParams.get('category'),'sea');
  assert.equal(changed.searchParams.get('page'),'2');
  const favorites=new URL(catalogHref({category:'sea',page:2},{favorites:true}),origin);
  assert.equal(favorites.searchParams.get('favorites'),'1');
  assert.equal(favorites.searchParams.get('category'),'sea');
  assert.equal(favorites.searchParams.get('page'),'2');
});

test('Only clean category and pagination URLs are indexable; searches and arbitrary filters are noindex',()=>{
  for(const search of [{},{category:'sea'},{page:'2'},{category:'nature',page:'2'}]){
    assert.equal(indexableCatalogSearch(search),true,JSON.stringify(search));
  }
  const rejected=[
    {category:'unknown'},{category:['sea','nature']},{q:'Рача'},{favorites:'1'},
    {search:''},{destination:'coral'},{days:'1'},{transport:'Катер'},{format:'Группа'},
    {sort:'title'},{anything:'value'},{page:'0'},{page:'-1'},{page:'1.5'},
    {page:'Infinity'},{page:'2oops'},{page:['1','2']},{page:'9007199254740992'},
  ];
  for(const search of rejected){
    assert.equal(indexableCatalogSearch(search),false,JSON.stringify(search));
    const metadata=seoMetadata(indexingPolicy(approved,host),{...page,indexable:indexableCatalogSearch(search)});
    assert.deepEqual(metadata.robots,{index:false,follow:true});
    assert.equal(metadata.alternates?.canonical??null,null);
  }
  assert.equal(indexableCatalogSearch({page:'2'},{destinationPage:true}),true);
  for(const search of [{category:'sea'},{destination:'coral'},{q:'Рача'},{favorites:'1'}]){
    assert.equal(indexableCatalogSearch(search,{destinationPage:true}),false,JSON.stringify(search));
  }
});

function sitemapPacket(publicCount=1):ImportPacket {
  const packet=JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket;
  const template=packet.products.find(tour=>tour.slug==='racha-coral')!;
  const destinationTemplate=packet.destinations[0];
  const statuses=['published','draft','archived'] as const;
  packet.destinations=['published','draft','archived','unused'].map(name=>({...structuredClone(destinationTemplate),id:'seo-place-'+name,slug:'seo-place-'+name}));
  packet.products=statuses.map(publicationStatus=>{
    const tour=structuredClone(template);
    tour.id='seo-tour-'+publicationStatus;
    tour.slug=tour.id;
    tour.publicationStatus=publicationStatus;
    tour.supplier.offerId='seo-offer-'+publicationStatus;
    tour.provenance.sourceId='seo-source-'+publicationStatus;
    tour.variants=[tour.variants[0]];
    tour.variants[0].id='seo-variant-'+publicationStatus;
    tour.variants[0].stops=[{...tour.variants[0].stops[0],destinationId:'seo-place-'+publicationStatus,sequence:1}];
    return tour;
  });
  for(let index=1;index<publicCount;index++){
    const tour=structuredClone(packet.products[0]);
    tour.id='seo-tour-published-'+index;
    tour.slug=tour.id;
    tour.variants[0].id='seo-variant-published-'+index;
    tour.supplier.offerId='seo-offer-published-'+index;
    tour.provenance.sourceId='seo-source-published-'+index;
    packet.products.push(tour);
  }
  return packet;
}

test('Sitemap paths use the active publication, public destinations and historical tour slug fallback',async()=>{
  const db=testDatabase();
  try{
    const packet=sitemapPacket();
    const release=await stageImport(db,packet,'seo-test');
    await publishRelease(db,release.id,0,'seo-test');
    // Older snapshots acquired an empty release slug when the schema migrated.
    db.sqlite.prepare("UPDATE catalog_release_products SET slug='' WHERE release_id=? AND product_id=?").run(release.id,'seo-tour-published');
    const pending=structuredClone(packet);
    pending.products[0].slug='seo-tour-unpublished-change';
    await stageImport(db,pending,'seo-test');
    const paths=await sitemapPaths(db);
    for(const path of ['/','/destinations','/guide','/about','/tour/seo-tour-published','/destination/seo-place-published']){
      assert(paths.includes(path),path);
    }
    for(const path of ['/catalog','/admin','/reference-preview','/tour/','/tour/seo-tour-draft','/tour/seo-tour-archived','/tour/seo-tour-unpublished-change','/destination/seo-place-draft','/destination/seo-place-archived','/destination/seo-place-unused']){
      assert.equal(paths.includes(path),false,path);
    }
    assert.equal(new Set(paths).size,paths.length);
  }finally{db.sqlite.close();}
});

test('Sitemap excludes destinations whose published products or variants are temporarily unavailable',async()=>{
  for(const unavailable of ['product','variant'] as const){
    const db=testDatabase();
    try{
      const packet=sitemapPacket();
      const tour=packet.products[0];
      if(unavailable==='product')tour.status='temporarily_unavailable';
      else tour.variants[0].status='temporarily_unavailable';
      const release=await stageImport(db,packet,'seo-unavailable-test');
      await publishRelease(db,release.id,0,'seo-unavailable-test');
      const paths=await sitemapPaths(db);
      assert.equal((await publicCatalog.catalog(db,{destination:'seo-place-published'})).total,0,unavailable);
      assert.equal(paths.includes('/destination/seo-place-published'),false,unavailable);
      assert(paths.includes('/tour/seo-tour-published'),'Published tour detail remains reachable');
      const destination=executeModule('app/destination/[slug]/page.tsx',routeDependencies(db));
      const metadata=await destination.generateMetadata({params:Promise.resolve({slug:'seo-place-published'}),searchParams:Promise.resolve({})});
      assert.equal(robotsIndex(metadata),false,unavailable);
      assert.equal(metadata.alternates?.canonical??null,null);
    }finally{db.sqlite.close();}
  }
});

// Run the actual route modules and their server SEO helper. Only platform
// bindings and client presentation components are replaced, as in home-routes.
type RouteProps={params?:Promise<{slug:string}>;searchParams?:Promise<CatalogSearch>};
type ExecutedRoute={
  metadata:Metadata;
  GET:(request:Request)=>Response|Promise<Response>;
  generateMetadata:(props:RouteProps)=>Promise<Metadata>;
  default:(props:RouteProps)=>Promise<{props:{initialQuery:CatalogQuery;initial:CatalogResponse;data:CatalogResponse;basePath?:string;destinationId?:string}}>;
};
function executeModule(file:string,dependencies:Record<string,unknown>) {
  const source=ts.transpileModule(readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
    fileName:file,
  }).outputText;
  const exports:Record<string,unknown>={};
  const require=(name:string)=>{
    if(name==='react/jsx-runtime')return jsxRuntime;
    if(Object.hasOwn(dependencies,name))return dependencies[name];
    throw new Error('Unexpected SEO route dependency: '+name);
  };
  new Function('require','exports',source)(require,exports);
  return exports as ExecutedRoute;
}

function robotsIndex(metadata:Metadata) {
  assert.equal(typeof metadata.robots,'object');
  return metadata.robots&&typeof metadata.robots==='object'?metadata.robots.index:undefined;
}

function routeDependencies(db:D1Database,environment:Record<string,string|undefined>=approved,requestHost=host) {
  const bindings={database:()=>db,configuration:()=>environment};
  const requestHeaders={headers:async()=>new Headers({host:requestHost})};
  const serverSeo=executeModule('lib/server/seo.ts',{
    'next/headers':requestHeaders,
    './db':bindings,
    '../public/seo-policy':seoPolicy,
  });
  const presentation={CatalogExperience:()=>null,TourPage:()=>null};
  return {
    '@/lib/server/db':bindings,
    '@/lib/server/catalog':publicCatalog,
    '@/lib/server/seo':serverSeo,
    '@/lib/public/seo-policy':seoPolicy,
    '@/lib/public/catalog-navigation':catalogNavigation,
    '@/lib/public/types':{categoryNames},
    '@/app/components/CatalogUI':presentation,
    '../components/CatalogUI':presentation,
    './reference-preview/ReferenceHome':{ReferenceHome:()=>null},
    '../components/SiteChrome':{Unavailable:()=>null},
    'next/navigation':{notFound(){throw new Error('NOT_FOUND');},permanentRedirect(path:string){throw new Error('REDIRECT: '+path);}},
  };
}

test('Sitemap and robots handlers block unapproved hosts without querying the catalogue',async()=>{
  const db=testDatabase();
  try{
    for(const [environment,requestOrigin] of [
      [{},origin],
      [{PUBLIC_INDEXING:'true'},origin],
      [approved,'https://preview.chatgpt.site'],
      [{PUBLIC_INDEXING:'true',SITE_ORIGIN:'https://preview.chatgpt.site'},'https://preview.chatgpt.site'],
    ] as const){
      const dependencies=routeDependencies(db,environment);
      dependencies['@/lib/server/db'].database=()=>{throw new Error('Disabled sitemap must not read the database');};
      const sitemap=executeModule('app/sitemap.xml/route.ts',dependencies);
      const response=await sitemap.GET(new Request(requestOrigin+'/sitemap.xml')) as Response;
      assert.equal(response.status,404);
      assert.equal(response.headers.get('X-Robots-Tag'),'noindex');
      assert.doesNotMatch(await response.text(),/<loc>|undefined|null/);
      const robots=executeModule('app/robots.txt/route.ts',dependencies);
      const robotsResponse=await robots.GET(new Request(requestOrigin+'/robots.txt')) as Response;
      assert.equal(robotsResponse.status,200);
      assert.doesNotMatch(await robotsResponse.text(),/^Sitemap:/m);
    }
  }finally{db.sqlite.close();}
});

test('Approved sitemap handler emits only published paths and fails safely when data is unavailable',async()=>{
  const db=testDatabase();
  try{
    const route=executeModule('app/sitemap.xml/route.ts',routeDependencies(db));
    const request=new Request(origin+'/sitemap.xml');
    const unavailable=await route.GET(request) as Response;
    assert.equal(unavailable.status,503);
    assert.doesNotMatch(await unavailable.text(),/<loc>/);
    const release=await stageImport(db,sitemapPacket(),'seo-route-test');
    await publishRelease(db,release.id,0,'seo-route-test');
    const response=await route.GET(request) as Response;
    assert.equal(response.status,200);
    assert.match(response.headers.get('Content-Type')||'',/application\/xml/);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    const xml=await response.text();
    assert(xml.includes('<loc>'+origin+'/tour/seo-tour-published</loc>'));
    assert(xml.includes('<loc>'+origin+'/destination/seo-place-published</loc>'));
    assert.doesNotMatch(xml,/seo-tour-draft|seo-tour-archived|seo-place-draft|seo-place-unused|chatgpt\.site|undefined/);
  }finally{db.sqlite.close();}
});

test('Actual catalogue and destination routes preserve page 2 and enforce safe self-canonicals',async()=>{
  const db=testDatabase();
  try{
    const release=await stageImport(db,sitemapPacket(13),'seo-route-test');
    await publishRelease(db,release.id,0,'seo-route-test');
    const dependencies=routeDependencies(db);
    const catalogue=executeModule('app/page.tsx',dependencies);
    const props={searchParams:Promise.resolve({category:'sea',page:'2'})};
    const rendered=await catalogue.default(props);
    assert.equal(rendered.props.initialQuery.category,'sea');
    assert.equal(rendered.props.initialQuery.page,2);
    assert.equal(rendered.props.data.page,2);
    const metadata=await catalogue.generateMetadata(props);
    assert.equal(metadata.alternates?.canonical,origin+'/?category=sea&page=2');
    assert.equal(robotsIndex(metadata),true);
    assert.equal(metadata.openGraph?.title,typeof metadata.title==='object'&&metadata.title&&'absolute' in metadata.title?metadata.title.absolute:metadata.title);
    assert.equal(metadata.openGraph?.description,metadata.description);
    for(const search of [{page:'999'},{q:'Рача'},{favorites:'1'},{search:''},{anything:'value'}]){
      const hidden=await catalogue.generateMetadata({searchParams:Promise.resolve(search)});
      assert.equal(robotsIndex(hidden),false,JSON.stringify(search));
      assert.equal(hidden.alternates?.canonical??null,null);
    }
    const destination=executeModule('app/destination/[slug]/page.tsx',dependencies);
    const params=Promise.resolve({slug:'seo-place-published'});
    const destinationProps={params,searchParams:Promise.resolve({page:'2',category:'sea',destination:'seo-place-draft'})};
    const renderedDestination=await destination.default(destinationProps);
    assert.equal(renderedDestination.props.initialQuery.destination,'seo-place-published');
    assert.equal(renderedDestination.props.initialQuery.category,'sea');
    assert.equal(renderedDestination.props.initialQuery.page,2);
    assert.equal(renderedDestination.props.initial.page,2);
    assert.equal(renderedDestination.props.basePath,'/destination/seo-place-published');
    assert.equal(renderedDestination.props.destinationId,'seo-place-published');
    const destinationMetadata=await destination.generateMetadata({params,searchParams:Promise.resolve({page:'2'})});
    assert.equal(destinationMetadata.alternates?.canonical,origin+'/destination/seo-place-published?page=2');
    assert.equal(robotsIndex(destinationMetadata),true);
    const filteredDestination=await destination.generateMetadata(destinationProps);
    assert.equal(robotsIndex(filteredDestination),false);
    assert.equal(filteredDestination.alternates?.canonical??null,null);
    const disabled=executeModule('app/page.tsx',routeDependencies(db,{}));
    const disabledMetadata=await disabled.generateMetadata(props);
    assert.equal(robotsIndex(disabledMetadata),false);
    assert.equal(disabledMetadata.alternates?.canonical??null,null);
  }finally{db.sqlite.close();}
});

test('Admin and visual preview route metadata stays noindex after public indexing is approved',()=>{
  const admin=executeModule('app/admin/page.tsx',{
    'next/headers':{},
    '@/lib/server/db':{configuration:()=>approved},
    '../chatgpt-auth':{},
    './panel':{},
  });
  const preview=executeModule('app/reference-preview/page.tsx',{'../page':{default:()=>null}});
  for(const route of [admin,preview]){
    assert.equal(robotsIndex(route.metadata),false);
    assert.equal(Boolean(route.metadata.alternates?.canonical),false);
  }
});
