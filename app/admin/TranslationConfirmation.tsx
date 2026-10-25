'use client';
import {useEffect,useId,useRef} from 'react';
export function TranslationConfirmation({count,busy,onConfirm,onCancel,children}:{count:number;busy:boolean;onConfirm:()=>void;onCancel:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),title=useId(),description=useId(),submitted=useRef(false);useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);
 return <dialog ref={ref} aria-labelledby={title} aria-describedby={description} onCancel={event=>{event.preventDefault();if(!busy&&!submitted.current)onCancel();}} style={{maxWidth:'min(800px,90vw)',maxHeight:'85vh',overflow:'auto'}}><h3 id={title}>Публикация переводов: {count}</h3><p id={description}>Переводы появятся на публичном сайте. Русские данные, цены, маршруты и доступы не изменятся.</p>{children}<div><button autoFocus disabled={busy} onClick={()=>{if(!busy&&!submitted.current)onCancel();}}>Отмена</button><button disabled={busy} onClick={()=>{if(busy||submitted.current)return;submitted.current=true;onConfirm();}}>{busy?'Публикуем…':'Подтвердить публикацию переводов'}</button></div></dialog>;
}
