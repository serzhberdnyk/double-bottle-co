'use client';
import {useEffect,useId,useState} from 'react';
import {useEditorImageUpload} from '@/hooks/use-editor-image-upload';
import {variantImageTour} from '@/lib/public/variant-image';
import {tourCover} from '@/lib/public/tour-cover';
import {usesCompactTourLayout} from '@/lib/public/compact-tour';
import type {Tour,Variant} from '@/lib/public/types';
import {ImageGuidance} from './image-guidance';
import styles from './catalog-panel.module.css';

type Props={tour:Tour;variant:Variant;commonImage:string|null;commonImageAlt:string;disabled:boolean;onBusyChange:(busy:boolean)=>void;onChange:(image:{image:string|null;imageAlt:string})=>void};

export function VariantImageEditor({tour,variant,commonImage,commonImageAlt,disabled,onBusyChange,onChange}:Props){
 const id=useId(),[filename,setFilename]=useState('');
 const upload=useEditorImageUpload(image=>onChange({image,imageAlt:variant.imageAlt||''}));
 useEffect(()=>{onBusyChange(upload.busy);return()=>onBusyChange(false);},[upload.busy,onBusyChange]);
 const cover=tourCover(variantImageTour({...tour,image:commonImage,imageAlt:commonImageAlt},variant));
 return <fieldset><legend>Изображение варианта</legend><p>Меняется на странице экскурсии при выборе этой программы. Если отдельное изображение не выбрано, используется общая обложка.</p>
  <ImageGuidance id={id+'-guidance'} src={cover.src} kind={cover.kind} compact={usesCompactTourLayout(tour)}/>
  <div className={styles.filePicker} data-busy={disabled}><label className={styles.fileChoose} htmlFor={id}>Выбрать изображение для этого варианта</label><input id={id} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} aria-describedby={id+'-guidance '+id+'-name '+id+'-status'} onChange={e=>{const file=e.target.files?.[0];if(file){setFilename(file.name);void upload.start(file);}e.target.value='';}}/><span id={id+'-name'} className={styles.fileName}>{filename||(variant.image?'Загруженное изображение варианта':'Общая обложка')}</span></div>
  <p id={id+'-status'} className={styles.uploadStatus} aria-live="polite" aria-atomic="true">{upload.status}</p>
  {upload.busy&&<button type="button" onClick={upload.cancel}>Отменить загрузку изображения варианта</button>}
  {upload.retryable&&!disabled&&<button type="button" onClick={upload.retry}>Повторить загрузку изображения варианта</button>}
  {variant.image&&<label>Описание изображения варианта<input value={variant.imageAlt||''} maxLength={1000} disabled={disabled} onChange={e=>onChange({image:variant.image!,imageAlt:e.target.value})}/></label>}
  <button type="button" disabled={disabled||!variant.image} onClick={()=>{upload.reset();setFilename('');onChange({image:null,imageAlt:''});}}>Использовать общую обложку</button>
 </fieldset>;
}
