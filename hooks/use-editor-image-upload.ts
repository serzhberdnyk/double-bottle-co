'use client';
import {useEffect,useRef,useState} from 'react';
import {uploadEditorImage} from '../lib/public/prepare-editor-image';

export function useEditorImageUpload(onComplete:(path:string)=>void){
 const active=useRef<AbortController|null>(null),lastFile=useRef<File|null>(null);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[retryable,setRetryable]=useState(false);
 useEffect(()=>()=>{active.current?.abort();active.current=null;},[]);
 function cancel(){active.current?.abort();active.current=null;setBusy(false);setStatus('Загрузка отменена. Можно повторить или выбрать другой файл.');setRetryable(!!lastFile.current);}
 function reset(){active.current?.abort();active.current=null;lastFile.current=null;setBusy(false);setStatus('');setRetryable(false);}
 async function start(file:File){
  active.current?.abort();const controller=new AbortController();active.current=controller;lastFile.current=file;
  setBusy(true);setRetryable(false);setStatus('Подготовка изображения…');
  try{
   const path=await uploadEditorImage(file,controller.signal,message=>{if(active.current===controller)setStatus(message);});
   if(active.current!==controller||controller.signal.aborted)return;
   onComplete(path);setStatus('Изображение загружено. Сохраните черновик.');lastFile.current=null;
  }catch(error){
   if(active.current!==controller)return;
   setStatus(controller.signal.aborted?'Загрузка отменена.':error instanceof Error?error.message:'Не удалось загрузить изображение.');setRetryable(true);
  }finally{if(active.current===controller){active.current=null;setBusy(false);}}
 }
 return {busy,status,retryable,start,cancel,reset,retry:()=>{if(lastFile.current)void start(lastFile.current);}};
}
