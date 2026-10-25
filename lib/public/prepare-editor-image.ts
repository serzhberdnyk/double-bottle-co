import {MAX_EDITOR_IMAGE_BYTES,MAX_EDITOR_IMAGE_EDGE,MAX_SOURCE_IMAGE_BYTES,MAX_SOURCE_IMAGE_PIXELS,MAX_SOURCE_IMAGE_EDGE} from './editor-image-limits';

export type ImageProgress = (message:string)=>void;
const invalid = ()=>new Error('Не удалось прочитать изображение. Файл повреждён или имеет неподдерживаемый формат.');
export function checkImageAbort(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Загрузка отменена.','AbortError');}

// Inspect the bounded compressed input BEFORE allocating a decoded bitmap/canvas.
export function sourceImageSize(bytes:Uint8Array,type:string){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=bytes.length;
 const text=(i:number,count:number)=>String.fromCharCode(...bytes.slice(i,i+count));
 let width=0,height=0;
 if(type==='image/png'&&n>=33&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&text(12,4)==='IHDR'){
  width=view.getUint32(16);height=view.getUint32(20);
  for(let i=8;i+12<=n;){const length=view.getUint32(i);if(length>n-i-12)break;if(text(i+4,4)==='acTL')throw new Error('Выберите неподвижное изображение JPEG, PNG или WebP.');i+=12+length;}
 }else if(type==='image/jpeg'&&n>=4&&bytes[0]===255&&bytes[1]===216){
  let i=2;
  while(i+3<n){
   if(bytes[i++]!==255)throw invalid();while(i<n&&bytes[i]===255)i++;
   const marker=bytes[i++];if(marker===218||marker===217)break;
   if(marker===1||(marker>=208&&marker<=215))continue;
   if(i+2>n)throw invalid();const length=view.getUint16(i);
   if(length<2||i+length>n)throw invalid();
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
    if(length<8)throw invalid();height=view.getUint16(i+3);width=view.getUint16(i+5);break;
   }i+=length;
  }
 }else if(type==='image/webp'&&n>=20&&text(0,4)==='RIFF'&&text(8,4)==='WEBP'){
  if(view.getUint32(4,true)+8!==n)throw invalid();
  for(let i=12;i+8<=n;){
   const chunk=text(i,4),length=view.getUint32(i+4,true),p=i+8;
   if(p+length>n)throw invalid();
   if(chunk==='VP8X'&&length>=10){
    if(bytes[p]&2)throw new Error('Выберите неподвижное изображение JPEG, PNG или WebP.');
    width=1+bytes[p+4]+bytes[p+5]*256+bytes[p+6]*65536;height=1+bytes[p+7]+bytes[p+8]*256+bytes[p+9]*65536;break;
   }
   if(chunk==='VP8 '&&length>=10&&bytes[p+3]===157&&bytes[p+4]===1&&bytes[p+5]===42){width=view.getUint16(p+6,true)&16383;height=view.getUint16(p+8,true)&16383;break;}
   if(chunk==='VP8L'&&length>=5&&bytes[p]===47){const bits=view.getUint32(p+1,true);width=1+(bits&16383);height=1+((bits>>>14)&16383);break;}
   i=p+length+(length%2);
  }
 }
 if(!width||!height)throw invalid();
 if(width>MAX_SOURCE_IMAGE_EDGE||height>MAX_SOURCE_IMAGE_EDGE||width*height>MAX_SOURCE_IMAGE_PIXELS)throw new Error('Изображение слишком большое для обработки: максимум 40 Мп и 16384 px по стороне. Выберите уменьшенную копию.');
 return {width,height};
}

export async function prepareImage(file:File,options:{signal?:AbortSignal;onProgress?:ImageProgress}={}){
 const {signal,onProgress=()=>{}}=options;checkImageAbort(signal);
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Поддерживаются JPEG, PNG и WebP. HEIC и SVG сначала сохраните в одном из этих форматов.');
 if(!file.size||file.size>MAX_SOURCE_IMAGE_BYTES)throw new Error('Выберите непустое изображение до 20 МБ.');
 onProgress('Проверка изображения…');
 const bytes=new Uint8Array(await file.arrayBuffer());checkImageAbort(signal);sourceImageSize(bytes,file.type);
 const url=URL.createObjectURL(file),image=new Image(),canvas=document.createElement('canvas');
 const abort=()=>{image.src='';};signal?.addEventListener('abort',abort,{once:true});
 try{
  onProgress('Чтение изображения…');image.src=url;
  // HTML image decoding applies EXIF orientation before drawImage in supported browsers.
  try{await image.decode();}catch{checkImageAbort(signal);throw invalid();}
  checkImageAbort(signal);
  const w=image.naturalWidth,h=image.naturalHeight;
  if(!w||!h||w*h>MAX_SOURCE_IMAGE_PIXELS||Math.max(w,h)>MAX_SOURCE_IMAGE_EDGE)throw invalid();
  if(file.size<=MAX_EDITOR_IMAGE_BYTES&&Math.max(w,h)<=MAX_EDITOR_IMAGE_EDGE)return file;
  const context=canvas.getContext('2d');if(!context)throw new Error('Браузер не поддерживает обработку изображений. Попробуйте другой браузер.');
  let edge=Math.min(MAX_EDITOR_IMAGE_EDGE,Math.max(w,h));
  for(;;){
   checkImageAbort(signal);const scale=edge/Math.max(w,h);
   canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
   context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
   context.drawImage(image,0,0,canvas.width,canvas.height);
   onProgress(`Подгонка изображения: ${canvas.width} × ${canvas.height}…`);
   // PNG fallback keeps alpha if WebP encoding is unavailable. Never flatten icons to JPEG.
   for(const quality of [.9,.78,.64,.5]){
    checkImageAbort(signal);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    checkImageAbort(signal);
    if(!blob)throw new Error('Не удалось сжать изображение. Попробуйте другой файл.');
    if(!['image/webp','image/png'].includes(blob.type))throw invalid();
    if(blob.size>0&&blob.size<=MAX_EDITOR_IMAGE_BYTES)return blob;
    if(blob.type==='image/png')break;
   }
   if(edge===1)break;edge=Math.max(1,Math.floor(edge*.75));
  }
  throw new Error('Не удалось подогнать изображение под 512 КБ. Выберите другой файл.');
 }finally{signal?.removeEventListener('abort',abort);image.src='';URL.revokeObjectURL(url);canvas.width=canvas.height=1;}
}

export async function uploadEditorImage(file:File,signal:AbortSignal,onProgress:ImageProgress){
 const image=await prepareImage(file,{signal,onProgress});checkImageAbort(signal);
 onProgress('Отправка изображения…');
 const response=await fetch('/api/admin/catalog/media',{method:'POST',headers:{'Content-Type':image.type},body:image,signal});
 const result=await response.json() as {path?:string;error?:string};checkImageAbort(signal);
 if(!response.ok||!result.path)throw new Error(result.error||'Не удалось загрузить изображение. Проверьте соединение и повторите.');
 return result.path;
}
