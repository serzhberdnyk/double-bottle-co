import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {testDatabase} from './d1-adapter';
import {stageImport,publishRelease,type ImportPacket} from '../lib/server/management';
import * as catalog from '../lib/server/catalog';
import * as navigation from '../lib/public/catalog-navigation';
import * as types from '../lib/public/types';
import * as pricing from '../lib/public/pricing';
import * as filterOptions from '../app/reference-preview/catalog-filter-options';
import {referenceCopy} from '../app/reference-preview/reference-copy';
import {createReferenceCatalogController} from '../app/reference-preview/reference-feed';

function module(file:string,dependencies:Record<string,unknown>):Record<string,any>{
 const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},fileName:file}).outputText;
 const exports={};
 new Function('require','exports',source)((name:string)=>{
  if(name==='react/jsx-runtime')return jsxRuntime;
  if(name==='react')return React;
  if(Object.hasOwn(dependencies,name))return dependencies[name];
  throw Error('Unexpected dependency '+name);
 },exports);
 return exports;
}
const css={default:new Proxy({},{get:(_,name)=>String(name)})};
const Icon=()=>null;
const filters=module('app/reference-preview/HomeCatalogFilters.tsx',{'./reference.module.css':css,'./catalog-filter-options':filterOptions,'lucide-react':{Search:Icon,X:Icon,ChevronDown:Icon}});
const home=module('app/reference-preview/ReferenceHome.tsx',{
 'next/link':{default:(props:any)=>React.createElement('a',props)},
 'lucide-react':Object.fromEntries(['ArrowRight','Clock','Heart','Menu','Search','Users','X','Plus','Check'].map(name=>[name,Icon])),
 '@/lib/public/types':types,'@/lib/public/pricing':pricing,'@/lib/public/catalog-navigation':navigation,
 '../components/TourImage':{TourImage:()=>null},'../components/LicenseBadge':{LicenseBadge:()=>null},
 './reference-copy':{referenceCopy},'./SupplementalArtPOIs':{SupplementalArtPOIs:()=>null},
 './HomeCatalogFilters':filters,'./reference.module.css':css,
 './useReferenceCatalog':{useReferenceCatalog:(initial:types.CatalogResponse|null,query:types.CatalogQuery)=>{
  const controller=createReferenceCatalogController(initial,async()=>{throw Error('SSR cannot fetch');},query);
  return {...controller.getSnapshot(),...controller};
 }},
});
function route(db:D1Database){return module('app/page.tsx',{
 '@/lib/server/catalog':catalog,'@/lib/server/db':{database:()=>db},'@/lib/public/catalog-navigation':navigation,
 '@/lib/server/seo':{pageMetadata:async()=>({})},'./reference-preview/ReferenceHome':home,
});}
async function published(){const db=testDatabase();const release=await stageImport(db,JSON.parse(readFileSync('private-import/reviewed-catalog-2026-10-04.json','utf8')) as ImportPacket,'home-consolidation');await publishRelease(db,release.id,0,'home-consolidation');return db;}

test('Every one of 43 public tours is reachable through visible, server-rendered home next hrefs',async()=>{
 const db=await published();try{
  const page=route(db),seen=new Set<string>();let next='/',pages=0;
  while(next){
   const url=new URL(next,'https://example.invalid');
   const rendered=await page.default({searchParams:Promise.resolve(Object.fromEntries(url.searchParams))});
   const markup=renderToStaticMarkup(rendered);
   const ids=[...markup.matchAll(/data-tour-id="([^"]+)"/g)].map(match=>match[1]);
   assert(ids.length>0&&ids.length<=4);for(const id of ids){assert(!seen.has(id));seen.add(id);}
   assert(!markup.includes('href="/catalog'));assert(!markup.includes('bot'));
   const match=markup.match(/<a class="showMore" href="([^"]+)" rel="next"/);
   next=match?match[1].replaceAll('&amp;','&'):'';
   assert(++pages<=11);
  }
  assert.equal(pages,11);assert.equal(seen.size,43);
  const all=await catalog.catalog(db,{limit:48});assert.deepEqual([...seen],all.items.map(tour=>tour.id));
 }finally{db.sqlite.close();}
});

test('Home query results and append requests retain every public filter and a page-two start',async()=>{
 const db=await published();try{
  const search={category:'sea',destination:'coral',sort:'title',page:'2'};
  const rendered=await route(db).default({searchParams:Promise.resolve(search)});
  const query={...navigation.catalogQueryFromSearch(search),limit:4};
  assert.deepEqual(rendered.props.data,await catalog.catalog(db,query));
  const calls:types.CatalogQuery[]=[];
  const feed=createReferenceCatalogController(rendered.props.data,async next=>{calls.push(next);return catalog.catalog(db,next);},query);
  assert.equal(feed.getSnapshot().appliedFilters.destination,'coral');
  if(feed.getSnapshot().hasMore){await feed.loadMore();assert.equal(calls[0].page,rendered.props.data.page+1);assert.equal(calls[0].destination,'coral');assert.equal(calls[0].sort,'title');}
  for(const search of [{q:'Рача'},{days:'1',transport:'Катер'},{category:'nature',format:'Группа'},{q:'definitely-no-match'}]){
   const result=await route(db).default({searchParams:Promise.resolve(search)});
   assert.deepEqual(result.props.data,await catalog.catalog(db,{...navigation.catalogQueryFromSearch(search),limit:4}));
  }
 }finally{db.sqlite.close();}
});

test('Legacy catalogue permanently redirects, preserves repeated query values and anchors the gallery',async()=>{
 const legacy=module('app/catalog/page.tsx',{'next/navigation':{permanentRedirect:(url:string)=>{throw Error(url);}},'@/lib/public/catalog-navigation':navigation});
 for(const search of [{},{q:'Рача & Корал',page:'2',search:'1',favorites:'1',destination:'coral',category:'sea',sort:'title',days:'1',transport:'Катер',format:'Группа'},{q:['one','two'],future:'kept'}]){
  const href=navigation.legacyCatalogHref(search);
  await assert.rejects(legacy.default({searchParams:Promise.resolve(search)}),{message:href});
  const url=new URL(href,'https://example.invalid');assert.equal(url.pathname,'/');assert.equal(url.hash,'#selected');
  for(const [key,value] of Object.entries(search))assert.deepEqual(url.searchParams.getAll(key),Array.isArray(value)?value:[value]);
 }
});

test('Favourite URLs never leak the unfiltered catalogue into the server-rendered favourite gallery',async()=>{
 const db=await published();try{
  const page=await route(db).default({searchParams:Promise.resolve({favorites:'1'})});
  assert.equal(page.props.onlyFavorites,true);assert.equal(page.props.data.items.length,0);
  const markup=renderToStaticMarkup(page);assert(markup.includes('Загружаем избранное'));assert(!markup.includes('data-tour-id='));
  const first=(await catalog.catalog(db,{limit:4})).items[0];
  const feed=createReferenceCatalogController(page.props.data,next=>catalog.catalog(db,next),page.props.initialQuery);
  await feed.restoreFilters({...page.props.initialQuery,ids:[first.id]},2);
  assert.deepEqual(feed.getSnapshot().data?.items.map(item=>item.id),[first.id]);
  assert.equal(feed.getSnapshot().error,'');
 }finally{db.sqlite.close();}
});

test('Compact search is always visible with one category, hidden legacy values and a no-JS fallback',()=>{
 const html=renderToStaticMarkup(React.createElement(filters.HomeCatalogFilters,{data:null,query:{q:'Рача',destination:'coral',days:'1'},onlyFavorites:true,onChange:()=>{},onReset:()=>{}}));
 assert(html.includes('method="get"'));assert(html.includes('action="/#selected"'));
 for(const name of ['q','category','days','destination','favorites'])assert(html.includes(`name="${name}"`));
 assert(html.includes('value="coral"'));assert(!html.includes('<details'));
 assert.equal((html.match(/<select/g)||[]).length,1);
 assert(html.includes('Куда или что хочется?'));assert(html.includes('htmlFor')===false);
 assert(html.includes('for="tour-search"'));assert(html.includes('for="tour-category"'));
 assert(html.includes('Очистить поиск'));assert(html.includes('type="submit"'));assert(html.includes('Найти'));
 assert(!html.includes('<noscript>')); // The real submit button is always available, including without JavaScript.
 for(const label of ['Транспорт','Длительность','Любой формат','Поиск и фильтры'])assert(!html.includes(label));
});



test('Later-page replacement retries, favourite removals and previous links keep the resolved start page',async()=>{
 const db=await published();try{
  const ids=(await catalog.catalog(db,{limit:48})).items.slice(0,14).map(item=>item.id);
  const query={ids,page:3,limit:4};
  const initial=await catalog.catalog(db,query);let fail=true;const calls:number[]=[];
  const feed=createReferenceCatalogController(initial,async next=>{calls.push(next.page!);if(fail){fail=false;throw Error('temporary');}return catalog.catalog(db,next);},query);
  assert.equal(feed.getSnapshot().firstPage,3);
  await feed.restoreFilters(query,3);assert.equal(feed.getSnapshot().error,'temporary');
  await feed.retry();assert.deepEqual(calls,[3,3]);assert.equal(feed.getSnapshot().firstPage,3);
  await feed.loadMore();assert.equal(feed.getSnapshot().data?.page,4);assert.equal(feed.getSnapshot().firstPage,3);
  await feed.restoreFilters({...query,ids:ids.slice(0,9)},feed.getSnapshot().firstPage);
  assert.equal(feed.getSnapshot().data?.page,3);assert.equal(feed.getSnapshot().firstPage,3);
  assert.equal(feed.getSnapshot().data?.items.length,1);
  await feed.restoreFilters({...query,ids:ids.slice(0,8)},feed.getSnapshot().firstPage);
  assert.equal(feed.getSnapshot().firstPage,2);assert.equal(feed.getSnapshot().data?.items.length,4);
 }finally{db.sqlite.close();}
});


test('Destination filter exits navigate to the real home instead of mounting a second general catalogue',()=>{
 const source=readFileSync('app/components/CatalogUI.tsx','utf8');
 const update=source.slice(source.indexOf(' function update('),source.indexOf(' async function compareTours'));
 assert(update.includes('window.location.assign(catalogHref(next,linkContext))'));
 assert(!update.includes('history.replaceState'));
 assert.equal(navigation.catalogHref({destination:undefined},{basePath:'/destination/coral',destinationId:'coral'}),'/#selected');
 assert.equal(navigation.catalogHref({destination:'racha-yai'},{basePath:'/destination/coral',destinationId:'coral'}),'/?destination=racha-yai#selected');
});

test('Browser history restores the expanded home feed without changing URLs or accepting another release',async()=>{
 const db=await published();try{
  const query={limit:4,page:1},initial=await catalog.catalog(db,query);
  const feed=createReferenceCatalogController(initial,next=>catalog.catalog(db,next),query);
  await feed.loadMore();const expanded=feed.getSnapshot();
  const entry={data:expanded.data!,filters:expanded.appliedFilters,firstPage:expanded.firstPage};
  const back=createReferenceCatalogController(initial,next=>catalog.catalog(db,next),query);
  assert.equal(back.restoreHistory(entry),true);assert.equal(back.getSnapshot().data?.items.length,24);
  await back.loadMore();assert.equal(back.getSnapshot().data?.items.length,43);
  assert.equal(back.restoreHistory({...entry,data:{...entry.data,releaseId:'other-release'}}),false);
  assert.equal(back.restoreHistory({...entry,filters:{category:'sea'}}),false);
  assert.equal(back.restoreHistory({...entry,firstPage:2}),false);
  const ids=initial.items.map(item=>item.id),favoritesQuery={ids,limit:4,page:1};
  const favoriteData=await catalog.catalog(db,favoritesQuery);
  const favorites=createReferenceCatalogController(favoriteData,async()=>{throw Error('Unchanged favorites must not replace the restored list');},favoritesQuery);
  assert.equal(await favorites.restoreFilters(favoritesQuery,1,true),true);
 }finally{db.sqlite.close();}
});

test('Load-more owns its dynamic progress badge and no detached visible counter remains',async()=>{
 const db=await published();try{
  const all=await catalog.catalog(db,{limit:48});
  for(const shown of [4,24]){
   const data={...all,items:all.items.slice(0,shown),page:Math.ceil(shown/4),pages:Math.ceil(all.total/4)};
   const markup=renderToStaticMarkup(React.createElement(home.ReferenceHome,{data,initialQuery:{}}));
   const control=markup.match(/<a class="showMore"[^>]*>[\s\S]*?<\/a>/)?.[0];assert(control);
   assert(control.includes('Показать ещё'));assert(control.includes(`class="progressBadge" aria-hidden="true">${shown} / ${all.total}</span>`));
   assert(control.includes(`Показано: ${shown}. Всего: ${all.total} программы.`));
   assert(!markup.includes('class="visibleCount"'));assert(markup.includes('aria-live="polite"'));
  }
 }finally{db.sqlite.close();}
});

test('Completed filtered galleries use count-aware captions and no active load-more link',async()=>{
 const db=await published();try{
  const all=await catalog.catalog(db,{limit:48});
  for(const [total,expected] of [[0,'Нет программ'],[1,'1 программа'],[4,'Все 4 программы'],[20,'Все 20 программ'],[21,'Все программы · 21'],[23,'Все 23 программы'],[43,'Все 43 программы']] as const){
   const data={...all,items:all.items.slice(0,total),total,page:Math.max(1,Math.ceil(total/4)),pages:Math.ceil(total/4)};
   const markup=renderToStaticMarkup(React.createElement(home.ReferenceHome,{data,initialQuery:{category:'sea'}}));
   assert(!markup.includes('<a class="showMore"'));assert(markup.includes(`<button type="button" class="showMore" disabled=""><span>${expected}</span>`),expected);
   assert(!markup.includes('class="visibleCount"'));
  }
 }finally{db.sqlite.close();}
});

test('Approved no-header home retains accessible brand, h1, catalogue search, four favourite controls and next-page navigation',async()=>{
 const db=await published();try{
  const markup=renderToStaticMarkup(await route(db).default());
  assert(!markup.includes('<header'));assert(!markup.includes('reference-navigation'));
  assert(!markup.includes('Больше, чем путешествия</span>'));
  assert.match(markup,/<a class="heroBrand" href="\/#selected" aria-label="Double Bottle Co’ — главная">Double Bottle Co’<span>PHUKET &amp; BEYOND<\/span><\/a>/);
  assert.equal((markup.match(/<h1\b/g)||[]).length,1);
  assert(markup.includes('<h1 id="reference-heading"><span>Пхукет</span><span>и гораздо</span><span>больше</span></h1>'));
  assert(markup.includes('href="#main-content"'));assert(markup.includes('id="main-content"'));
  assert(markup.includes('role="search"'));assert(markup.includes('type="submit"'));
  assert.equal((markup.match(/aria-pressed="false"/g)||[]).length,4);
  assert(markup.includes('rel="next"'));assert(markup.includes('aria-live="polite"'));
  assert(markup.includes('class="primaryAction" href="/#selected">Выбрать экскурсию</a>'));
 }finally{db.sqlite.close();}
});
