import {Fragment} from 'react';
import {pageMetadata} from '@/lib/server/seo';
import {pagesCopy} from '@/lib/i18n/pages-copy';
import {currentLocale} from '@/lib/i18n/server';
import {localePath} from '@/lib/i18n/core';
import {Header,Footer} from '../components/SiteChrome';

export async function generateMetadata(){
  const copy=pagesCopy[await currentLocale()].guide;
  return pageMetadata({...copy.seo,path:'/guide'});
}
export default async function Guide(){
  const locale=await currentLocale(),copy=pagesCopy[locale].guide;
  return <><Header/><main className="content-page">
    <span className="eyebrow">{copy.eyebrow}</span>
    <h1>{copy.title[0]}<br/>{copy.title[1]}</h1>
    {copy.sections.map((section,index)=><Fragment key={index}>
      {section.heading&&<h2>{section.heading}</h2>}
      {section.paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}
    </Fragment>)}
    {copy.cta&&<a className="primary-button" href={localePath('/#selected',locale)}>{copy.cta}</a>}
  </main><Footer/></>;
}
