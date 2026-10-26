'use client';
import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import type {ServiceCompany} from '../../lib/public/admin-service-sort';
import styles from './company-filter.module.css';

export function CompanyFilter({companies,value,onChange,disabled=false}:{companies:ServiceCompany[];value:string;onChange:(id:string)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null),options=useRef<HTMLDivElement>(null),id=useId();
 const selected=companies.find(company=>company.id===value),term=query.trim().toLocaleLowerCase('ru');
 const matches=companies.filter(company=>company.name.toLocaleLowerCase('ru').includes(term));
 const expanded=open&&!disabled;
 function close(restoreFocus=false){setOpen(false);if(restoreFocus)trigger.current?.focus();}
 function choose(companyId:string){if(disabled)return;onChange(companyId);close(true);}
 useEffect(()=>{
  if(!expanded)return;
  search.current?.focus();
  function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false);}
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[expanded]);
 function navigate(event:KeyboardEvent<HTMLDivElement>){
  if(!expanded)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
  const buttons=Array.from(options.current?.querySelectorAll('button')||[]),index=buttons.indexOf(event.target as HTMLButtonElement);
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();
   const next=index<0?(event.key==='ArrowDown'?0:buttons.length-1):(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
   buttons[next]?.focus();
  }else if(index>=0&&(event.key==='Home'||event.key==='End')){
   event.preventDefault();buttons[event.key==='Home'?0:buttons.length-1]?.focus();
  }
 }
 return <div ref={root} className={styles.filter} onKeyDown={navigate} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))close();}}>
  <button ref={trigger} type="button" className={styles.trigger} disabled={disabled} aria-expanded={expanded} aria-controls={id} aria-label={'Компания: '+(selected?.name||'Все компании')} onClick={()=>{setQuery('');setOpen(!expanded);}} onKeyDown={event=>{if(!expanded&&(event.key==='ArrowDown'||event.key==='ArrowUp')){event.preventDefault();event.stopPropagation();setQuery('');setOpen(true);}}}><span>{selected?.name||'Все компании'}</span><span aria-hidden="true">▾</span></button>
  {expanded&&<div id={id} className={styles.popup} role="region" aria-label="Выбор компании">
   <input ref={search} className={styles.search} type="search" aria-label="Поиск компании" placeholder="Поиск компании" value={query} onChange={event=>setQuery(event.target.value)} autoComplete="off"/>
   <div ref={options} className={styles.options}>
    <button type="button" aria-pressed={!value} onClick={()=>choose('')}>Все компании<span aria-hidden="true">{!value?'✓':''}</span></button>
    {matches.map(company=><button type="button" key={company.id} aria-pressed={value===company.id} onClick={()=>choose(company.id)}>{company.name}<span aria-hidden="true">{value===company.id?'✓':''}</span></button>)}
    {!matches.length&&<p role="status">Компании не найдены</p>}
   </div>
  </div>}
 </div>;
}
