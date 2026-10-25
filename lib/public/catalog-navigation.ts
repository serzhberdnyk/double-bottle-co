import {categoryNames,type CatalogQuery} from './types';

export type CatalogSearch=Record<string,string|string[]|undefined>;
const text=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined;
export function catalogQueryFromSearch(search:CatalogSearch,fixedDestination?:string):CatalogQuery {
  return {sort:text(search.sort),q:text(search.q),category:text(search.category),destination:fixedDestination||text(search.destination),transport:text(search.transport),format:text(search.format),days:text(search.days),page:Math.max(1,Math.trunc(Number(text(search.page))||1))};
}
export type CatalogLinkContext={basePath?:string;destinationId?:string;favorites?:boolean;search?:boolean;anchor?:boolean};
export function catalogHref(query:CatalogQuery,context:CatalogLinkContext={}) {
  const destinationPath=context.basePath?.startsWith('/destination/')&&query.destination===context.destinationId;
  const path=destinationPath?context.basePath!:'/';
  const params=new URLSearchParams();
  for(const key of ['category','destination','q','days','transport','format','sort'] as const){
    const value=query[key];
    if(value&&!(key==='destination'&&destinationPath)&&!(key==='sort'&&value==='recommended'))params.set(key,value);
  }
  if(query.page&&query.page>1)params.set('page',String(query.page));
  if(context.favorites)params.set('favorites','1');
  if(context.search)params.set('search','1');
  return path+(params.size?'?'+params.toString():'')+(!destinationPath&&context.anchor!==false?'#selected':'');
}
export function indexableCatalogSearch(search:CatalogSearch,{destinationPage=false}:{destinationPage?:boolean}={}) {
  const allowed=destinationPage?['page']:['page','category'];
  if(Object.keys(search).some(key=>!allowed.includes(key)))return false;
  if(search.category!==undefined&&(typeof search.category!=='string'||!Object.hasOwn(categoryNames,search.category)))return false;
  if(search.page!==undefined&&(typeof search.page!=='string'||!/^\d+$/.test(search.page)||Number(search.page)<1||!Number.isSafeInteger(Number(search.page))))return false;
  return true;
}

// Keep every legacy query value, including repeated and future filters.
export function legacyCatalogHref(search:CatalogSearch) {
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(search)){
    for(const item of Array.isArray(value)?value:value===undefined?[]:[value])params.append(key,item);
  }
  return '/'+(params.size?'?'+params.toString():'')+'#selected';
}
