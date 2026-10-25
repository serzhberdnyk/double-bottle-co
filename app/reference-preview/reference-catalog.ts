import type {CatalogQuery} from '../../lib/public/types';

// Share the catalogue's existing query contract; no duplicate programme list.
export function referenceCatalogQuery(query:CatalogQuery):string {
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(query)) {
    if(value===undefined || value==='' || key==='featured')continue;
    params.set(key,Array.isArray(value)?value.join(','):String(value));
  }
  return params.toString();
}

export function referenceDestinationHref(destinationId:string):string {
  return '/?'+referenceCatalogQuery({destination:destinationId})+'#selected';
}
