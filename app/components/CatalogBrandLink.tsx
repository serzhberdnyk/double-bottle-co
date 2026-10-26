'use client';

import {useEffect,useState,type ReactNode,type SyntheticEvent} from 'react';
import {useI18n} from '@/lib/i18n/context';
import {brandCatalogHref} from '@/lib/public/catalog-navigation';

/** Native navigation unmounts program selection and lets browser history restore each page. */
export function CatalogBrandLink({className,label,children}:{className?:string;label:string;children:ReactNode}){
 const {href:localHref}=useI18n();
 const [target,setTarget]=useState(localHref('/#selected'));
 useEffect(()=>{
  const sync=()=>setTarget(localHref(brandCatalogHref(location.search)));
  sync();window.addEventListener('popstate',sync);
  return()=>window.removeEventListener('popstate',sync);
 },[localHref]);
 function refresh(event:SyntheticEvent<HTMLAnchorElement>){
  // Filters can change via pushState after mount; use the current URL at activation.
  const next=localHref(brandCatalogHref(location.search));
  event.currentTarget.href=next;setTarget(next);
 }
 return <a className={className} aria-label={label} href={target} onClick={refresh} onAuxClick={refresh} onFocus={refresh} onContextMenu={refresh}>{children}</a>;
}
