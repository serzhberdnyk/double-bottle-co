import {movedVariantSlug,variantRedirectPath} from '@/lib/server/variant-owner-redirect';
import {currentLocale} from '@/lib/i18n/server';
import {localePath} from '@/lib/i18n/core';
import {notFound,permanentRedirect,redirect} from 'next/navigation';
import {database} from '@/lib/server/db';
import {product,canonicalSlug} from '@/lib/server/catalog';
import {TourPage} from '@/app/components/CatalogUI';
import {pageMetadata,canonicalPageUrl} from '@/lib/server/seo';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){try{const p=await product(database(),(await params).slug);if(p)return pageMetadata({title:p.tour.title,description:p.tour.description,path:'/tour/'+encodeURIComponent(p.tour.slug)});}catch{}return pageMetadata({title:'Программа',description:'Программы экскурсий из каталога Double Bottle Co’.',path:'/',indexable:false});}
export default async function ProductPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams?:Promise<Record<string,string|string[]|undefined>>}){const {slug}=await params;const query=await searchParams||{};const moved=await movedVariantSlug(database(),slug,query.variant);if(moved&&moved.slug!==slug)redirect(localePath(variantRedirectPath(moved.slug,query),await currentLocale()));const p=await product(database(),slug);if(!p){const r=await canonicalSlug(database(),slug);if(r&&r.slug!==slug)permanentRedirect(localePath('/tour/'+r.slug,await currentLocale()));notFound();}const canonical=await canonicalPageUrl('/tour/'+encodeURIComponent(p.tour.slug));const structured={'@context':'https://schema.org','@type':'TouristTrip',inLanguage:await currentLocale(),name:p.tour.title,description:p.tour.description,provider:{'@type':'Organization',name:'Double Bottle Co’'},...(canonical?{url:canonical}:{})};return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,'\\u003c')}}/><TourPage tour={p.tour} releaseId={p.releaseId}/></>;}
