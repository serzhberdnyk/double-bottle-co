'use client';
import {SellingPriceFields} from './selling-price-fields';
import {sellingMinorUnits} from '../../lib/public/selling-price-editor';
import {type ServiceCompanies} from '@/lib/public/admin-service-sort';
import {ProgrammeEditor} from './programme-editor';
import {VariantImageEditor} from './variant-image-editor';
import {programmeItemsSchema} from '@/lib/public/programme-items';
import {ImageGuidance} from './image-guidance';
import {usesCompactTourLayout} from '@/lib/public/compact-tour';
import {CreateTourPanel} from './create-tour-panel';
import {useEditorImageUpload} from '@/hooks/use-editor-image-upload';
import {useEffect,useId,useState} from 'react';
import {editorPayload,type EditorDraft,type EditorPayload} from '@/lib/public/catalog-editor';
import type {Tour} from '@/lib/public/types';
import {tourCover} from '@/lib/public/tour-cover';
import styles from './catalog-panel.module.css';
type State={state:{release_id:string;generation:number};tours:Tour[];serviceCompanies:ServiceCompanies;drafts:EditorDraft[];releases:{id:string;createdAt:string}[]};
async function api<T>(body?:unknown):Promise<T>{const r=await fetch('/api/admin/catalog',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);const data=await r.json() as T&{error?:string};if(!r.ok)throw Error(data.error||'Не удалось выполнить действие');return data;}

export function CatalogEditorPanel(){
 const [data,setData]=useState<State|null>(null),[tourId,setTourId]=useState(''),[payload,setPayload]=useState<EditorPayload|null>(null),[draft,setDraft]=useState<EditorDraft|null>(null),[amounts,setAmounts]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[actionBusy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[confirm,setConfirm]=useState<string|null>(null);
 const [imageSession,setImageSession]=useState(0);
 const tour=data?.tours.find(t=>t.id===tourId);
 const [selectedFileName,setSelectedFileName]=useState(''),[uploadStatus,setUploadStatus]=useState('');
 const imageUpload=useEditorImageUpload(path=>{if(payload)change({...payload,image:path});});
 const [creationBusy,setCreationBusy]=useState(false),[variantUploadBusy,setVariantUploadBusy]=useState(false);
 const busy=actionBusy||imageUpload.busy||creationBusy||variantUploadBusy;
 const fileInputId=useId(),fileNameId=fileInputId+'-name',uploadStatusId=fileInputId+'-status';
 async function read(){const next=await api<State>();setData(next);return next;}
 useEffect(()=>{let active=true;api<State>().then(next=>{if(active)setData(next);}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[]);
 function open(t:Tour,d:EditorDraft|null=null){setImageSession(n=>n+1);const p={...(d?.payload||editorPayload(t)),visible:d?.payload.visible??!t.hidden};setTourId(t.id);setPayload(structuredClone(p));setDraft(d);setAmounts(Object.fromEntries(p.variants.flatMap(v=>[...v.rates.map(r=>[r.id,r.amountMinor===null?'':String(r.amountMinor/100)]),...(v.newRates||[]).map((r,i)=>['new:'+v.id+':'+i,String(r.amountMinor/100)])])));setDirty(false);setConfirm(null);setMessage('');setSelectedFileName('');setUploadStatus('');imageUpload.reset();}
 function change(p:EditorPayload){setPayload(p);setDirty(true);setConfirm(null);}
 async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function save(){if(!data||!tour||!payload)return;await run(async()=>{for(const v of payload.variants){if(v.name!==undefined&&(!v.name.trim()||v.name.trim().length>500))throw Error('Название варианта: введите от 1 до 500 символов.');if(v.itinerary!==undefined){const valid=programmeItemsSchema.safeParse(v.itinerary);if(!valid.success)throw Error('Программа: '+valid.error.issues[0].message);}}const p={...payload,variants:payload.variants.map(v=>({...v,rates:v.rates.map(r=>({...r,amountMinor:sellingMinorUnits(amounts[r.id]??'')})),...(v.newRates?{newRates:v.newRates.flatMap((r,i)=>{const n=sellingMinorUnits(amounts['new:'+v.id+':'+i]??'');return n===null?[]:[{...r,amountMinor:n}];})}:{})}))};const saved=await api<EditorDraft>({action:'save',draft:{...(draft?{id:draft.id}:{}),revision:draft?.revision||0,productId:tour.id,baseReleaseId:draft?.baseReleaseId||data.state.release_id,baseGeneration:draft?.baseGeneration??data.state.generation,payload:p}});await read();open(tour,saved);setMessage('Изменения сохранены. Для показа на сайте нажмите «Опубликовать».');});}
 async function publish(){if(!draft||dirty)return;await run(async()=>{await api({action:'publish',id:draft.id,revision:draft.revision});const next=await read(),current=next.tours.find(t=>t.id===tourId);if(current)open(current);setConfirm(null);setMessage('Изменения опубликованы в каталоге.');});}
 async function upload(file:File){setSelectedFileName(file.name);await imageUpload.start(file);}

 const image=tour&&payload?tourCover({...tour,image:payload.image,imageAlt:payload.imageAlt}).src:null;
 return <section className={styles.editor} aria-label="Редактор каталога"><div className={styles.heading}><div><h2>Редактор экскурсий</h2></div><button type="button" disabled={busy||dirty} onClick={()=>run(async()=>{const next=await read(),t=next.tours.find(t=>t.id===tourId);if(t)open(t);})}>Обновить данные</button></div>
  <p role="status" className={styles.message}>{message}</p><CreateTourPanel disabled={actionBusy||imageUpload.busy||variantUploadBusy||dirty} onBusyChange={setCreationBusy} onPublished={async id=>{const next=await read(),t=next.tours.find(t=>t.id===id);if(t)open(t);}}/>
  {!data?<p>Загрузка каталога…</p>:<><label>Экскурсия<select aria-label="Экскурсия для редактирования" value={tourId} disabled={busy||dirty} onChange={e=>{const t=data.tours.find(t=>t.id===e.target.value);if(t)open(t,data.drafts.find(d=>d.productId===t.id&&d.status==='editing'&&d.baseReleaseId===data.state.release_id&&d.baseGeneration===data.state.generation)||null);}}><option value="">Выберите экскурсию</option>{data.tours.map(t=><option key={t.id} value={t.id}>{t.hidden?'Скрыта · ':''}{t.title}{' · '+(data.serviceCompanies[t.id]?.join(', ')||'Компания не указана')}</option>)}</select></label>
   {tour&&payload&&<div className={styles.form}><div className={styles.fields}>
    <fieldset><legend>Видимость карточки</legend><p role="status">{tour.hidden?'Сейчас скрыта с сайта':'Сейчас видна на сайте'}</p><label><select aria-label="Видимость после публикации" value={payload.visible===false?'hidden':'visible'} disabled={busy} onChange={e=>change({...payload,visible:e.target.value==='visible'})}><option value="visible">Показывать на сайте</option><option value="hidden">Скрыть с сайта</option></select></label><small>Изменение вступит в силу после сохранения и публикации. Данные и фотографии сохранятся.</small></fieldset>
    <label>Название<input value={payload.title} maxLength={500} disabled={busy} onChange={e=>change({...payload,title:e.target.value})}/></label>
    <label>Общее описание<textarea value={payload.description} rows={2} maxLength={10000} disabled={busy} onChange={e=>change({...payload,description:e.target.value})}/></label>
    <details className={styles.fold}><summary>Обложка и фотографии</summary><fieldset><legend>Обложка</legend><ImageGuidance id={fileInputId+'-guidance'} src={image} kind={tourCover({...tour,image:payload.image}).kind} compact={usesCompactTourLayout(tour)}/>
     <div className={styles.filePicker} data-busy={busy}>
      <label className={styles.fileChoose} htmlFor={fileInputId}>Выбрать фото</label>
      <input id={fileInputId} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={fileNameId+' '+uploadStatusId+' '+fileInputId+'-guidance'} disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);e.target.value='';}}/>
      <span id={fileNameId} className={styles.fileName}>{selectedFileName||(payload.image?.startsWith('/api/catalog-media/')?'Загруженная обложка':'Файл не выбран')}</span>
     </div>
     <p id={uploadStatusId} className={styles.uploadStatus} aria-live="polite" aria-atomic="true">{imageUpload.status||uploadStatus}</p>
     {imageUpload.busy&&<button type="button" onClick={imageUpload.cancel}>Отменить загрузку</button>}
     {imageUpload.retryable&&!busy&&<button type="button" onClick={imageUpload.retry}>Повторить загрузку</button>}
     <label>Описание изображения<input value={payload.imageAlt} maxLength={1000} disabled={busy} onChange={e=>change({...payload,imageAlt:e.target.value})}/></label><button type="button" disabled={busy} onClick={()=>{imageUpload.reset();change({...payload,image:null,imageAlt:''});setSelectedFileName('');setUploadStatus('Выбрана стандартная обложка.');}}>Вернуть стандартную обложку</button></fieldset></details>
    {tour.variants.map(v=>{const edit=payload.variants.find(x=>x.id===v.id)!;return <details key={v.id} className={styles.fold}><summary>{edit.name?.trim()||v.name}</summary><fieldset><legend>Настройки варианта</legend><label>Название варианта<input value={edit.name??v.name} maxLength={500} required aria-invalid={edit.name!==undefined&&!edit.name.trim()} disabled={busy} onChange={e=>change({...payload,variants:payload.variants.map(x=>x.id===v.id?{...x,name:e.target.value}:x)})}/></label><label><input type="checkbox" checked={edit.visible??(v.visible!==false)} disabled={busy} onChange={e=>change({...payload,variants:payload.variants.map(x=>x.id===v.id?{...x,visible:e.target.checked}:x)})}/>Показывать этот вариант на сайте</label><small>Выключенный вариант сохранится здесь, но исчезнет из выбора и новых заявок после публикации.</small><VariantImageEditor key={tour.id+':'+v.id+':'+imageSession} tour={tour} variant={{...v,name:edit.name??v.name,image:edit.image===undefined?v.image:edit.image,imageAlt:edit.imageAlt??v.imageAlt}} commonImage={payload.image} commonImageAlt={payload.imageAlt} disabled={busy} onBusyChange={setVariantUploadBusy} onChange={image=>change({...payload,variants:payload.variants.map(x=>x.id===v.id?{...x,...image}:x)})}/><label>Описание варианта<textarea value={edit.description} rows={2} maxLength={10000} disabled={busy} onChange={e=>change({...payload,variants:payload.variants.map(x=>x.id===v.id?{...x,description:e.target.value}:x)})}/></label><ProgrammeEditor variantName={edit.name?.trim()||v.name} items={edit.itinerary??v.itinerary} disabled={busy} onChange={itinerary=>change({...payload,variants:payload.variants.map(x=>x.id===v.id?{...x,itinerary}:x)})}/><SellingPriceFields variant={v} edit={edit} amounts={amounts} disabled={busy} onAmount={(key,value)=>{setAmounts({...amounts,[key]:value});setDirty(true);setConfirm(null);}} onChange={next=>change({...payload,variants:payload.variants.map(x=>x.id===v.id?next:x)})}/></fieldset></details>;})}
   </div><aside className={styles.actions}><h3>Изменения</h3><p>{dirty?'Есть несохранённые изменения.':'Нет несохранённых изменений.'}</p><button type="button" disabled={busy||!dirty} onClick={save}>Сохранить изменения</button><button type="button" disabled={busy||!dirty} onClick={()=>open(tour,draft)}>Отменить несохранённые изменения</button><button type="button" className={styles.publish} disabled={busy||dirty||!draft||draft.status!=='editing'} onClick={()=>setConfirm('publish')}>Опубликовать в каталоге</button>{confirm==='publish'&&<div className={styles.confirm}><p>Опубликовать изменения на сайте?</p><button disabled={busy} onClick={publish}>Подтвердить публикацию</button><button disabled={busy} onClick={()=>setConfirm(null)}>Отмена</button></div>}</aside></div>}


  </>}
 </section>;
}
