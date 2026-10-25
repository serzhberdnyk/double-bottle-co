import {Header,Footer} from './components/SiteChrome';
import {currentLocale} from '@/lib/i18n/server';
import {localePath} from '@/lib/i18n/core';
export const metadata={robots:{index:false,follow:true}};
export default async function NotFound(){const locale=await currentLocale();const copy={ru:{title:'Пойдём другим маршрутом?',text:'Эта страница не найдена. А в каталоге есть другие направления для вашего путешествия.',action:'Открыть каталог'},en:{title:'Shall we take another route?',text:'This page was not found. Explore other destinations in our tour catalog.',action:'Open tour catalog'},th:{title:'ลองเปลี่ยนเส้นทางกันไหม?',text:'ไม่พบหน้านี้ ลองสำรวจจุดหมายปลายทางอื่นในแคตตาล็อกทัวร์ของเรา',action:'ดูแคตตาล็อกทัวร์'}}[locale];return <><Header/><main className="content-page"><span className="eyebrow">Double Bottle Co’</span><h1>{copy.title}</h1><p>{copy.text}</p><a className="primary-button" href={localePath('/#selected',locale)}>{copy.action}</a></main><Footer/></>;}
