import {pageMetadata} from '@/lib/server/seo';
import {TourImage} from '../components/TourImage';
import {database} from '@/lib/server/db';
import {catalog} from '@/lib/server/catalog';
import {pagesCopy} from '@/lib/i18n/pages-copy';
import {currentLocale} from '@/lib/i18n/server';
import {localePath} from '@/lib/i18n/core';
import {Header,Footer,Unavailable} from '../components/SiteChrome';

export async function generateMetadata(){
  const copy=pagesCopy[await currentLocale()].destinations;
  return pageMetadata({...copy.seo,path:'/destinations'});
}
export const dynamic='force-dynamic';
export default async function Destinations(){
  const locale=await currentLocale(),copy=pagesCopy[locale].destinations;
  try{
    const d=await catalog(database(),{limit:1});
    return <><Header/><main className="content-page">
      <span className="eyebrow">{copy.eyebrow}</span>
      <h1>{copy.title[0]}<br/>{copy.title[1]}</h1>
      {copy.sections.flatMap(section=>section.paragraphs).map((paragraph,index)=><p key={index}>{paragraph}</p>)}
      <div className="destination-grid">{d.destinations.map(x=><a className="destination-tile" href={localePath('/destination/'+x.slug,locale)} key={x.id}>
        {x.image&&<TourImage src={x.image} alt={x.name}/>}
        <h2>{x.name}</h2><p>{x.description}</p><span className="text-link">{copy.programCount(x.count??0)}</span>
      </a>)}</div>
    </main><Footer/></>;
  }catch{return <Unavailable/>;}
}
