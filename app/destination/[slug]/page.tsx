import {notFound} from 'next/navigation';
import {database} from '@/lib/server/db';
import {destination,catalog} from '@/lib/server/catalog';
import {CatalogExperience} from '@/app/components/CatalogUI';
import {catalogQueryFromSearch,catalogHref,indexableCatalogSearch,type CatalogSearch} from '@/lib/public/catalog-navigation';
import {pageMetadata} from '@/lib/server/seo';
import {pagesCopy} from '@/lib/i18n/pages-copy';
import {currentLocale} from '@/lib/i18n/server';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>;searchParams:Promise<CatalogSearch>};
export async function generateMetadata({params,searchParams}:Props){
 const search=await searchParams,copy=pagesCopy[await currentLocale()].destination;
 try{const d=await destination(database(),(await params).slug);if(d){const query=catalogQueryFromSearch(search,d.id),data=await catalog(database(),query);return pageMetadata({title:copy.titlePrefix+d.name,description:d.description,path:catalogHref(query,{basePath:'/destination/'+encodeURIComponent(d.slug),destinationId:d.id}),indexable:indexableCatalogSearch(search,{destinationPage:true})&&data.page===query.page&&data.total>0});}}
 catch{/* The page itself retains its original error/404 behavior. */}
 return pageMetadata({title:copy.fallbackTitle,description:copy.fallbackDescription,path:'/destinations',indexable:false});
}
export default async function DestinationPage({params,searchParams}:Props){const d=await destination(database(),(await params).slug);if(!d)notFound();const query=catalogQueryFromSearch(await searchParams,d.id);const data=await catalog(database(),query);return <CatalogExperience initial={data} initialQuery={query} basePath={'/destination/'+encodeURIComponent(d.slug)} destinationId={d.id}/>;}
