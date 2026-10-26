'use client';
import {useI18n} from '@/lib/i18n/context';

import {Heart,Search,Menu,X} from 'lucide-react';
import {useState} from 'react';
import {LanguageSwitcher} from './LanguageSwitcher';
import {LicenseBadge} from './LicenseBadge';
import {BrandMark} from './BrandMark';
import {CatalogBrandLink} from './CatalogBrandLink';
export function Header({dark=false}:{dark?:boolean}){
 const {t:tr,href:localHref}=useI18n();
const [open,setOpen]=useState(false);return <><header className={'site-header '+(dark?'dark-header':'')}><CatalogBrandLink className="wordmark" label={tr("Double Bottle Co’ - главная")}><BrandMark/><div className="brand-copy">Double Bottle Co’<span>{tr("Впечатления остаются")}</span></div></CatalogBrandLink><nav className={open?'nav open':'nav'} aria-label={tr("Основная навигация")}><a href={localHref("/#selected")}>{tr("Экскурсии")}</a><a href={localHref("/destinations")}>{tr("Направления")}</a><a href={localHref("/guide")}>{tr("Как выбрать")}</a><a href={localHref("/about")}>{tr("О нас")}</a></nav><div className="header-actions"><a className="icon-label" href={localHref("/?search=1#selected")}><Search size={20}/><span>{tr("Поиск")}</span></a><a className="icon-label" href={localHref("/?favorites=1#selected")}><Heart size={20}/><span>{tr("Избранное")}</span></a><a className="header-cta" href={localHref("/#selected")}>{tr("Помочь с выбором")}</a><button className="mobile-menu" aria-label={open?tr("Закрыть меню"):tr("Открыть меню")} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></div></header><div className="site-language-bar"><LanguageSwitcher/></div></>;}
export function Footer(){
 const {t:tr,href:localHref}=useI18n();
return <footer className="site-footer"><a className="footer-brand" href={localHref("/#selected")}><BrandMark/>Double Bottle Co’</a><span>{tr("Больше, чем путешествия. Настоящие впечатления.")}</span><nav aria-label={tr("Служебная навигация")}><a href={localHref("/guide")}>{tr("Как забронировать")}</a><a href={localHref("/privacy")}>{tr("Конфиденциальность")}</a><a href={localHref("/credits")}>{tr("Источники фото и карты")}</a></nav><LicenseBadge/></footer>;}
export function Unavailable(){
 const {t:tr,href:localHref}=useI18n();
return <><Header/><main className="content-page unavailable"><span className="eyebrow">Double Bottle Co’</span><h1>{tr("Скоро продолжим")}<br/>{tr("путешествие")}</h1><p>{tr("Каталог временно недоступен. Попробуйте обновить страницу через некоторое время.")}</p><a className="primary-button" href={localHref("/#selected")}>{tr("Обновить каталог")}</a></main><Footer/></>;}
