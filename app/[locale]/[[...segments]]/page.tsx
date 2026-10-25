import {notFound} from 'next/navigation';
import Home, {generateMetadata as homeMeta} from '@/app/page';
import About, {generateMetadata as aboutMeta} from '@/app/about/page';
import Guide, {generateMetadata as guideMeta} from '@/app/guide/page';
import Privacy, {generateMetadata as privacyMeta} from '@/app/privacy/page';
import Credits, {generateMetadata as creditsMeta} from '@/app/credits/page';
import Destinations, {generateMetadata as destinationsMeta} from '@/app/destinations/page';
import Tour, {generateMetadata as tourMeta} from '@/app/tour/[slug]/page';
import Destination, {generateMetadata as destinationMeta} from '@/app/destination/[slug]/page';
import Catalog from '@/app/catalog/page';
import CheowLan, {generateMetadata as cheowLanMeta} from '@/app/cheow-lan/page';
import type {CatalogSearch} from '@/lib/public/catalog-navigation';
export const dynamic='force-dynamic';
type Props={params:Promise<{locale:string;segments?:string[]}>;searchParams:Promise<CatalogSearch>};
async function resolve({params,searchParams}:Props){const p=await params;if(p.locale!=='en'&&p.locale!=='th')notFound();const s=p.segments||[];const props={params:Promise.resolve({slug:s[1]}),searchParams};return {s,props};}
export async function generateMetadata(input:Props){const {s,props}=await resolve(input);if(!s.length)return homeMeta(props);if(s.length===1){switch(s[0]){case 'about':return aboutMeta();case 'guide':return guideMeta();case 'privacy':return privacyMeta();case 'credits':return creditsMeta();case 'destinations':return destinationsMeta();case 'catalog':return {robots:{index:false}};case 'cheow-lan':return cheowLanMeta();}}if(s.length===2&&s[0]==='tour')return tourMeta(props);if(s.length===2&&s[0]==='destination')return destinationMeta(props);notFound();}
export default async function LocalizedPage(input:Props){const {s,props}=await resolve(input);if(!s.length)return Home(props);if(s.length===1){switch(s[0]){case 'about':return About();case 'guide':return Guide();case 'privacy':return Privacy();case 'credits':return Credits();case 'destinations':return Destinations();case 'catalog':return Catalog(props);case 'cheow-lan':return CheowLan();}}if(s.length===2&&s[0]==='tour')return Tour(props);if(s.length===2&&s[0]==='destination')return Destination(props);notFound();}
