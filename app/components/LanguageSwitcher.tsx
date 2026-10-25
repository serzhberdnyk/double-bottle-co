'use client';
import {useEffect,useState,useId} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {languageNames,locales,localePath} from '@/lib/i18n/core';
import {useI18n} from '@/lib/i18n/context';
import {languageTicket} from '@/lib/public/language-ticket';
import styles from './LanguageSwitcher.module.css';
export function LanguageSwitcher(){
 const {locale}=useI18n(),clip='language-ticket-'+useId().replace(/:/g,'');const path=usePathname()||'/';const query=useSearchParams();const [hash,setHash]=useState('');
 useEffect(()=>{const sync=()=>setHash(window.location.hash);sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 if(/^\/admin(?:\/|$)/.test(path))return null;
 const suffix=(query?.toString()?'?'+query.toString():'')+hash;
 return <nav className={styles.switcher} aria-label={locale==='ru'?'Язык сайта':locale==='th'?'ภาษาของเว็บไซต์':'Website language'}>
  <svg className={styles.art} viewBox="0 0 441 113" aria-hidden="true" focusable="false">
   <defs><clipPath id={clip}><path d={languageTicket.path}/></clipPath></defs>
   <path d={languageTicket.path} fill="#0a3049" transform="translate(6 6)"/>
   <g clipPath={`url(#${clip})`}>{locales.map((value,index)=><rect key={value} className={styles[value]} data-active={value===locale} x={index*147} y={0} width={147} height={113} fill={value===locale?'#ffcd4f':'#fff2d3'}/>)}</g>
   <path d={languageTicket.path} fill="none" stroke="#0a3049" strokeWidth={3}/>
   <path d="M147 16V97M294 16V97" fill="none" stroke="#0a3049" strokeWidth={3} strokeDasharray="5 5"/>
  </svg>
  {locales.map(value=><a key={value} data-lang={value} lang={value} hrefLang={value} aria-label={languageNames[value]} title={languageNames[value]} href={localePath(path,value)+suffix} aria-current={value===locale?'page':undefined} className={styles.language}><span className={styles.face}>{value.toUpperCase()}</span></a>)}
 </nav>;
}
