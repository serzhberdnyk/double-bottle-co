import {pageMetadata} from '@/lib/server/seo';
import {pagesCopy,creditLinks} from '@/lib/i18n/pages-copy';
import {currentLocale} from '@/lib/i18n/server';
import {Header,Footer} from '../components/SiteChrome';

export async function generateMetadata(){
  const copy=pagesCopy[await currentLocale()].credits;
  return pageMetadata({...copy.seo,path:'/credits'});
}
export default async function Credits(){
  const copy=pagesCopy[await currentLocale()].credits;
  return <><Header/><main className="content-page">
    <span className="eyebrow">{copy.eyebrow}</span>
    <h1>{copy.title[0]}<br/>{copy.title[1]}</h1>
    {copy.sections.flatMap(section=>section.paragraphs).map((paragraph,index)=><p key={index}>{paragraph}</p>)}
    <h2>{copy.mapHeading}</h2>
    <p>© <a href={creditLinks.osm}>{copy.mapAttribution}</a>. {copy.mapLicenseBefore} <a href={creditLinks.odbl}>ODbL 1.0</a>. {copy.mapLicenseAfter} <a href={creditLinks.mapDownload} download>{copy.downloadMap}</a>.</p>
    <p>{copy.mapNotes}</p>
    <h2>{copy.fontsHeading}</h2>
    <p>{copy.fontsText} <a href={creditLinks.fontLicense}>{copy.fontLicense}</a>.</p>
  </main><Footer/></>;
}
