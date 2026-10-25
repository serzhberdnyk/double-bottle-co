'use client';
import {useState} from 'react';
import {BulkTranslations} from './BulkTranslations';
import {TranslationConfirmation} from './TranslationConfirmation';
import {translationBatchTemplate,type TranslationRow,type TranslationChange} from './translation-batch';
import {withPublishedTranslation,type CatalogLocalizationReadiness} from '@/lib/public/catalog-localization';
type Data={sources:string[];rows:TranslationRow[];seed:{en:Record<string,string>;th:Record<string,string>};readiness:CatalogLocalizationReadiness};
export function TranslationsPanel(){
 const [data,setData]=useState<Data|null>(null),[locale,setLocale]=useState<'en'|'th'>('en'),[filter,setFilter]=useState(''),[missingOnly,setMissingOnly]=useState(true),[source,setSource]=useState(''),[text,setText]=useState(''),[revision,setRevision]=useState(0),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
 async function load(){setBusy(true);try{const r=await fetch('/api/admin/translations'),d=await r.json() as Data & {error?:string};if(!r.ok)throw Error(d.error||'Ошибка загрузки');setData(d);setSource('');setMessage('');}catch(e){setMessage(String(e));}finally{setBusy(false);}}
 function choose(value:string,l=locale){if(!data)return;const row=data.rows.find(x=>x.source_text===value&&x.locale===l);setSource(value);setText(row?.translated_text||data.seed[l][value]||'');setRevision(row?.revision||0);setMessage('');}
 function recorded(change:TranslationChange,nextRevision:number,published:boolean){setData(prev=>prev?{
  ...prev,rows:[...prev.rows.filter(row=>!(row.locale===change.locale&&row.source_text===change.source)),{locale:change.locale,source_text:change.source,translated_text:change.translation,published_text:published?change.translation:prev.rows.find(row=>row.locale===change.locale&&row.source_text===change.source)?.published_text||null,revision:nextRevision}],
  readiness:published?withPublishedTranslation(prev.readiness,change.locale,change.source):prev.readiness,
 }:prev);}
 async function save(action:'save'|'publish'){setBusy(true);try{const r=await fetch('/api/admin/translations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,locale,source,translation:text,revision})}),result=await r.json() as {error?:string;revision:number;published:boolean};if(!r.ok)throw Error(result.error||'Ошибка сохранения');if(result.revision!==revision+1||result.published!==(action==='publish'))throw Error('Ответ не подтверждает сохранение. Обновите список и сверьте результат.');setRevision(result.revision);recorded({locale,source,translation:text,revision},result.revision,result.published);setMessage(action==='publish'?'Перевод опубликован.':'Черновик перевода сохранён. Публичный текст не изменён.');}catch(e){setMessage(String(e));}finally{setBusy(false);setConfirm(false);}}
 function download(){if(!data)return;const template=translationBatchTemplate(data.sources,data.rows,data.seed),url=URL.createObjectURL(new Blob([JSON.stringify(template,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`double-bottle-translations-generation-${data.readiness.generation}.json`;a.click();URL.revokeObjectURL(url);}
 const pending=new Set(data?.readiness.locales[locale].missing||[]);
 const sources=data?.sources.filter(s=>(!missingOnly||pending.has(s))&&(!filter||s.toLocaleLowerCase().includes(filter.toLocaleLowerCase())))||[];
 return <section className="admin-section"><h2>Переводы каталога · English / ไทย</h2>
  <details><summary>Как работают переводы</summary>  <p>Русский — основной язык. Цены, даты, маршруты, видимость и права общие для всех языков. Переводы накладываются на тот же каталог, отдельные карточки и тарифы создавать не нужно. Один перевод одинаковой фразы применяется ко всем её вхождениям.</p>
  <p><strong>Автоматический перевод новых текстов не подключён.</strong> После изменения русского текста или добавления тура обновите список: новые фразы появятся в очереди ниже. Переведите EN и TH, проверьте и опубликуйте через эту форму или пакет. Карточка на другом языке доступна только после полного перевода; русский текст вместо перевода не показывается.</p>
</details>
  <button disabled={busy||confirm} onClick={load}>{data?'Обновить список':'Загрузить переводы'}</button>
  {data&&<>
   <h3>Готовность опубликованного каталога</h3>
   <p>Версия каталога: {data.readiness.generation}. RU: {data.readiness.tours.length}; EN: {data.readiness.locales.en.ready} из {data.readiness.locales.en.total}; TH: {data.readiness.locales.th.ready} из {data.readiness.locales.th.total}.</p>
   <p>Это очередь недостающих переводов, не фоновый автоматический перевод. Сохранённый черновик перевода не делает карточку доступной.</p>
   <details><summary>Готовность каждой карточки</summary><ul>{data.readiness.tours.map(tour=><li key={tour.id}><strong>{tour.title}</strong>{(['en','th'] as const).map(l=><span key={l}> · {l.toUpperCase()}: {tour.locales[l].ready?'готово':<button disabled={busy||confirm} onClick={()=>{setLocale(l);setMissingOnly(true);setFilter('');choose(tour.locales[l].missing[0],l);}}>не переведено фраз: {tour.locales[l].missing.length}</button>}</span>)}</li>)}</ul></details>
   <p>Фраз: {data.sources.length}. Без опубликованного перевода {locale.toUpperCase()}: {pending.size}.</p>
   <button disabled={busy||!data.readiness.locales.en.missing.length&&!data.readiness.locales.th.missing.length} onClick={download}>Скачать шаблон EN / TH (до 100 недостающих фраз)</button>
   <label>Язык <select disabled={busy||confirm} value={locale} onChange={e=>{const l=e.target.value as 'en'|'th';setLocale(l);if(source)choose(source,l);}}><option value="en">English</option><option value="th">ไทย</option></select></label>
   <label><input type="checkbox" checked={missingOnly} onChange={e=>setMissingOnly(e.target.checked)}/>Только без опубликованного перевода</label>
   <label>Поиск по русскому тексту <input value={filter} onChange={e=>setFilter(e.target.value)}/></label>
   <label>Исходная фраза <select disabled={busy||confirm} value={source} onChange={e=>choose(e.target.value)}><option value="">Выберите фразу</option>{[...(source&&!sources.includes(source)?[source]:[]),...sources].map(s=><option key={s} value={s}>{s.length>130?s.slice(0,130)+'…':s}</option>)}</select></label>
   {source&&<><blockquote style={{whiteSpace:'pre-wrap'}}>{source}</blockquote><label>Перевод <textarea disabled={busy||confirm} lang={locale} rows={7} value={text} onChange={e=>setText(e.target.value)}/></label><div><button disabled={busy||confirm||!text.trim()} onClick={()=>save('save')}>Сохранить черновик перевода</button><button disabled={busy||confirm||!text.trim()} onClick={()=>setConfirm(true)}>Опубликовать перевод</button></div></>}
  </>}
  {confirm&&<TranslationConfirmation count={1} busy={busy} onCancel={()=>setConfirm(false)} onConfirm={()=>save('publish')}><strong>{locale.toUpperCase()}</strong><blockquote>{source}</blockquote><p>{text}</p></TranslationConfirmation>}
  {data&&<BulkTranslations sources={data.sources} rows={data.rows} onPublished={(change,nextRevision)=>recorded(change,nextRevision,true)}/>}
  <p role="status">{message}</p>
 </section>;
}
