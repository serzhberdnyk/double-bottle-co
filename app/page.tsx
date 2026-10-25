import {currentLocale} from '@/lib/i18n/server';
import {catalog} from '@/lib/server/catalog';
import {database} from '@/lib/server/db';
import type {CatalogResponse} from '@/lib/public/types';
import {catalogQueryFromSearch,catalogHref,indexableCatalogSearch,type CatalogSearch} from '@/lib/public/catalog-navigation';
import {publishedMapDocument} from '@/lib/server/map-editor';
import {defaultMapDocument} from '@/lib/public/map-layout';
import {ReferenceHome} from './reference-preview/ReferenceHome';
import {pageMetadata} from '@/lib/server/seo';

export const dynamic = 'force-dynamic';
type Props={searchParams?:Promise<CatalogSearch>};
export async function generateMetadata({searchParams}:Props={}) {
  const search=await searchParams||{},query={...catalogQueryFromSearch(search),limit:4};
  let indexable=indexableCatalogSearch(search);
  try{const data=await catalog(database(),query);indexable=indexable&&data.page===query.page&&data.total>0;}catch{indexable=false;}
  const locale=await currentLocale();const titles={ru:'Double Bottle Co’ — экскурсии на Пхукете и в Таиланде',en:'Double Bottle Co’ — Phuket and Thailand tours',th:'Double Bottle Co’ — ทัวร์ภูเก็ตและประเทศไทย'};const descriptions={ru:'Острова, природа и культура Таиланда. Выбирайте экскурсии и направления, сравнивайте варианты программ и запрашивайте условия на вашу дату.',en:'Explore the islands, nature and culture of Thailand. Compare tours and destinations, and ask about availability and conditions for your dates.',th:'สำรวจหมู่เกาะ ธรรมชาติ และวัฒนธรรมของไทย เปรียบเทียบทัวร์และจุดหมายปลายทาง พร้อมสอบถามวันว่างและเงื่อนไขสำหรับวันที่คุณต้องการ'};
  const meta=await pageMetadata({title:titles[locale],description:descriptions[locale],path:catalogHref(query,{anchor:false}),indexable});
  return {...meta,title:{absolute:titles[locale]}};
}

// Human and crawler receive the same published four-card page and next href.
export default async function Home({searchParams}:Props={}) {
  const search=await searchParams||{},onlyFavorites=search.favorites==='1';
  const query={...catalogQueryFromSearch(search),limit:4,...(onlyFavorites?{ids:['__empty__']}: {})};
  let data: CatalogResponse | null = null;
  try { data = await catalog(database(), query); }
  catch { /* Keep the approved scene and its honest catalogue retry state. */ }
  let mapDocument=defaultMapDocument;try{mapDocument=await publishedMapDocument(database());}catch{}
  return <ReferenceHome mapDocument={mapDocument} data={data} initialQuery={query} onlyFavorites={onlyFavorites} searchOpen={search.search!==undefined}/>;
}
